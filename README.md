# Mortgage Tool Kit

A ledger-styled, single-file mortgage toolkit — no build step, no server. Two tabs:

- **Escrow Analysis** — projects an escrow account 12 months out, sizes the RESPA
  cushion (0–2 months), and flags a **shortage** or **surplus** against the low
  point. Editable disbursement list (taxes, insurance, HOA, PMI…) with per-item
  frequency and due month. Live current → recommended payment comparison with
  monthly/annual/% deltas.
- **Amortization Schedule** — P&I payment, extra-payment savings, payoff date,
  and full **PITI** (P&I + the recommended escrow from the Analysis tab). Balance
  vs. cumulative-interest chart and a **Yearly / Monthly** schedule toggle.

### Features
- **Import historical activity** — paste or upload a servicer CSV (`Date`,
  `Description`, and either `Amount` or `Deposit`/`Withdrawal`, optional
  `Balance`). Reconstructs the ledger, auto-derives the disbursement list and
  starting balance, and shows the history in its own card.
- **Export** — context-aware **CSV** (escrow projection or amortization schedule)
  and a printable **Annual Escrow Account Disclosure Statement** (preview →
  Print / Save PDF or Download `.html`).
- Full light/dark theming; all figures use tabular monospace. Estimates only —
  not financial advice.

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
