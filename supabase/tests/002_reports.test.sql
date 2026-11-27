-- Reports: verified-only submission, municipal bounds, idempotent offline
-- retries, status timeline, photo rules, and the anonymized nearby map.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('50000000-0000-4000-8000-000000000001', 'r.verified@example.test',
   '{"display_name":"Report Verified","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('50000000-0000-4000-8000-000000000002', 'r.unverified@example.test',
   '{"display_name":"Report Unverified","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('50000000-0000-4000-8000-000000000003', 'r.other@example.test',
   '{"display_name":"Report Other","barangay_id":"9","consent_given":"true","consent_version":"2026-11-v2"}');
insert into auth.users (id, email, raw_app_meta_data) values
  ('50000000-0000-4000-8000-000000000009', 'r.admin@example.test', '{"cc_role":"admin"}');
update public.profiles set verification_status = 'approved'
where id in ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003');

-------------------------------------------------------------------------------
-- Structure
-------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), 'RLS is enabled on reports');
select ok((select relrowsecurity from pg_class where oid = 'public.report_media'::regclass), 'RLS is enabled on report_media');
select ok((select relrowsecurity from pg_class where oid = 'public.report_status_history'::regclass), 'RLS is enabled on report_status_history');
select ok((select not public from storage.buckets where id = 'report-media'), 'the report-media bucket is private');

-------------------------------------------------------------------------------
-- Unverified resident
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select public.submit_report('51000000-0000-4000-8000-000000000001', 'flood', 'Flooding near the school gate.', 13.91, 121.05)$$,
  '42501', 'ID verification is required before submitting reports', 'an unverified resident cannot submit a report');

select throws_ok(
  $$insert into public.reports (client_uuid, reporter_id, category, description, lat, lng)
    values ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'flood', 'Direct insert attempt.', 13.91, 121.05)$$,
  '42501', null, 'reports cannot be inserted directly, bypassing submit_report');

select throws_ok(
  $$select * from public.nearby_reports(13.91, 121.05, 3000)$$,
  '42501', null, 'an unverified resident cannot view nearby incidents');

reset role;

-------------------------------------------------------------------------------
-- Verified resident
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select public.submit_report('51000000-0000-4000-8000-000000000003', 'flood', 'Flooding somewhere in Manila.', 14.5995, 120.9842)$$,
  '23514', 'The location is outside the Municipality of Cuenca', 'a location outside Cuenca is rejected');

select throws_ok(
  $$select public.submit_report('51000000-0000-4000-8000-000000000004', 'flood', 'Too short', 13.91, 121.05)$$,
  '23514', null, 'a description shorter than 10 characters is rejected');

select lives_ok(
  $$select public.submit_report('51000000-0000-4000-8000-000000000005', 'fire', 'Smoke coming from a grass fire behind the market.', 13.9100, 121.0500, 15, 'adjusted')$$,
  'a verified resident can submit a report');

select is(
  public.submit_report('51000000-0000-4000-8000-000000000005', 'fire', 'Smoke coming from a grass fire behind the market.', 13.9100, 121.0500, 15, 'adjusted'),
  (select id from public.reports where client_uuid = '51000000-0000-4000-8000-000000000005'),
  'retrying with the same client_uuid returns the same report (offline retry)');

select is(
  (select count(*)::int from public.reports where client_uuid = '51000000-0000-4000-8000-000000000005'),
  1, 'the retry does not create a duplicate report');

select results_eq(
  $$select r.status::text, r.reporter_id::text, r.location_source from public.reports r
    where client_uuid = '51000000-0000-4000-8000-000000000005'$$,
  $$values ('submitted', '50000000-0000-4000-8000-000000000001', 'adjusted')$$,
  'the report is submitted by the caller with the adjusted location source');

select results_eq(
  $$select h.status::text from public.report_status_history h
    join public.reports r on r.id = h.report_id
    where r.client_uuid = '51000000-0000-4000-8000-000000000005'$$,
  $$values ('submitted')$$,
  'submission starts the status timeline');

select lives_ok(
  $$insert into public.report_media (report_id, storage_path, mime_type, size_bytes)
    select id, '50000000-0000-4000-8000-000000000001/51000000-0000-4000-8000-000000000005/1.jpg', 'image/jpeg', 2048
    from public.reports where client_uuid = '51000000-0000-4000-8000-000000000005'$$,
  'the reporter can attach a photo stored in their own folder');

