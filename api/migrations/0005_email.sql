-- Email verification + an outbox drained by Jarvis (the box polls outbound; the
-- Worker can't reach it behind NAT, and Workers can't do raw SMTP anyway).

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- One row per verification link issued. token is the secret in the URL.
CREATE TABLE IF NOT EXISTS email_verifications (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Outbound mail queue. Jarvis GETs pending rows, sends them, POSTs the result.
CREATE TABLE IF NOT EXISTS email_outbox (
  id         TEXT PRIMARY KEY,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'generic',
  created_at INTEGER NOT NULL,
  sent_at    INTEGER,
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

-- Fast lookup of what still needs sending.
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON email_outbox (sent_at, attempts);
