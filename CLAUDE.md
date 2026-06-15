# CLAUDE.md

Guidance for working in this repo.

## What this is

A **local web app** that re-implements the "Limbus Utility Sheet" Google Sheet
(`Limbus Utility Sheet.xlsx`) and its Apps Script (`Code.gs`) — an inventory /
resource tracker for Limbus Company. It runs entirely offline: a tiny Python
server serves a static frontend that reads/writes `app/data.json`.

## Run / dev

```
python app/server.py          # serves http://localhost:8765, opens browser
# or double-click "Run Tracker.bat"
```

- **No build step, no Node, no framework.** Plain ES modules + a stdlib Python
  server. Files are served no-cache, so just reload the browser after editing.
- There is **no local JS runtime**. Verify changes by (a) serving and curling
  endpoints, and (b) mirroring any non-trivial calculation in Python and
  checking it against the spreadsheet's known values. Don't claim a JS change
  works without one of these.

## Architecture

| Path | Role |
|------|------|
| `app/server.py` | stdlib HTTP server; `GET/POST /api/state` ↔ `app/data.json` (keeps `.bak`) |
| `app/import_xlsx.py` | one-time seeder: xlsx → `data.json` (needs `openpyxl`) |
| `app/data.json` | the live state the app reads/writes |
| `app/web/constants.js` | all costs (ported from Code.gs) **and** colour palettes |
| `app/web/logic.js` | Code.gs Quick-Button logic ported to JS (operates on `state`) |
| `app/web/projections.js` | forecasts + calculators (Crate/Pass/Manager, ID Leveling, EGO Threadspin, Event Shop) |
| `app/web/app.js` | rendering + event wiring for every view |

Views (tabs): Dashboard, Quick Buttons, Event Shop, IDs, EGOs, Bokgak Teams, IF SS7.

## Conventions & gotchas

- **Commit + push after every change.** Branch `main`, remote
  `origin` = https://github.com/titlekungCh/limbus-utility-tracker (public).
  End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context)`
  trailer. `gh` is installed but not on PATH — call it by full path:
  `& "C:\Program Files\GitHub CLI\gh.exe"`. Plain `git push` works without it.
- **Re-seeding** (`python app/import_xlsx.py`) overwrites `data.json` entirely.
  Only do it when `git status` is clean — in-app autosave makes the file dirty
  during normal use, and reseeding would discard those edits.
- **Colours come from the spreadsheet's conditional formatting** where it has
  any (extract via openpyxl; theme-indexed fills resolve through the workbook
  palette). Where the sheet has none (season/keyword/tier/sin), colours were
  **sampled from user-provided reference images** — sample with Pillow
  (`pip install pillow`) by scanning vertical colour bands. All palettes live in
  `constants.js`; `contrastFont()` picks readable text per fill.
- **openpyxl + array formulas:** several Inventory formulas live in column A and
  spill across B:M. openpyxl exposes them as `ArrayFormula` objects, *not*
  strings starting with `=`. Scan for `ArrayFormula` when hunting for logic.
- **ID/EGO `name` is the col-A title only** (e.g. "LCB Sinner"); the
  `[name] sinner` form is just a sheet formula. Names are **not unique**, so
  calculators/selectors key off the array **index**, not the name.
- **IF SS7 / Bokgak grids preserve blank rows** on import (only trailing rows
  trimmed) so IF SS7's computed stat rows map to fixed indices.
- Dashboard editable numbers use a `data-path` attribute + one delegated
  `change` handler (`dashboardEdit` → `setByPath`). Add new editable fields the
  same way rather than per-element listeners.
- Faithfulness matters: when porting a formula, verify it reproduces the sheet's
  cached value exactly (note quirks, e.g. `COUNTIF(..,"* Bkgk")` is ends-with).

## Not built

- Sparkline mini-charts (the per-sinner shard bars) — shown as plain table
  numbers instead.
