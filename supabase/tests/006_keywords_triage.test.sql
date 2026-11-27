-- Keyword triage with editable English and Filipino lists stored in the
-- database. Triage only suggests an office; it never assigns one.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email, raw_user_meta_data) values
  ('80000000-0000-4000-8000-000000000001', 'kw.resident@example.test',
   '{"display_name":"Keyword Resident","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}');
update public.profiles set verification_status = 'approved' where id = '80000000-0000-4000-8000-000000000001';
insert into auth.users (id, email, raw_app_meta_data) values
  ('80000000-0000-4000-8000-000000000009', 'kw.admin@example.test', '{"cc_role":"admin"}');

-- Fixtures that do not depend on seed data.
insert into public.offices (id, code, name, handles_categories) overriding system value values
  (910, 'TSTKW', 'Keyword Test Office', '{fire,flood,medical,road,other}');
insert into public.keywords (term, lang, category, severity) values
  ('sunog', 'fil', 'fire', 'critical'),
  ('baha', 'fil', 'flood', 'medium'),
  ('not breathing', 'en', 'medical', 'critical'),
  ('pothole', 'en', 'road', 'low')
on conflict (term, lang) do update set severity = excluded.severity, category = excluded.category, is_active = true;
insert into public.keywords (term, lang, category, severity, is_active) values
  ('kwinactiveterm', 'en', 'fire', 'critical', false);

create function pg_temp.report(p_desc text, p_cat public.report_category)
returns public.reports language sql as $$
  insert into public.reports (client_uuid, reporter_id, category, description, lat, lng)
  values (gen_random_uuid(), '80000000-0000-4000-8000-000000000001', p_cat, p_desc, 13.91, 121.05)
  returning *
$$;

-------------------------------------------------------------------------------
-- Structure
-------------------------------------------------------------------------------
select has_table('public', 'keywords', 'keywords table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.keywords'::regclass), 'RLS is enabled on keywords');
select enum_has_labels('public', 'keyword_lang', array['en', 'fil'], 'keyword lists are English and Filipino');

-------------------------------------------------------------------------------
-- Matching
-------------------------------------------------------------------------------
select results_eq(
  $$select severity::text, is_critical, 'sunog' = any (matched_keywords), assigned_office_id
    from pg_temp.report('May sunog sa likod ng palengke.', 'fire')$$,
  $$values ('critical', true, true, null::smallint)$$,
  'a Filipino keyword marks the report critical and does not assign an office');
select ok(
  (select 'fire' = any (o.handles_categories) from pg_temp.report('May sunog dito sa amin.', 'fire') r
   join public.offices o on o.id = r.suggested_office_id),
  'triage suggests an office that handles the category');
select results_eq(
  $$select severity::text, is_critical from pg_temp.report('A man here is NOT BREATHING, please hurry.', 'other')$$,
  $$values ('critical', true)$$,
  'an English multi-word keyword matches regardless of case');
select ok(
  (select 'medical' = any (o.handles_categories) from pg_temp.report('Someone is not breathing near the gate.', 'other') r
   join public.offices o on o.id = r.suggested_office_id),
  'for "other" reports, the keyword''s category picks the suggested office');
select results_eq(
  $$select severity::text, matched_keywords from pg_temp.report('Malinis ang bahay namin ngayon.', 'other')$$,
  $$values ('low', '{}'::text[])$$,
  'whole-word matching: "baha" does not match "bahay"');
select results_eq(
  $$select severity::text, matched_keywords from pg_temp.report('Mataas ang baha sa kalsada.', 'flood')$$,
  $$values ('medium', '{baha}'::text[])$$,
  '"baha" matches as a whole word');
select is(
  (select severity::text from pg_temp.report('Something kwinactiveterm happened.', 'other')),
  'low', 'inactive keywords are ignored');
select is(
  (select severity::text from pg_temp.report('Something is burning at the corner.', 'fire')),
  'high', 'without keywords, the category baseline applies (fire = high)');
select is(
  (select severity::text from pg_temp.report('Big pothole and also sunog nearby.', 'road')),
  'critical', 'the most severe matched keyword wins');

-------------------------------------------------------------------------------
-- Priority: severity bands never overlap, whatever the votes
-------------------------------------------------------------------------------
insert into public.reports (id, client_uuid, reporter_id, category, description, lat, lng) values
  ('81000000-0000-4000-8000-000000000001', gen_random_uuid(), '80000000-0000-4000-8000-000000000001',
   'fire', 'May sunog, disputed by many residents.', 13.91, 121.05),
  ('81000000-0000-4000-8000-000000000002', gen_random_uuid(), '80000000-0000-4000-8000-000000000001',
   'fire', 'Grass is burning near the field.', 13.91, 121.05);
update public.reports set dispute_count = 500 where id = '81000000-0000-4000-8000-000000000001';
update public.reports set confirm_count = 500 where id = '81000000-0000-4000-8000-000000000002';
select ok(
  (select c.priority_score > h.priority_score
   from public.reports c, public.reports h
   where c.id = '81000000-0000-4000-8000-000000000001' and h.id = '81000000-0000-4000-8000-000000000002'
     and c.severity = 'critical' and h.severity = 'high'),
  'a heavily disputed critical report still outranks a heavily confirmed high report');

-------------------------------------------------------------------------------
-- Resident: no access to keyword lists
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.keywords), 0, 'residents cannot read the keyword lists');
select throws_ok($$insert into public.keywords (term, lang) values ('hack', 'en')$$,
  '42501', null, 'residents cannot add keywords');
reset role;

-------------------------------------------------------------------------------
-- Admin: editing the lists
-------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"80000000-0000-4000-8000-000000000009","role":"authenticated"}';

select lives_ok($$insert into public.keywords (term, lang, category, severity) values ('  Gumuho   ang  Tulay ', 'fil', 'road', 'critical')$$,
  'an admin can add a keyword');
select is((select count(*)::int from public.keywords where term = 'gumuho ang tulay'),
  1, 'keywords are normalized to lowercase with single spaces');
select throws_ok($$insert into public.keywords (term, lang) values ('Gumuho ang tulay', 'fil')$$,
  '23505', null, 'the same term cannot be added twice to one language');
select lives_ok($$insert into public.keywords (term, lang) values ('gumuho ang tulay', 'en')$$,
  'the same term may exist in the other language list');
select throws_ok($$insert into public.keywords (term, lang) values ('fire.*', 'en')$$,
  '23514', null, 'terms with symbols (regex characters) are rejected');
select is(
  (select count(*)::int from public.audit_log
   where action = 'keywords.insert' and actor_id = '80000000-0000-4000-8000-000000000009'),
  2, 'keyword changes are written to audit_log with the admin');
select lives_ok($$update public.keywords set is_active = false where term = 'gumuho ang tulay' and lang = 'en'$$,
  'an admin can deactivate a keyword');
select results_eq(
  $$select severity::text, suggested_office_name is not null from public.preview_triage('Gumuho ang tulay sa ilog!', 'road')$$,
  $$values ('critical', true)$$,
  'an admin can preview triage for a sample text');
reset role;

-- A new keyword affects the next report immediately (editable lists).
select is(
  (select severity::text from pg_temp.report('Gumuho ang tulay papuntang bayan.', 'road')),
  'critical', 'a keyword added by an admin is used for new reports');

select is(
  (select assigned_office_id from public.reports where description like 'Gumuho ang tulay papuntang%'),
  null, 'triage never assigns an office');

select * from finish();
rollback;
