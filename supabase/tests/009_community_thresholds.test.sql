-- Community verification thresholds (Confirm/Dispute) and the rule that
-- disputes never hide critical reports.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- Reporter, five verified voters, an admin.
insert into auth.users (id, email, raw_user_meta_data)
select ('b1000000-0000-4000-8000-00000000000' || n)::uuid, 'ct' || n || '@example.test',
       jsonb_build_object('display_name', 'Community ' || n, 'barangay_id', '6',
                          'consent_given', 'true', 'consent_version', '2026-11-v2')
from generate_series(0, 5) n;
update public.profiles set verification_status = 'approved' where id::text like 'b1000000-%';
insert into auth.users (id, email, raw_app_meta_data) values
  ('b1000000-0000-4000-8000-000000000009', 'ct.admin@example.test', '{"cc_role":"admin"}');

-- Known thresholds for this test (as the database owner).
update public.community_thresholds set min_confirms = 3, min_disputes = 3, dominance_ratio = 2.0;

-- A routine report and a critical one (reporter = voter 0), far from seed data.
insert into public.reports (id, client_uuid, reporter_id, category, description, lat, lng) values
  ('b2000000-0000-4000-8000-000000000001', gen_random_uuid(), 'b1000000-0000-4000-8000-000000000000',
   'road', 'Pothole near the Labac chapel, needs filling.', 13.8700, 121.0200),
  ('b2000000-0000-4000-8000-000000000002', gen_random_uuid(), 'b1000000-0000-4000-8000-000000000000',
   'fire', 'May sunog sa bodega malapit sa Labac chapel!', 13.8701, 121.0201);

create function pg_temp.vote_as(p_voter int, p_report text, p_vote public.vote_type) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'b1000000-0000-4000-8000-00000000000' || p_voter, 'role', 'authenticated')::text, true);
  insert into public.report_votes (report_id, voter_id, vote)
  values (p_report::uuid, ('b1000000-0000-4000-8000-00000000000' || p_voter)::uuid, p_vote)
  on conflict (report_id, voter_id) do update set vote = excluded.vote;
end;
$$;

create function pg_temp.status_of(p_report text) returns text language sql as $$
  select community_status::text from public.reports where id = p_report::uuid
$$;

-------------------------------------------------------------------------------
-- Structure
-------------------------------------------------------------------------------
select is((select count(*)::int from public.community_thresholds), 1, 'there is exactly one thresholds row');
select throws_ok($$insert into public.community_thresholds (id) values (false)$$, '23514', null,
  'a second thresholds row cannot be created');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'pending', 'a new report is pending');

-------------------------------------------------------------------------------
-- Confirmation threshold
-------------------------------------------------------------------------------
select pg_temp.vote_as(1, 'b2000000-0000-4000-8000-000000000001', 'confirm');
select pg_temp.vote_as(2, 'b2000000-0000-4000-8000-000000000001', 'confirm');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'pending', 'two confirmations stay pending (min 3)');
select pg_temp.vote_as(3, 'b2000000-0000-4000-8000-000000000001', 'confirm');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'confirmed', 'three confirmations confirm the report');
select pg_temp.vote_as(4, 'b2000000-0000-4000-8000-000000000001', 'dispute');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'confirmed', '3 confirms vs 1 dispute stays confirmed (ratio 2)');
select pg_temp.vote_as(5, 'b2000000-0000-4000-8000-000000000001', 'dispute');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'pending', '3 confirms vs 2 disputes is contested: pending');

-------------------------------------------------------------------------------
-- Dispute threshold on a routine report
-------------------------------------------------------------------------------
select pg_temp.vote_as(1, 'b2000000-0000-4000-8000-000000000001', 'dispute');
select pg_temp.vote_as(2, 'b2000000-0000-4000-8000-000000000001', 'dispute');
select pg_temp.vote_as(3, 'b2000000-0000-4000-8000-000000000001', 'dispute');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'disputed', 'five disputes and no confirmations: disputed');

