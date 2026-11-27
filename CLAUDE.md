# CuencaConnect

Capstone prototype: location-based civic engagement and emergency
reporting for the Municipality of Cuenca, Batangas. Student project,
simulated data only.

## Stack

React + TypeScript + Vite; Supabase (Auth, Postgres + PostGIS, Storage,
Realtime, Edge Functions, pg_cron); Leaflet + OpenStreetMap; Vitest; pgTAP.

## Structure

- /app/* resident PWA, /admin/* admin command center, /office/* office
  inbox; shared code in src/
- supabase/migrations holds every schema change
- supabase/tests holds pgTAP tests; supabase/functions holds Edge Functions
- The approved implementation plan is in docs/implementation-plan.md

## Rules

### Roles and access
- Roles: resident, office_staff, admin. Role is stored in profiles.role.
- Admins and office staff are created manually, never by public sign-up.
- Office staff must have profiles.office_id and see only reports assigned
  to their office.
- Enforce access with Row Level Security, not only route guards.
- Keep business logic in the database (constraints, triggers, RPCs, RLS).

### Consent and ID verification
- Registration requires explicit consent, recorded with a version and
  timestamp.
- Residents must be ID-verified before submitting reports or voting.
  Unverified users may read alerts and the office directory only.
- Verification flow: upload a government ID photo, status pending, an
  admin approves or rejects with a reason (submit_verification,
  review_verification RPCs; accepted_id_types and id_verifications tables).
- Store only the ID type and verification status. Never store the ID number.
- ID images live in a private bucket. They are viewed only through ~60-second
  signed URLs issued by an Edge Function that writes an audit_log row per
  view. ID images are purged 7 days after the decision.

### Reports, routing, and triage
- Routing is centralized. Triage sets only suggested_office_id. Only admins
  route reports, at /admin/command, through the route_report RPC, which
  writes routing_history and audit_log.
- Critical reports must always be visible to all admins, whether routed or
  unrouted and regardless of votes.
- Keyword triage uses editable English and Filipino keyword lists
  stored in the database.

### Security, privacy, and UI
- Never commit secrets. Use .env.local and keep .env.example updated.
- Mobile-first UI. Geolocation needs HTTPS.
- Data Privacy Act: collect only what is needed. No real personal data
  in seed data.

### Testing
- Every database rule needs a pgTAP test.

## Commands

npm run dev | npm run test | npm run lint | npm run build | npm run test:db

## Workflow

Plan first. Run tests and lint before each commit. Small commits with
descriptive messages.
