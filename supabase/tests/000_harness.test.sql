-- Phase 0 harness check: confirms pgTAP runs and required extensions exist.
-- Run with: npm run test:db  (requires `npm run db:start` and Docker)
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select has_extension('postgis', 'PostGIS is installed');
select has_schema('public', 'public schema exists');

select * from finish();
rollback;
