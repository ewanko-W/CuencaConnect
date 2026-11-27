\# CuencaConnect

Capstone prototype: location-based civic engagement and emergency

reporting for the Municipality of Cuenca, Batangas. Student project,

simulated data only.



\## Stack

React + TypeScript + Vite (PWA: web manifest and service worker);

Supabase (Auth, Postgres + PostGIS, Storage, Realtime); Leaflet +

OpenStreetMap; Vitest.



\## Structure

\- /app/\* resident area: mobile-first, installable PWA

\- /admin/\* administrative dashboard: desktop-first

\- All business rules (roles, triage, verification, access control) live in

&#x20; Supabase (migrations, RLS, functions) so a native app can reuse them later.

\- Alerts use in-app realtime updates, not browser push.



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

