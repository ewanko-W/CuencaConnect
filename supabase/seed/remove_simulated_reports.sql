-- Removes everything created by simulated_reports.sql: the simulated
-- residents and, through ON DELETE CASCADE, their reports, votes, photos
-- metadata, timelines, and routing history. Audit log entries are kept
-- (the audit log is append-only by design).
delete from auth.users where email like 'sim-__@example.test';
