# Financial Tool Kit

A ledger-styled personal-finance toolkit — a static Pages frontend plus a small
Cloudflare Worker for auth. **Formerly Mortgage Tool Kit.** It's now a hub of six
tool **areas**: **Mortgage** (the original 9 tools) plus **Auto**, **Investing**,
**Budgeting & Savings**, **Credit & Debt**, and **Retirement & Taxes** — each with
its own first round of calculators (see `BACKLOG.md` for what's built and what's next).

The five newer areas run on a small **declarative calculator framework**: each
calculator is defined as a list of inputs + a `compute()` function (in the `CALCS`
registry in `index.html`), and a shared renderer builds the form and results. Adding
a calculator is data, not new markup. The money math reuses `window.MTK` (`calc.js`).
Every field carries a `?` **tooltip** and formats with **thousands separators**,
projection tools draw a **live canvas chart**, and each calculator links to a relevant
**knowledge article**, can **Export CSV**, and can **Share** a deep-link (`#c=<id>~<base64>`)
that reopens it with the same inputs. The pure math for these areas lives in **`calc.js`**
(`futureValue`, `presentValueAnnuity`, `payoffMonths`, `federalTax`, `debtPayoff`, `TAX_2024`,
`RMD_TABLE`, …) alongside the mortgage functions, so the app and the **`test/` unit suite**
run the exact same code (`node --test test/*.mjs`, 32 tests, wired into CI).

There is no top title bar — a floating **control dock** (bottom-right) holds Home,
theme, and settings. A built-in **knowledge base** of ~17 educational articles (in the
`kbData` JSON block, rendered by a magazine-style reader) appears as a "Learn" section
on each area's grid. To regenerate/extend it, edit `scratchpad/kb.raw.json`-style
sources and inject decoded HTML into the `#kbData` script tag.

The landing page is a radial **hub**: a central logo (a `$` placeholder for now)
ringed by category "spokes." Entering any area first shows a forced **disclaimer
splash** ("information only — not legal or financial advice"), acknowledged once
per visit. The **Mortgage** spoke opens the toolkit's launcher — a card grid of
every mortgage tool; opening one shows a slim toolbar (**← All tools**, a tool
switcher, and the export actions). The header title returns to the hub; on-page
**← Financial Tool Kit** links back out of an area. Signed-in users get a **Log
out** button by the settings gear.

> **Infra note:** the rebrand is user-facing only. The repo is still
> `mortgage-tool-kit`, hosted at `mtk.dabrewer.dev`, backed by the `mtk-api`
> Worker and `mtk-prod`/`mtk-dev` D1. A domain/infra rename to `ftk` is an open
> decision in `BACKLOG.md`.

## Mortgage area

The Mortgage area's tools:

- **Escrow Analysis** — projects an escrow account 12 months out, sizes the RESPA
  cushion (0–2 months), and flags a **shortage**, **surplus**, or **deficiency**
  (balance goes negative) against the low point. Shows the **initial escrow deposit**
  a new loan would collect at closing and an optional **annual tax/insurance
  escalation**. Editable disbursement list (taxes, insurance, HOA, PMI…) with per-item
  frequency and due month. Live current → recommended payment comparison.
- **Amortization Schedule** — P&I payment, extra-payment savings, payoff date,
  and full **PITI** (P&I + its own **Monthly escrow** input). Recurring
  extra, one-time **lump sum**, **bi-weekly**, and a **"pay off by date X → required
  payment" solver**. Balance vs. cumulative-interest chart and a **Yearly / Monthly** toggle.
- **Payment** — full monthly payment calculator: home price, down payment ($/%),
  rate, term, taxes ($ or %/homestead), insurance, HOA (mo/yr), closing costs
  (with roll-into-loan), and PMI → total **PITI + HOA + PMI** with a breakdown
  donut, cash-to-close, loan/LTV, and a printable summary.
- **Affordability** — income + monthly debts + front/back DTI → the max home
  price / loan / payment you qualify for (solved so full PITI stays within DTI).
- **Refinance** — current vs. new loan → new payment, monthly savings, break-even
  months, and lifetime cost difference.
- **Compare** — two loans side by side (rate, term, points, fees) → payments, total
  cost, and the break-even on the upfront gap.
- **ARM** — initial rate + fixed period, index + margin, and first/periodic/lifetime
  caps → projected payment path under "index holds" and "worst case" scenarios, each
  re-amortizing at every adjustment. A button fills the index from the latest bundled
  1-year Treasury.
- **Rent vs. Buy** — buying (appreciation, ownership costs, selling costs) vs.
  renting-and-investing (rent growth, investment return) over a horizon → net-worth
  comparison and the break-even year.
