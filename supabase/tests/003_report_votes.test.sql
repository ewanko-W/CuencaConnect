-- Confirm/Dispute votes: one vote per user per report, verified residents
-- only, no self-votes, closed reports locked, and votes never hide reports
-- from admins.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-------------------------------------------------------------------------------
-- Fixtures (created as postgres, independent of seed data)
-------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('40000000-0000-4000-8000-000000000001', 'v.reporter@example.test',
   '{"display_name":"Vote Reporter","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('40000000-0000-4000-8000-000000000002', 'v.voter@example.test',
   '{"display_name":"Vote Voter","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('40000000-0000-4000-8000-000000000003', 'v.unverified@example.test',
   '{"display_name":"Vote Unverified","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'),
  ('40000000-0000-4000-8000-000000000004', 'v.second@example.test',
   '{"display_name":"Vote Second","barangay_id":"9","consent_given":"true","consent_version":"2026-11-v2"}');
insert into auth.users (id, email, raw_app_meta_data) values
  ('40000000-0000-4000-8000-000000000009', 'v.admin@example.test', '{"cc_role":"admin"}');

update public.profiles set verification_status = 'approved'
where id in ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
             '40000000-0000-4000-8000-000000000004');

insert into public.reports (id, client_uuid, reporter_id, category, description, lat, lng) values
  ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', 'flood', 'Flooded street near the plaza.', 13.9100, 121.0500),
  ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000001', 'road', 'Closed report used for vote locking.', 13.9101, 121.0501);
update public.reports set status = 'resolved' where id = '41000000-0000-4000-8000-000000000002';

-------------------------------------------------------------------------------
-- Structure
-------------------------------------------------------------------------------
select col_is_pk('public', 'report_votes', array['report_id', 'voter_id'],
  'report_votes primary key is (report_id, voter_id): one vote per user per report');
select enum_has_labels('public', 'vote_type', array['confirm', 'dispute'], 'votes are confirm or dispute');
select ok((select relrowsecurity from pg_class where oid = 'public.report_votes'::regclass), 'RLS is enabled on report_votes');

-------------------------------------------------------------------------------
-- Verified voter
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$select confirm_count, dispute_count, my_vote::text from public.cast_vote('41000000-0000-4000-8000-000000000001', 'confirm')$$,
  $$values (1, 0, 'confirm')$$,
  'a verified resident can confirm a report');

select throws_ok(
  $$insert into public.report_votes (report_id, voter_id, vote)
    values ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'dispute')$$,
  '23505', null, 'a second vote row by the same user on the same report is rejected');

select results_eq(
  $$select confirm_count, dispute_count, my_vote::text from public.cast_vote('41000000-0000-4000-8000-000000000001', 'dispute')$$,
  $$values (0, 1, 'dispute')$$,
  'casting again switches the existing vote from confirm to dispute');

select is(
  (select count(*)::int from public.report_votes where report_id = '41000000-0000-4000-8000-000000000001'),
  1, 'switching does not create a second vote');

select results_eq(
  $$select confirm_count, dispute_count, my_vote::text from public.cast_vote('41000000-0000-4000-8000-000000000001', 'dispute')$$,
  $$values (0, 1, 'dispute')$$,
  'repeating the same vote is idempotent');

select throws_ok(
  $$insert into public.report_votes (report_id, voter_id, vote)
    values ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'confirm')$$,
  '42501', null, 'a user cannot cast a vote on behalf of someone else');

select throws_ok(
  $$select * from public.cast_vote('41000000-0000-4000-8000-000000000002', 'confirm')$$,
  '23514', null, 'voting on a resolved report is rejected');

select throws_ok(
  $$update public.report_votes set voter_id = '40000000-0000-4000-8000-000000000004'
    where report_id = '41000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a vote cannot be reassigned to another user');

reset role;
select is(
  (select voter_id::text from public.report_votes where report_id = '41000000-0000-4000-8000-000000000001'),
  '40000000-0000-4000-8000-000000000002', 'the vote still belongs to the original voter');
