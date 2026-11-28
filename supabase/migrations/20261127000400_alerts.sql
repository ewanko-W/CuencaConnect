-- Alerts from the municipality, targeted to the whole municipality or to
-- selected barangays, delivered to residents through Supabase Realtime.
--
-- Rules: every signed-in user (verified or not) may read active alerts that
-- target them; only admins write alerts.

create type public.alert_level as enum ('advisory', 'warning', 'emergency');
create type public.alert_scope as enum ('municipality', 'barangay');

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null check (char_length(btrim(body)) between 3 and 2000),
  level public.alert_level not null default 'advisory',
  scope public.alert_scope not null default 'municipality',
  target_barangay_ids smallint[] not null default '{}',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_scope_targets check (
    (scope = 'municipality' and cardinality(target_barangay_ids) = 0)
    or (scope = 'barangay' and cardinality(target_barangay_ids) > 0)
  ),
  constraint alerts_valid_window check (expires_at is null or expires_at > starts_at)
);

create index alerts_active_idx on public.alerts (is_active, starts_at desc);

create trigger alerts_touch_updated_at
  before update on public.alerts
  for each row execute function public.touch_updated_at();

create function public.my_barangay_id()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select p.barangay_id from public.profiles p where p.id = auth.uid()
$$;

revoke all on public.alerts from anon, authenticated;
grant select, insert, update, delete on public.alerts to authenticated;

alter table public.alerts enable row level security;

-- Residents (verified or not): active alerts for the municipality or their barangay.
-- Staff: every active alert.
create policy alerts_select_targeted on public.alerts
  for select to authenticated
  using (
    is_active
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and (
      scope = 'municipality'
      or (select public.my_barangay_id()) = any (target_barangay_ids)
      or (select public.is_office_staff())
    )
  );

create policy alerts_select_admin on public.alerts
  for select to authenticated
  using ((select public.is_admin()));

create policy alerts_insert_admin on public.alerts
  for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));

create policy alerts_update_admin on public.alerts
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy alerts_delete_admin on public.alerts
  for delete to authenticated
  using ((select public.is_admin()));

-- Realtime: Supabase applies the SELECT policies above to each subscriber.
alter publication supabase_realtime add table public.alerts;
