# Security Review

**Scope.** The resident PWA, the admin Command Center, the Supabase database (RLS, functions, triggers), Storage, the PWA and service worker, and the deployment configuration.

**Method.** Code and configuration review, automated database tests (`supabase/tests/010_security.test.sql` and the per-feature pgTAP files), front-end tests, and browser checks in Chromium: installability, Content Security Policy, and an offline cold start.

## 1. Summary of checks

| Area | Check | Result | Evidence |
|---|---|---|---|
| Access control | RLS enabled on every `public` table | Pass | `010_security`: RLS and a policy on every table |
| | Anonymous visitors can read only the barangay list | Pass | `010_security`: anon grants |
| | No RPC callable without signing in | Pass | `010_security`: anon execute |
| | Role, office and verification status cannot be changed through the API | Pass | `001_profiles_roles` |
| | Admins see all reports; critical reports are never hidden | Pass | `003`, `005`, `009` |
| | Office staff see only reports assigned to their office | Pass | `005_routing_status` |
| Functions | Every `SECURITY DEFINER` function pins `search_path` | Pass | `010_security` |
| | Views run with the caller's rights (`security_invoker`) | Pass | `010_security` |
| | Internal helpers (`triage_text`, `write_audit`) not callable by clients | Pass | `010_security` |
| Audit | Admin actions are logged; the log cannot be changed or deleted | Pass | `007_audit_log` |
| Secrets | No keys, tokens or `.env` files in the repository or its history | Pass | `npm run check:secrets`; history scan |
| | Only the public anon key is used by the browser | Pass | `src/lib/supabaseClient.ts` |
| Input validation | Database constraints on every user-supplied field (length, range, enum, no control characters) | Pass | `002`, `004`, `006`, `010` |
| | Client-side checks mirror the database (UX only) | Pass | Vitest: validation tests |
| | Reports limited to the municipality (bounding box) | Pass | `002_reports` |
| Abuse limits | At most 10 reports per resident per hour; one vote per user per report | Pass | `010_security`, `003_report_votes` |
| File uploads | Private bucket; JPEG, PNG or WebP only; 5 MB per file | Pass | `010_security`: bucket limits |
| | Uploads only to the uploader's own folder, for their own open report; at most 3 per report | Pass | `010_security`: upload rules |
| | Uploaded files cannot be overwritten or deleted through the API | Pass | `010_security` |
| | Photos re-encoded on the device, removing EXIF GPS data | Pass | `src/lib/reports/image.ts` |
| Auth | Password of at least 8 characters with letters and digits; re-authentication to change a password | Pass (local config) | `supabase/config.jsonc`; must also be set on the hosted project (README §2.A.4) |
| Transport and headers | HTTPS; HSTS; CSP; `X-Frame-Options: DENY`; `nosniff`; Permissions-Policy limiting GPS and camera to the site | Pass | `netlify.toml`; Chromium check showed no CSP violations |
| PWA | Installable (valid manifest, icons, service worker) | Pass | Chromium installability check: no errors |
| | Clear offline message; the app opens offline; reports are saved offline | Pass | Offline cold start in Chromium; Vitest offline tests |
| | Private API data not stored by the service worker | Pass | `src/sw/service-worker.ts` caches only the app shell and map tiles |

## 2. Findings fixed during this review

1. **Unbounded report submission (spam).** Fixed: `submit_report` now accepts at most 10 reports per resident per rolling hour. Offline retries of an already-sent report still succeed.
2. **Storage misuse.** A verified user could upload any number of files to their own folder. Fixed: uploads must target the uploader's own report that is still `submitted`, with at most 3 files per report.
3. **Password policy mismatch.** Supabase Auth accepted 6 characters while the app asked for 8. Fixed: 8 characters with letters and digits, in both places.
4. **Control characters in text fields.** These could corrupt the display or audit records. Fixed with check constraints.
5. **Unsupported photo formats** (for example, HEIC that a browser could not convert) failed only at upload time. Fixed: photos are validated when chosen, with a clear message.
6. **Offline start blocked by the profile request.** The installed app showed "Loading…" while the network timed out. Fixed: a minimal cached profile (UI fields only, cleared on sign-out) is used at once when the device is offline.
7. **Alerts page offline** showed "Loading" indefinitely. Fixed: it now shows an offline message and reloads when the connection returns.

## 3. Remaining risks and recommendations

| Risk | Recommendation |
|---|---|
| Automated sign-ups (bots) | Enable Supabase Auth CAPTCHA (hCaptcha or Turnstile) on the hosted project. Email confirmation must stay on. |
| Admin account compromise | Enable multi-factor authentication for administrator accounts (Supabase Auth MFA). |
| `style-src 'unsafe-inline'` in the CSP | Required by the map library's inline styles. Script execution remains restricted to `'self'`. |
| Audit log immutability depends on the database owner not disabling triggers | Acceptable for a prototype. In production, export the logs to separate write-once storage. |
| OpenStreetMap tile usage policy | Acceptable at prototype traffic levels. Use a commercial or self-hosted tile service for production. |
| ID verification not built yet | Until the ID-verification phase, testers are verified manually by SQL. Do not collect real IDs before that phase's controls (private bucket, signed URLs, 7-day purge) exist. |
| Rate limit is per account | Combine with CAPTCHA and email confirmation so new accounts cannot be created freely. |

## 4. How to re-run the checks
```bash
npm run test:db
```
```bash
npm run test
```
```bash
npm run lint
```
```bash
npm run check:secrets
```

For the PWA, build and preview the app, then use Chrome DevTools: **Application → Manifest** (installability) and **Network → Offline**. Reload `/app` while offline: the offline banner should appear and the report form should still work.