select throws_ok(
  $$insert into public.report_media (report_id, storage_path, mime_type, size_bytes)
    select id, '50000000-0000-4000-8000-000000000003/x/1.jpg', 'image/jpeg', 2048
    from public.reports where client_uuid = '51000000-0000-4000-8000-000000000005'$$,
  '42501', null, 'a photo path in another user''s folder is rejected');

select throws_ok(
  $$insert into public.report_media (report_id, storage_path, mime_type, size_bytes)
    select id, '50000000-0000-4000-8000-000000000001/51000000-0000-4000-8000-000000000005/big.jpg', 'image/jpeg', 6000000
    from public.reports where client_uuid = '51000000-0000-4000-8000-000000000005'$$,
  '23514', null, 'a photo larger than 5 MB is rejected');

select lives_ok(
  $$insert into public.report_media (report_id, storage_path, mime_type, size_bytes)
    select id, '50000000-0000-4000-8000-000000000001/51000000-0000-4000-8000-000000000005/' || n || '.jpg', 'image/jpeg', 2048
    from public.reports, generate_series(2, 3) n where client_uuid = '51000000-0000-4000-8000-000000000005'$$,
  'up to three photos are accepted');

select throws_ok(
  $$insert into public.report_media (report_id, storage_path, mime_type, size_bytes)
    select id, '50000000-0000-4000-8000-000000000001/51000000-0000-4000-8000-000000000005/4.jpg', 'image/jpeg', 2048
    from public.reports where client_uuid = '51000000-0000-4000-8000-000000000005'$$,
  '23514', 'A report can have at most 3 photos', 'a fourth photo is rejected');

reset role;

-------------------------------------------------------------------------------
-- Another verified resident: privacy of reports
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is(
  (select count(*)::int from public.reports where client_uuid = '51000000-0000-4000-8000-000000000005'),
  0, 'other residents cannot read the report row');

select is(
  (select count(*)::int from public.report_media m join public.reports r on r.id = m.report_id
   where r.client_uuid = '51000000-0000-4000-8000-000000000005'),
  0, 'other residents cannot see the report photos');

select lives_ok(
  $$select public.submit_report('51000000-0000-4000-8000-000000000006', 'road', 'Pothole near the plaza fountain.', 13.91012, 121.05031)$$,
  'a second verified resident submits a nearby report');

select set_eq(
  $$select category::text, is_mine, approx_lat, approx_lng from public.nearby_reports(13.9100, 121.0500, 2000)
    where distance_m < 100$$,
  $$values ('road', true, 13.91::float8, 121.0505::float8), ('fire', false, 13.91::float8, 121.05::float8)$$,
  'nearby_reports lists active incidents with approximate (grid-snapped) locations');

select ok(
  not exists (
    select 1 from pg_proc
    where proname = 'nearby_reports'
      and ('reporter_id' = any (proargnames) or 'description' = any (proargnames))
  ),
  'nearby_reports exposes neither the reporter nor the description');

select is(
  (select count(*)::int from public.nearby_reports(13.9100, 121.0500, 2000) r
   where r.category = 'fire' and r.distance_m < 100),
  1, 'the other resident''s report appears on the map');

reset role;

-- Closed reports leave the map.
update public.reports set status = 'resolved' where client_uuid = '51000000-0000-4000-8000-000000000005';

set local role authenticated;
set local request.jwt.claims to '{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::int from public.nearby_reports(13.9100, 121.0500, 2000) where category = 'fire' and distance_m < 100),
  0, 'resolved reports are not shown on the nearby map');
reset role;

select results_eq(
  $$select h.status::text from public.report_status_history h join public.reports r on r.id = h.report_id
    where r.client_uuid = '51000000-0000-4000-8000-000000000005' order by h.id$$,
  $$values ('submitted'), ('resolved')$$,
  'status changes are appended to the timeline');

-------------------------------------------------------------------------------
-- Admin
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"50000000-0000-4000-8000-000000000009","role":"authenticated"}';
select ok(
  (select count(*) from public.reports where reporter_id in
    ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003')) = 2,
  'an admin sees every report');
reset role;

select * from finish();
rollback;
