-- Admin Command Center: audit log, keyword triage, priority, centralized
-- routing, status updates, and alert broadcasting rules.
--
-- Rules enforced here (see CLAUDE.md):
--   * Every admin action is written to audit_log, which is append-only.
--   * Keyword triage uses editable English and Filipino lists stored in the
--     database; it sets severity, is_critical, matched_keywords, and ONLY
--     suggested_office_id (never assigned_office_id).
--   * Only admins route reports (route_report), which writes
--     routing_history and audit_log.
--   * Status changes go through set_report_status, which validates the
--     transition and writes the timeline and audit_log.

-------------------------------------------------------------------------------
-- Audit log (append-only)
-------------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  -- No foreign key on purpose: deleting a user (e.g., a Data Privacy Act
  -- erasure request) must not be blocked, and the log must not be rewritten.
  actor_id uuid,
  action text not null check (char_length(action) between 3 and 60),
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_action_idx on public.audit_log (action, created_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

create function public.prevent_audit_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_log_change();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.prevent_audit_log_change();

-- Internal helper used by RPCs; not callable by clients.
create function public.write_audit(
  p_action text,
  p_table text,
  p_record_id text,
  p_old jsonb,
  p_new jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), p_action, p_table, p_record_id, p_old, p_new)
$$;

-- Generic row-change audit for admin-managed tables.
create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger alerts_audit after insert or update or delete on public.alerts
  for each row execute function public.audit_row_change();
create trigger offices_audit after insert or update or delete on public.offices
  for each row execute function public.audit_row_change();
create trigger barangays_audit after insert or update or delete on public.barangays
  for each row execute function public.audit_row_change();

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
alter table public.audit_log enable row level security;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select public.is_admin()));

-- Audit entries with the actor's display name (RLS of both tables applies).
create view public.audit_log_entries
with (security_invoker = true) as
  select a.id, a.created_at, a.action, a.table_name, a.record_id, a.old_data, a.new_data,
         a.actor_id, p.display_name as actor_name, p.role as actor_role
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id;

revoke all on public.audit_log_entries from anon, authenticated;
grant select on public.audit_log_entries to authenticated;

revoke execute on function public.write_audit(text, text, text, jsonb, jsonb) from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Offices handle categories (used to suggest an office)
-------------------------------------------------------------------------------
alter table public.offices
  add column handles_categories public.report_category[] not null default '{}';

-------------------------------------------------------------------------------
-- Keywords (editable English and Filipino triage lists)
-------------------------------------------------------------------------------
create type public.keyword_lang as enum ('en', 'fil');

create table public.keywords (
  id bigint generated by default as identity primary key,
  term text not null
    check (char_length(term) between 2 and 60 and term ~ '^[a-zñáéíóúü]+([ ''-][a-zñáéíóúü]+)*$'),
  lang public.keyword_lang not null,
  -- Optional hint: used to suggest an office when the resident chose "other".
  category public.report_category,
  severity public.report_severity not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint keywords_term_lang_unique unique (term, lang)
);

comment on column public.keywords.severity is 'A match raises the report to at least this severity; critical marks the report critical.';

create function public.normalize_keyword()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.term := lower(btrim(regexp_replace(new.term, '\s+', ' ', 'g')));
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger keywords_normalize
  before insert or update on public.keywords
  for each row execute function public.normalize_keyword();

create trigger keywords_audit after insert or update or delete on public.keywords
  for each row execute function public.audit_row_change();

revoke all on public.keywords from anon, authenticated;
grant select, insert, update, delete on public.keywords to authenticated;
alter table public.keywords enable row level security;
create policy keywords_admin_all on public.keywords
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-------------------------------------------------------------------------------
-- Triage
-------------------------------------------------------------------------------
create function public.category_base_severity(c public.report_category)
returns public.report_severity
language sql
immutable
set search_path = ''
as $$
  select (case c
    when 'fire' then 'high'
    when 'medical' then 'high'
    when 'crime' then 'high'
    when 'flood' then 'medium'
    else 'low'
  end)::public.report_severity
$$;

create function public.severity_rank(s public.report_severity)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case s when 'critical' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end
$$;

-- Matches whole words/phrases (so "baha" does not match "bahay").
create function public.triage_text(p_text text, p_category public.report_category)
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
  v_text text := lower(coalesce(p_text, ''));
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
  where k.is_active and v_text ~ ('\m' || k.term || '\M');

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

