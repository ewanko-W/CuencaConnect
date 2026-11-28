-- Reports, status history, report media (Storage), and Confirm/Dispute votes.
--
-- Rules enforced here (see CLAUDE.md):
--   * Only ID-verified residents submit reports and vote.
--   * Reports are inside the municipality (approximate bounding box until
--     official boundaries are loaded).
--   * One vote per user per report (primary key); a vote may be changed
--     between confirm and dispute or withdrawn, never duplicated.
--   * No voting on one's own report or on closed reports.
--   * Votes never hide a report from admins (admin SELECT has no vote filter).
--   * Other residents see only an anonymized, approximate summary
--     (nearby_reports); never the reporter, description, or photos.

-------------------------------------------------------------------------------
-- Types
-------------------------------------------------------------------------------
create type public.report_category as enum
  ('fire', 'flood', 'medical', 'crime', 'road', 'utilities', 'waste', 'other');
create type public.report_severity as enum ('low', 'medium', 'high', 'critical');
create type public.report_status as enum
  ('submitted', 'routed', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'duplicate');
create type public.vote_type as enum ('confirm', 'dispute');

-------------------------------------------------------------------------------
-- Geography helpers
-------------------------------------------------------------------------------
-- Approximate bounding box of the Municipality of Cuenca, Batangas.
-- Replace with ST_Contains on official barangay boundaries when available.
create function public.is_within_cuenca(lat double precision, lng double precision)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lat between 13.84 and 13.98 and lng between 120.98 and 121.12
$$;

create function public.is_active_report_status(s public.report_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s in ('submitted', 'routed', 'acknowledged', 'in_progress')
$$;

-------------------------------------------------------------------------------
-- Reports
-------------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Generated on the device; makes offline retries idempotent.
  client_uuid uuid not null unique,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  category public.report_category not null,
  description text not null check (char_length(btrim(description)) between 10 and 1000),
  lat double precision not null,
  lng double precision not null,
  location extensions.geography(Point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  location_source text not null default 'gps' check (location_source in ('gps', 'adjusted', 'manual')),
  gps_accuracy_m real check (gps_accuracy_m is null or gps_accuracy_m >= 0),
  barangay_id smallint references public.barangays (id),
  -- Set by keyword triage (later phase); null means not yet triaged.
  severity public.report_severity,
  is_critical boolean not null default false,
  matched_keywords text[] not null default '{}',
  suggested_office_id smallint references public.offices (id),
  assigned_office_id smallint references public.offices (id),
  status public.report_status not null default 'submitted',
  confirm_count integer not null default 0 check (confirm_count >= 0),
  dispute_count integer not null default 0 check (dispute_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_within_cuenca check (public.is_within_cuenca(lat, lng))
);

create index reports_location_idx on public.reports using gist (location);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);
create index reports_status_idx on public.reports (status, is_critical, created_at desc);
create index reports_assigned_office_idx on public.reports (assigned_office_id) where assigned_office_id is not null;

create trigger reports_touch_updated_at
  before update on public.reports
  for each row execute function public.touch_updated_at();

-------------------------------------------------------------------------------
-- Status history (timeline). Written only by trigger.
-------------------------------------------------------------------------------
create table public.report_status_history (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  status public.report_status not null,
  -- Shown to the reporter; set by status-changing RPCs via cc.status_note.
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index report_status_history_report_idx on public.report_status_history (report_id, created_at);

create function public.record_report_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.report_status_history (report_id, status, note)
    values (new.id, new.status, nullif(current_setting('cc.status_note', true), ''));
  end if;
  return null;
end;
$$;

create trigger reports_record_status
  after insert or update of status on public.reports
  for each row execute function public.record_report_status();

-------------------------------------------------------------------------------
-- submit_report: the only way for residents to create a report.
-------------------------------------------------------------------------------
create function public.submit_report(
  p_client_uuid uuid,
  p_category public.report_category,
  p_description text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real default null,
  p_location_source text default 'gps'
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

  -- Idempotent retry from the offline outbox.
  select r.id into v_id from public.reports r
  where r.client_uuid = p_client_uuid and r.reporter_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  if not public.is_within_cuenca(p_lat, p_lng) then
    raise exception 'The location is outside the Municipality of Cuenca'
      using errcode = 'check_violation';
  end if;

  insert into public.reports
    (client_uuid, reporter_id, category, description, lat, lng, gps_accuracy_m, location_source)
  values
    (p_client_uuid, v_uid, p_category, btrim(p_description), p_lat, p_lng, p_accuracy_m, p_location_source)
  returning id into v_id;

  return v_id;
end;
$$;

-------------------------------------------------------------------------------
-- Report media (photos in the private "report-media" bucket)
-------------------------------------------------------------------------------
create table public.report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index report_media_report_idx on public.report_media (report_id);

create function public.limit_report_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.report_media m where m.report_id = new.report_id) >= 3 then
    raise exception 'A report can have at most 3 photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger report_media_limit
  before insert on public.report_media
  for each row execute function public.limit_report_media();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-media', 'report-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Files live under "<user id>/<client uuid>/<file>".
create policy report_media_upload_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_verified())
  );