- **T-Note Lookup** — historical Treasury Constant Maturity rates (1Y–10Y) for an
  ARM-style lookback: enter a reference date and a lookback (e.g. 45 days); the
  tool takes the rate that many days earlier, and if that lands on a weekend or
  U.S. federal holiday it rolls back to the previous business day. Shows the full
  curve on the resolved date, recent business days, and a rate-history chart.
  Rates are **bundled** (`tnote-rates.js`, ~11 yrs of daily FRED DGS data) so
  lookups are instant and need no network. Refresh the data with
  `scripts/fetch-tnote-rates.sh`.

### Features
- **Import historical activity** — paste or upload a servicer CSV (`Date`,
  `Description`, and either `Amount` or `Deposit`/`Withdrawal`, optional
  `Balance`). Reconstructs the ledger, auto-derives the disbursement list and
  starting balance, and shows the history in its own card.
- **Export** — context-aware **CSV** (every tab, incl. ARM & rent-vs-buy), a
  printable **Annual Escrow Account Disclosure Statement**, and a **Full report**
  that prints every calculator's headline figures in one document.
- **Thousands separators** — currency inputs format as you type (`400,000`); all
  reads strip the commas so the math is unaffected.
- **Shared calc module** — the mortgage math lives in `calc.js`, loaded by the app
  (`window.MTK`) *and* imported by the unit tests, so the tested code is the code
  that ships (no inline copies to drift). Refresh formulas in one place.
- **Independent tabs vs. sign-in convenience** — as a **guest**, every tab is
  independent: each field (including the Amortization tab's monthly escrow) is
  filled separately, and nothing carries between tabs. **Signed in**, the Escrow
  Analysis tab auto-fills the Amortization escrow, and a **Clear fields** button
  (in the tab actions, with a two-step confirm) blanks every input across all tabs.
- **Accounts (optional sign-in)** — the calculators are usable without an account
  via **Continue without an account** (guest mode, autosaved to the browser only).
  Signing in adds **saved scenarios** (name + reload a full property snapshot),
  cross-device autosave, and server-stored theme/accent. Real login/logout +
  self-service password change, backed by a Cloudflare Worker + D1 (see `api/`).
  **Admins** get a Users section in Settings to add/remove accounts (role-gated),
  plus an **audit log** of admin actions and a **mail-queue health** readout that
  flags a stalled relay (so undelivered verification/reset email is visible).
  If the backend is unreachable the calculators still work (guest fallback).
- **Settings** (gear by the theme toggle) — Auto/Light/Dark theme, five accent
  colors (each with light + dark variants), and the account controls.
- Full light/dark theming; all figures use tabular monospace. Estimates only —
  not financial advice.

## Backend (`api/`)

A Cloudflare Worker (Hono) with a D1 database provides auth for the static
frontend. PBKDF2-hashed passwords, HMAC-derived session ids, `SameSite=Lax`
httpOnly session cookies. Prod = default env (`mtk-api.dabrewer.dev` + `mtk-prod`),
dev = `[env.dev]` (`mtk-api-dev.dabrewer.dev` + `mtk-dev`). No open signup —
users are seeded with `npm run create-user` (pass `--role admin` for an admin),
or added in-app by an admin. `/auth/forgot-password` is rate-limited per-IP and
per-email so it can't flood an inbox or the mail relay. Endpoints:
`/auth/{login,logout,me,change-password,forgot-password,reset-password,verify,resend-verification}`,
scenario + autosave routes, and admin-only `/admin/users` (GET/POST/DELETE),
`/admin/users/:id/password`, `/admin/audit`, and `/admin/health`.

```bash
cd api && npm install
npm run migrate:prod        # apply D1 migrations (and migrate:dev)
npx wrangler secret put SESSION_SECRET          # prod (and --env dev)
npm run deploy              # prod worker (deploy:dev for dev)
npm run create-user -- --env prod --email you@example.com --password 'min8chars'
```

The frontend picks its API base at runtime: the prod root uses `mtk-api`, the
`/dev/` path and localhost use `mtk-api-dev`.

## Run locally

It's a static file. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8791   # http://localhost:8791/
```

## Hosting (GitHub Pages, dev + prod)

One Pages site publishes both branches via `.github/workflows/pages.yml` (on
`dev`):

| Branch | Path | URL |
|--------|------|-----|
| `main` | `/` | https://mtk.dabrewer.dev/ |
| `dev`  | `/dev/` | https://mtk.dabrewer.dev/dev/ |

The workflow checks out both branches, writes the `CNAME`, and deploys. Pages
source = "GitHub Actions"; the `github-pages` environment allows the `dev` branch
to deploy. DNS: `CNAME mtk.dabrewer.dev → brewerindustries.github.io` (DNS-only).

## Workflow

- Work on **`dev`** → deploys to `/dev/` → verify there.
- Promote to prod **only via a PR** — never fast-forward / reset-push. Pushing to
  `dev` (or "Run workflow") rebuilds the Pages site.

Registered with the Jarvis Dashboard via `.jarvis.json` (id `mtk`, lane
`standalone`).
