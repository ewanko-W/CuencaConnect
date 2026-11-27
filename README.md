# CuencaConnect

A capstone prototype for location-based civic engagement and emergency reporting for the Municipality of Cuenca, Batangas. **All data is simulated.**

| Area | Path | Users |
|---|---|---|
| Resident PWA (mobile-first, installable) | `/app` | Residents |
| Command Center (desktop-first, tablet-friendly) | `/admin` | Municipal administrators |
| Office inbox (placeholder; built in a later phase) | `/office` | Responding-office staff |

**Stack.** React, TypeScript and Vite; Supabase (Auth, Postgres with PostGIS, Storage, Realtime); Leaflet with OpenStreetMap; Vitest; pgTAP.

**Documentation**
- [`docs/implementation-plan.md`](docs/implementation-plan.md): design, schema, routes, and build phases
- [`docs/triage-and-community-verification.md`](docs/triage-and-community-verification.md): how priority and community votes work
- [`docs/security-review.md`](docs/security-review.md): security checklist, findings, and remaining risks
- [`docs/provisioning-staff.md`](docs/provisioning-staff.md): creating admin and office-staff accounts
- [`CLAUDE.md`](CLAUDE.md): project rules

---

## 1. Local setup

### Requirements
- Node.js 20 or later, and npm
- Docker Desktop, running (the local Supabase stack runs in Docker)
- Optional: `psql`, the PostgreSQL client, for `npm run db:simulate`

### Steps
1. Get the code and install dependencies:
   ```bash
   git clone https://github.com/ewanko-W/CuencaConnect.git
   ```
   ```bash
   cd CuencaConnect
   ```
   ```bash
   npm install
   ```
2. Start the local Supabase stack. The first run downloads the Docker images. When it finishes it prints the **API URL** and the **anon key**.
   ```bash
   npm run db:start
   ```
3. Create the database and load the seed data (migrations, reference data, demo accounts and simulated reports):
   ```bash
   npm run db:reset
   ```
4. Create your local environment file. Copy `.env.example` to `.env.local`, then paste the API URL and anon key printed in step 2. `.env.local` is ignored by Git; never commit it.
   ```bash
   cp .env.example .env.local
   ```
5. Start the app and open <http://localhost:5173/app>. The browser allows GPS on `localhost` without HTTPS.
   ```bash
   npm run dev
   ```

### Demo accounts (local only)
All demo accounts use the password `CuencaDemo2026!`. They are created by `supabase/seed.sql` and must **never** be created on a hosted project.

| Email | Role | Area |
|---|---|---|
| `resident@example.test` | Resident, unverified (alerts and directory only) | `/app` |
| `verified.resident@example.test` | Resident, verified, Barangay Dita | `/app` |
| `neighbor@example.test` | Resident, verified, Barangay Ibabao | `/app` |
| `ana.demo@`, `jose.demo@`, `liza.demo@example.test` | Residents, verified (their votes show the community statuses) | `/app` |
| `bfp.staff@example.test` | Office staff (BFP) | `/office` |
| `admin@example.test` | Administrator | `/admin` |

### Seed data
`npm run db:reset` loads these files in order (see `supabase/config.jsonc`):

| File | Contents | Safe on the hosted demo? |
|---|---|---|
| `supabase/seed/reference_data.sql` | Offices (placeholder hotlines) and the starter English and Filipino keywords | Yes |
| `supabase/seed.sql` | Demo accounts with a known password, demo reports and alerts | **No, local only** |
| `supabase/seed/simulated_reports.sql` | 12 simulated residents who cannot sign in, plus 60 simulated reports in English, Filipino and Taglish, with statuses, timelines and votes | Yes |

Simulated reports can also be added to, or removed from, any database. Both commands use `DATABASE_URL`, or the local database if it is unset:
```bash
npm run db:simulate
```
```bash
npm run db:simulate:remove
```

### Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Development server (the service worker is off in development) |
| `npm run build` | Type-check and production build (includes the service worker) |
| `npm run preview` | Serve the production build at <http://localhost:4173> |
| `npm run test` | Front-end tests (Vitest) |
| `npm run test:db` | Database tests (pgTAP), via `supabase test db` |
| `npm run lint` | Lint (oxlint) |
| `npm run check:secrets` | Fail if a tracked file looks like it contains a key or password |
| `npm run db:reset` | Recreate the local database and load all seed files |
| `npm run db:types` | Regenerate the TypeScript database types |

Before each commit, run:
```bash
npm run test && npm run lint && npm run test:db && npm run check:secrets
```

---

## 2. Deploy for testing on phones (free, HTTPS)

Phones allow GPS and installing the app only on **HTTPS** sites. The camera works through the photo picker either way. This setup uses two free services:
- **Supabase Cloud** (free plan): database, auth, storage and realtime;
- **Netlify** (free plan): hosts the app with automatic HTTPS.

The repository already contains `netlify.toml`, which provides the build settings, the single-page-app fallback, and the security headers.

### A. Supabase Cloud
1. Create a free project at <https://supabase.com/dashboard>, choosing the region closest to the Philippines (Singapore). Save the database password in a password manager, **not** in the repository.
2. Link the project and apply the migrations from your computer:
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   ```bash
   npx supabase db push
   ```
