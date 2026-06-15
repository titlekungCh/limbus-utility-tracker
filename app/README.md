# Limbus Utility Tracker — local app

A local re-implementation of the "Limbus Utility Sheet" Google Sheet + `Code.gs`
Apps Script. It runs entirely on your machine: a tiny Python server serves a
web UI that reads/writes `app/data.json`.

## Run

Double-click **`Run Tracker.bat`** (in the project root), or:

```
python app/server.py
```

Then open http://localhost:8765 (the launcher opens it automatically).
Press `Ctrl+C` in the console window to stop.

## First-time setup / re-seeding from the spreadsheet

`app/data.json` is already generated. To rebuild it from the current
`Limbus Utility Sheet.xlsx`:

```
pip install openpyxl
python app/import_xlsx.py
```

After seeding, the spreadsheet is no longer needed to run the app.

## What's where

| File | Purpose |
|------|---------|
| `app/server.py`      | Local HTTP server + `GET/POST /api/state` |
| `app/import_xlsx.py` | One-time importer: xlsx → `data.json` |
| `app/data.json`      | The live state the app reads & writes (a `.bak` is kept on save) |
| `app/web/constants.js` | All costs/values ported from `Code.gs` |
| `app/web/logic.js`     | The Quick Buttons logic ported to JS |
| `app/web/app.js`       | UI rendering, tabs, save |

## UI

- **Dashboard** — Manager XP, Inventory, Lunacy, Mirror Dungeon status,
  Status, and the 12-sinner shard row (spreadsheet-style grid). Below that, a
  **Projections** section: Manager XP forecast (After 1–7 Daily / +1 MD), Crate
  forecast, Pass Level forecast, an ID Leveling calculator, and an editable
  Shard Planning table that rolls up into the Crate forecast. All forecast
  values were verified to match the spreadsheet's computed cells exactly.
- **Quick Buttons** — every item from the spreadsheet's custom menu:
  Daily, Manager XP (+undos), Gacha shard results, Extractions/Lunacy, Pulls,
  Tickets, Uptying, Thread Spinning, Intervallo shop, Season/Rental.
- **Event Shop** — the Intervallo planner (Inventory `A1:G13`): editable shop
  items (cost / total / bought → remaining + currency-to-finish), one-time
  rewards (cost / claimed) with the ID-EGO cost following the Reward Type, an
  editable Current Currency, and computed Currency Required / Needed / Short.
- **IDs / EGOs** — searchable, owned-only filterable, **fully editable** tables
  (edit level/uptie/threadspin/owned/lv-extra/etc., add or delete entries). The
  **Season**, **Keyword**, and **Extra Keyword** columns are **multi-selects**
  (tags) with an add-tag box. Colour-coded from the sheet's
  conditional formatting: name + Sinner/Grade dropdowns use the per-sinner /
  shard-type colours, Level uses the level-bracket fills, and Uptie/Threadspin
  use the red→yellow→green colour scale.
- The **Dashboard** is colour-coded too (Status sinner/tier dropdowns + current
  day, the Sinner-Shard headers, and the Shard-Planning sinner/type), and the
  **Event Shop** flags outstanding costs red / cleared green.
- **Bokgak Teams** — **fully editable** free-form grid (add/delete rows &
  columns); cells tinted by the sinner acronym they contain (e.g. " YS").
- **IF SS7** — structured view: an editable prediction / actual-result / keyword
  table (ID cells faction-coloured, keyword cells status-coloured), **computed**
  read-only stat cards (finger counts, totals, per-status ID/EGO counts — the
  sheet's COUNTIF formulas), the status-combo legend, and the registered-teams
  sub-grid below.

## Notes / differences from the sheet

- Manager level-ups use a `while` loop (the script used a single `if`); large
  XP jumps now level correctly. Single runs behave identically — verified that
  one Daily Luxcavation moves Current XP to exactly the sheet's "After 1 Daily".
- The **Intervallo shop** actions are quantity-driven inputs here, because the
  script read per-item counts out of the event area of the Inventory grid.
- ID Tier stars: the sheet stored tiers as 1–3 repeats of a custom-font glyph;
  these are converted to ★ / ★★ / ★★★ in the IDs table.
- The Shard Planning table is fully derived from the sheet's array formulas
  (`A27`/`A28`/`A29`/`A32`): Shard Needed/Thread Needed come from the shard type
  via the `ShardNumber` table, Owned is live, and Crate Needed =
  `enabled ? max(0,(needed-owned)/2) : 0`. The only inputs are the **Shard Type**
  and the per-sinner **Enabled** toggle (the sheet's `B24:M24` row) — turning it
  off zeroes that sinner's crate need (this is why Yi Sang & Don Quixote are 0).
- Sparkline mini-charts (the per-sinner shard bars) are not reproduced; the
  Shard Planning table shows the same numbers in tabular form.
