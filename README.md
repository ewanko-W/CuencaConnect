# CuencaConnect

A capstone prototype for location-based civic engagement and emergency reporting for the Municipality of Cuenca, Batangas. **All data is simulated.**

| Area | Path | Users |
|---|---|---|
| Resident PWA (mobile-first, installable) | `/app` | Residents |
| Command Center | `/admin` | Municipal administrators |
| Office inbox | `/office` | Responding-office staff |

The full design (schema, RLS outline, routes, and build phases) is in [`docs/implementation-plan.md`](docs/implementation-plan.md). Project rules are listed in [`CLAUDE.md`](CLAUDE.md).

## Requirements
- Node.js 20 or later and npm
- Docker, needed by the local Supabase stack (`npx supabase start`)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local Supabase. This prints the API URL and anon key.
   ```bash
   npm run db:start
   ```
3. Copy `.env.example` to `.env.local` and paste the URL and anon key printed in step 2.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Demo accounts (local only, created by `supabase/seed.sql`)
All three accounts use the password `CuencaDemo2026!`. They are fictitious and must not be used on a hosted project.

| Email | Role | Area |
|---|---|---|
| `resident@example.test` | resident (unverified) | `/app` |
| `bfp.staff@example.test` | office_staff (BFP) | `/office` |
| `admin@example.test` | admin | `/admin` |

New residents register at `/app/register`. Admins and office staff are created manually; see [`docs/provisioning-staff.md`](docs/provisioning-staff.md).

## Installing the PWA on a phone
The service worker is built only for production; it is disabled in `npm run dev`. Browsers also install PWAs only over HTTPS, with `localhost` as the one exception.

1. Run `npm run build`, then `npm run preview`.
2. On a desktop, open `http://localhost:4173/app` in Chrome or Edge and use the install icon in the address bar.
3. On a phone, the app must be served over HTTPS. Either deploy the `dist/` folder to an HTTPS host (Netlify, Vercel, or Cloudflare Pages), or expose the preview server through an HTTPS tunnel. Then:
   - **Android (Chrome):** tap **Install app** on the home screen, or use the menu and choose **Install app**.
   - **iOS (Safari):** tap **Share**, then **Add to Home Screen**.

The installed app opens at `/app` in standalone mode. The admin and office areas open in the browser.

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Vite development server |
| `npm run test` | Front-end unit tests (Vitest) |
| `npm run lint` | Linting (oxlint) |
| `npm run build` | Type-check and production build |
| `npm run test:db` | Database tests (pgTAP) via `supabase test db` |
| `npm run db:reset` | Re-apply all migrations and `supabase/seed.sql` |
| `npm run db:types` | Regenerate `src/types/database.types.ts` |

## Data privacy
This project follows the Data Privacy Act of 2012 (Republic Act No. 10173):
- Only the minimum data needed is collected.
- ID numbers are never stored.
- ID images are purged seven days after review.
- Seed data contains no real personal information.
