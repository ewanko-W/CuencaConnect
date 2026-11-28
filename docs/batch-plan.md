# CuencaConnect: Plan for Batches 1–6 (UI, languages, reporting, multi-office routing, office dashboard, alerts)

## Context
The resident and admin areas, keyword triage, community votes, security hardening and deployment are done (PR ewanko-W/CuencaConnect#1). The group now wants six batches of changes:
- UI fixes;
- English/Filipino support;
- multiple categories and video evidence;
- routing one report to several offices;
- an office dashboard;
- reworked alerts, with Web Push and a privacy-preserving, barangay-based `nearby_reports`.

**Decisions already made**
- Web Push is added; this overrides the "not browser push" line on `main`.
- Routing a report accepts it automatically, and an admin can also accept a report without routing it.
- Non-sensitive reports show their exact pin, covered by a new privacy notice (v3) that existing users accept at their next sign-in.
- I pause after each batch for your manual test.

**Working rules**
- Each batch ends with commits, in which `npm run test`, `npm run lint`, `npm run build` and `npm run test:db` all pass.
- After each batch I give PowerShell manual-test steps, then wait for your go-ahead.
- New database rules go into new migrations only, each with a pgTAP test.
- Routing goes only through `route_report`.

**Environment limitation (unchanged).** This environment has no Docker, so `supabase test db` cannot run here. I run the same pgTAP files with `pg_prove` against Postgres 16 with PostGIS and pgTAP, plus a stand-in for Supabase's auth, storage and realtime (and, from Batch 6, its `pg_net` and Vault). Your `npm run test:db` on Docker is the final check. Deno is not installed here either, so Edge Function logic is kept in plain TypeScript modules tested by Vitest, and you run the function itself with `npx supabase functions serve`.

---

## Batch 0: Prerequisite, merge `main` (first commit of Batch 1)
- Merge `origin/main` (commit e301290, "Update structure for web-first prototype") into the branch, and combine both versions of `CLAUDE.md`. This removes the pull request conflict.
- Apply the `CLAUDE.md` changes listed in the "CLAUDE.md conflicts" section, each in the batch where it takes effect. Approving this plan approves that wording.

## Batch 1: UI fixes (no database change)
**Dependencies:** `lucide-react`.

1. **Remove emojis.**
   - New `src/components/icons/CategoryIcon.tsx` maps each category to a lucide icon: Flame, Waves, Ambulance, Siren, Construction, Lightbulb, Trash2, MapPin.
   - `CATEGORY_INFO` in `src/lib/reports/types.ts` refers to these components instead of emoji strings.
   - Map pins (`src/components/map/pinIcon.ts`) render the lucide SVG with `renderToStaticMarkup`.
   - Twenty files currently contain pictographic symbols. Representative examples: `src/app/AppLayout.tsx`, `src/admin/AdminLayout.tsx`, `src/components/reports/VoteButtons.tsx`, `src/components/reports/CommunityBadge.tsx`, `src/pwa/OfflineBanner.tsx`, `src/app/report/NewReportPage.tsx`, `src/admin/command/AdminReportPage.tsx`.
   - Each icon gets a visible label, or an `aria-label` when it stands alone. Decorative icons get `aria-hidden`.
   - The arrows (←, →), stars, dots and check marks in UI text and comments are replaced as well.
   - **Regression test** `src/test/no-pictographs.test.ts` fails if any non-test source file contains `\p{Extended_Pictographic}` or those symbols.
2. **Active navigation.**
   - `NavLink` already sets `aria-current="page"` and the `active` class. The active style becomes much stronger: a filled background pill, bold text and a 3 px indicator bar, with contrast of at least 4.5:1.
   - This applies to the resident bottom bar, the top-bar Hotlines and Profile links (converted to `NavLink`), and the admin and office sidebars (`src/components/SidebarLayout.tsx`, which gains an `icon` prop).
   - Tests in `src/guards/guards.test.tsx` and the admin tests assert `aria-current="page"` on the correct link for each route.
3. **Text overflowing its box.** The cause in your screenshot is the `<fieldset>`/`<legend>` headings, which render on the card's border.
   - Fix in `src/index.css`: `legend { float: left; width: 100%; }` with `legend + * { clear: both; }`, which keeps the fieldset semantics.
   - Also: `overflow-wrap: anywhere` on cards, headings and badges; remove the risky `nowrap`; `min-width: 0` on flex and grid children (the filter bar, category tiles, critical panel, report headers); `flex-wrap` on header rows.
   - **Verification:** a Playwright check (my scratch script, screenshots sent to you) at 360, 768 and 1280 px asserts that no element overflows its card on any resident or admin page.
4. **Also from your screenshot.** Your computer reported a "GPS" fix with ±50,000 m accuracy (location estimated from the network). Fixes worse than 500 m will be treated as approximate: no pin is placed, the map centres on Cuenca, and a message asks you to tap the map.
   - Unit test with a mocked geolocation.

**pgTAP:** none (no database change).

## Batch 2: English and Filipino
**Dependencies:** `i18next`, `react-i18next`, `i18next-browser-languagedetector`.

**Migration** `…_profile_language.sql`
- Add `profiles.language text not null default 'en' check (language in ('en','fil'))`.
- `handle_new_user` reads `language` from the sign-up metadata, accepting only `en` or `fil` and defaulting to `en`.
- Grant the signed-in role update rights on `language` only.

**RLS:** unchanged; residents still update only their own row.

**pgTAP** `011_profile_language`
- the default is `en`;
- signing up with `fil` is stored;
- an invalid value is rejected;
- users can update only their own language;
- the existing guard on role and verification still holds.

**UI**
- `src/i18n/index.ts`: detector order is local storage key `cc.lang`, then the browser language; `tl`, `fil` and `fil-PH` map to `fil`; the fallback is `en`.
- `src/i18n/locales/en.json` and `fil.json`, with namespaces `common`, `auth`, `resident`, `admin`, `office`.
- `src/components/LanguageToggle.tsx` (EN | FIL with `aria-pressed`) on the login, register and profile screens.
- `src/i18n/useLanguageSync.ts`: once signed in, `profiles.language` wins; changing the language updates both local storage and the profile.
- Every component's text moves to `t()` keys, the resident area first and then admin and office.
- Dates use `Intl` with `en-PH` or `fil-PH`.
- Report descriptions, office names, barangay names and other user or reference data are never translated.

**Checks**
- A Vitest test requires that `en.json` and `fil.json` have the same keys and no empty values.
- `scripts/check-i18n.mjs` (with `npm run check:i18n`, also run inside Vitest) flags hardcoded JSX text and the `aria-label`, `placeholder` and `title` props. It is a heuristic with an allowlist.
- `npm run i18n:review` generates `docs/translation-review.md` (key | English | Filipino | reviewed). A test fails if the document is out of date.

## Batch 3: Multiple categories and video
**Migration** `…_categories_table_and_junction.sql`
- New table `categories(code report_category primary key, is_sensitive, base_severity, sort_order)` with 8 rows; `is_sensitive` is true for medical and crime. Labels stay in the translation files.
- New table `report_categories(report_id, category)` with the primary key on both columns. It is back-filled from `reports.category`, and then `reports.category` is dropped.
- A deferred constraint trigger requires at least one category per report. A trigger enforces at most **3** categories, which is my proposed limit (question 1).
- **Triage:**
  - `triage_text(text, report_category[])`; the baseline is the most severe of the report's categories.
  - `suggested_office_id` becomes `suggested_office_ids smallint[]`, one office per category, set by triage.
  - Triage also runs when categories are inserted or deleted, and remains escalate-only.
- `submit_report(…, p_categories report_category[], …)` validates 1 to 3 distinct categories.
- Updated for categories: `preview_triage`, the re-triage after keyword changes, and the existing admin filters.

**Migration** `…_report_videos.sql`
- `report_media` gains `media_type` (`photo` or `video`) and `duration_seconds`.
- Per-report limits: up to 3 photos and 1 video.
- Per-type limits: photos must be JPEG, PNG or WebP up to 5 MB; videos must be MP4 (`video/mp4`), MOV (`video/quicktime`) or WebM up to 50 MB, with a duration of 60 seconds or less.
- New private bucket `report-videos`, limited to 52,428,800 bytes and those three MIME types.
- Storage policies:
  - INSERT through `can_upload_report_video(name)`: only for the uploader's own open report, at most 1 video.
  - SELECT for the reporter or an admin; Batch 4 adds routed offices.
  - No UPDATE or DELETE policies.

**pgTAP**
- `012_report_categories`:
  - a report without a category fails at commit (tested with `set constraints all immediate`);
  - more than 3 categories, or a duplicate, is rejected;
  - the most severe category drives the baseline severity;
  - one office is suggested per category;
  - the sensitive flag is set for medical and crime;
  - triage never assigns an office.
- `013_report_videos`: bucket limits, accepted formats, the one-video limit, the duration check, own-report-only uploads, and that other residents cannot read videos while admins can.
- Existing tests updated for the removed `category` column: 002, 003, 005, 006, 008, 009 and 010.

**UI**
- `NewReportPage.tsx`:
  - category chips that allow several selections, with at least one required;
  - a video picker with `accept="video/mp4,video/quicktime,video/webm"`;
  - `src/lib/reports/videoValidation.ts` reads the format, size and duration through `HTMLVideoElement` metadata and gives clear error messages;
  - a guidance line: "avoid filming faces".
- Video upload uses **tus-js-client**, the resumable upload Supabase recommends for files over 6 MB. It shows a progress bar and resumes on weak mobile connections. Photos keep the current upload.
- The offline outbox stores the video as well.
- Report views (`ReportDetailPage.tsx`, `MyReportsPage.tsx`, `AdminReportPage.tsx`) show the categories and play the video through a signed URL.
- The admin category filter matches on `report_categories`.

**Limitation to note.** The 60-second limit is checked from the metadata the phone reports, and the database stores that duration. Truly verifying the duration on the server would need a media-processing service, which free Edge Functions don't provide.

## Batch 4: Routing to multiple offices
**Migration** `…_report_routes.sql`

*New types*
- `route_status`: new, acknowledged, in_progress, resolved, returned.
- `review_status`: pending, accepted, rejected, duplicate.
- `report_progress`: unrouted, new, in_progress, resolved.

*Changes to `reports`*
- Add `review_status`, plus `reviewed_by` and `reviewed_at`.
- Add `progress` (the overall status), which is **set only by a trigger**.
- Migrate the existing `status` values, then drop `status` and `assigned_office_id`.
- Replace `is_active_report_status` with `is_report_open(review_status, progress)`, and update votes, nearby, re-triage and priority to use it.

*`report_routes`* (one row per report and office)
- Columns: `report_id`, `office_id`, `status`, `return_reason`, `routed_by`, `routed_at`, `updated_at`, `removed_at`, `removed_by`, `removal_reason`.
- Primary key on `report_id` and `office_id`.

*`report_route_history`*
- Records every route, removal, status change, return and remark, with the user, time and reason.
- It is append-only: triggers block UPDATE, DELETE and TRUNCATE, as on `audit_log`.
- It replaces `routing_history`, whose rows are migrated before the table is dropped.

*Functions* (each writes history and `audit_log`)
- `route_report(report_id, office_ids smallint[], note)`, admin only:
  - requires at least one office;
  - accepts a pending report;
  - re-adds a returned or removed office as `new`;
  - adding an office to a resolved report reopens it.
- `remove_report_route(report_id, office_id, reason)`, admin only: allowed only while that office's status is `new`, and the reason is required.
- `review_report(report_id, decision, reason)`, admin only: accept, reject, duplicate, or reopen to pending. A reason is required to reject, mark duplicate, or reopen.
- `set_route_status`, `return_report` (reason required) and `add_route_remark`: for office staff, on their own office's route only.
- `recompute_report_progress()`: a trigger on `report_routes` that sets the overall status:
  - ignore removed and returned routes;
  - none left → `unrouted` (back in the admin queue);
  - all remaining resolved → `resolved`;
  - any acknowledged, in progress or resolved → `in_progress`;
  - otherwise → `new`.
- `set_report_status` is dropped. Admins no longer set progress by hand.

*Visibility*
- `reports`: admins see everything (critical reports are always visible); office staff see a report only while their office has a route on it that has not been removed. **Residents lose direct SELECT** on `reports`; My Reports switches to `my_reports()` and `my_report_detail(id)`, which return the overall status, categories, media, the review reason, and each routed office's name and status, with no remarks.
- `report_routes`: column privileges hide `return_reason` and remarks. Office staff can read the routes (office names and statuses) of reports they can see.
- `report_route_history`: admins see all of it; office staff see only their own office's rows.
- Admins read remarks through `admin_report_routes(id)`; offices read their own through `my_route_detail(id)`.
- **Media access:** a new `can_view_report_media(name)` lets the reporter, admins, and offices with a non-removed route view photos and videos. A removed office loses access.

**pgTAP** `014_report_routes`, one test or more per rule:
- at least one office per routing call;
- only admins can route;
- routing accepts a pending report;
- the per-office transitions;
- returning requires a reason;
- each case of the overall-status calculation, including that all offices returning puts the report back in the queue;
- adding an office reopens a resolved report;
- an office can be removed only while it is `new`, and only with a reason;
- a removed office loses access to the report and its media;
- other offices' remarks are hidden from offices and residents;
- history is append-only and records the user, time and reason;
- critical reports stay visible to all admins;
- residents cannot select from `reports`;
- `audit_log` entries are written.

Tests 005, 007, 009 and 010 are updated.

**UI**
- Admin `AdminReportPage.tsx`:
  - the routing card has office checkboxes, with the triage suggestions preselected;
  - a per-office status table with Add office, and Remove for offices still `new` (reason required);
  - a review card (Accept, Reject, Duplicate, Reopen);
  - the full route history, including remarks.
- Command Center filters: overall progress, review state, and office.
- `src/lib/reports/api.ts` and `ReportDetailPage.tsx` switch to the RPCs. The resident sees the overall status and each office's name and status.

## Batch 5: Office dashboard
**Migration** `…_office_dashboard.sql`
- `office_status_counts()`: counts by the office's own status.
- `office_reports(status, category, from_date, to_date)`: newest first, with a critical flag. It runs with the caller's permissions (security invoker), so RLS still applies.

**pgTAP** `015_office_dashboard`
- an office sees only reports routed to it (not removed), as an RLS test;
- the counts are correct per status;
- the filters work;
- staff cannot change another office's route, cannot call `route_report`, and cannot read other offices' remarks.

**UI**
- `src/office/OfficeDashboardPage.tsx`: summary cards; a list with status, category and date-range filters; critical reports highlighted.
- `src/office/OfficeReportPage.tsx`: the details, media (including video) and map; own status buttons, a remark, and Return with a reason; the other routed offices' names and statuses.
- `OfficeLayout` navigation follows the same rules: icons with labels, a highlighted active tab, and translation keys.

**Seed:** route several demo and simulated reports to BFP, so that `bfp.staff@example.test` has data to work with.

## Batch 6: Alerts, Web Push, privacy notice v3, `nearby_reports`
**Migration** `…_alerts_bilingual_follow.sql`
- **Alert text:**
  - rename `title`/`body` to `title_en`/`body_en` (required);
  - add `title_fil`/`body_fil` (optional, both or neither, same length and character rules);
  - `ended_at` and the existing `is_active` cover "end".
- **Alert access:** every signed-in user, verified or not, can read all active alerts. Only admins can write alerts.
- **Personal-data warning:**
  - `detect_personal_data(text)` returns which kinds of personal data it finds: PH mobile and landline numbers, emails, address markers (Blk, Lot, Purok, house numbers), and names (an honorific followed by capitalized words, or 2–3 capitalized words that aren't a known barangay or office).
  - The alert form calls it through `alert_text_warnings(...)`. It warns but does not block.
- **Following barangays:** new table `followed_barangays(user_id, barangay_id)`. Users manage only their own rows. A trigger allows at most 5, excluding the user's own barangay.

**Migration** `…_web_push.sql`
- `push_subscriptions`: endpoint (unique), keys, `user_id`, timestamps and a failure count. Users manage only their own rows.
- `alert_push_recipients(alert_id)`, callable by the service role only, applies these rules:
  - a municipality-wide alert goes to everyone with a subscription;
  - a barangay alert goes to verified users whose `profiles.barangay_id` is a target, and to anyone who follows a target barangay;
  - unverified users receive pushes only through follows or municipality-wide alerts;
  - each recipient gets the alert in their language, falling back to English;
  - duplicate endpoints are removed.
- `alert_push_deliveries` logs each send.
- An `alerts` insert trigger calls the Edge Function through `pg_net`, reading the function URL and secret from Supabase Vault, and skips with a notice if they are not configured.

**Edge Function** `supabase/functions/send-alert-push/`
- Verifies the shared secret, loads the recipients, and builds each payload in the user's language.
- Sends with Web Push (VAPID) and deletes subscriptions that return 404 or 410.
- The shared logic lives in `supabase/functions/_shared/pushPayload.ts`, tested with Vitest.
- Keys: `VITE_VAPID_PUBLIC_KEY` returns to `.env.example`; the private key goes in `supabase/functions/.env` (gitignored) locally and in `supabase secrets set` on Cloud.

**Service worker:** `push` and `notificationclick` handlers (open `/app/alerts`) are added to `src/sw/service-worker.ts`.

**Migration** `…_privacy_notice_v3.sql`
- `current_consent_version` becomes `2026-12-v3`.
- `accept_current_consent()` RPC.
- `submit_report`, `cast_vote` and `nearby_reports` require the current consent version.

**Migration** `…_nearby_reports_barangay.sql`
- `barangays.reference_point` (a point), and `barangay_reference_point(id)`, which uses `ST_PointOnSurface(boundary)` when a boundary exists and the stored reference point otherwise.
- `nearby_reports()` is rewritten. It takes **no device location** and is security definer.
- **Who and which reports:**
  - verified residents with current consent; others are refused;
  - accepted reports from the last 14 days, in the user's barangay and the barangays they follow;
  - up to 50 rows, critical reports first;
  - disputed routine reports stay hidden, as now.
- **Never returned:** the reporter's id, name or contact details, the description, or any media.
- **Non-sensitive reports:** categories, overall status, the exact pin, and the date and hour (Asia/Manila time).
- **Sensitive reports:** categories, status, the barangay name, the barangay reference point, and the date only.
- **Fewer than 3 sensitive reports in a barangay:** one `sensitive_count` row for that barangay instead of individual rows.
- A report id is still returned so residents can Confirm or Dispute.

**pgTAP**
- `016_alerts`: read access for everyone signed in; admin-only writes; the English-required and Filipino-optional rules; the personal-data detector cases.
- `017_followed_barangays`: the limit of 5, the own-barangay exclusion, and own rows only.
- `018_push_recipients`: every targeting rule, language and fallback, deduplication, and users who turned push off.
- `019_nearby_reports`: no identity fields, media or descriptions are returned; sensitive locations equal the reference point; sensitive times are date-only; the small-count rule holds; pending and rejected reports are excluded; unverified users are refused; residents cannot read `reports` directly; the 14-day window and the 50-row cap hold.
- `020_consent_v3`.
- Tests 002, 003, 004 and 009 are updated.

**UI**
- `AdminAlertsPage.tsx`: English fields (required), Filipino fields (optional), guidance text, live personal-data warnings, and barangay or municipality targeting.
- `AlertsPage.tsx`: shows the user's language with English fallback; alerts for the user's barangays first; an "All Cuenca" toggle.
- `AppProfile.tsx`: language, followed barangays (up to 5), and a push on/off toggle that handles permissions and shows the iPhone install hint. Supporting code in `src/pwa/push.ts`.
- `NearbyMapPage.tsx` becomes "Reports in my barangays": a list and map built from `nearby_reports()`, with sensitive-count chips and no device geolocation.
- `ConsentUpdatePage` appears after sign-in until v3 is accepted; `PrivacyNotice` is updated to v3.

---

## CLAUDE.md conflicts and the changes I'll make (approving this plan approves them)
1. **Push.** `main` says "Alerts use in-app realtime updates, not browser push." New wording: alerts use realtime in-app updates *and* Web Push, targeted by barangay; device location is never stored.
2. **Triage:** "sets only suggested_office_id" becomes "sets only suggested_office_ids (one per category); never routes."
3. **Routing:** "route_report … writes routing_history" becomes "route_report (one or more offices) writes report_route_history (append-only) and audit_log; overall status is derived, never set by hand."
4. **Office visibility:** "see only reports assigned to their office" becomes "routed to their office (and not removed); other offices' remarks are never visible."
5. **Unverified users** "may read alerts and the office directory only" gains: "may also follow barangays and receive push for followed barangays and municipality-wide alerts."
6. **New rules:**
   - no emojis in the UI (lucide icons with labels);
   - active navigation is always highlighted;
   - all UI text uses translation keys, and every Filipino string is listed in `docs/translation-review.md`;
   - user content is never translated;
   - residents never read `reports` directly; map data comes only from `nearby_reports`;
   - no real-time location tracking.
7. **Stack:** add lucide-react, react-i18next, tus-js-client, Web Push and Edge Functions.
8. **Privacy:** privacy notice v3 requires re-consent before reporting, voting or viewing the map. Videos may show bystanders, so the form discourages filming faces.

## Open questions (I'll use the default unless you say otherwise)
1. **Maximum categories per report:** default **3**.
2. **Video duration:** checked on the phone and recorded in the database; no server-side media processing. Acceptable?
3. **Rejection reason:** shown to the reporter? Default **yes**. It is the admin's review reason, not an office remark.
4. **An office that returned a report:** keeps read-only access? Default **yes**. A *removed* office loses all access.
5. **Office staff and the reporter's name:** default **hidden**, for data minimization; only admins see it.
6. **Office status changes:** forward steps only; resolved can go back to in progress with a remark; returned is final for that office until an admin re-routes. Admins cannot set an office's status on its behalf. OK?
7. **Barangay locations:** I need either the **official barangay boundary polygons** (for example the PSA/NAMRIA administrative boundaries at barangay level, as GeoJSON or a shapefile, published on HDX) or **one verified reference point per barangay** (the latitude and longitude of the barangay hall, for all 21). Until one arrives, `reference_point` stays empty and sensitive reports show only the barangay name. Which can your group provide?
8. **Translations:** I draft the Filipino text. The privacy notice is a legal text, so I recommend your adviser reviews the Filipino version.
9. **`docs/implementation-plan.md`:** update it at the end of each batch? Default **yes**.

## Verification after every batch
- Here:
  - `npm run test`, `npm run lint`, `npm run build`, `npm run check:secrets`;
  - every pgTAP file via `pg_prove` on a freshly rebuilt database (all migrations and seeds);
  - Playwright screenshots at 360, 768 and 1280 px, sent to you.
- On your machine: `npm run test:db` (Docker), then the batch's manual steps in PowerShell with Docker Desktop.
- Representative manual checks:
  - **Batch 1:** icons, the active tab, no overflow at 360 px.
  - **Batch 2:** EN/FIL toggle and that the choice persists after signing in again.
  - **Batch 3:** a report with two categories and a 30-second phone video; a 2-minute video is rejected.
  - **Batch 4:** route a report to BFP and MDRRMO; have one office return it and the other resolve it; check the overall status.
  - **Batch 5:** sign in as `bfp.staff@example.test`.
  - **Batch 6:** following barangays, push on localhost, `nearby_reports` privacy.
- I pause after each batch for your go-ahead.
