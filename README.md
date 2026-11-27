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
