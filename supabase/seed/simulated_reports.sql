-- Simulated reports for demos and load testing (fictitious data only).
--
-- * Creates 12 simulated residents (sim-01..sim-12@example.test) that
--   CANNOT sign in (no password), verified, with recorded consent.
-- * Creates 60 reports in English, Filipino, and Taglish across all
--   categories, spread over the last 14 days around the town center, with
--   realistic statuses (routed, received, in progress, resolved, rejected),
--   timelines, routing history, and Confirm/Dispute votes.
-- * Deterministic (fixed random seed) and idempotent: it does nothing if the
--   simulated residents already exist.
-- * Safe for the hosted demo: no known passwords, no real people.
-- * Requires supabase/seed/reference_data.sql (offices and keywords) first.
--
-- Remove everything it created with supabase/seed/remove_simulated_reports.sql.

do $$
declare
  v_landmarks text[] := array[
    'palengke', 'simbahan', 'plaza', 'paaralan', 'barangay hall', 'health center',
    'tulay', 'kanto ng national highway', 'waiting shed', 'basketball court'];
  v_templates text[][] := array[
    -- category, text ("{place}" is replaced with a landmark)
    array['fire', 'May sunog malapit sa {place}, tumawag na kayo ng bumbero!'],
    array['fire', 'There is a fire near the {place}, thick smoke everywhere.'],
    array['fire', 'May usok galing sa likod ng {place}, parang may nasusunog.'],
    array['fire', 'Grass burning near the {place}, still small.'],
    array['flood', 'Bumabaha na sa kalsada malapit sa {place}.'],
    array['flood', 'Flooded street near the {place}, knee-deep water.'],
    array['flood', 'Tumataas ang tubig sa ilog sa may {place}, pls check.'],
    array['medical', 'May matandang walang malay sa {place}, kailangan ng ambulansya.'],
    array['medical', 'Someone fainted near the {place}, they are conscious now.'],
    array['medical', 'Pls help, may sugatan sa {place} after mahulog sa hagdan.'],
    array['crime', 'May nakawan sa tindahan malapit sa {place} kagabi.'],
    array['crime', 'Suspicious persons loitering near the {place} at night.'],
    array['road', 'Malaking lubak sa daan papunta sa {place}.'],
    array['road', 'Motorcycle accident near the {place}, rider is injured.'],
    array['road', 'Fallen tree branch blocking the road near the {place}.'],
    array['utilities', 'Walang ilaw ang poste malapit sa {place} for three nights.'],
    array['utilities', 'May nakalaylay na kawad ng kuryente sa {place}, delikado.'],
    array['utilities', 'Leaking water pipe near the {place}, sayang ang tubig.'],
    array['waste', 'Hindi nakolekta ang basura sa tabi ng {place}.'],
    array['waste', 'Uncollected garbage piling up near the {place}, mabaho na.'],
    array['other', 'Stray dogs chasing children near the {place}.'],
    array['other', 'May naipit na pusa sa kanal sa {place}.']
  ];
  v_names text[] := array['Andrea', 'Benjie', 'Carmela', 'Dindo', 'Ellen', 'Ferdie',
                          'Gina', 'Hector', 'Ivy', 'Jomar', 'Karla', 'Lito'];
  v_user uuid;
  v_report uuid;
  v_template text[];
  v_status_roll double precision;
  v_target text;
  v_office smallint;
  v_created timestamptz;
  i integer;
  j integer;
