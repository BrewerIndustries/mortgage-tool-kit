# Worker API — deploy & CI/CD

The Worker auto-deploys via `.github/workflows/deploy-api.yml`:

- push to **dev** → deploys `mtk-api-dev` + applies migrations to the `mtk-dev` D1
- push to **main** → deploys `mtk-api` + applies migrations to the `mtk-prod` D1
  (main only advances through an approved PR, so this fires only after you merge)

It runs **only** when something under `api/` changes.

## One-time setup — the `CLOUDFLARE_API_TOKEN` secret

CI can't use your local OAuth login, so it needs an API token.

1. **Create the token** — https://dash.cloudflare.com/profile/api-tokens → **Create Token**
   → use the **"Edit Cloudflare Workers"** template. That template already grants the two
   permissions we need (Account · Workers Scripts · Edit, and the Workers KV/deploy scopes).
   Then **add one more permission row**: **Account · D1 · Edit** (needed for the migration step).
   Account resources: your account. Click through and **copy the token** (shown once).

2. **Add it to GitHub** — repo **BrewerIndustries/mortgage-tool-kit** → **Settings** →
   **Secrets and variables** → **Actions** → **New repository secret**:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: *(the token from step 1)*

   Via CLI instead:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN --repo BrewerIndustries/mortgage-tool-kit
   ```

That's it. The account ID is already baked into the workflow (not secret). Next push that
touches `api/` will deploy automatically; you can also trigger it from the **Actions** tab
(**Deploy Worker API** → **Run workflow**).

## Notes
- Worker secrets (e.g. `SESSION_SECRET`) are set once with `wrangler secret put SESSION_SECRET
  [--env dev]` and **persist across deploys** — CI does not touch them.
- Manual deploy still works locally: `npm run deploy:dev` / `npm run deploy`,
  `npm run migrate:dev` / `npm run migrate:prod`.
