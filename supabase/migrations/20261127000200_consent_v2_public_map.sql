-- Consent version 2026-11-v2.
--
-- The nearby-incidents map shows other residents the category, status, and
-- APPROXIMATE location of active reports (never the reporter's name,
-- description, or photos). Version 1 of the privacy notice said report data
-- is shared only with administrators and the handling office, so the notice
-- and its version change. New registrations must accept version 2.
create or replace function public.current_consent_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-11-v2'::text $$;
