# Mortgage Tool Kit — Backlog

Prioritized, grouped work items from the critical review. Tiers: **P0** = highest
value (unlock what's already built, close core gaps), **P1** = important, **P2** =
polish / accessibility / extras. Check items off as they ship.

---

## P0 — Highest value

### Persistence & shared data model (make the accounts pay off)
- [x] Add a D1 `scenarios` table (`user_id`, `name`, JSON payload, created/updated) + admin-safe cascade on user delete
- [x] Introduce a single shared **property/loan scenario model** (price, loan, rate, term, taxes, insurance, disbursements) that every tab reads and writes
- [x] Migrate each tab's inputs to read/write the shared model instead of duplicating home price / loan / rate / taxes
- [x] Save / load / rename / delete named scenarios in the UI (scenario picker in the header)
- [x] Auto-save the working scenario (server-side when signed in, localStorage fallback otherwise) so a refresh never wipes inputs
- [x] Store per-user preferences (theme, accent) server-side so they follow the account across devices

### Core calculators people actually reach for
- [x] **Affordability / DTI** tab — income + monthly debts + rate → max home price & payment (front/back-end ratios)
- [x] **Refinance break-even** tab — current vs. new loan, closing costs, monthly savings, months-to-break-even

### Resilience
- [x] Graceful degradation when the auth backend is unreachable — let the client-side calculators still work, show a banner instead of a dead login gate
- [x] Decide + document the auth stance: gated app vs. public tool with optional sign-in for saved scenarios

---

## P1 — Important

### More calculators
- [x] **Loan comparison** — two scenarios side by side (15 vs 30 yr, or two lender quotes)
- [x] **Points / rate buydown** break-even analysis
- [x] **Bi-weekly payment** savings (interest saved, payoff acceleration)
- [x] **ARM payment projection** — initial rate, index + margin, periodic/lifetime caps; consumes the existing T-Note lookup (new ARM tab, "Use latest 1-yr T-Note" button)
- [x] Amortization: one-time / lump-sum extra payments and a "pay off by date X → required payment" solver

### Financial correctness
- [x] Make PMI a real input (rate + amount) with a sensible default instead of the flat 0.6%/yr heuristic
- [x] Model **PMI drop-off** at ~78–80% LTV over the amortization timeline (show the month it ends)
- [x] Add **APR / true cost** (note rate + fees) alongside the interest rate
- [x] Escrow: handle RESPA deficiency vs. shortage distinction and the initial escrow deposit at closing (+ optional annual tax/insurance escalation)
- [x] Fix schedule rounding so displayed amortization rows foot exactly (carry the rounding remainder)
- [x] Add total-cost-of-ownership view (lifetime interest + taxes + insurance + PMI)

### Security hardening
- [x] Bump the password KDF (PBKDF2 → ~600k+ iterations, or move to scrypt/argon2)
- [x] Add login rate-limiting (Cloudflare rule and/or D1 attempt counter with backoff/lockout)
- [x] Self-serve **password reset** flow (email), or at minimum an admin "set password" action
- [x] Force a password change on first login for seeded / temporary accounts
- [x] Prune expired sessions (scheduled Worker, or lazy purge on login)
- [x] Escape imported CSV fields before innerHTML (self-XSS via servicer CSV `Description`/`Date`)
- [x] Throttle `/auth/forgot-password` per-IP + per-email so it can't flood a victim inbox / the mail relay
- [x] Lazy-prune `login_attempts` + generic `rate_limits`; purge verification/reset tokens + queued mail on user delete (D1 FK cascade is off)

### Engineering & testing
- [x] Extract the pure calc functions into an importable module — `calc.js` is now the single source of truth, loaded by the app (`window.MTK`) AND the tests, so tested code == shipped code (payment/amortization/affordability/refinance/payoff no longer have inline copies)
- [x] Add a **unit test suite** for the calc module with known-value fixtures
- [x] Wire the tests into CI so they run on every PR
- [ ] Split the 2,120-line `index.html` into modules (CSS/JS separation or ES modules) without adding a heavy build

### Ops & reliability
- [x] CI/CD for the Worker (deploy on merge to `main` + run D1 migrations automatically) - needs CLOUDFLARE_API_TOKEN secret, see api/DEPLOY.md
- [ ] Monitoring / alert on the weekly T-Note data refresh (notify on failure)
- [x] Surface the T-Note data "fetched" date + a staleness warning in the UI when it's old
- [x] Mail-queue health visible in-app (admin) via `/admin/health` — flags a stalled relay so undelivered verification/reset email is detectable

---

## P2 — Polish, accessibility & extras

### UX
- [x] Info tooltips / popovers defining RESPA cushion, PITI, LTV, PMI, ARM lookback, escrow shortage, etc.
- [x] Thousands separators in number inputs while typing (400,000 vs 400000) — currency fields only; all reads go through comma-stripping parse
- [x] "Reset to defaults" control per tab
- [x] Combined **full mortgage report** print (all tabs in one PDF) — "Full report" button in the tab actions
- [x] Make export / statement buttons context-aware per tab (hide "Escrow statement" on non-escrow tabs)
- [ ] Short onboarding / "what each tab does" intro for first-time users

### Accessibility
- [x] Text alternative for the canvas charts — `role="img"` + live `aria-label` describing the current data (escrow low-point/cushion, amortization payoff/interest)
- [x] Contrast audit of muted/faint text — bumped `--faint` in both modes (darker in light, lighter in dark) for more legible fine print
- [x] `prefers-reduced-motion` handling for toggle / switch transitions
- [x] Full keyboard + ARIA pass on segmented controls (role=tab/aria-selected), accent swatches (aria-label/aria-pressed), and modals (role=dialog, aria-modal, Escape-to-close, focus trap, focus-on-open); added the missing `<meta charset>` + viewport

### Nice-to-have
- [x] Shareable read-only scenario links (encode inputs in the URL)
- [x] Full-scenario CSV/JSON export & import (not just per-tab)
- [ ] Currency / locale formatting option
- [x] Admin audit log for user add/delete (+ password resets); shown in Settings, backed by a D1 `audit_log` table
- [x] Email verification for new accounts (Worker outbox -> Jarvis Gmail relay; sends on user-create + Settings resend)
- [ ] Rent vs. buy calculator (stretch)
