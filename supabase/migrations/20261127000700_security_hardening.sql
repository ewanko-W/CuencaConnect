-- Security hardening from the security review (docs/security-review.md).
--
-- 1. Rate limit: at most 10 reports per resident per rolling hour
--    (offline retries of an existing report are not counted).
-- 2. Photo uploads: only into "<own user id>/<client uuid of an OWN report
--    that is still 'submitted'>/<file>", at most 3 files per report, so the
--    bucket cannot be used for arbitrary storage. Size (5 MB) and MIME type
--    (JPEG/PNG/WebP) are enforced by the bucket itself.
-- 3. Input validation: no control characters in display names, alert
--    titles, or report descriptions (newlines and tabs remain allowed in
--    descriptions); a sane upper bound for GPS accuracy.

-------------------------------------------------------------------------------
-- 1. submit_report with a rate limit
-------------------------------------------------------------------------------
create or replace function public.submit_report(
  p_client_uuid uuid,
  p_category public.report_category,
  p_description text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real default null,
  p_location_source text default 'gps',
  p_barangay_id smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to submit a report' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_verified() then
    raise exception 'ID verification is required before submitting reports'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent retry from the offline outbox (checked before the rate limit).
  select r.id into v_id from public.reports r
  where r.client_uuid = p_client_uuid and r.reporter_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  if (select count(*) from public.reports r
      where r.reporter_id = v_uid and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many reports in the last hour. For emergencies, call 911 or a hotline in the directory.'
      using errcode = 'program_limit_exceeded';
  end if;

  if not public.is_within_cuenca(p_lat, p_lng) then
    raise exception 'The location is outside the Municipality of Cuenca'
      using errcode = 'check_violation';
  end if;

  insert into public.reports
    (client_uuid, reporter_id, category, description, lat, lng, gps_accuracy_m, location_source, barangay_id)
  values
    (p_client_uuid, v_uid, p_category, btrim(p_description), p_lat, p_lng, p_accuracy_m, p_location_source,
     coalesce(p_barangay_id, public.my_barangay_id()))
  returning id into v_id;

  return v_id;
end;
$$;

-------------------------------------------------------------------------------
-- 2. Photo uploads tied to the uploader's own open report
-------------------------------------------------------------------------------
create function public.can_upload_report_photo(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_verified()
    and array_length(storage.foldername(p_object_name), 1) = 2
    and (storage.foldername(p_object_name))[1] = auth.uid()::text
    and exists (
      select 1 from public.reports r
      where r.client_uuid::text = (storage.foldername(p_object_name))[2]
        and r.reporter_id = auth.uid()
        and r.status = 'submitted'
    )
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'report-media'
        and (storage.foldername(o.name))[1] = auth.uid()::text
        and (storage.foldername(o.name))[2] = (storage.foldername(p_object_name))[2]
    ) < 3
$$;

revoke execute on function public.can_upload_report_photo(text) from public, anon;
grant execute on function public.can_upload_report_photo(text) to authenticated;

drop policy report_media_upload_own on storage.objects;

create policy report_media_upload_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'report-media' and (select public.can_upload_report_photo(name)));

-- No UPDATE or DELETE policies exist on report-media: uploaded evidence
-- cannot be overwritten or removed through the API.

-------------------------------------------------------------------------------
-- 3. Input validation
-------------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_printable check (display_name !~ '[[:cntrl:]]');

alter table public.alerts
  add constraint alerts_title_printable check (title !~ '[[:cntrl:]]');

alter table public.reports
  add constraint reports_description_printable
    check (description !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  add constraint reports_gps_accuracy_bound
    check (gps_accuracy_m is null or gps_accuracy_m <= 10000);
