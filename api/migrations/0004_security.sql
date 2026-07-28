-- Security hardening: IP-based login throttling + forced first-login password change.
CREATE TABLE login_attempts (
  ip       TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
