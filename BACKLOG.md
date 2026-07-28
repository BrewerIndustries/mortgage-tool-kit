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
- [ ] **Loan comparison** — two scenarios side by side (15 vs 30 yr, or two lender quotes)
- [ ] **Points / rate buydown** break-even analysis
- [ ] **Bi-weekly payment** savings (interest saved, payoff acceleration)
- [ ] **ARM payment projection** — initial rate, index + margin, periodic/lifetime caps; consumes the existing T-Note lookup
- [ ] Amortization: one-time / lump-sum extra payments and a "pay off by date X → required payment" solver

### Financial correctness
- [ ] Make PMI a real input (rate + amount) with a sensible default instead of the flat 0.6%/yr heuristic
- [ ] Model **PMI drop-off** at ~78–80% LTV over the amortization timeline (show the month it ends)
- [ ] Add **APR / true cost** (note rate + fees) alongside the interest rate
- [ ] Escrow: handle RESPA deficiency vs. shortage distinction and the initial escrow deposit at closing
- [ ] Fix schedule rounding so displayed amortization rows foot exactly (carry the rounding remainder)
- [ ] Add total-cost-of-ownership view (lifetime interest + taxes + insurance + PMI)

### Security hardening
- [ ] Bump the password KDF (PBKDF2 → ~600k+ iterations, or move to scrypt/argon2)
- [ ] Add login rate-limiting (Cloudflare rule and/or D1 attempt counter with backoff/lockout)
- [ ] Self-serve **password reset** flow (email), or at minimum an admin "set password" action
- [ ] Force a password change on first login for seeded / temporary accounts
- [ ] Prune expired sessions (scheduled Worker, or lazy purge on login)

### Engineering & testing
- [ ] Extract the pure calc functions (amortization, escrow projection, PITI, business-day rollback) into an importable module
- [ ] Add a **unit test suite** for the calc module with known-value fixtures
- [ ] Wire the tests into CI so they run on every PR
- [ ] Split the 2,120-line `index.html` into modules (CSS/JS separation or ES modules) without adding a heavy build

### Ops & reliability
- [ ] CI/CD for the Worker (deploy on merge to `main` + run D1 migrations automatically)
- [ ] Monitoring / alert on the weekly T-Note data refresh (notify on failure)
- [ ] Surface the T-Note data "fetched" date + a staleness warning in the UI when it's old

---

## P2 — Polish, accessibility & extras

### UX
- [ ] Info tooltips / popovers defining RESPA cushion, PITI, LTV, PMI, ARM lookback, escrow shortage, etc.
- [ ] Thousands separators in number inputs while typing (400,000 vs 400000)
- [ ] "Reset to defaults" control per tab
- [ ] Combined **full mortgage report** print (all tabs in one PDF)
- [ ] Make export / statement buttons context-aware per tab (hide "Escrow statement" on non-escrow tabs)
- [ ] Short onboarding / "what each tab does" intro for first-time users

### Accessibility
- [ ] Text alternative / data-table fallback for the canvas charts (ARIA)
- [ ] Contrast audit of muted/faint text on tinted theme backgrounds (WCAG AA in every accent, both modes)
- [ ] `prefers-reduced-motion` handling for toggle / switch transitions
- [ ] Full keyboard + ARIA pass on segmented controls, the switch, accent swatches, and modals (focus trap in modals)

### Nice-to-have
- [ ] Shareable read-only scenario links (encode inputs in the URL)
- [ ] Full-scenario CSV/JSON export & import (not just per-tab)
- [ ] Currency / locale formatting option
- [ ] Admin audit log for user add/delete
- [ ] Email verification for new accounts (if signup is ever opened up)
- [ ] Rent vs. buy calculator (stretch)
