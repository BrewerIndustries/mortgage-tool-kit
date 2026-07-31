-- Namespace saved scenarios by area + calculator so the newer tool areas (Auto,
-- Investing, Budgeting, Credit & Debt, Retirement & Taxes) can each save and load
-- their own named scenarios, alongside the mortgage full-snapshot scenarios.
--
-- Existing rows are the mortgage full-snapshot scenarios, so they default to
-- area='mortgage' with a NULL calc (meaning "the whole mortgage input snapshot").
-- Generic-calculator scenarios store area=<category id> and calc=<calculator id>,
-- with `data` = the JSON input map for that one calculator.

ALTER TABLE scenarios ADD COLUMN area TEXT NOT NULL DEFAULT 'mortgage';
ALTER TABLE scenarios ADD COLUMN calc TEXT;   -- generic-calculator id; NULL = mortgage full snapshot

CREATE INDEX idx_scenarios_user_calc ON scenarios(user_id, calc, updated_at DESC);
