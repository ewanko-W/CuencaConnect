-- Keyword triage against a corpus of simulated reports in English,
-- Filipino, and mixed Taglish, including reports that must NOT be flagged.
-- Every report goes through the real path: INSERT -> triage_report trigger.
-- All texts are fictitious.
begin;
create extension if not exists pgtap with schema extensions;

-------------------------------------------------------------------------------
-- Fixtures: a known keyword list (overrides seed values inside this test)
-------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-000000000001', 'corpus@example.test',
   '{"display_name":"Corpus Reporter","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}');
insert into auth.users (id, email, raw_app_meta_data) values
  ('a1000000-0000-4000-8000-000000000009', 'corpus.admin@example.test', '{"cc_role":"admin"}');

insert into public.keywords (term, lang, category, severity) values
  -- English
  ('fire', 'en', 'fire', 'critical'),
  ('unconscious', 'en', 'medical', 'critical'),
  ('not breathing', 'en', 'medical', 'critical'),
  ('gunshot', 'en', 'crime', 'critical'),
  ('trapped', 'en', 'other', 'critical'),
  ('bleeding', 'en', 'medical', 'high'),
  ('accident', 'en', 'road', 'high'),
  ('flood', 'en', 'flood', 'medium'),
  ('flooded', 'en', 'flood', 'medium'),
  ('garbage', 'en', 'waste', 'low'),
  -- Filipino
  ('sunog', 'fil', 'fire', 'critical'),
  ('nasusunog', 'fil', 'fire', 'critical'),
  ('walang malay', 'fil', 'medical', 'critical'),
  ('hindi makahinga', 'fil', 'medical', 'critical'),
  ('nakuryente', 'fil', 'utilities', 'critical'),
  ('naipit', 'fil', 'other', 'critical'),
  ('tumataas ang tubig', 'fil', 'flood', 'high'),
  ('naaksidente', 'fil', 'road', 'high'),
  ('baha', 'fil', 'flood', 'medium'),
  ('bumabaha', 'fil', 'flood', 'medium'),
  ('usok', 'fil', 'fire', 'medium'),
  ('lubak', 'fil', 'road', 'low'),
  ('basura', 'fil', 'waste', 'low')
on conflict (term, lang) do update
  set category = excluded.category, severity = excluded.severity, is_active = true;

-------------------------------------------------------------------------------
-- Corpus: (label, category chosen by the resident, text, expected severity)
-------------------------------------------------------------------------------
create temporary table corpus (
  n serial,
  label text,
  category public.report_category,
  body text,
  expected text
);

insert into corpus (label, category, body, expected) values
  -- English, critical
  ('EN: fire', 'fire', 'There is a fire at the back of the public market!', 'critical'),
  ('EN: unconscious and not breathing', 'medical', 'My father collapsed, he is unconscious and not breathing.', 'critical'),
  ('EN: gunshot', 'crime', 'Gunshot heard near the plaza, people are running.', 'critical'),
  ('EN: trapped child', 'other', 'A child is trapped under a fallen wall.', 'critical'),
  -- English, not critical
  ('EN: accident with bleeding is high', 'road', 'Motorcycle accident on the highway, the rider is bleeding.', 'high'),
  ('EN: flooded street is medium', 'flood', 'The river is rising and the street near the school is flooded.', 'medium'),
  -- Filipino, critical
  ('FIL: may sunog', 'fire', 'May sunog sa likod ng palengke!', 'critical'),
  ('FIL: nasusunog', 'fire', 'Nasusunog ang bahay ng kapitbahay namin.', 'critical'),
  ('FIL: walang malay, hindi makahinga', 'medical', 'Walang malay ang lola ko, hindi makahinga.', 'critical'),
  ('FIL: nakuryente', 'utilities', 'Nakuryente ang lalaki sa poste ng kuryente.', 'critical'),
  ('FIL: naipit', 'other', 'May naipit sa gumuhong pader sa Labac.', 'critical'),
  -- Filipino, not critical
  ('FIL: tumataas ang tubig is high', 'flood', 'Tumataas ang tubig sa ilog, bumabaha na sa kalsada.', 'high'),
  ('FIL: naaksidente is high', 'road', 'Naaksidente ang tricycle sa may kanto.', 'high'),
  -- Mixed (Taglish), critical
  ('MIX: may fire + naipit', 'other', 'Grabe, may fire sa kanto, naipit yung bata!', 'critical'),
  ('MIX: unconscious si lolo', 'medical', 'Pls help, unconscious si lolo sa bahay.', 'critical'),
  ('MIX: hyphenated nag-fire', 'fire', 'Nag-fire sa may tindahan ni Aling Nena.', 'critical'),
  ('MIX: capitals and punctuation', 'fire', 'SUNOG!!! Tulong po, sa may simbahan.', 'critical'),
  ('MIX: emoji next to keyword', 'fire', '🔥sunog🔥 sa Dita, bilisan niyo po', 'critical'),
  ('MIX: accented spelling', 'fire', 'Sunóg sa palengke, bilis!', 'critical'),
  -- Mixed (Taglish), not critical
  ('MIX: nag-flood + tumataas ang tubig is high', 'flood', 'Help po, nag-flood na sa amin at tumataas ang tubig.', 'high'),
  ('MIX: naaksidente + bleeding is high', 'road', 'Yung jeep naaksidente, may bleeding yung driver.', 'high'),
  -- Must NOT be flagged critical
  ('NOT: "bahay" is not "baha"', 'other', 'Malinis na ang bahay namin, salamat po.', 'low'),
  ('NOT: "fireworks" is not "fire"', 'other', 'Fireworks display tonight at the plaza for the fiesta.', 'low'),
  ('NOT: "bonfire" is not "fire"', 'other', 'Bonfire for the barangay fiesta, under control.', 'low'),
  ('NOT: "sunugan" is not "sunog"', 'waste', 'Ang sunugan ng basura ay malayo sa mga bahay.', 'low'),
  ('NOT: garbage complaint', 'waste', 'Uncollected garbage near the elementary school.', 'low'),
  ('NOT: broken streetlight', 'utilities', 'Sira ang ilaw sa kanto, madilim tuwing gabi.', 'low'),
  ('NOT: pothole', 'road', 'Pakiayos po ang lubak sa daan papuntang bayan.', 'low'),
  ('NOT: rain without flooding stays medium', 'flood', 'Malakas ang ulan pero wala pang baha.', 'medium'),
  ('NOT: smoke from a grill is high, not critical', 'fire', 'May usok galing sa ihawan ng kapitbahay.', 'high'),
  -- Documented design choice: negation is NOT interpreted (safety first)
  ('SAFETY: negated mention is still flagged', 'fire', 'False alarm po, walang sunog, usok lang sa ihawan.', 'critical');

