# Financial Tool Kit — Onboarding & Ways of Working

Welcome! This is the operating guide for **Financial Tool Kit** (repo still named
`mortgage-tool-kit` — see naming note below). Read it top to bottom once, then keep it
handy. **You can also drop this file into Claude Code** so your assistant knows the house
rules: copy it to `CLAUDE.md` at the repo root (Claude auto-loads it every session) or just
point Claude at `ONBOARDING.md`.

If you only remember three things:
1. **Work on `dev`. Never push to `main`** — prod only moves via a PR that Dan approves.
2. **Keep the source ASCII-only** (static hosts serve latin-1; raw UTF-8 mojibakes).
3. **Math goes in `calc.js` with a unit test** — the app and the tests import the same code.

---

## 1. What this is

A **static single-page app** (vanilla JS, HTML5 Canvas, **no build step, no framework, no
frontend dependencies**) plus a small **Cloudflare Worker + D1** backend for optional accounts.

It's a **hub of six personal-finance tool areas**:

- **Mortgage** (the original product) — 9 calculators: escrow analysis, amortization, payment
  (PITI), affordability/DTI, refinance, compare, ARM, rent-vs-buy, T-Note lookup.
- **Auto, Investing, Budgeting & Savings, Credit & Debt, Retirement & Taxes** — each a set of
  calculators built on a shared declarative framework, plus in-app knowledge articles.

The landing page is a **radial hub**; clicking a spoke animates into that area's calculators.
Entering **any** area shows a forced "information only — not advice" disclaimer. Every calculator
has tooltips, most projection tools draw a live chart, and each links to a knowledge article.

> **Naming:** The product was renamed **Mortgage Tool Kit → Financial Tool Kit** (user-facing
> only). The **repo, domain, Worker, and D1 are still `mtk`** on purpose — don't rename them.

---

## 2. Repo layout

