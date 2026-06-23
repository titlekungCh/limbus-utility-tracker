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

After seeding, the spreadsheet is no longer needed to run the app. (Only
re-seed when `git status` is clean — in-app autosave makes `data.json` dirty
during normal use, and re-seeding overwrites it.)

## What's where

| File | Purpose |
|------|---------|
| `app/server.py`      | Local HTTP server + `GET/POST /api/state`; `POST /api/fetch-icon` |
| `app/import_xlsx.py` | One-time importer: xlsx → `data.json` |
| `app/scrape_season_icons.py` | Standalone tool: fetch new season / Walpurgis icons |
| `app/data.json`      | The live state the app reads & writes (a `.bak` is kept on save) |
| `app/web/constants.js` | All costs/values ported from `Code.gs` + colour palettes + icon paths |
| `app/web/logic.js`     | The Quick Buttons logic ported to JS |
| `app/web/projections.js` | Forecasts + calculators (verified against the sheet) |
| `app/web/icons-map.js` | Generated map: dropdown option → icon file |
| `app/web/app.js`       | UI rendering, tabs, save |
| `app/web/icons/`       | Local icon assets (keyword, sin, sinner, season, tier, resource, …) |

## UI

Tabs: **Dashboard, Quick Buttons, Event Shop, IDs, EGOs, Bokgak Teams,
IF SS7, MD Teams, Data.**

- **Dashboard** — editable Manager XP, Inventory, **Lunacy & Pulls** (incl.
  derived **Rolls (10-roll)** and **Total Rolls**), Mirror Dungeon status
  (rental week shown Yes/No, derived from the rental anchor), Status (Current
  Day/Patch, editable Event Currency + an **Add Currency** field), and the
  12-sinner shard row with tiered corner markers (red <50 / orange <150 /
  yellow <300 / lime <400 / green ≥400). Below: a **Projections** section —
  Manager XP forecast, Crate forecast, Pass Level forecast, an **ID Leveling
  Calculator** (with a "Use Tickets" button that spends the breakdown and
  levels the ID, plus `<`/`>` steppers to shift which ticket tiers are used),
  an **EGO Threadspinning Calculator**, and an editable **Shard Planning**
  table (resource icons + a red→green "owned vs needed" progress marker) that
  rolls into the Crate forecast. Forecast values match the sheet's cells.
- **Quick Buttons** — every item from the spreadsheet's custom menu:
  Daily, Manager XP (+undos), Sinner Gacha Result (per-tier 12-sinner grids),
  Extractions/Lunacy, Pulls (each tagged with the resource it would consume),
  Tickets, Uptying, Thread Spinning (TS4 shows its EGO-shard cost), Season.
- **Event Shop** — the Intervallo planner: editable shop items (cost / total /
  bought → remaining + currency-to-finish, icon-labelled), one-time rewards
  (cost / claimed) with the ID/EGO cost following the icon-labelled Reward
  Type, editable Current Currency, and computed Required / Needed / Short. A
  **currency-to-finish marker** colours the next item to save toward (priority
  order, cascading as you can afford each), and a **Complete Intervallo Shop**
  panel buys out items (adds the resource, spends currency, marks bought).
- **IDs / EGOs** — **fully editable** tables (level/uptie/threadspin/owned/
  lv-extra/etc., add or delete). Season / Keyword / Extra Keyword are
  multi-select tags. Per-session filter dropdowns: Sinner, Tier (IDs) / Grade
  (EGOs), Sin (EGOs), Season, Keyword, Extra Keyword, and UT (IDs) / TS (EGOs)
  — blank UT/TS counts as 0. The text search matches the **name only** and
  supports `term` (AND), `-term` (exclude), and `"quoted phrases"`. Owned rows
  get a green tint; everything is colour-coded from the sheet's formatting.
- **Bokgak Teams** / **MD Teams** — editable free-form grids (add/delete rows &
  columns); cells tinted by the sinner acronym they contain.
- **IF SS7** — structured view: editable prediction / actual-result / keyword
  table (ID cells faction-coloured, keyword cells status-coloured), computed
  read-only stat cards (the sheet's COUNTIF formulas), the status-combo legend,
  and the registered-teams sub-grid.
- **Data** — edit `state.constants` (curves, scalars, shard table with colour
  pickers, ticket XP) and manage the shared **Extra Keyword** list
  (add / rename / set icon via fetch / remove). Computed fields are read-only.

## Icons

Dropdown/label icons live under `app/web/icons/` (scraped from the Great Limbus
Library and the wiki, kept locally for offline use); `icons-map.js` maps option
values to files. When a new season releases, run
`python app/scrape_season_icons.py` to fetch its icon — numeric seasons resolve
to `icons/season/s-N.webp` automatically, no code edit needed. (Season
*colours* are still sampled from reference images by hand.)

## Notes / differences from the sheet

- Manager level-ups use a `while` loop (the script used a single `if`); large
  XP jumps now level correctly. Single runs behave identically — verified that
  one Daily Luxcavation moves Current XP to exactly the sheet's "After 1 Daily".
- **Weekly MD reset** fires once per patch-week (Thursday boundary) via
  `maybeWeeklyReset`, not on the Wednesday daily-lux click as in `Code.gs`, so
  hard-MD slots are always consumed in order regardless of when daily lux is
  pressed.
- Rental weeks are derived from a fixed anchor (`projections.js`), not a manual
  toggle.
- ID Tier stars: the sheet's custom-font glyph is shown as ★ / ★★ / ★★★.
- The Shard Planning table is derived from the sheet's array formulas
  (`A27`/`A28`/`A29`/`A32`): Shard/Thread Needed come from the shard type, Owned
  is live, Crate Needed = `enabled ? max(0,(needed-owned)/2) : 0`. Inputs are
  the **Shard Type** and per-sinner **Enabled** toggle.
- Sparkline mini-charts (the per-sinner shard bars) are not reproduced; the
  Shard Planning table shows the same numbers in tabular form.
