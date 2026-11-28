-- audit_log: append-only, admin-readable, and written for admin actions.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('90000000-0000-4000-8000-000000000001', 'au.resident@example.test',
   '{"display_name":"Audit Resident","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}');
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('90000000-0000-4000-8000-000000000009', 'au.admin@example.test', '{"cc_role":"admin"}', '{"display_name":"Audit Admin"}');

-------------------------------------------------------------------------------
-- Admin actions are logged
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated"}';

select lives_ok(
  $$insert into public.alerts (id, title, body, level, scope, target_barangay_ids)
    values ('91000000-0000-4000-8000-000000000001', 'Audit alert', 'Broadcast for the audit test.', 'emergency', 'barangay', '{6}')$$,
  'an admin can broadcast an alert');
select is(
  (select created_by::text from public.alerts where id = '91000000-0000-4000-8000-000000000001'),
  '90000000-0000-4000-8000-000000000009', 'the alert records the admin who created it');
select results_eq(
  $$select action, actor_id::text, new_data ->> 'title' from public.audit_log
    where record_id = '91000000-0000-4000-8000-000000000001'$$,
  $$values ('alerts.insert', '90000000-0000-4000-8000-000000000009', 'Audit alert')$$,
  'broadcasting an alert is written to audit_log');
select lives_ok($$update public.alerts set is_active = false where id = '91000000-0000-4000-8000-000000000001'$$,
  'an admin can deactivate an alert');
select results_eq(
  $$select old_data ->> 'is_active', new_data ->> 'is_active' from public.audit_log
    where record_id = '91000000-0000-4000-8000-000000000001' and action = 'alerts.update'$$,
  $$values ('true', 'false')$$,
  'the update is logged with old and new values');
select throws_ok(
  $$insert into public.alerts (title, body, scope, target_barangay_ids) values ('Bad', 'Unknown barangay', 'barangay', '{999}')$$,
  '23503', null, 'an alert cannot target an unknown barangay');
select is(
  (select actor_name from public.audit_log_entries where record_id = '91000000-0000-4000-8000-000000000001' limit 1),
  'Audit Admin', 'audit_log_entries shows the actor''s name');
select throws_ok($$select public.write_audit('fake', 'x', 'y', null, null)$$,
  '42501', null, 'clients cannot call the internal audit writer');
reset role;

-------------------------------------------------------------------------------
-- Residents
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.audit_log), 0, 'residents cannot read audit_log');
select throws_ok(
  $$insert into public.audit_log (action) values ('forged.entry')$$,
  '42501', null, 'residents cannot write audit_log');
reset role;

-------------------------------------------------------------------------------
-- Append-only, even for the database owner
-------------------------------------------------------------------------------
select throws_ok($$update public.audit_log set action = 'tampered'$$,
  '42501', 'audit_log is append-only', 'audit entries cannot be updated');
select throws_ok($$delete from public.audit_log$$,
  '42501', 'audit_log is append-only', 'audit entries cannot be deleted');
select throws_ok($$truncate public.audit_log$$,
  '42501', 'audit_log is append-only', 'audit_log cannot be truncated');
select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'audit_log'
      and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'API roles have no write privileges on audit_log');

select * from finish();
rollback;
