-- Phase 0: extensions required by CuencaConnect.
-- PostGIS stores report locations and barangay boundaries.
-- pg_cron and pg_net are enabled in Phase 2 (scheduled ID-image purge).

create extension if not exists postgis with schema extensions;
