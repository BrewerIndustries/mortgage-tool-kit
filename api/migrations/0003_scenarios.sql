-- Saved scenarios (a full snapshot of all calculator inputs), plus per-user
-- working state (autosave) and preferences (theme/accent).

CREATE TABLE scenarios (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  data       TEXT NOT NULL,            -- JSON snapshot of all inputs
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_scenarios_user ON scenarios(user_id, updated_at DESC);

ALTER TABLE users ADD COLUMN prefs TEXT;       -- JSON: { theme, accent }
ALTER TABLE users ADD COLUMN work_state TEXT;  -- JSON: last autosaved working inputs
