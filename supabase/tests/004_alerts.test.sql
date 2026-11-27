-- Alerts: barangay targeting, expiry, readable by unverified residents,
-- written only by admins, published to Realtime.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('60000000-0000-4000-8000-000000000001', 'a.dita@example.test',
   '{"display_name":"Alert Dita","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('60000000-0000-4000-8000-000000000002', 'a.ibabao@example.test',
   '{"display_name":"Alert Ibabao","barangay_id":"9","consent_given":"true","consent_version":"2026-11-v2"}');
insert into auth.users (id, email, raw_app_meta_data) values
  ('60000000-0000-4000-8000-000000000009', 'a.admin@example.test', '{"cc_role":"admin"}');

insert into public.alerts (id, title, body, level, scope, target_barangay_ids, starts_at, expires_at) values
  ('61000000-0000-4000-8000-000000000001', 'Town-wide test', 'Everyone sees this.', 'advisory', 'municipality', '{}', now() - interval '1 minute', null),
  ('61000000-0000-4000-8000-000000000002', 'Dita only', 'Only Dita sees this.', 'warning', 'barangay', '{6}', now() - interval '1 minute', null),
  ('61000000-0000-4000-8000-000000000003', 'Expired', 'Nobody sees this.', 'advisory', 'municipality', '{}', now() - interval '2 days', now() - interval '1 day'),
  ('61000000-0000-4000-8000-000000000004', 'Scheduled', 'Not yet visible.', 'advisory', 'municipality', '{}', now() + interval '1 day', null);

select ok((select relrowsecurity from pg_class where oid = 'public.alerts'::regclass), 'RLS is enabled on alerts');
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'alerts'),
  'alerts are published to Supabase Realtime');
select throws_ok(
  $$insert into public.alerts (title, body, scope) values ('Bad', 'No targets given', 'barangay')$$,
  '23514', null, 'a barangay alert must list at least one barangay');

-- Unverified resident of Dita
set local role authenticated;
set local request.jwt.claims to '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$select title from public.alerts where id::text like '61000000-%' order by title$$,
  $$values ('Dita only'), ('Town-wide test')$$,
  'an unverified Dita resident sees municipal and Dita alerts');
select throws_ok(
  $$insert into public.alerts (title, body) values ('Fake', 'Resident alert')$$,
  '42501', null, 'a resident cannot create alerts');
reset role;

-- Resident of Ibabao
set local role authenticated;
set local request.jwt.claims to '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq(
  $$select title from public.alerts where id::text like '61000000-%'$$,
  $$values ('Town-wide test')$$,
  'an Ibabao resident does not see the Dita-only alert');
select is((select count(*)::int from public.alerts where title = 'Expired'), 0, 'expired alerts are hidden');
select is((select count(*)::int from public.alerts where title = 'Scheduled'), 0, 'scheduled alerts are hidden until they start');
reset role;

-- Admin
set local role authenticated;
set local request.jwt.claims to '{"sub":"60000000-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.alerts where id::text like '61000000-%'), 4, 'an admin sees all alerts');
select lives_ok(
  $$insert into public.alerts (title, body, created_by) values ('Admin alert', 'Created by admin', '60000000-0000-4000-8000-000000000009')$$,
  'an admin can create an alert');
reset role;

-- Anonymous
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.alerts$$, '42501', null, 'anonymous visitors cannot read alerts');
reset role;

select * from finish();
rollback;
