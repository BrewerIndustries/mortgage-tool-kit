# Financial Tool Kit — Backlog

Financial Tool Kit (formerly **Mortgage Tool Kit**) is expanding from a mortgage-only
app into a hub of personal-finance tool **areas**. The home page is a radial **hub** —
a central logo ($ placeholder) ringed by category "spokes." Mortgage is live; the other
areas ship one at a time. Work through them in the order below.

Tiers: **P0** = do next, **P1** = important, **P2** = polish / stretch. `[x]` = shipped.

---

## ✅ Phase 0 — Rebrand + hub shell (shipped)

- [x] Rebrand user-facing name to **Financial Tool Kit** (title, header, auth card, print/report brand, backup label). Infra unchanged — still `mortgage-tool-kit` repo, `mtk.dabrewer.dev`, `mtk-api` Worker, `mtk-prod`/`mtk-dev` D1.
- [x] Radial **home hub** with 6 category spokes + `$` placeholder logo (swap for real logo later).
- [x] Hub → category → tool navigation; header brand + on-page back links route home.
- [x] **Coming-soon** category pages that preview each area's planned tools.
- [x] Forced **disclaimer splash** ("information only — not legal or financial advice") gating entry into any area; acknowledged once per session (`sessionStorage`).

## ✅ Phase 1 — all five new areas shipped, v1 (2026-07-30, on dev)

Built a **declarative calculator framework** (a `CALCS` registry + a shared form/results
renderer in `index.html`), then implemented every area's first-round calculators on it.
Dark theme is now the default; the brand is centered; the hub intro was removed; accent
swatches show their names on hover.

- [x] **Auto** — loan payment, lease vs. buy, total cost of ownership, affordability, refinance, early payoff
- [x] **Investing** — compound growth, return/CAGR, dollar-cost averaging, investment goal, dividend/DRIP, portfolio allocation
- [x] **Budgeting & Savings** — 50/30/20 planner, savings goal, emergency fund, net worth, paycheck/take-home
- [x] **Credit & Debt** — debt payoff (snowball/avalanche sim), credit-card payoff, loan payoff, consolidation, utilization
- [x] **Retirement & Taxes** — 401(k)/IRA growth, retirement readiness, drawdown, 2024 federal tax, RMD

**Polish pass shipped (2026-07-30, dev):** removed the top title bar for a floating
bottom-right control dock (Home / theme / settings); `?` info tooltips on **every**
calculator field; distinct **per-calc icons**; **live canvas charts** on the growth/
projection tools (compound, DCA, goal, 401k, drawdown, TCO, budget split, readiness,
debt-payoff); a **knowledge base** of 17 in-app articles (3–4 per area) with a magazine-
style reader, a "Learn" section on every area grid, related-article links, and a
"Learn: …" link from each calculator to its most relevant article; a global footer.

**Follow-up hardening shipped (2026-07-30, dev):**
- [x] Extracted the new pure math into **`calc.js`** (`futureValue`, `presentValueAnnuity`,
  `payoffMonths`, `grow`, `federalTax`/`marginalRate` + `TAX_2024`, `debtPayoff`, `RMD_TABLE`);
  the inline calc helpers now delegate to `window.MTK`, so shipped == tested. **+15 unit tests**
  in `test/calc.test.mjs` (32 total, all green in CI).
- [x] **Thousands separators** on every generic money input (reuses `attachThousands`).
- [x] **Share** (copy a `#c=<id>~<base64>` deep-link that reopens the calc with its inputs,
  behind the disclaimer gate) and **Export CSV** (inputs + results) per calculator.

- [x] **Saved scenarios per area** — migration `0008_scenario_areas.sql` adds `area` + `calc`
  columns to `scenarios` (existing mortgage rows default to `area='mortgage'`, `calc=NULL`).
  The Worker's `/scenarios` list takes `?calc=<id>` (per-calculator) and defaults to
  `calc IS NULL` (mortgage snapshot, back-compat). Each generic calculator gets a signed-in
  Save / picker / Delete control that stores and reloads that calc's inputs.

Remaining for these areas (P1/P2): amortization/schedule detail views, and refresh tax/limit
figures annually. The per-area detail below is the record of intended scope.

## Cross-cutting — foundation for every new area (P0, do alongside Auto)

