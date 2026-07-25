#!/usr/bin/env bash
# Rebuild tnote-rates.js from FRED Daily Treasury Constant Maturity series.
# Bundles ~11 years of daily rates for the note tenors so the T-Note Lookup tab
# works offline with no CORS/network dependency. Run from anywhere; writes to the
# repo root's tnote-rates.js. Re-run periodically to extend the data through today.
set -euo pipefail
cd "$(dirname "$0")/.."

COSD="2015-07-01"
COED="$(date +%F)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for pair in 1Y:DGS1 2Y:DGS2 3Y:DGS3 5Y:DGS5 7Y:DGS7 10Y:DGS10; do
  sid="${pair#*:}"
  curl -sS -m 60 "https://fred.stlouisfed.org/graph/fredgraph.csv?id=${sid}&cosd=${COSD}&coed=${COED}" -o "$TMP/${sid}.csv"
  echo "fetched ${sid}: $(wc -l < "$TMP/${sid}.csv") lines"
done

TMP="$TMP" python3 - <<'PY'
import json, os, datetime
TMP = os.environ["TMP"]
TENORS = [("1Y","DGS1"),("2Y","DGS2"),("3Y","DGS3"),("5Y","DGS5"),("7Y","DGS7"),("10Y","DGS10")]
data = {}
for i,(label,sid) in enumerate(TENORS):
    for ln in open(f"{TMP}/{sid}.csv").read().strip().splitlines()[1:]:
        d,v = ln.split(",")
        data.setdefault(d, [None]*len(TENORS))
        data[d][i] = None if v in ("",".") else round(float(v),2)
rows = [[d]+vals for d,vals in sorted(data.items()) if any(x is not None for x in vals)]
out = {
  "source": "FRED - Daily Treasury Constant Maturity (DGS1,2,3,5,7,10)",
  "tenors": [t[0] for t in TENORS],
  "fetched": datetime.date.today().isoformat(),
  "start": rows[0][0], "end": rows[-1][0], "count": len(rows),
  "rows": rows,
}
open("tnote-rates.js","w").write("window.TNOTE_DATA = " + json.dumps(out, separators=(",",":")) + ";\n")
print(f"wrote tnote-rates.js: {len(rows)} rows, {rows[0][0]} -> {rows[-1][0]}, {os.path.getsize('tnote-rates.js')} bytes")
PY
