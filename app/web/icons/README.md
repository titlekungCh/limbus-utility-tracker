# Dropdown icons

Icons for the IDs/EGOs/Dashboard dropdowns (Keyword, Extra Keyword, Sin,
Sinner, Season/Walpurgisnaught, Grade), scraped from the fan site
**Great Limbus Library** (`https://gll-fun.com`, asset path
`/images/<folder>/<name>.webp`) on **2026-06-16**.

`manifest.json` maps this app's values (as used in `constants.js`) to the files
here. Paths in it are relative to the web root, e.g. `icons/sin/wrath.webp`.

## Folders

| Folder | Used by | Source folder | Notes |
|--------|---------|---------------|-------|
| `keyword/` | Keyword **and** Extra Keyword | `tags/` | the 7 combat statuses only (burn, bleed, tremor, rupture, sinking, poise, charge) |
| `sin/` | Sin | `sins/` | Gluttony's file is `glut.webp` |
| `sinner/` | Sinner | `sinners-icons/` | renamed to kebab-case (`yi-sang`, `don-quixote`, `hong-lu`, `meursault`) |
| `season/` | Season number | `season-icons/` (`s-0`..`s-7`) | source only has seasons 1–7; `s-0` kept raw. Run `python app/scrape_season_icons.py` to grab new ones — numeric seasons auto-resolve to `icons/season/s-N.webp` in the UI |
| `walpurgis/` | Walpurgisnaught | `season-icons/` (`w-1`..`w-8`) | one per Walpurgis event; the app has a single Walpurgisnaught tag. Also fetched by `scrape_season_icons.py` |
| `grade/` | Grade / danger level | — | **no images** — the source renders grades as Hebrew glyphs (ZAYIN ז, TETH ט, HE ה, WAW ו, ALEPH ℵ); see `manifest.json` → `grade` |

## Scope

Only the values this app actually uses were fetched (e.g. the keyword set is
exactly the 7 statuses in `STATUS_ORDER`, not every tag the source has).

These are third-party fan-site assets kept locally for offline use; not wired
into the UI yet.
