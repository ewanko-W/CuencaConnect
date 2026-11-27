-- Seed data for LOCAL DEVELOPMENT ONLY (applied by `supabase db reset`).
-- RULE: simulated data only. All names are fictitious, all emails use the
-- reserved domain example.test, and all hotlines are placeholders.
-- The demo password below is for local test accounts only; never reuse it
-- on a hosted project.

-------------------------------------------------------------------------------
-- Offices (fictitious contact details)
-------------------------------------------------------------------------------
insert into public.offices (id, code, name, hotline, contact_info)
overriding system value
values
  (1, 'MDRRMO', 'Municipal Disaster Risk Reduction and Management Office', '(043) 000-0001', 'Municipal Hall (sample data)'),
  (2, 'BFP', 'Bureau of Fire Protection - Cuenca', '(043) 000-0002', 'Sample data'),
  (3, 'PNP', 'Philippine National Police - Cuenca', '(043) 000-0003', 'Sample data'),
  (4, 'MHO', 'Municipal Health Office', '(043) 000-0004', 'Sample data'),
  (5, 'MEO', 'Municipal Engineering Office', '(043) 000-0005', 'Sample data')
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.offices', 'id'), 5);

-------------------------------------------------------------------------------
-- Demo accounts (password: CuencaDemo2026!)
--   admin@example.test      -> admin (provisioned via app_metadata)
--   bfp.staff@example.test  -> office_staff, BFP
--   resident@example.test   -> resident, Barangay Dita, unverified
-------------------------------------------------------------------------------
do $$
declare
  demo record;
begin
  for demo in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@example.test',
        '{"provider":"email","providers":["email"],"cc_role":"admin"}'::jsonb,
        '{"display_name":"Demo Admin"}'::jsonb),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'bfp.staff@example.test',
        '{"provider":"email","providers":["email"],"cc_role":"office_staff","cc_office_id":"2"}'::jsonb,
        '{"display_name":"Demo BFP Staff"}'::jsonb),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'resident@example.test',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"Juan Dela Cruz (Demo)","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'::jsonb)
    ) as t (id, email, app_meta, user_meta)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', demo.id, 'authenticated', 'authenticated',
      demo.email, extensions.crypt('CuencaDemo2026!', extensions.gen_salt('bf')), now(),
      demo.app_meta, demo.user_meta, now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    select gen_random_uuid(), demo.id, demo.id::text,
           jsonb_build_object('sub', demo.id::text, 'email', demo.email, 'email_verified', true),
           'email', now(), now(), now()
    where not exists (
      select 1 from auth.identities i where i.user_id = demo.id and i.provider = 'email'
    );
  end loop;
end;
$$;

-------------------------------------------------------------------------------
-- Verified demo residents (password: CuencaDemo2026!)
--   verified.resident@example.test -> approved, Barangay Dita (can report and vote)
--   neighbor@example.test          -> approved, Barangay Ibabao
-- Verification is set directly here as postgres; in the app it is set by an
-- admin through review_verification (ID verification phase).
-------------------------------------------------------------------------------
do $$
declare
  demo record;
