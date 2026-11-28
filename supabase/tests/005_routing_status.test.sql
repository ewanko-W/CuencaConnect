-- Centralized routing and status updates: admin-only RPCs, validated
-- transitions, routing_history, resident timeline, and audit_log.
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

insert into auth.users (id, email, raw_user_meta_data) values
  ('70000000-0000-4000-8000-000000000001', 'rs.resident@example.test',
   '{"display_name":"Routing Resident","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}');
update public.profiles set verification_status = 'approved' where id = '70000000-0000-4000-8000-000000000001';

insert into public.offices (id, code, name, handles_categories, is_active) overriding system value values
  (900, 'TSTA', 'Test Office A', '{fire}', true),
  (901, 'TSTOFF', 'Inactive Office', '{fire}', false),
  (902, 'TSTB', 'Test Office B', '{road}', true);

insert into auth.users (id, email, raw_app_meta_data) values
  ('70000000-0000-4000-8000-000000000009', 'rs.admin@example.test', '{"cc_role":"admin"}'),
  ('70000000-0000-4000-8000-000000000008', 'rs.staff@example.test', '{"cc_role":"office_staff","cc_office_id":"902"}');

insert into public.reports (id, client_uuid, reporter_id, category, description, lat, lng) values
  ('71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001',
   '70000000-0000-4000-8000-000000000001', 'fire', 'Grass fire spreading behind the school.', 13.91, 121.05),
  ('71000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002',
   '70000000-0000-4000-8000-000000000001', 'road', 'Report that will be rejected as invalid.', 13.91, 121.05);

-------------------------------------------------------------------------------
-- Non-admins
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.route_report('71000000-0000-4000-8000-000000000001', 900::smallint)$$,
  '42501', null, 'a resident cannot route reports');
select throws_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'resolved')$$,
  '42501', null, 'a resident cannot change report status');
select throws_ok($$select * from public.preview_triage('sunog')$$,
  '42501', null, 'a resident cannot use the triage preview');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"70000000-0000-4000-8000-000000000008","role":"authenticated"}';
select throws_ok($$select public.route_report('71000000-0000-4000-8000-000000000001', 902::smallint)$$,
  '42501', null, 'office staff cannot route reports');
select is((select count(*)::int from public.reports where id = '71000000-0000-4000-8000-000000000001'),
  0, 'office staff cannot see unrouted reports');
reset role;

-------------------------------------------------------------------------------
-- Admin: routing
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"70000000-0000-4000-8000-000000000009","role":"authenticated"}';

select throws_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'acknowledged')$$,
  '22023', 'Route the report to an office first', 'a report must be routed before it is marked received');
select throws_ok($$select public.route_report('71000000-0000-4000-8000-000000000001', 901::smallint)$$,
  '22023', 'Choose an active office', 'routing to an inactive office is rejected');
select throws_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'routed')$$,
  '22023', null, 'status routed can only be set through route_report');
select throws_ok($$update public.reports set status = 'resolved' where id = '71000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'admins cannot update reports directly, bypassing the RPCs');

select lives_ok($$select public.route_report('71000000-0000-4000-8000-000000000001', 900::smallint, 'Nearest station')$$,
  'an admin can route a report to an office');
select results_eq(
  $$select status::text, assigned_office_id::int from public.reports where id = '71000000-0000-4000-8000-000000000001'$$,
  $$values ('routed', 900)$$,
  'routing sets the status to routed and assigns the office');
select results_eq(
  $$select from_office_id::int, to_office_id::int, routed_by::text, note from public.routing_history
    where report_id = '71000000-0000-4000-8000-000000000001'$$,
  $$values (null::int, 900, '70000000-0000-4000-8000-000000000009', 'Nearest station')$$,
  'routing writes routing_history with the admin and the internal note');
select is(
  (select count(*)::int from public.audit_log
   where action = 'report.routed' and record_id = '71000000-0000-4000-8000-000000000001'
     and actor_id = '70000000-0000-4000-8000-000000000009'),
  1, 'routing writes audit_log with the acting admin');
select throws_ok($$select public.route_report('71000000-0000-4000-8000-000000000001', 900::smallint)$$,
  '22023', null, 'routing to the office already assigned is rejected');
select lives_ok($$select public.route_report('71000000-0000-4000-8000-000000000001', 902::smallint)$$,
  'an admin can re-route to another office');
select results_eq(
  $$select from_office_id::int, to_office_id::int from public.routing_history
    where report_id = '71000000-0000-4000-8000-000000000001' order by id$$,
  $$values (null::int, 900), (900, 902)$$,
  're-routing is recorded with the previous office');
select results_eq(
  $$select note from public.report_status_history
    where report_id = '71000000-0000-4000-8000-000000000001' and status = 'routed' order by id$$,
  $$values ('Sent to Test Office A.'), ('Sent to Test Office B.')$$,
  'the resident timeline shows each office, not the internal note');

-------------------------------------------------------------------------------
-- Admin: status updates
-------------------------------------------------------------------------------
select lives_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'acknowledged')$$,
  'an admin can mark a routed report as received');
select lives_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'in_progress', 'Crew on site')$$,
  'an admin can mark it in progress');
select lives_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'resolved', 'Fire put out')$$,
  'an admin can mark it resolved');
select ok((select resolved_at is not null from public.reports where id = '71000000-0000-4000-8000-000000000001'),
  'resolving records resolved_at');
select throws_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'acknowledged')$$,
  '22023', null, 'resolved cannot go back to received');
select throws_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'in_progress')$$,
  '22023', null, 'reopening without a note is rejected');
select lives_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000001', 'in_progress', 'Flare-up reported')$$,
  'reopening with a note is allowed');
select ok((select resolved_at is null from public.reports where id = '71000000-0000-4000-8000-000000000001'),
  'reopening clears resolved_at');
select is(
  (select count(*)::int from public.audit_log
   where action = 'report.status_changed' and record_id = '71000000-0000-4000-8000-000000000001'),
  4, 'every status change is written to audit_log');

select throws_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000002', 'rejected')$$,
  '22023', null, 'rejecting without a note is rejected');
select lives_ok($$select public.set_report_status('71000000-0000-4000-8000-000000000002', 'rejected', 'Not an incident')$$,
  'an admin can reject a report with a note');
select is(
  (select note from public.report_status_history where report_id = '71000000-0000-4000-8000-000000000002' and status = 'rejected'),
  'Not an incident', 'the rejection note appears on the resident timeline');
select throws_ok($$select public.route_report('71000000-0000-4000-8000-000000000002', 900::smallint)$$,
  '22023', null, 'closed reports cannot be routed');
reset role;

-------------------------------------------------------------------------------
-- Office staff see only reports assigned to their office
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"70000000-0000-4000-8000-000000000008","role":"authenticated"}';
select is((select count(*)::int from public.reports where id = '71000000-0000-4000-8000-000000000001'),
  1, 'office staff see a report once it is routed to their office');
select is((select count(*)::int from public.routing_history where report_id = '71000000-0000-4000-8000-000000000001'),
  1, 'office staff see only routing entries addressed to their office');
reset role;

select * from finish();
rollback;
