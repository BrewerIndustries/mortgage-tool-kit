# Financial Tool Kit — project rules for Claude

The full operating guide is in **@ONBOARDING.md** (architecture, run/test, code patterns,
the DB-migration workflow, team). Read it before making changes.

**Never break these:**

- **Work on `dev`.** **Never** push, fast-forward, or reset `main` — production moves only via a
  Pull Request that **Dan approves**.
- Keep **`index.html` and `calc.js` ASCII-only** — the static host serves latin-1, so raw UTF-8
  mojibakes. Use HTML entities (`&rarr;`, `&mdash;`, `&amp;`, `&asymp;`) in HTML; ASCII in
  plain-text/CSV.
- Put financial math in **`calc.js`** (loaded as `window.MTK`) with a unit test in `test/` — the
  app and the tests import the same module, so shipped code == tested code.
- **Verify changes in the browser** and keep **`node --test test/*.mjs` green** before pushing.
- This is a **no-build, no-framework, no-frontend-dependency** app — keep it that way.
- Keep the **"not legal/financial advice" disclaimers** intact; the disclaimer gate on entering an
  area (`requireDisclaimer`) stays.
- The product is "Financial Tool Kit" but the **repo/domain/Worker/D1 stay named `mtk`** — don't
  rename them.
