-- Security review checks: RLS everywhere, minimal anonymous access, safe
-- SECURITY DEFINER functions, upload limits, rate limits, input validation.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-------------------------------------------------------------------------------
-- Row Level Security and privileges
-------------------------------------------------------------------------------
select is(
  array(select tablename::text from pg_tables where schemaname = 'public' and not rowsecurity order by 1),
  '{}'::text[], 'every table in the public schema has Row Level Security enabled');

select is(
  array(select t.tablename::text from pg_tables t
        where t.schemaname = 'public'
          and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
        order by 1),
  '{}'::text[], 'every public table has at least one explicit policy');

select is(
  array(select table_name || ':' || privilege_type from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public' order by 1),
  array['barangays:SELECT'],
  'anonymous visitors can only read the barangay list (for the registration form)');

select is(
  array(select table_name::text from information_schema.views where table_schema = 'public'
        except
        select c.relname::text from pg_class c
        where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
          and 'security_invoker=true' = any (coalesce(c.reloptions, '{}'))),
  '{}'::text[], 'every view runs with the caller''s permissions (security_invoker)');

select is(
  array(select p.proname::text from pg_proc p
        where p.pronamespace = 'public'::regnamespace and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
        order by 1),
  '{}'::text[], 'every SECURITY DEFINER function pins its search_path');

select is(
  array(select p.proname::text from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('submit_report', 'nearby_reports', 'cast_vote', 'withdraw_vote', 'vote_counts',
                            'route_report', 'set_report_status', 'preview_triage', 'triage_text', 'write_audit',
                            'can_upload_report_photo')
          and has_function_privilege('anon', p.oid, 'execute')
        order by 1),
  '{}'::text[], 'anonymous visitors cannot call any RPC');

select is(
  array(select p.proname::text from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('triage_text', 'write_audit')
          and has_function_privilege('authenticated', p.oid, 'execute')
        order by 1),
  '{}'::text[], 'internal helpers (triage_text, write_audit) are not callable by signed-in users');

-------------------------------------------------------------------------------
-- Storage bucket limits
-------------------------------------------------------------------------------
select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'report-media'$$,
  $$values (false, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp'])$$,
  'report photos: private bucket, 5 MB per file, JPEG/PNG/WebP only');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'DELETE', 'ALL')
     and (qual like '%report-media%' or with_check like '%report-media%')),
  0, 'uploaded report photos cannot be overwritten or deleted through the API');

-------------------------------------------------------------------------------
-- Upload rules (as the API role)
-------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-4000-8000-000000000001', 'sec.a@example.test',
   '{"display_name":"Security A","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('c1000000-0000-4000-8000-000000000002', 'sec.b@example.test',
   '{"display_name":"Security B","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('c1000000-0000-4000-8000-000000000003', 'sec.unverified@example.test',
   '{"display_name":"Security Unverified","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}');
update public.profiles set verification_status = 'approved'
where id in ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002');

insert into public.reports (client_uuid, reporter_id, category, description, lat, lng) values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'road', 'Open report for upload tests.', 13.88, 121.03),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'road', 'Routed report for upload tests.', 13.88, 121.03);
update public.reports set status = 'routed', assigned_office_id = (select min(id) from public.offices)
where client_uuid = 'c2000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/1.jpg')$$,
  'a verified resident can upload a photo for their own open report');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000002/c2000000-0000-4000-8000-000000000001/1.jpg')$$,
  '42501', null, 'uploading into another user''s folder is rejected');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000001/' || gen_random_uuid() || '/1.jpg')$$,
  '42501', null, 'uploading for a report that does not exist is rejected (no free storage)');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000002/1.jpg')$$,
  '42501', null, 'uploading for a report that is already routed is rejected');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/extra/1.jpg')$$,
  '42501', null, 'deeper folder paths are rejected');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/2.jpg'),
    ('report-media', 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/3.jpg')$$,
  'up to three photos per report are accepted');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000001/c2000000-0000-4000-8000-000000000001/4.jpg')$$,
  '42501', null, 'a fourth photo is rejected by the storage policy');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from storage.objects where bucket_id = 'report-media'
     and name like 'c1000000-0000-4000-8000-000000000001/%'),
  0, 'other residents cannot list or read someone else''s photos');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('report-media', 'c1000000-0000-4000-8000-000000000003/c2000000-0000-4000-8000-000000000001/1.jpg')$$,
  '42501', null, 'unverified residents cannot upload');
reset role;

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from storage.objects where bucket_id = 'report-media'), 0,
  'anonymous visitors cannot see any report photo');
reset role;

-------------------------------------------------------------------------------
-- Rate limit on report submission
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$select public.submit_report(('c3000000-0000-4000-8000-00000000000' || n)::uuid, 'road',
      'Rate limit test report number ' || n, 13.88, 121.03)
    from generate_series(0, 9) n$$,
  'ten reports within an hour are accepted');
select throws_ok(
  $$select public.submit_report('c3000000-0000-4000-8000-0000000000ff', 'road', 'The eleventh report this hour.', 13.88, 121.03)$$,
  '54000', null, 'the eleventh report within an hour is rejected');
select lives_ok(
  $$select public.submit_report('c3000000-0000-4000-8000-000000000003', 'road', 'Rate limit test report number 3', 13.88, 121.03)$$,
  'an offline retry of an already-sent report still succeeds');
reset role;

-------------------------------------------------------------------------------
-- Input validation
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$update public.profiles set display_name = E'Juan\nAdmin' where id = 'c1000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'display names cannot contain control characters');
select throws_ok(
  $$update public.profiles set display_name = repeat('x', 61) where id = 'c1000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'display names are limited to 60 characters');
reset role;

select throws_ok(
  $$insert into public.reports (client_uuid, reporter_id, category, description, lat, lng)
    values (gen_random_uuid(), 'c1000000-0000-4000-8000-000000000001', 'other', E'Bell \x07 character test', 13.88, 121.03)$$,
  '23514', null, 'report descriptions cannot contain control characters');
select lives_ok(
  $$insert into public.reports (client_uuid, reporter_id, category, description, lat, lng)
    values (gen_random_uuid(), 'c1000000-0000-4000-8000-000000000001', 'other', E'Line one\nLine two', 13.88, 121.03)$$,
  'line breaks in descriptions are allowed');
select throws_ok(
  $$insert into public.reports (client_uuid, reporter_id, category, description, lat, lng, gps_accuracy_m)
    values (gen_random_uuid(), 'c1000000-0000-4000-8000-000000000001', 'other', 'Unrealistic accuracy value.', 13.88, 121.03, 99999)$$,
  '23514', null, 'unrealistic GPS accuracy values are rejected');
select throws_ok(
  $$insert into public.reports (client_uuid, reporter_id, category, description, lat, lng)
    values (gen_random_uuid(), 'c1000000-0000-4000-8000-000000000001', 'other', repeat('a', 1001), 13.88, 121.03)$$,
  '23514', null, 'report descriptions are limited to 1000 characters');

select * from finish();
rollback;
