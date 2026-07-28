-- Generic rate-limiter buckets (keyed "purpose:identifier") and an admin audit log.
-- The rate limiter backs /auth/forgot-password (per-IP and per-email) so it can't be
-- used to flood a victim's inbox or the Jarvis mail relay. Rows are lazily pruned once
-- their window expires.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket   TEXT PRIMARY KEY,   -- e.g. "forgot:ip:1.2.3.4" or "forgot:email:you@x.com"
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- Append-only record of privileged admin actions (user add/delete/password-reset).
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,             -- admin who performed the action
  actor_email TEXT,
  action      TEXT NOT NULL,    -- user.create | user.delete | user.password_reset
  target      TEXT,             -- affected email (or id)
  detail      TEXT,             -- optional JSON/text context
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
