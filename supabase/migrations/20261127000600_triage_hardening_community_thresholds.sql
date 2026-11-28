-- Keyword triage hardening and community verification thresholds.
--
-- Triage (Postgres, not an Edge Function, so it runs in the same
-- transaction as the insert and cannot be bypassed):
--   * Text and keywords are normalized the same way (case, accents,
--     whitespace) before whole-word matching, so "SUNOG!!!", "Sunóg" and
--     "🔥sunog🔥" all match "sunog", while "bahay" never matches "baha".
--   * A report that matches a critical keyword is marked critical.
--   * Escalate-only: re-triage can raise severity but never lowers it or
--     clears is_critical. Neither votes nor keyword edits can "un-critical"
--     an incident; only an admin decision on status closes it.
--   * When the keyword lists change, open reports that the new lists would
--     escalate are re-triaged immediately (and the re-triage is audited).
--   * Safety-first: negated mentions ("walang sunog", "no fire") are still
--     flagged. In emergency triage a false alarm costs an admin a minute;
--     a missed fire costs far more. Admins can reject false alarms.
--
-- Community verification (Confirm/Dispute votes):
--   * confirmed: confirms >= min_confirms and confirms >= ratio x disputes
--   * disputed:  disputes >= min_disputes and disputes >= ratio x confirms
--   * pending:   otherwise
--   * Disputed NON-critical reports leave the residents' nearby map.
--     Critical reports are NEVER hidden by disputes: they stay on the map
--     (labelled disputed), in every admin view, and keep their severity.

-------------------------------------------------------------------------------
-- Normalization and matching
-------------------------------------------------------------------------------
create function public.triage_normalize(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    lower(translate(coalesce(t, ''),
      'ÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑáàâäãéèêëíìîïóòôöõúùûüñ',
      'AAAAAEEEEIIIIOOOOOUUUUNaaaaaeeeeiiiiooooouuuun')),
    '\s+', ' ', 'g'))
$$;