set local role authenticated;
select pg_temp.vote_as(1, 'b2000000-0000-4000-8000-000000000001', 'dispute'); -- sets claims for voter 1
select is(
  (select count(*)::int from public.nearby_reports(13.8700, 121.0200, 500) where id = 'b2000000-0000-4000-8000-000000000001'),
  0, 'a disputed routine report is hidden from other residents'' nearby map');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000000","role":"authenticated"}';
select results_eq(
  $$select is_mine, community_status::text from public.nearby_reports(13.8700, 121.0200, 500)
    where id = 'b2000000-0000-4000-8000-000000000001'$$,
  $$values (true, 'disputed')$$,
  'the reporter still sees their own disputed report, labelled disputed');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.reports where id = 'b2000000-0000-4000-8000-000000000001'),
  1, 'admins still see a disputed routine report');
reset role;

-------------------------------------------------------------------------------
-- Critical reports are never hidden by disputes
-------------------------------------------------------------------------------
select pg_temp.vote_as(n, 'b2000000-0000-4000-8000-000000000002', 'dispute') from generate_series(1, 5) n;
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000002'), 'disputed', 'a critical report can be disputed');
select results_eq(
  $$select severity::text, is_critical from public.reports where id = 'b2000000-0000-4000-8000-000000000002'$$,
  $$values ('critical', true)$$,
  'disputes do not change severity or the critical flag');

set local role authenticated;
select pg_temp.vote_as(1, 'b2000000-0000-4000-8000-000000000002', 'dispute');
select results_eq(
  $$select is_critical, community_status::text from public.nearby_reports(13.8700, 121.0200, 500)
    where id = 'b2000000-0000-4000-8000-000000000002'$$,
  $$values (true, 'disputed')$$,
  'a disputed CRITICAL report stays on the residents'' nearby map');
select is(
  (select id::text from public.nearby_reports(13.8700, 121.0200, 500) limit 1),
  'b2000000-0000-4000-8000-000000000002', 'critical reports are listed first on the nearby map');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000009","role":"authenticated"}';
select is(
  (select count(*)::int from public.reports
   where id = 'b2000000-0000-4000-8000-000000000002' and is_critical and public.is_active_report_status(status)),
  1, 'admins see the disputed critical report among open critical reports');
select ok(
  (select priority_score from public.reports where id = 'b2000000-0000-4000-8000-000000000002')
  > public.severity_rank('high') * 100 + 49,
  'a disputed critical report outranks the best possible high-severity score');
reset role;

-------------------------------------------------------------------------------
-- Editing the thresholds
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select min_confirms::int from public.community_thresholds), 3, 'residents can read the thresholds');
select lives_ok($$update public.community_thresholds set min_disputes = 1$$, 'a resident''s update runs but is filtered by RLS');
reset role;
select is((select min_disputes::int from public.community_thresholds), 3, 'residents cannot change the thresholds');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000009","role":"authenticated"}';
select throws_ok($$update public.community_thresholds set min_confirms = 0$$, '23514', null,
  'thresholds must be at least 1');
select throws_ok($$update public.community_thresholds set dominance_ratio = 0.5$$, '23514', null,
  'the ratio must be at least 1.0');
select lives_ok($$update public.community_thresholds set min_disputes = 6$$, 'an admin can raise the dispute threshold');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'pending',
  'new thresholds are applied to existing reports immediately');
select results_eq(
  $$select actor_id::text, (new_data ->> 'min_disputes')::int from public.audit_log
    where action = 'community_thresholds.update' order by id desc limit 1$$,
  $$values ('b1000000-0000-4000-8000-000000000009', 6)$$,
  'threshold changes are written to audit_log');
reset role;

-- Votes still work after the change and statuses follow the new rule.
select pg_temp.vote_as(4, 'b2000000-0000-4000-8000-000000000001', 'confirm');
select is(pg_temp.status_of('b2000000-0000-4000-8000-000000000001'), 'pending',
  'status is recomputed on every vote');

select * from finish();
rollback;
