\# CuencaConnect

Capstone prototype: location-based civic engagement and emergency

reporting for the Municipality of Cuenca, Batangas. Student project,

simulated data only.



\## Stack

React + TypeScript + Vite; Supabase (Auth, Postgres + PostGIS, Storage,

Realtime); Leaflet + OpenStreetMap; Vitest.



\## Structure

\- /app/\* resident pages, /admin/\* admin pages, shared code in src/

\- supabase/migrations holds every schema change



\## Rules

\- Roles: resident, admin. Role is stored in profiles.role.

\- Admins are created manually, never by public sign-up.

\- Enforce access with Row Level Security, not only route guards.

\- Critical reports must always be visible to admins, regardless of votes.

\- Keyword triage uses editable English and Filipino keyword lists

&#x20; stored in the database.

\- Never commit secrets. Use .env.local and keep .env.example updated.

\- Mobile-first UI. Geolocation needs HTTPS.

\- Data Privacy Act: collect only what is needed. No real personal data

&#x20; in seed data.



\## Commands

npm run dev | npm run test | npm run lint | npm run build



\## Workflow

Plan first. Run tests and lint before each commit. Small commits with

descriptive messages.