create function public.triage_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select * into t from public.triage_text(new.description, new.category);
  new.severity := t.severity;
  new.is_critical := t.is_critical;
  new.matched_keywords := t.matched_keywords;
  new.suggested_office_id := t.suggested_office_id;
  -- assigned_office_id is deliberately untouched: routing is an admin decision.
  return new;
end;
$$;

create trigger reports_triage
  before insert or update of description, category on public.reports
  for each row execute function public.triage_report();

-- Admin keyword screen: test a text against the current lists.
create function public.preview_triage(p_text text, p_category public.report_category default 'other')
returns table (
  severity public.report_severity,
  is_critical boolean,
  matched_keywords text[],
  suggested_office_id smallint,
  suggested_office_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can preview triage' using errcode = 'insufficient_privilege';
  end if;
  return query
    select t.severity, t.is_critical, t.matched_keywords, t.suggested_office_id, o.name
    from public.triage_text(p_text, p_category) t
    left join public.offices o on o.id = t.suggested_office_id;
end;
$$;

revoke execute on function public.preview_triage(text, public.report_category) from public, anon;
grant execute on function public.preview_triage(text, public.report_category) to authenticated;

-------------------------------------------------------------------------------
-- Priority: severity first, then community confirmation. Votes can move a
-- report within its severity band but never across bands, and never hide it.
-------------------------------------------------------------------------------
alter table public.reports
  add column priority_score integer generated always as (
    public.severity_rank(severity) * 100 + least(confirm_count, 49) - least(dispute_count, 49)
  ) stored;

create index reports_priority_idx on public.reports (priority_score desc, created_at desc);

-- Triage existing rows (no-op on a fresh database; seed rows are triaged on insert).
update public.reports set description = description;

-------------------------------------------------------------------------------
-- Barangay where the incident happened (chosen by the reporter, defaulting to
-- their own barangay) until official boundaries allow automatic lookup.
-------------------------------------------------------------------------------
drop function public.submit_report(uuid, public.report_category, text, double precision, double precision, real, text);

create function public.submit_report(
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
    (client_uuid, reporter_id, category, description, lat, lng, gps_accuracy_m, location_source, barangay_id)
  values
    (p_client_uuid, v_uid, p_category, btrim(p_description), p_lat, p_lng, p_accuracy_m, p_location_source,
     coalesce(p_barangay_id, public.my_barangay_id()))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.submit_report(uuid, public.report_category, text, double precision, double precision, real, text, smallint) from public, anon;
grant execute on function public.submit_report(uuid, public.report_category, text, double precision, double precision, real, text, smallint) to authenticated;

-------------------------------------------------------------------------------
-- Routing history and route_report
-------------------------------------------------------------------------------
create table public.routing_history (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  from_office_id smallint references public.offices (id),
  to_office_id smallint not null references public.offices (id),
  routed_by uuid,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index routing_history_report_idx on public.routing_history (report_id, created_at);

revoke all on public.routing_history from anon, authenticated;
grant select on public.routing_history to authenticated;
alter table public.routing_history enable row level security;
create policy routing_history_select_admin on public.routing_history
  for select to authenticated
  using ((select public.is_admin()));
create policy routing_history_select_office on public.routing_history
  for select to authenticated
  using ((select public.is_office_staff()) and to_office_id = (select public.my_office_id()));

create function public.route_report(p_report_id uuid, p_office_id smallint, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports;
  v_office public.offices;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can route reports' using errcode = 'insufficient_privilege';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'no_data_found';
  end if;
  if not public.is_active_report_status(v_report.status) then
    raise exception 'Closed reports cannot be routed. Reopen the report first.' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_office from public.offices where id = p_office_id and is_active;
  if not found then
    raise exception 'Choose an active office' using errcode = 'invalid_parameter_value';
  end if;
  if v_report.assigned_office_id = p_office_id then
    raise exception 'The report is already assigned to this office' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'The note must be at most 500 characters' using errcode = 'invalid_parameter_value';
  end if;

  -- Resident-facing timeline note: only the office name (admin notes stay internal).
  perform set_config('cc.status_note', 'Sent to ' || v_office.name || '.', true);
  update public.reports
    set assigned_office_id = p_office_id, status = 'routed', resolved_at = null
    where id = p_report_id;
  if v_report.status = 'routed' then
    -- Re-routing keeps the same status, so the status trigger does not fire.
    insert into public.report_status_history (report_id, status, note)
    values (p_report_id, 'routed', 'Sent to ' || v_office.name || '.');
  end if;
  perform set_config('cc.status_note', '', true);

  insert into public.routing_history (report_id, from_office_id, to_office_id, routed_by, note)
  values (p_report_id, v_report.assigned_office_id, p_office_id, auth.uid(), v_note);

  perform public.write_audit(
    'report.routed', 'reports', p_report_id::text,
    jsonb_build_object('status', v_report.status, 'assigned_office_id', v_report.assigned_office_id),
    jsonb_build_object('status', 'routed', 'assigned_office_id', p_office_id,
                       'suggested_office_id', v_report.suggested_office_id, 'note', v_note)
  );
end;
$$;

revoke execute on function public.route_report(uuid, smallint, text) from public, anon;
grant execute on function public.route_report(uuid, smallint, text) to authenticated;

-------------------------------------------------------------------------------
-- Status updates
-------------------------------------------------------------------------------
-- 'routed' is reached only through route_report. Reopening needs a note.
create function public.is_allowed_status_transition(p_from public.report_status, p_to public.report_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from::text || '>' || p_to::text) = any (array[
    'routed>acknowledged', 'routed>in_progress', 'routed>resolved',
    'acknowledged>in_progress', 'acknowledged>resolved',
    'in_progress>resolved',
    'submitted>rejected', 'submitted>duplicate',
    'routed>rejected', 'routed>duplicate',
    'acknowledged>rejected', 'acknowledged>duplicate',
    'resolved>in_progress',
    'rejected>submitted', 'duplicate>submitted'
  ])
$$;

create function public.set_report_status(
  p_report_id uuid,
  p_status public.report_status,
  p_note text default null
)
returns public.report_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can change report status' using errcode = 'insufficient_privilege';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'no_data_found';
  end if;

  if p_status = 'routed' then
    raise exception 'Use route_report to send a report to an office' using errcode = 'invalid_parameter_value';
  end if;
  if p_status in ('acknowledged', 'in_progress', 'resolved') and v_report.assigned_office_id is null then
    raise exception 'Route the report to an office first' using errcode = 'invalid_parameter_value';
  end if;
  if not public.is_allowed_status_transition(v_report.status, p_status) then
    raise exception 'Cannot change status from % to %', v_report.status, p_status
      using errcode = 'invalid_parameter_value';
  end if;
  if v_note is null and (p_status in ('rejected', 'duplicate')
                         or v_report.status in ('resolved', 'rejected', 'duplicate')) then
    raise exception 'A note is required to reject, mark as duplicate, or reopen a report'
      using errcode = 'invalid_parameter_value';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'The note must be at most 500 characters' using errcode = 'invalid_parameter_value';
  end if;

  perform set_config('cc.status_note', coalesce(v_note, ''), true);
  update public.reports
    set status = p_status,
        resolved_at = case when p_status = 'resolved' then now() else null end,
        assigned_office_id = case when p_status = 'submitted' then null else assigned_office_id end
    where id = p_report_id;
  perform set_config('cc.status_note', '', true);

  perform public.write_audit(
    'report.status_changed', 'reports', p_report_id::text,
    jsonb_build_object('status', v_report.status),
    jsonb_build_object('status', p_status, 'note', v_note)
  );
  return p_status;
end;
$$;

revoke execute on function public.set_report_status(uuid, public.report_status, text) from public, anon;
grant execute on function public.set_report_status(uuid, public.report_status, text) to authenticated;

-------------------------------------------------------------------------------
-- Alerts: created_by defaults to the admin; targeted barangays must exist.
-------------------------------------------------------------------------------
alter table public.alerts alter column created_by set default auth.uid();

create function public.check_alert_targets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(new.target_barangay_ids) t(id)
    where not exists (select 1 from public.barangays b where b.id = t.id)
  ) then
    raise exception 'Unknown barangay in alert targets' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger alerts_check_targets
  before insert or update of target_barangay_ids on public.alerts
  for each row execute function public.check_alert_targets();

-------------------------------------------------------------------------------
-- Realtime: admins see new reports and changes live (RLS applies).
-------------------------------------------------------------------------------
alter publication supabase_realtime add table public.reports;