begin
  for demo in
    select * from (values
      ('00000000-0000-4000-8000-000000000004'::uuid, 'verified.resident@example.test',
        '{"display_name":"Maria Santos (Demo)","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v2"}'::jsonb),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'neighbor@example.test',
        '{"display_name":"Pedro Reyes (Demo)","barangay_id":"9","consent_given":"true","consent_version":"2026-11-v2"}'::jsonb)
    ) as t (id, email, user_meta)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', demo.id, 'authenticated', 'authenticated',
      demo.email, extensions.crypt('CuencaDemo2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, demo.user_meta, now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    select gen_random_uuid(), demo.id, demo.id::text,
           jsonb_build_object('sub', demo.id::text, 'email', demo.email, 'email_verified', true),
           'email', now(), now(), now()
    where not exists (
      select 1 from auth.identities i where i.user_id = demo.id and i.provider = 'email'
    );
  end loop;
end;
$$;

update public.profiles set verification_status = 'approved'
where id in ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005');

-------------------------------------------------------------------------------
-- Sample reports (fictitious incidents around the town center)
-------------------------------------------------------------------------------
insert into public.reports
  (id, client_uuid, reporter_id, category, description, lat, lng, gps_accuracy_m, location_source, created_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000005', 'flood',
   'Knee-deep flooding on the road near the chapel after heavy rain.', 13.9112, 121.0478, 12, 'gps', now() - interval '3 hours'),
  ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000005', 'road',
   'Large pothole in the middle of the lane, motorcycles swerving.', 13.9061, 121.0547, 20, 'adjusted', now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-000000000005', 'utilities',
   'Streetlight has been out for three nights on the corner.', 13.9135, 121.0525, 15, 'gps', now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004',
   '00000000-0000-4000-8000-000000000004', 'waste',
   'Uncollected garbage piling up beside the waiting shed.', 13.9088, 121.0499, 8, 'gps', now() - interval '5 hours'),
  ('a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005',
   '00000000-0000-4000-8000-000000000004', 'road',
   'Fallen tree branch blocking half of the road, already cleared.', 13.9040, 121.0580, 10, 'gps', now() - interval '4 days')
on conflict (id) do nothing;

-- Status progression (writes report_status_history through the trigger).
do $$
begin
  perform set_config('cc.status_note', 'Routed to the Municipal Engineering Office.', true);
  update public.reports set status = 'routed', assigned_office_id = 5 where id = 'a0000000-0000-4000-8000-000000000002';
  perform set_config('cc.status_note', 'Inspection team acknowledged the report.', true);
  update public.reports set status = 'acknowledged' where id = 'a0000000-0000-4000-8000-000000000002';

  perform set_config('cc.status_note', 'Routed to the Municipal Engineering Office.', true);
  update public.reports set status = 'routed', assigned_office_id = 5 where id = 'a0000000-0000-4000-8000-000000000005';
  perform set_config('cc.status_note', 'Crew dispatched.', true);
  update public.reports set status = 'in_progress' where id = 'a0000000-0000-4000-8000-000000000005';
  perform set_config('cc.status_note', 'Branch removed; road is clear.', true);
  update public.reports set status = 'resolved', resolved_at = now() - interval '3 days'
  where id = 'a0000000-0000-4000-8000-000000000005';
  perform set_config('cc.status_note', '', true);
end;
$$;

-- Spread history timestamps after each report's creation for a realistic timeline.
update public.report_status_history h
set created_at = r.created_at + (h.id - first.min_id) * interval '2 hours'
from public.reports r,
     (select report_id, min(id) as min_id from public.report_status_history group by report_id) first
where h.report_id = r.id and first.report_id = r.id and r.id::text like 'a0000000-%';

-- Votes (one per user per report; never on one's own report).
insert into public.report_votes (report_id, voter_id, vote) values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'confirm'),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', 'confirm')
on conflict do nothing;

-------------------------------------------------------------------------------
-- Sample alerts
-------------------------------------------------------------------------------
insert into public.alerts (id, title, body, level, scope, target_barangay_ids, starts_at, expires_at, created_by)
values
  ('b0000000-0000-4000-8000-000000000001', 'Heavy rainfall advisory',
   'Moderate to heavy rain is expected this afternoon. Avoid low-lying roads and keep emergency kits ready. (Sample alert)',
   'advisory', 'municipality', '{}', now() - interval '1 hour', now() + interval '2 days',
   '00000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'Flood warning for Barangay Dita',
   'Water levels near the creek are rising. Residents along the creek should prepare to evacuate to the barangay hall. (Sample alert)',
   'warning', 'barangay', '{6}', now() - interval '30 minutes', now() + interval '1 day',
   '00000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'Scheduled water interruption in Ibabao',
   'Water service will be interrupted from 9:00 AM to 3:00 PM for pipe repairs. (Sample alert)',
   'advisory', 'barangay', '{9}', now() - interval '2 hours', now() + interval '1 day',
   '00000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000004', 'Expired: road clearing operations',
   'Clearing operations have ended. (Sample alert, expired)',
   'advisory', 'municipality', '{}', now() - interval '5 days', now() - interval '4 days',
   '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