set local role authenticated;
set local request.jwt.claims to '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$select confirm_count, dispute_count, my_vote::text from public.withdraw_vote('41000000-0000-4000-8000-000000000001')$$,
  $$values (0, 0, null::text)$$,
  'a voter can withdraw their vote');

select results_eq(
  $$select confirm_count, dispute_count, my_vote::text from public.cast_vote('41000000-0000-4000-8000-000000000001', 'confirm')$$,
  $$values (1, 0, 'confirm')$$,
  'a voter can vote again after withdrawing');

select is(
  (select count(*)::int from public.reports where id = '41000000-0000-4000-8000-000000000001'),
  0, 'voters cannot read other residents'' reports directly (RLS)');

reset role;

-------------------------------------------------------------------------------
-- Reporter (self-vote)
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select * from public.cast_vote('41000000-0000-4000-8000-000000000001', 'confirm')$$,
  '23514', 'You cannot vote on your own report', 'a reporter cannot vote on their own report');

select is(
  (select count(*)::int from public.report_votes),
  0, 'a reporter cannot see who voted on their report');

reset role;

-------------------------------------------------------------------------------
-- Unverified resident
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"40000000-0000-4000-8000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select * from public.cast_vote('41000000-0000-4000-8000-000000000001', 'confirm')$$,
  '42501', null, 'an unverified resident cannot vote');

select throws_ok(
  $$insert into public.report_votes (report_id, voter_id, vote)
    values ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'dispute')$$,
  '42501', null, 'an unverified resident cannot insert a vote directly');

reset role;

-------------------------------------------------------------------------------
-- Second verified voter: counts aggregate correctly
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"40000000-0000-4000-8000-000000000004","role":"authenticated"}';

select results_eq(
  $$select confirm_count, dispute_count, my_vote::text from public.cast_vote('41000000-0000-4000-8000-000000000001', 'dispute')$$,
  $$values (1, 1, 'dispute')$$,
  'votes from different users are counted separately');

select is(
  (select count(*)::int from public.report_votes),
  1, 'a voter sees only their own vote');

select results_eq(
  $$select my_vote::text, is_mine from public.nearby_reports(13.9100, 121.0500, 1000)
    where id = '41000000-0000-4000-8000-000000000001'$$,
  $$values ('dispute', false)$$,
  'nearby_reports returns the caller''s own vote');

reset role;

-------------------------------------------------------------------------------
-- Disputes never hide reports from admins
-------------------------------------------------------------------------------
-- Pile on disputes and mark the report critical.
update public.reports set is_critical = true, severity = 'critical'
where id = '41000000-0000-4000-8000-000000000001';
update public.report_votes set vote = 'dispute' where report_id = '41000000-0000-4000-8000-000000000001';

select results_eq(
  $$select confirm_count, dispute_count from public.reports where id = '41000000-0000-4000-8000-000000000001'$$,
  $$values (0, 2)$$,
  'counts are recomputed after any change to votes');

set local role authenticated;
set local request.jwt.claims to '{"sub":"40000000-0000-4000-8000-000000000009","role":"authenticated"}';

select is(
  (select count(*)::int from public.reports where id = '41000000-0000-4000-8000-000000000001'),
  1, 'an admin still sees a critical report that is heavily disputed');

select is(
  (select count(*)::int from public.report_votes where report_id = '41000000-0000-4000-8000-000000000001'),
  2, 'an admin can see all votes on a report');

reset role;

-------------------------------------------------------------------------------
-- Closing a report locks existing votes
-------------------------------------------------------------------------------
update public.reports set status = 'resolved' where id = '41000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"40000000-0000-4000-8000-000000000004","role":"authenticated"}';

select throws_ok(
  $$select * from public.cast_vote('41000000-0000-4000-8000-000000000001', 'confirm')$$,
  '23514', null, 'a vote cannot be changed after the report is closed');

reset role;

-------------------------------------------------------------------------------
-- Anonymous visitors
-------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$select * from public.cast_vote('41000000-0000-4000-8000-000000000001', 'confirm')$$,
  '42501', null, 'anonymous visitors cannot vote');

select throws_ok(
  $$select count(*) from public.report_votes$$,
  '42501', null, 'anonymous visitors cannot read votes');

reset role;

select * from finish();
rollback;