select plan((select count(*)::int from corpus) + 9);

insert into public.reports (client_uuid, reporter_id, category, description, lat, lng)
select gen_random_uuid(), 'a1000000-0000-4000-8000-000000000001', c.category, c.body, 13.91, 121.05
from corpus c;

-- One assertion per corpus report, through the real insert path.
select is(r.severity::text, c.expected, c.label)
from corpus c
join public.reports r on r.description = c.body
order by c.n;

-------------------------------------------------------------------------------
-- Invariants over the whole corpus
-------------------------------------------------------------------------------
select is(
  (select count(*)::int from corpus c join public.reports r on r.description = c.body
   where r.is_critical <> (c.expected = 'critical')),
  0, 'is_critical is set exactly for reports that match a critical keyword');

select is(
  (select count(*)::int from corpus c join public.reports r on r.description = c.body
   where r.assigned_office_id is not null),
  0, 'triage never assigns an office (routing stays an admin decision)');

select is(
  (select matched_keywords from public.reports where description = 'Grabe, may fire sa kanto, naipit yung bata!'),
  array['fire', 'naipit'],
  'mixed-language text matches keywords from both lists');

select is(
  (select matched_keywords from public.reports where description = 'Fireworks display tonight at the plaza for the fiesta.'),
  '{}'::text[], 'substrings inside longer words are not matches');

-------------------------------------------------------------------------------
-- Disputes never lower severity or clear the critical flag
-------------------------------------------------------------------------------
update public.reports set dispute_count = 99
where description = 'May sunog sa likod ng palengke!';
select results_eq(
  $$select severity::text, is_critical from public.reports where description = 'May sunog sa likod ng palengke!'$$,
  $$values ('critical', true)$$,
  'a heavily disputed critical report stays critical');

-------------------------------------------------------------------------------
-- Editing the lists re-triages open reports (escalate only)
-------------------------------------------------------------------------------
insert into public.reports (client_uuid, reporter_id, category, description, lat, lng, status) values
  (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000001', 'medical', 'May nahimatay sa tapat ng munisipyo.', 13.91, 121.05, 'submitted'),
  (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000001', 'medical', 'Nahimatay kahapon pero ayos na, salamat.', 13.91, 121.05, 'submitted');
update public.reports set status = 'resolved' where description = 'Nahimatay kahapon pero ayos na, salamat.';

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-000000000009","role":"authenticated"}';
insert into public.keywords (term, lang, category, severity) values ('nahimatay', 'fil', 'medical', 'critical');
update public.keywords set is_active = false where term = 'sunog' and lang = 'fil';
reset role;

select results_eq(
  $$select is_critical, 'nahimatay' = any (matched_keywords) from public.reports
    where description = 'May nahimatay sa tapat ng munisipyo.'$$,
  $$values (true, true)$$,
  'a keyword added by an admin escalates matching OPEN reports immediately');

select is(
  (select is_critical from public.reports where description = 'Nahimatay kahapon pero ayos na, salamat.'),
  false, 'closed reports are not re-triaged');

select is(
  (select is_critical from public.reports where description = 'May sunog sa likod ng palengke!'),
  true, 'deactivating a keyword never downgrades an existing critical report');

select ok(
  exists (select 1 from public.audit_log
          where action = 'reports.retriaged' and actor_id = 'a1000000-0000-4000-8000-000000000009'
            and (new_data ->> 'newly_critical')::int >= 1),
  'the re-triage is written to audit_log with the admin who edited the list');

select * from finish();
rollback;