create or replace function public.triage_text(p_text text, p_category public.report_category)
returns table (
  severity public.report_severity,
  is_critical boolean,
  matched_keywords text[],
  suggested_category public.report_category,
  suggested_office_id smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_text text := public.triage_normalize(p_text);
  v_max public.report_severity;
  v_terms text[];
  v_hint public.report_category;
  v_category public.report_category;
begin
  select max(k.severity),
         coalesce(array_agg(k.term order by public.severity_rank(k.severity) desc, k.term), '{}'),
         (array_agg(k.category order by public.severity_rank(k.severity) desc) filter (where k.category is not null))[1]
    into v_max, v_terms, v_hint
  from public.keywords k
  where k.is_active
    and v_text ~ ('\m' || public.triage_normalize(k.term) || '\M');

  severity := greatest(public.category_base_severity(p_category), v_max);
  is_critical := severity = 'critical';
  matched_keywords := v_terms;
  v_category := case when p_category = 'other' then coalesce(v_hint, 'other') else p_category end;
  suggested_category := v_category;
  select o.id into suggested_office_id
  from public.offices o
  where o.is_active and v_category = any (o.handles_categories)
  order by o.id
  limit 1;
  return next;
end;
$$;

revoke execute on function public.triage_text(text, public.report_category) from public, anon, authenticated;

-- Escalate-only on re-triage.
create or replace function public.triage_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select * into t from public.triage_text(new.description, new.category);

  if tg_op = 'INSERT' then
    new.severity := t.severity;
    new.is_critical := t.is_critical;
    new.matched_keywords := t.matched_keywords;
    new.suggested_office_id := t.suggested_office_id;
  else
    new.severity := greatest(old.severity, t.severity);
    new.is_critical := old.is_critical or t.is_critical;
    new.matched_keywords := array(
      select distinct term from unnest(old.matched_keywords || t.matched_keywords) as term order by term
    );
    new.suggested_office_id := coalesce(t.suggested_office_id, old.suggested_office_id);
  end if;
  -- assigned_office_id is deliberately untouched: routing is an admin decision.
  return new;
end;
$$;

-- Re-triage open reports that the edited keyword lists would escalate.
create function public.retriage_after_keyword_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_newly_critical integer;
begin
  select coalesce(array_agg(r.id), '{}'),
         count(*) filter (where x.is_critical and not r.is_critical)
    into v_ids, v_newly_critical
  from public.reports r
  cross join lateral public.triage_text(r.description, r.category) x
  where public.is_active_report_status(r.status)
    and public.severity_rank(x.severity) > public.severity_rank(r.severity);

  if cardinality(v_ids) > 0 then
    update public.reports set description = description where id = any (v_ids);
    perform public.write_audit(
      'reports.retriaged', 'reports', null, null,
      jsonb_build_object('escalated', cardinality(v_ids), 'newly_critical', v_newly_critical, 'report_ids', to_jsonb(v_ids))
    );
  end if;
  return null;
end;
$$;

create trigger keywords_retriage_open_reports
  after insert or update or delete on public.keywords
  for each statement execute function public.retriage_after_keyword_change();

-------------------------------------------------------------------------------
-- Community verification thresholds (single row, admin-editable)
-------------------------------------------------------------------------------
create type public.community_status as enum ('pending', 'confirmed', 'disputed');

create table public.community_thresholds (
  id boolean primary key default true check (id), -- exactly one row
  min_confirms smallint not null default 3 check (min_confirms between 1 and 100),
  min_disputes smallint not null default 3 check (min_disputes between 1 and 100),
  dominance_ratio numeric(3, 1) not null default 2.0 check (dominance_ratio between 1.0 and 10.0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.community_thresholds is
  'Confirmed: confirms >= min_confirms and >= ratio x disputes. Disputed: disputes >= min_disputes and >= ratio x confirms.';

insert into public.community_thresholds default values;

create function public.community_status_for(p_confirms integer, p_disputes integer)
returns public.community_status
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_confirms >= t.min_confirms and p_confirms >= t.dominance_ratio * p_disputes then 'confirmed'
    when p_disputes >= t.min_disputes and p_disputes >= t.dominance_ratio * p_confirms then 'disputed'
    else 'pending'
  end::public.community_status
  from public.community_thresholds t
$$;

alter table public.reports
  add column community_status public.community_status not null default 'pending';

update public.reports set community_status = public.community_status_for(confirm_count, dispute_count);

create index reports_community_status_idx on public.reports (community_status) where community_status <> 'pending';

-- Votes: keep counts AND community status current. Never touches severity or is_critical.
create or replace function public.refresh_report_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report uuid := coalesce(new.report_id, old.report_id);
  v_confirms integer;
  v_disputes integer;
begin
  select count(*) filter (where v.vote = 'confirm'), count(*) filter (where v.vote = 'dispute')
    into v_confirms, v_disputes
  from public.report_votes v where v.report_id = v_report;

  update public.reports r set
    confirm_count = v_confirms,
    dispute_count = v_disputes,
    community_status = public.community_status_for(v_confirms, v_disputes)
  where r.id = v_report;
  return null;
end;
$$;

create function public.touch_thresholds()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger community_thresholds_touch
  before update on public.community_thresholds
  for each row execute function public.touch_thresholds();

-- New thresholds apply to every report at once.
create function public.recompute_community_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reports r
    set community_status = public.community_status_for(r.confirm_count, r.dispute_count)
  where r.community_status is distinct from public.community_status_for(r.confirm_count, r.dispute_count);
  return null;
end;
$$;

create trigger community_thresholds_recompute
  after update on public.community_thresholds
  for each statement execute function public.recompute_community_status();

create trigger community_thresholds_audit
  after insert or update or delete on public.community_thresholds
  for each row execute function public.audit_row_change();

revoke all on public.community_thresholds from anon, authenticated;
grant select on public.community_thresholds to authenticated;
grant update (min_confirms, min_disputes, dominance_ratio) on public.community_thresholds to authenticated;
alter table public.community_thresholds enable row level security;

create policy community_thresholds_select on public.community_thresholds
  for select to authenticated
  using (true);

create policy community_thresholds_update_admin on public.community_thresholds
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-------------------------------------------------------------------------------
-- Nearby map: hide disputed NON-critical reports; never hide critical ones.
-------------------------------------------------------------------------------
drop function public.nearby_reports(double precision, double precision, integer);

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
  is_mine boolean,
  is_critical boolean,
  community_status public.community_status
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
      round(r.lat * 2000) / 2000.0,
      round(r.lng * 2000) / 2000.0,
      extensions.st_distance(r.location, v_center)::integer,
      r.created_at,
      r.confirm_count,
      r.dispute_count,
      (select v.vote from public.report_votes v where v.report_id = r.id and v.voter_id = v_uid),
      r.reporter_id = v_uid,
      r.is_critical,
      r.community_status
    from public.reports r
    where public.is_active_report_status(r.status)
      and extensions.st_dwithin(r.location, v_center, v_radius)
      and (r.community_status <> 'disputed' or r.is_critical or r.reporter_id = v_uid)
    order by r.is_critical desc, r.created_at desc
    limit 200;
end;
$$;

revoke execute on function public.nearby_reports(double precision, double precision, integer) from public, anon;
grant execute on function public.nearby_reports(double precision, double precision, integer) to authenticated;
