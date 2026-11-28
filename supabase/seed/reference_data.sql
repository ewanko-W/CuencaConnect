-- Reference data: responding offices and starter triage keywords.
-- Idempotent; safe to run on the hosted demo project (no accounts, no
-- personal data). Office hotlines are placeholders, not real numbers.

-------------------------------------------------------------------------------
-- Offices (fictitious contact details)
-------------------------------------------------------------------------------
insert into public.offices (id, code, name, hotline, contact_info, handles_categories)
overriding system value
values
  (1, 'MDRRMO', 'Municipal Disaster Risk Reduction and Management Office', '(043) 000-0001', 'Municipal Hall (sample data)', '{flood,other}'),
  (2, 'BFP', 'Bureau of Fire Protection - Cuenca', '(043) 000-0002', 'Sample data', '{fire}'),
  (3, 'PNP', 'Philippine National Police - Cuenca', '(043) 000-0003', 'Sample data', '{crime}'),
  (4, 'MHO', 'Municipal Health Office', '(043) 000-0004', 'Sample data', '{medical}'),
  (5, 'MEO', 'Municipal Engineering Office', '(043) 000-0005', 'Sample data', '{road,utilities}'),
  (6, 'MENRO', 'Municipal Environment and Natural Resources Office', '(043) 000-0006', 'Sample data', '{waste}')
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.offices', 'id'), greatest(6, (select max(id) from public.offices)));

-------------------------------------------------------------------------------
-- Starter triage keywords (English and Filipino). Admins edit these at
-- /admin/keywords. Matching is by whole word or phrase, so add variants
-- (e.g., "flood", "flooding", "flooded").
-------------------------------------------------------------------------------
insert into public.keywords (term, lang, category, severity) values
  -- English
  ('fire', 'en', 'fire', 'critical'),
  ('on fire', 'en', 'fire', 'critical'),
  ('explosion', 'en', 'fire', 'critical'),
  ('smoke', 'en', 'fire', 'medium'),
  ('trapped', 'en', 'other', 'critical'),
  ('landslide', 'en', 'other', 'critical'),
  ('unconscious', 'en', 'medical', 'critical'),
  ('not breathing', 'en', 'medical', 'critical'),
  ('bleeding', 'en', 'medical', 'high'),
  ('injured', 'en', 'medical', 'high'),
  ('electrocuted', 'en', 'utilities', 'critical'),
  ('live wire', 'en', 'utilities', 'high'),
  ('gunshot', 'en', 'crime', 'critical'),
  ('stabbing', 'en', 'crime', 'critical'),
  ('robbery', 'en', 'crime', 'high'),
  ('accident', 'en', 'road', 'high'),
  ('flood', 'en', 'flood', 'medium'),
  ('flooding', 'en', 'flood', 'medium'),
  ('flooded', 'en', 'flood', 'medium'),
  ('rising water', 'en', 'flood', 'high'),
  ('pothole', 'en', 'road', 'low'),
  ('garbage', 'en', 'waste', 'low'),
  -- Filipino
  ('sunog', 'fil', 'fire', 'critical'),
  ('nasusunog', 'fil', 'fire', 'critical'),
  ('pagsabog', 'fil', 'fire', 'critical'),
  ('usok', 'fil', 'fire', 'medium'),
  ('naipit', 'fil', 'other', 'critical'),
  ('guho', 'fil', 'other', 'critical'),
  ('pagguho ng lupa', 'fil', 'other', 'critical'),
  ('walang malay', 'fil', 'medical', 'critical'),
  ('hindi makahinga', 'fil', 'medical', 'critical'),
  ('duguan', 'fil', 'medical', 'high'),
  ('sugatan', 'fil', 'medical', 'high'),
  ('nakuryente', 'fil', 'utilities', 'critical'),
  ('nakalaylay na kawad', 'fil', 'utilities', 'high'),
  ('barilan', 'fil', 'crime', 'critical'),
  ('sinaksak', 'fil', 'crime', 'critical'),
  ('nakawan', 'fil', 'crime', 'high'),
  ('aksidente', 'fil', 'road', 'high'),
  ('naaksidente', 'fil', 'road', 'high'),
  ('baha', 'fil', 'flood', 'medium'),
  ('bumabaha', 'fil', 'flood', 'medium'),
  ('tumataas ang tubig', 'fil', 'flood', 'high'),
  ('lubak', 'fil', 'road', 'low'),
  ('basura', 'fil', 'waste', 'low')
on conflict (term, lang) do nothing;