3. Load the safe seed data. In the dashboard, open **SQL Editor** and run the contents of `supabase/seed/reference_data.sql`, then `supabase/seed/simulated_reports.sql`. **Do not run `supabase/seed.sql`** on the hosted project, because it creates accounts with a published password.
4. Configure Auth (dashboard → **Authentication**):
   - **URL Configuration:** set the Site URL to `https://YOUR-SITE.netlify.app` and add `https://YOUR-SITE.netlify.app/**` to Redirect URLs. You will know the Netlify address after part B; come back to this step then.
   - **Sign In / Providers → Email:** keep **Confirm email** turned on.
   - **Password security:** set the minimum length to 8 and require letters and digits. This matches the app and `supabase/config.jsonc`, which only applies to the local stack.
5. Create your administrator account by following [`docs/provisioning-staff.md`](docs/provisioning-staff.md), using a strong password of your own.
6. Copy the **Project URL** and the **anon (public) key** from **Project Settings → API**. Never put the `service_role` key in the app or in Netlify.

### B. Netlify
1. Sign in at <https://app.netlify.com> with GitHub, choose **Add new site → Import an existing project**, and pick the `CuencaConnect` repository and branch. Netlify reads the build settings from `netlify.toml`.
2. Before deploying, add the environment variables under **Site configuration → Environment variables**:
   - `VITE_SUPABASE_URL`: the Project URL
   - `VITE_SUPABASE_ANON_KEY`: the anon key
3. Deploy. The site is published at `https://YOUR-SITE.netlify.app`, with HTTPS already enabled.
4. Go back to step A.4 and enter this address in Supabase Auth.

### C. Test on real phones
1. On the phone, open `https://YOUR-SITE.netlify.app/app` and register a resident account. Confirm the email.
2. Until the ID-verification screens are built, mark test residents as verified in the SQL Editor:
   ```sql
   update public.profiles set verification_status = 'approved'
   where id = (select id from auth.users where email = 'tester@example.com');
   ```
3. Work through this checklist:

| Check | Android (Chrome) | iPhone (Safari, iOS 16.4 or later) |
|---|---|---|
| Install | Menu → **Install app**, or the in-app **Install app** button | **Share → Add to Home Screen** |
| GPS | Allow location when asked; the pin and accuracy circle appear | Allow location; check that **Settings → Privacy → Location Services → Safari Websites** is on |
| Correct location | Drag the pin or tap the map | Same |
| Camera | **Take photo** opens the rear camera | **Take photo → Take Photo** |
| Offline | Turn on airplane mode: the offline banner appears; send a report and it is **saved on this phone**; turn airplane mode off and it is sent automatically | Same |
| Live alerts | Keep **Alerts** open; broadcast from `/admin/alerts` on a computer | Same |

**Troubleshooting**
- **"The location is outside the Municipality of Cuenca":** you are testing outside Cuenca. Drag the pin into town. Reports are limited to the municipality on purpose.
- **No location prompt:** reset the site's location permission in the browser settings and reload.
- **The app looks out of date after a new deploy:** close and reopen the installed app. The service worker updates in the background.
- **Supabase project paused:** free projects pause after a week without activity. Restore it from the dashboard.

**Other free hosts.** Vercel and Cloudflare Pages also work. They need the same single-page-app fallback (every path served by `index.html`) and the headers from `netlify.toml`, configured in their own formats.

---

## 3. Features

### Resident app (`/app`)
| Feature | Route | Who |
|---|---|---|
| Report an incident: GPS with a draggable pin, camera photos (up to 3), bilingual categories, a description, and the barangay; saved on the phone when offline | `/app/report` | Verified residents |
| My reports, with unsent drafts (Retry / Delete) and a status timeline | `/app/reports` | Verified residents |
| Nearby active incidents with **Confirm / Dispute** (one vote per user per report) | `/app/map` | Verified residents |
| Alerts, delivered live | `/app/alerts` | All residents |
| Hotlines and offices | `/app/directory` | All residents |

### Command Center (`/admin`)
| Feature | Route |
|---|---|
| Map and priority table with filters; open critical reports are always shown | `/admin/command` |
| Report detail: triage result, routing to an office, status updates, timeline | `/admin/command/:id` |
| Broadcast alerts to all of Cuenca or to selected barangays | `/admin/alerts` |
| English and Filipino keyword lists, triage preview, community thresholds | `/admin/keywords` |
| Append-only audit log of admin actions | `/admin/audit` |

## 4. Security and privacy
- **Database-enforced access.** Row Level Security is enabled on every table, and business rules live in the database. Each rule is covered by pgTAP tests (`supabase/tests`).
- **Secrets.** Secrets stay out of Git: `.env.local` is ignored, and `npm run check:secrets` scans tracked files. The anon key is public by design, and RLS protects the data.
- **Uploads.** Photos go to a private bucket: JPEG, PNG or WebP only, 5 MB each, at most 3 per report, and only for the uploader's own open report. Photos are re-encoded on the phone, which removes the hidden GPS data in the image file.
- **Data Privacy Act.** Under the Data Privacy Act of 2012 (Republic Act No. 10173), the app collects only what is needed, and the seed data contains no real personal information. ID verification will store only the ID type and status, never the ID number. ID images will be deleted seven days after review once that phase is built.

See [`docs/security-review.md`](docs/security-review.md) for the full review.
