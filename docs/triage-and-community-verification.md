# Keyword Triage and Community Verification

This document describes how CuencaConnect assigns priority to incoming reports and how resident votes are interpreted. Both mechanisms run inside the PostgreSQL database, so the client application cannot bypass them.

## 1. Keyword-based priority triage

### 1.1 Where it runs
Triage is a PostgreSQL trigger, `reports_triage`, which executes `public.triage_report()` before each report is inserted. It runs in the same transaction as the insertion. As a result, no report is ever stored without a priority, and neither a modified client nor a failed network call can skip the step.

A Supabase Edge Function was considered and not used, for three reasons:
- It would run after the insert, leaving a window in which a report exists without a priority.
- It would require an extra network hop and service credentials.
- It would duplicate access-control logic that the database already enforces.

### 1.2 Keyword lists
The English (`en`) and Filipino (`fil`) keyword lists are stored in `public.keywords` and edited by administrators at `/admin/keywords`. Each entry has:
- a term (a word or a phrase);
- a severity: `low`, `medium`, `high` or `critical`;
- an optional category hint.

A report whose text matches an active keyword of severity `critical` is marked critical (`is_critical = true`). Lower-severity keywords raise the report's priority without making it critical.

### 1.3 Matching procedure
1. **Normalization.** The report text and each keyword pass through the same function, `public.triage_normalize()`. It converts letters to lowercase, removes accents (so *sunóg* becomes *sunog*), and collapses repeated spaces.
2. **Whole-word matching.** A keyword must appear as a complete word or phrase. Matching uses the PostgreSQL regular-expression word boundaries `\m` and `\M`. Consequently:
   - *baha* (flood) does not match *bahay* (house);
   - *fire* does not match *fireworks* or *bonfire*;
   - *sunog* (fire) does not match *sunugan* (burning site).

   Punctuation, hyphens and emoji count as word boundaries, so *nag-fire*, *SUNOG!!!* and *🔥sunog🔥* all match.
3. **Severity.** The report's severity is the highest of two values: the baseline for its category (for example, fire is `high` and road is `low`) and the most severe matched keyword.
4. **Office suggestion.** Triage sets only `suggested_office_id`. It never routes a report; routing remains an administrator decision, made through `route_report`.

### 1.4 Re-triage rules
- **Escalate only.** Re-triage can raise a report's severity but never lowers it, and it never clears `is_critical`. Neither votes nor edits to the keyword lists can downgrade an incident that has already been classified critical.
- **List edits apply to open reports.** When an administrator adds, edits or deactivates a keyword, open reports that the new lists would escalate are re-triaged at once. The change is recorded in `audit_log` as `reports.retriaged`. Closed reports are not changed.

### 1.5 Design decision: negation is not interpreted
A report such as *"Walang sunog, usok lang"* ("No fire, just smoke") is still flagged critical. The system deliberately favours recall over precision. A false alarm costs an administrator a few seconds to reject, whereas a missed emergency may cost lives. Negation handling was rejected for a second reason: several critical phrases contain negators themselves, such as *hindi makahinga* ("cannot breathe") and *not breathing*.

## 2. Community verification thresholds

Verified residents may **Confirm** or **Dispute** a nearby report, with one vote per user per report. The votes are compared with three thresholds stored in the single-row table `public.community_thresholds`, which administrators edit at `/admin/keywords`.

| Setting | Default | Meaning |
|---|---|---|
| `min_confirms` | 3 | Minimum confirmations for a report to be *confirmed* |
| `min_disputes` | 3 | Minimum disputes for a report to be *disputed* |
| `dominance_ratio` | 2.0 | How many times one side must outnumber the other |

Let *c* be the number of confirmations and *d* the number of disputes:
- **confirmed** if *c* ≥ `min_confirms` and *c* ≥ `dominance_ratio` × *d*;
- **disputed** if *d* ≥ `min_disputes` and *d* ≥ `dominance_ratio` × *c*;
- **pending** otherwise, which covers both too few votes and contested reports.

The status (`reports.community_status`) is recomputed on every vote, and for all reports whenever the thresholds change. Threshold changes are recorded in `audit_log`.

### 2.1 Effects of the status
| Status | Residents' nearby map | Administrators |
|---|---|---|
| confirmed | Shown, with a "Community-confirmed" badge | Shown, with a badge; confirmations slightly raise priority |
| pending | Shown | Shown |
| disputed (routine report) | Hidden from other residents; the reporter still sees it | Shown, with a "Disputed" badge |
| disputed (**critical** report) | **Shown**, labelled disputed and listed first | **Shown** in the critical panel, still at critical priority |

### 2.2 Critical reports are never hidden by disputes
The following rules hold together:
1. The administrator `SELECT` policy on `reports` has no condition on votes.
2. `nearby_reports` keeps every critical report, even when it is disputed.
3. Votes change only the vote counts and `community_status`, never `severity` or `is_critical`.
4. Priority puts severity first (`priority_score = 100 × severity rank + votes`, with the vote effect capped at ±49), so a disputed critical report always outranks any high-severity report.
5. The Command Center's critical panel lists every open critical report, whatever the filters.

## 3. Verification
The rules are verified with pgTAP:

| Test file | Coverage |
|---|---|
| `supabase/tests/008_triage_corpus.test.sql` | 31 simulated reports in English, Filipino and Taglish, including 10 that must not be flagged critical, plus re-triage and audit checks (40 assertions) |
| `supabase/tests/009_community_thresholds.test.sql` | Threshold boundaries, map visibility, disputed critical reports, threshold editing and auditing (26 assertions) |
| `supabase/tests/006_keywords_triage.test.sql` | List editing, normalization of terms, and access control |

All corpus texts are fictitious.

## 4. Limitations
- **Inflected forms.** Filipino affixes and infixes produce many forms of a word (for example, *nasunugan*). Each variant must be added to the list as a separate keyword; the system does not stem words.
- **Misspellings.** Elongated spellings (*sunoggg*) and misspellings are not matched.
- **Small vote counts.** Community thresholds assume enough verified residents near an incident. In sparsely populated barangays, most reports will remain *pending*.
- **Starter lists.** The keyword lists in the seed data are drafts. They should be validated with the MDRRMO and native speakers before deployment.
