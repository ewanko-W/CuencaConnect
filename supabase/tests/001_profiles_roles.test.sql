-- Phase 1: profiles, roles, consent, and RLS.
-- Users are created by inserting into auth.users (as the Auth server would);
-- the on_auth_user_created trigger then creates the profile.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-------------------------------------------------------------------------------
-- Structure
-------------------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'barangays', 'barangays table exists');
select has_table('public', 'offices', 'offices table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS is enabled on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.barangays'::regclass), 'RLS is enabled on barangays');
select ok((select relrowsecurity from pg_class where oid = 'public.offices'::regclass), 'RLS is enabled on offices');
select enum_has_labels('public', 'user_role', array['resident', 'office_staff', 'admin'], 'user_role has exactly the three roles');
select is((select count(*)::int from public.barangays), 21, 'all 21 barangays of Cuenca are loaded');
select is(public.current_consent_version(), '2026-11-v1', 'current consent version is defined in the database');

-- Fixture office for staff tests (independent of seed data).
insert into public.offices (id, code, name) overriding system value values (900, 'TST', 'Test Office');

-------------------------------------------------------------------------------
-- Public sign-up rules
-------------------------------------------------------------------------------
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('10000000-0000-4000-8000-000000000001', 'noconsent@example.test',
     '{"display_name":"No Consent","barangay_id":"1"}')$$,
  '23514', null, 'sign-up without consent is rejected');

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('10000000-0000-4000-8000-000000000002', 'oldconsent@example.test',
     '{"display_name":"Old Consent","barangay_id":"1","consent_given":"true","consent_version":"2020-01-v0"}')$$,
  '23514', null, 'sign-up with an outdated consent version is rejected');

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('10000000-0000-4000-8000-000000000003', 'nobarangay@example.test',
     '{"display_name":"No Barangay","consent_given":"true","consent_version":"2026-11-v1"}')$$,
  '23514', null, 'resident sign-up without a barangay is rejected');

select lives_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('20000000-0000-4000-8000-00000000000a', 'resident.a@example.test',
     '{"display_name":"Resident A","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v1"}')$$,
  'sign-up with consent succeeds');

select results_eq(
  $$select role::text, verification_status::text, barangay_id::int from public.profiles
    where id = '20000000-0000-4000-8000-00000000000a'$$,
  $$values ('resident', 'unverified', 6)$$,
  'a new user is an unverified resident in the chosen barangay');

select ok(
  (select consented_at is not null and consent_version = '2026-11-v1' from public.profiles
   where id = '20000000-0000-4000-8000-00000000000a'),
  'consent version and timestamp are recorded');

select lives_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('20000000-0000-4000-8000-00000000000b', 'resident.b@example.test',
     '{"display_name":"Resident B","barangay_id":"1","consent_given":"true","consent_version":"2026-11-v1","role":"admin","cc_role":"admin"}')$$,
  'sign-up that tries to claim admin in user metadata still succeeds');

select is(
  (select role::text from public.profiles where id = '20000000-0000-4000-8000-00000000000b'),
  'resident', 'user metadata cannot grant the admin role');

-------------------------------------------------------------------------------
-- Manual provisioning of staff (app_metadata)
-------------------------------------------------------------------------------
select lives_ok(
  $$insert into auth.users (id, email, raw_app_meta_data) values
    ('30000000-0000-4000-8000-000000000001', 'test.admin@example.test', '{"cc_role":"admin"}')$$,
  'an admin can be provisioned through app_metadata');

select is(
  (select role::text from public.profiles where id = '30000000-0000-4000-8000-000000000001'),
  'admin', 'provisioned admin has the admin role');

select throws_ok(
  $$insert into auth.users (id, email, raw_app_meta_data) values
    ('30000000-0000-4000-8000-000000000002', 'nooffice@example.test', '{"cc_role":"office_staff"}')$$,
  '23514', null, 'office staff without an office is rejected');

select lives_ok(
  $$insert into auth.users (id, email, raw_app_meta_data) values
    ('30000000-0000-4000-8000-000000000003', 'test.staff@example.test',
     '{"cc_role":"office_staff","cc_office_id":"900"}')$$,
  'office staff with an office can be provisioned');

select throws_ok(
  $$insert into auth.users (id, email, raw_app_meta_data) values
    ('30000000-0000-4000-8000-000000000004', 'superuser@example.test', '{"cc_role":"superuser"}')$$,
  '23514', null, 'an unknown provisioned role is rejected');

-------------------------------------------------------------------------------
-- Resident A, through the API role
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"20000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(public.current_user_role()::text, 'resident', 'current_user_role() reports resident');
select is(public.is_admin(), false, 'is_admin() is false for a resident');
select is((select count(*)::int from public.profiles), 1, 'a resident sees only their own profile');

select lives_ok(
  $$update public.profiles set display_name = 'Resident A Updated' where id = '20000000-0000-4000-8000-00000000000a'$$,
  'a resident can update their own display name');

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'a resident cannot change their own role');

select throws_ok(
  $$update public.profiles set verification_status = 'approved' where id = '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'a resident cannot mark themselves as verified');

select throws_ok(
  $$update public.profiles set office_id = 900 where id = '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'a resident cannot assign themselves to an office');

select lives_ok(
  $$update public.profiles set display_name = 'Hacked' where id = '20000000-0000-4000-8000-00000000000b'$$,
  'updating another profile runs without error (RLS filters it to 0 rows)');

select throws_ok(
  $$insert into public.profiles (id, display_name) values ('20000000-0000-4000-8000-00000000000c', 'Fake')$$,
  '42501', null, 'profiles cannot be inserted directly by clients');

select throws_ok(
  $$delete from public.profiles where id = '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'profiles cannot be deleted by clients');

select is((select count(*)::int from public.barangays), 21, 'signed-in users can read barangays');
select ok((select count(*) from public.offices where id = 900) = 1, 'signed-in users can read the office directory');

select throws_ok(
  $$insert into public.offices (code, name) values ('HACK', 'Fake Office')$$,
  '42501', null, 'a resident cannot create offices');

reset role;

select is(
  (select display_name from public.profiles where id = '20000000-0000-4000-8000-00000000000b'),
  'Resident B', 'another resident''s profile was not modified');

-------------------------------------------------------------------------------
-- Office staff
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is(public.is_office_staff(), true, 'is_office_staff() is true for office staff');
select is(public.my_office_id()::int, 900, 'my_office_id() returns the staff member''s office');

reset role;

-------------------------------------------------------------------------------
-- Admin
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.is_admin(), true, 'is_admin() is true for an admin');
select is(
  (select count(*)::int from public.profiles where id in (
    '20000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000b',
    '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003')),
  4, 'an admin can see all profiles');

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '20000000-0000-4000-8000-00000000000b'$$,
  '42501', null, 'roles cannot be changed through the API, even by an admin');

select lives_ok(
  $$insert into public.offices (code, name) values ('ADM', 'Admin Created Office')$$,
  'an admin can create offices');

reset role;

-------------------------------------------------------------------------------
-- Anonymous visitors
-------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is((select count(*)::int from public.barangays), 21, 'anonymous visitors can read barangays (registration form)');
select throws_ok($$select count(*) from public.profiles$$, '42501', null, 'anonymous visitors cannot read profiles');

reset role;

select * from finish();
rollback;