create policy report_media_read_own_or_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-media'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-------------------------------------------------------------------------------
-- Votes: Confirm / Dispute
-------------------------------------------------------------------------------
create table public.report_votes (
  report_id uuid not null references public.reports (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  vote public.vote_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (report_id, voter_id) -- one vote per user per report
);

create index report_votes_voter_idx on public.report_votes (voter_id);

create function public.check_report_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter uuid;
  v_status public.report_status;
begin
  if tg_op = 'UPDATE' and (new.report_id <> old.report_id or new.voter_id <> old.voter_id) then
    raise exception 'A vote cannot be moved to another report or user' using errcode = 'check_violation';
  end if;

  select r.reporter_id, r.status into v_reporter, v_status
  from public.reports r where r.id = new.report_id;

  if v_reporter = new.voter_id then
    raise exception 'You cannot vote on your own report' using errcode = 'check_violation';
  end if;
  if not public.is_active_report_status(v_status) then
    raise exception 'Voting is closed for this report' using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger report_votes_check
  before insert or update on public.report_votes
  for each row execute function public.check_report_vote();

-- Keep denormalized counts on reports (voters cannot update reports).
create function public.refresh_report_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report uuid := coalesce(new.report_id, old.report_id);
begin
  update public.reports r set
    confirm_count = (select count(*) from public.report_votes v where v.report_id = v_report and v.vote = 'confirm'),
    dispute_count = (select count(*) from public.report_votes v where v.report_id = v_report and v.vote = 'dispute')
  where r.id = v_report;
  return null;
end;
$$;

create trigger report_votes_refresh_counts
  after insert or update or delete on public.report_votes
  for each row execute function public.refresh_report_vote_counts();

-- cast_vote: insert or switch the caller's single vote. SECURITY INVOKER,
-- so RLS (verified residents only) and the triggers above apply.
create function public.cast_vote(p_report_id uuid, p_vote public.vote_type)
returns table (confirm_count integer, dispute_count integer, my_vote public.vote_type)
language plpgsql
set search_path = ''
as $$
begin
  insert into public.report_votes as v (report_id, voter_id, vote)
  values (p_report_id, auth.uid(), p_vote)
  on conflict (report_id, voter_id) do update set vote = excluded.vote
  where v.vote is distinct from excluded.vote;

  return query
    select r.confirm_count, r.dispute_count, p_vote
    from public.vote_counts(p_report_id) r;
end;
$$;

create function public.withdraw_vote(p_report_id uuid)
returns table (confirm_count integer, dispute_count integer, my_vote public.vote_type)
language plpgsql
set search_path = ''
as $$
begin
  delete from public.report_votes v where v.report_id = p_report_id and v.voter_id = auth.uid();
  return query
    select r.confirm_count, r.dispute_count, null::public.vote_type
    from public.vote_counts(p_report_id) r;
end;
$$;

-- Counts for any active report (voters cannot SELECT other people's reports).
create function public.vote_counts(p_report_id uuid)
returns table (confirm_count integer, dispute_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.confirm_count, r.dispute_count from public.reports r where r.id = p_report_id
$$;

-------------------------------------------------------------------------------
-- nearby_reports: anonymized map data for verified residents and staff.
-------------------------------------------------------------------------------
create function public.nearby_reports(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 3000
)
returns table (
  id uuid,
  category public.report_category,
  status public.report_status,
  approx_lat double precision,
  approx_lng double precision,
  distance_m integer,
  created_at timestamptz,
  confirm_count integer,
  dispute_count integer,
  my_vote public.vote_type,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_center extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_radius integer := least(greatest(coalesce(p_radius_m, 3000), 100), 10000);
begin
  if not (public.is_verified() or public.is_admin() or public.is_office_staff()) then
    raise exception 'ID verification is required to view nearby incidents'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      r.id,
      r.category,
      r.status,
      -- Snap to a ~55 m grid so a reporter's exact position (e.g., home) is not exposed.
      round(r.lat * 2000) / 2000.0,
      round(r.lng * 2000) / 2000.0,
      extensions.st_distance(r.location, v_center)::integer,
      r.created_at,
      r.confirm_count,
      r.dispute_count,
      (select v.vote from public.report_votes v where v.report_id = r.id and v.voter_id = v_uid),
      r.reporter_id = v_uid
    from public.reports r
    where public.is_active_report_status(r.status)
      and extensions.st_dwithin(r.location, v_center, v_radius)
    order by r.created_at desc
    limit 200;
end;
$$;

-------------------------------------------------------------------------------
-- Privileges
-------------------------------------------------------------------------------
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated; -- inserts only via submit_report

revoke all on public.report_status_history from anon, authenticated;
grant select on public.report_status_history to authenticated;

revoke all on public.report_media from anon, authenticated;
grant select, insert on public.report_media to authenticated;

revoke all on public.report_votes from anon, authenticated;
grant select, insert, delete on public.report_votes to authenticated;
grant update (vote) on public.report_votes to authenticated;

revoke execute on function public.submit_report(uuid, public.report_category, text, double precision, double precision, real, text) from public, anon;
revoke execute on function public.nearby_reports(double precision, double precision, integer) from public, anon;
revoke execute on function public.cast_vote(uuid, public.vote_type) from public, anon;
revoke execute on function public.withdraw_vote(uuid) from public, anon;
revoke execute on function public.vote_counts(uuid) from public, anon;
grant execute on function public.submit_report(uuid, public.report_category, text, double precision, double precision, real, text) to authenticated;
grant execute on function public.nearby_reports(double precision, double precision, integer) to authenticated;
grant execute on function public.cast_vote(uuid, public.vote_type) to authenticated;
grant execute on function public.withdraw_vote(uuid) to authenticated;
grant execute on function public.vote_counts(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.report_status_history enable row level security;
alter table public.report_media enable row level security;
alter table public.report_votes enable row level security;

-- reports
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

-- Admins see every report, critical or not, with no filter on votes.
create policy reports_select_admin on public.reports
  for select to authenticated
  using ((select public.is_admin()));

create policy reports_select_office on public.reports
  for select to authenticated
  using ((select public.is_office_staff()) and assigned_office_id = (select public.my_office_id()));

-- report_status_history follows report visibility
create policy report_status_history_select on public.report_status_history
  for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));

-- report_media
create policy report_media_select on public.report_media
  for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));

create policy report_media_insert_own on public.report_media
  for insert to authenticated
  with check (
    (select public.is_verified())
    and uploaded_by = (select auth.uid())
    and storage_path like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.reports r
      where r.id = report_id and r.reporter_id = (select auth.uid()) and r.status = 'submitted'
    )
  );

-- report_votes
create policy report_votes_select_own on public.report_votes
  for select to authenticated
  using (voter_id = (select auth.uid()));

create policy report_votes_select_admin on public.report_votes
  for select to authenticated
  using ((select public.is_admin()));

create policy report_votes_insert_verified on public.report_votes
  for insert to authenticated
  with check (voter_id = (select auth.uid()) and (select public.is_verified()));

create policy report_votes_update_own on public.report_votes
  for update to authenticated
  using (voter_id = (select auth.uid()))
  with check (voter_id = (select auth.uid()) and (select public.is_verified()));

create policy report_votes_delete_own on public.report_votes
  for delete to authenticated
  using (voter_id = (select auth.uid()));