begin
  if exists (select 1 from auth.users where email = 'sim-01@example.test') then
    raise notice 'Simulated reports already exist; nothing to do.';
    return;
  end if;
  if not exists (select 1 from public.keywords) then
    raise exception 'Load supabase/seed/reference_data.sql first (offices and keywords).';
  end if;

  perform setseed(0.2026);

  -- Simulated residents (cannot sign in: no password).
  for i in 1..12 loop
    v_user := ('5100' || lpad(i::text, 4, '0') || '-0000-4000-8000-000000000000')::uuid;
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
      'sim-' || lpad(i::text, 2, '0') || '@example.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'display_name', v_names[i] || ' (Simulated)',
        'barangay_id', (1 + floor(random() * 21))::int::text,
        'consent_given', 'true',
        'consent_version', public.current_consent_version()),
      now(), now(), '', '', '', ''
    );
  end loop;
  update public.profiles set verification_status = 'approved'
  where id::text like '5100____-0000-4000-8000-000000000000';

  -- Reports.
  for i in 1..60 loop
    j := 1 + floor(random() * array_length(v_templates, 1))::int;
    v_template := array[v_templates[j][1], v_templates[j][2]];
    v_created := now() - (random() * interval '14 days');
    v_user := ('5100' || lpad((1 + floor(random() * 12))::int::text, 4, '0') || '-0000-4000-8000-000000000000')::uuid;

    insert into public.reports
      (client_uuid, reporter_id, category, description, lat, lng, gps_accuracy_m, location_source,
       barangay_id, created_at)
    values (
      md5('cuencaconnect-simulated-' || i)::uuid,
      v_user,
      v_template[1]::public.report_category,
      replace(v_template[2], '{place}', v_landmarks[1 + floor(random() * array_length(v_landmarks, 1))::int]),
      13.9094 + (random() - 0.5) * 0.04,
      121.0503 + (random() - 0.5) * 0.04,
      (5 + random() * 40)::real,
      case when random() < 0.8 then 'gps' else 'adjusted' end,
      (1 + floor(random() * 21))::smallint,
      v_created
    )
    returning id, coalesce(suggested_office_id, 1) into v_report, v_office;

    -- Status: 35% new, 15% routed, 15% received, 10% in progress, 20% resolved, 5% rejected.
    v_status_roll := random();
    v_target := case
      when v_status_roll < 0.35 then 'submitted'
      when v_status_roll < 0.50 then 'routed'
      when v_status_roll < 0.65 then 'acknowledged'
      when v_status_roll < 0.75 then 'in_progress'
      when v_status_roll < 0.95 then 'resolved'
      else 'rejected'
    end;

    if v_target = 'rejected' then
      perform set_config('cc.status_note', 'Not an incident that the municipality handles (simulated).', true);
      update public.reports set status = 'rejected' where id = v_report;
    elsif v_target <> 'submitted' then
      perform set_config('cc.status_note',
        'Sent to ' || (select name from public.offices where id = v_office) || '.', true);
      update public.reports set status = 'routed', assigned_office_id = v_office where id = v_report;
      insert into public.routing_history (report_id, from_office_id, to_office_id, note, created_at)
      values (v_report, null, v_office, 'Simulated routing', v_created + interval '20 minutes');

      if v_target in ('acknowledged', 'in_progress', 'resolved') then
        perform set_config('cc.status_note', 'The office received the report.', true);
        update public.reports set status = 'acknowledged' where id = v_report;
      end if;
      if v_target in ('in_progress', 'resolved') then
        perform set_config('cc.status_note', 'A team is working on it.', true);
        update public.reports set status = 'in_progress' where id = v_report;
      end if;
      if v_target = 'resolved' then
        perform set_config('cc.status_note', 'Resolved (simulated).', true);
        update public.reports set status = 'resolved', resolved_at = least(now(), v_created + interval '1 day') where id = v_report;
      end if;
    end if;
    perform set_config('cc.status_note', '', true);

    -- Spread the timeline after the report time (one step every ~2 hours).
    update public.report_status_history h
      set created_at = v_created + (h.id - (select min(id) from public.report_status_history where report_id = v_report))
                                   * interval '2 hours'
    where h.report_id = v_report;

    -- Votes from other simulated residents on open reports (75% confirm).
    if v_target not in ('resolved', 'rejected') then
      for j in 1..12 loop
        continue when ('5100' || lpad(j::text, 4, '0') || '-0000-4000-8000-000000000000')::uuid = v_user;
        continue when random() > 0.35;
        insert into public.report_votes (report_id, voter_id, vote)
        values (v_report, ('5100' || lpad(j::text, 4, '0') || '-0000-4000-8000-000000000000')::uuid,
                case when random() < 0.75 then 'confirm' else 'dispute' end::public.vote_type)
        on conflict do nothing;
      end loop;
    end if;
  end loop;

  raise notice 'Created 12 simulated residents and 60 simulated reports.';
end;
$$;