- [ ] **Generalize the shared model**: today the shared scenario is a mortgage "property/loan" object. Give each area its own scenario shape; namespace autosave + saved scenarios by area.
- [ ] Extend the D1 **`scenarios`** table (add an `area` column, or per-area tables) so saved scenarios don't collide across areas.
- [ ] Split **`calc.js`** into per-area modules (`calc/auto.js`, `calc/invest.js`, …) over shared primitives (amortization, PV/FV, IRR, tax brackets). Keep tested code == shipped code — tests import the same modules.
- [ ] Per-area **CSV/JSON export**, print report, and share-link support (reuse the existing mortgage patterns).
- [ ] Make the **disclaimer text area-aware** if we want stronger wording for tax/investing than for, say, budgeting.
- [ ] Design the **real logo** + favicon (mark + wordmark, light/dark); replace the `$` placeholder in the hub center and masthead.
- [ ] **Open decision — domain/infra rename.** Currently user-facing rebrand only. Full migration would mean `ftk.dabrewer.dev`, rename repo, `ftk-api` Worker, `ftk` D1, redirects from the old domain, and a dashboard re-id (`mtk` → `ftk`). Defer until at least one new area ships.

## 🚗 Auto — first new area (P0)

- [ ] **Auto loan payment** — price, down payment, trade-in, sales tax, fees, APR, term → monthly payment, total interest, amortization schedule
- [ ] **Lease vs. buy** — money factor, residual, cap cost vs. financing the same car over a holding period
- [ ] **Total cost of ownership** — depreciation curve, insurance, fuel/energy, maintenance, registration/tax over the years kept
- [ ] **Auto affordability** — budget + down + rate → target price / payment
- [ ] **Auto refinance** — current vs. new loan → monthly savings + break-even
- [ ] **Early payoff** — extra payment → interest saved, payoff date
- [ ] EV vs. gas running-cost comparison (stretch)

## 📈 Investing (P1)

- [ ] **Compound growth** — contributions, return, compounding freq, inflation-adjusted toggle + growth chart
- [ ] **Return / CAGR** — annualized return between two values/dates
- [ ] **Dollar-cost averaging** simulator through ups and downs
- [ ] **Portfolio allocation** + rebalance (target vs. actual mix)
- [ ] **Dividend / DRIP** reinvestment compounding
- [ ] **Investing 101** guide drawer (risk, diversification, index funds, fees, tax-advantaged accounts) — reuse the existing Learn drawer
- [ ] Optional live quote/return data source — decide bundled vs. API (stretch)

## 💰 Budgeting & Savings (P1)

- [ ] **Budget planner** — 50/30/20 + custom categories from take-home pay
- [ ] **Savings goal** — target + date → monthly contribution. ⚠️ Overlaps the standalone **Savings Goals** app — decide link-out vs. embed before building.
- [ ] **Emergency fund** sizer — 3–6 months of essential expenses + a funding plan
- [ ] **Net-worth** tracker — assets − liabilities over time
- [ ] **Paycheck / take-home** — gross → net (shared with Retirement & Taxes)

## 💳 Credit & Debt (P1)

- [ ] **Debt payoff** — snowball vs. avalanche across multiple debts (schedule, total interest, payoff date)
- [ ] **Credit-card payoff** — balance, APR, payment → months + interest; "pay off in N months → required payment"
- [ ] **Loan payoff** — personal/student-loan amortization + early-payoff savings (reuse amortization)
- [ ] **Debt consolidation** comparison vs. current balances
- [ ] **Credit-utilization** / score-factor explainer

## 🏛️ Retirement & Taxes (P2)

- [ ] **401(k) / IRA growth** — contributions, employer match, contribution limits
- [ ] **Retirement readiness** — savings + SS/pension income vs. target spend
- [ ] **Retirement drawdown** / safe-withdrawal projection
- [ ] **Federal tax estimate** — brackets, filing status, standard/itemized. Needs a bracket data source + annual refresh (mirror the T-Note refresh pattern).
- [ ] **RMD estimate** by age
- [ ] Note: tax tools carry extra "not tax advice" weight — keep the disclaimer prominent.

## Hub / UX polish (P2)

- [ ] Real logo swap-in + favicon (see cross-cutting)
- [ ] Keyboard nav around the hub (arrow keys between spokes) + full ARIA on the radial layout
- [ ] Optional "what is this area?" tooltip on each spoke
- [ ] Per-area accent color (e.g. Auto = blue, Investing = green) — ties into the existing accent system
- [ ] Global search across all tools; "recently used" / favorites row on the hub

---

# Mortgage area — original backlog

The items below are the mortgage toolkit's own review-driven backlog (its core is
shipped). This is now the **Mortgage** area of Financial Tool Kit.

Tiers: **P0** = highest value, **P1** = important, **P2** = polish / accessibility / extras.

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
