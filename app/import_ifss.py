"""Merge the IF SS season sheet(s) from the xlsx into data.json.

Run this when a new season's prediction sheet has been added to the downloaded
spreadsheet (e.g. an 'IF SS8 Sheet'):

    python app/import_ifss.py

It reads every 'IF SS<N> Sheet' from 'Limbus Utility Sheet.xlsx', pulls the
Actual + Keyword block (F1:P13), the pre-computed stat cards (A15:P21), and the
faction colours from the sheet's conditional formatting, then merges them into
data.json under `ifss` WITHOUT touching anything else (a .bak is kept). Existing
seasons with the same number are refreshed; the app shows a per-season picker.
"""
import json
import os

import openpyxl

from import_xlsx import XLSX, OUT, extract_ifss


def main():
    if not os.path.exists(OUT):
        raise SystemExit(f"{OUT} not found — run 'python app/import_xlsx.py' first.")
    if not os.path.exists(XLSX):
        raise SystemExit(f"{XLSX} not found.")

    wb = openpyxl.load_workbook(XLSX, data_only=True)
    seasons = extract_ifss(wb)
    if not seasons:
        raise SystemExit("No 'IF SS<N> Sheet' sheets found in the xlsx.")

    with open(OUT, encoding="utf-8") as f:
        state = json.load(f)
    with open(OUT + ".bak", "w", encoding="utf-8") as f:   # safety backup
        json.dump(state, f, ensure_ascii=False, indent=2)

    ifss = state.get("ifss") or {}
    ifss.update(seasons)                                    # add/refresh; keep others
    state["ifss"] = ifss

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    print("Merged IF SS season(s):", ", ".join("SS" + k for k in sorted(seasons, key=int)))
    print("All seasons now present:", ", ".join("SS" + k for k in sorted(ifss, key=int)))


if __name__ == "__main__":
    main()
