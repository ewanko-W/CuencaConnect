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
        '{"display_name":"Juan Dela Cruz (Demo)","barangay_id":"6","consent_given":"true","consent_version":"2026-11-v1"}'::jsonb)
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