| Path | What it is |
|------|-----------|
| `index.html` | **The entire frontend** — CSS in one `<style>`, HTML `#view-*` panels, one inline `<script>`. ~5.5k lines, no build. |
| `calc.js` | **Pure financial math.** Dual CommonJS/browser module: the app loads it as `window.MTK`, and the tests import it. Single source of truth. |
| `test/calc.test.mjs` | `node:test` unit tests with known-value fixtures. |
| `tnote-rates.js` | Bundled ~11yr of daily Treasury rates for the T-Note tool (refresh via `scripts/fetch-tnote-rates.sh`). |
| `api/` | Cloudflare **Worker (Hono) + D1** — auth, saved scenarios, autosave, prefs. `src/index.ts`, `migrations/*.sql`, `wrangler.toml`. |
| `README.md` | Architecture + hosting reference. **Keep it current.** |
| `BACKLOG.md` | The roadmap. Check items off as you ship; add new ones here (don't push to a dashboard). |
| `.jarvis.json` | Registry entry for Dan's internal dashboard. You rarely touch this. |
| `.github/workflows/` | `pages.yml` (deploy site), `test.yml` (unit tests), `deploy-api.yml` (Worker + D1 migrations). |

---

## 3. Get Claude Code connected to the repo

Do this once, before anything else.

**Prerequisites**
- A **GitHub account with access** to `BrewerIndustries/mortgage-tool-kit` — ask Dan to add you
  as a collaborator.
- **git**, **python3** (for the local static server), and **Node.js 20+** (for the unit tests and
  the Worker tooling).
- A **Claude account** — a Claude Pro/Max subscription, or an Anthropic Console API key.

**1. Install Claude Code** (native installer — Claude itself needs no Node):

```bash
# macOS / Linux / WSL:
curl -fsSL https://claude.ai/install.sh | bash
# Windows PowerShell:
#   irm https://claude.ai/install.ps1 | iex
```

Alternatives: `brew install --cask claude-code`, WinGet, or `npm install -g @anthropic-ai/claude-code`
(the npm route needs Node 22+). Verify:

```bash
claude --version    # e.g. "2.x.x (Claude Code)"
```

**2. Clone the repo and switch to `dev`:**

```bash
git clone https://github.com/BrewerIndustries/mortgage-tool-kit.git
cd mortgage-tool-kit
git checkout dev
```

**3. Start Claude Code from inside the repo and log in:**

```bash
claude
```

Claude Code operates on the directory you launch it from, so **always start it from the repo root.**
First run opens a browser to authenticate — sign in with your **Claude Pro/Max** account (or set
`ANTHROPIC_API_KEY` to use a Console key and skip the browser). Approve the tool-permission prompts
(Bash / Git / Read / Write) the first time they appear.

**4. Load these house rules into Claude.** Claude auto-loads a `CLAUDE.md` from the repo root every
session. This repo ships **`ONBOARDING.md`** (this file). To have Claude pick it up automatically,
either add a one-line `CLAUDE.md` at the repo root that points here (e.g. `See ONBOARDING.md for
project rules.`) or copy this file's content into `CLAUDE.md`. Otherwise just tell Claude
**"read ONBOARDING.md"** at the start of a session. Confirm what's loaded with:

```bash
/context     # lists the memory/CLAUDE.md files in effect
```

(Machine-only personal notes go in `CLAUDE.local.md`, which is git-ignored.)

**5. Sanity check** — start a session and ask it something:

```bash
claude
# at the prompt:
/status      # shows your login, org, and active model (default: Claude Opus 4.8)
/help        # list commands
what does this project do, and what should I NOT touch?
```

Use `/config` → **Model** to change the model if you need to.

**GitHub `@claude` on PRs (optional, admin-only):** mentioning `@claude` in a PR or issue requires
the Claude GitHub App installed on the repo (`/install-github-app`, run by a repo **admin**). You
probably won't have admin — **ask Dan** if you want that enabled.

---

## 4. Run it locally

It's a static file — no install needed for the frontend:

```bash
git checkout dev
python3 -m http.server 8791
# open http://localhost:8791/
```

On `localhost` the app talks to the **dev** API (`mtk-api-dev`), same as the `/dev/` site.

**Run the tests** (do this before every push that touches math):

```bash
node --test test/*.mjs
```

**Worker locally** (rarely needed — the deployed dev Worker is usually fine):

```bash
cd api && npm install && npx wrangler dev
```

---

## 5. The golden rule: branches & deploys

- **`dev` is the integration branch.** It auto-deploys to **https://mtk.dabrewer.dev/dev/**.
- **`main` is production** — **https://mtk.dabrewer.dev/**. It moves **only via a Pull Request
  that Dan reviews and approves.** Never `git push`, fast-forward, or reset-push to `main`.
- **As you're getting started, open a PR into `dev` for review** rather than committing straight
  to it, so a senior can look before it hits the dev site. Once you're trusted with an area,
  the team norm is small commits straight to `dev` are fine — ask Dan.

**What a push to `dev` triggers automatically:**
- `pages.yml` → rebuilds the `/dev/` site.
- `test.yml` → runs the unit tests (keep them green).
- `deploy-api.yml` → **only if `api/**` changed** → deploys `mtk-api-dev` **and applies new D1
  migrations to `mtk-dev`**. (On `main` it does the same to prod.)

So: a DB migration ships just by merging an `api/` change to the right branch. Get it right.

---

## 6. How the frontend is built (patterns you must know)

There are **two** calculator systems. Match the one you're extending.

### a) Mortgage tools (the original)
Each is a hand-built `#view-<id>` panel with a `compute*()` function, registered in the `TOOLS`
array, and toggled by `selectTool(id)`. Charts use `<canvas>`.

### b) Generic calculator framework (Auto / Investing / Budget / Debt / Retirement)
**This is where most new work happens.** Calculators are **data, not markup**. To add one, push
an object into the `CALCS` array in `index.html`:

```js
{ id: "auto-loan", cat: "auto", name: "Auto loan payment",
  desc: "Price, down, trade-in, tax, and APR → monthly payment and total interest.",
  inputs: [
    { k: "price", label: "Vehicle price", type: "money", def: 32000, step: 500 },
    { k: "apr",   label: "APR",           type: "pct",   def: 6.5,  step: 0.1 },
    { k: "term",  label: "Term (months)", type: "num",   def: 60,   step: 6 },
    // types: money | pct | num | select (with options:[[value,label],…])
  ],
  compute(v) {
    const pay = _pmt(financed, v.apr, v.term);   // _pmt/_fv/etc. delegate to window.MTK
    return { rows: [ { label: "Monthly payment", val: _mf2(pay) }, /* first row = hero */ ],
             note: "optional context string (may contain <strong>…</strong>)" };
  } }
```

Supporting maps (all keyed by calc id) let you enrich a calculator without touching the renderer:
- **`HELP`** — `"calcId.fieldKey" → tooltip text`. Every field should have help (inline `help:` on
  the field also works). "Tooltips everywhere" is a product rule.
- **`LEARN`** — `calcId → knowledge-article id`, renders a "Learn: …" link under the results.
- **`_CHARTS`** — `calcId → (v) => chartSpec`, draws a live line/bar chart (`_drawChart`).
- **`CALC_ICON`** — `calcId → SVG inner`, the card icon.

Other registries:
- **`CATEGORIES`** — the six hub spokes.
- **`KB`** — knowledge articles, embedded as JSON in the `#kbData` `<script>` block, rendered by a
  simple article reader.

Helpers you'll reuse: formatters `_mf` / `_mf2` / `_pf` / `_nf` / `_dur`; money math `_pmt` /
`_fv` / `_pvAnnuity` / `_payoffMonths` (all thin aliases over `window.MTK`).

### Cross-cutting frontend rules
- **Money math lives in `calc.js`** (`window.MTK`), not inline. Add a function there + a test.
- **Tooltips on every input.** **Disclaimer gate (`requireDisclaimer`) stays** — don't bypass it.
- **Theme-aware.** Dark is the default; everything must work in light + dark. Charts read CSS vars
  on each draw, so don't hard-code colors.
- **Estimates only.** Keep the "not legal/financial advice" disclaimers intact. Get real-world
  figures (tax brackets, contribution limits, rates) right, and cite the year.

---

## 7. The charset footgun (read this twice)

**Source files must stay ASCII-only.** The static host serves the page as latin-1, so raw UTF-8
characters (curly quotes, →, ≈, é, …) turn into mojibake. Use:
- **HTML entities** in HTML / `innerHTML` strings: `&rarr;`, `&mdash;`, `&amp;`, `&asymp;`.
- **Plain ASCII** in plain-text / CSV / `alert()` contexts.

If you paste text and see `â€™` or `Ã©` in the browser, this is why.

---

## 8. Backend & database (`api/`)

- **Stack:** Cloudflare Worker (Hono) + D1 (SQLite). PBKDF2 passwords, HMAC session ids,
  `SameSite=Lax` httpOnly cookie. **No open signup** — users are seeded
  (`cd api && npm run create-user -- --env dev --email you@x.com --password '…'`).
- **Two environments** in `wrangler.toml`: prod = default (`mtk-api` + D1 `mtk-prod`), dev =
  `[env.dev]` (`mtk-api-dev` + D1 `mtk-dev`).
- **Saved scenarios** are namespaced by `area` + `calc` (see `migrations/0008`). The mortgage app
  saves a full snapshot (`calc IS NULL`); each generic calculator saves its own inputs.

### Writing a migration
1. Add `api/migrations/NNNN_description.sql` (next number). **Additive only** — new tables/columns,
   `ADD COLUMN` with a constant default, new indexes. Don't rewrite existing rows destructively.
2. **Validate the SQL locally against SQLite first** (replay the relevant prior state, apply your
   file, check queries). Cheap insurance before it runs on the real D1.
3. Push the `api/` change → CI applies it (`dev` → `mtk-dev`, `main` → `mtk-prod`) and redeploys.
4. Confirm from the CI run log that the migration applied `✅`, and smoke-test the live endpoint.

> Worker **secrets** (`SESSION_SECRET`, etc.) persist across deploys — CI never clobbers them.

---

## 9. Definition of done

Before you call something finished:

- [ ] It works — **verified in the browser** (open the page, click through, check the console for
      errors). Don't ask a reviewer to "just check it works"; show a screenshot / the result.
- [ ] **Tests pass** (`node --test test/*.mjs`) and you **added tests for any new math**.
- [ ] Works in **light and dark**, and doesn't break **mobile** layout.
- [ ] **No new UTF-8** characters in source (ASCII-only).
- [ ] **`README.md` / `BACKLOG.md` updated** if the change is meaningful.
- [ ] Disclaimers intact; figures accurate and year-stamped.
- [ ] Committed on `dev` (or a branch → PR into `dev`). **Nothing on `main` without an approved PR.**

---

## 10. First day

1. Do Section 3 (Claude Code + repo, on `dev`), then serve locally
   (`python3 -m http.server 8791`) and click through every hub area.
2. `node --test test/*.mjs` — watch them pass so you know the baseline is green.
3. Skim `README.md`, then `BACKLOG.md`.
4. Pick a small **P1/P2** item from `BACKLOG.md`. Branch off `dev`, build it following the patterns
   above, add/keep tests green, verify in the browser, and open a PR into `dev`.
5. When in doubt, ask Dan — especially anything touching `main`, D1 migrations, or the disclaimer.

Welcome aboard.
