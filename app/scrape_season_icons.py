#!/usr/bin/env python3
"""Download Limbus season / Walpurgisnaught icons.

Run this whenever a new season (or Walpurgis event) releases — no arguments,
no AI needed:

    python app/scrape_season_icons.py

It pulls the icons from the Great Limbus Library (gll-fun.com), the same source
the existing s-1..s-7 / w-1..w-8 icons came from, and saves any that aren't
already present into:

    app/web/icons/season/      s-N.webp   (season number N)
    app/web/icons/walpurgis/   w-N.webp   (Walpurgisnaught banners)

The app shows a numeric season's icon by convention (icons/season/s-N.webp), so
once this downloads s-8.webp, season "8" lights up automatically — no code edit.

NOTE: this fetches ICONS only. Season *colours* (constants.js
SEASON_NUMBER_FILL / SEASON_FILL) are sampled from reference images by hand and
are not touched here.
"""
import os
import urllib.request
import urllib.error

BASE = "https://gll-fun.com/images/season-icons"
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Referer": "https://gll-fun.com/",
}


def fetch(url):
    """Return the image bytes, or None if it isn't there / isn't an image."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            if r.status != 200:
                return None
            if "image" not in r.headers.get("Content-Type", ""):
                return None
            return r.read()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return None


def scrape(prefix, subdir):
    """Probe <prefix>-1, <prefix>-2, ... downloading any missing ones."""
    out = os.path.join(WEB, "icons", subdir)
    os.makedirs(out, exist_ok=True)
    added = 0
    n = 1
    misses = 0
    while misses < 2:  # stop after two consecutive numbers that don't exist
        name = "%s-%d.webp" % (prefix, n)
        dest = os.path.join(out, name)
        if os.path.exists(dest):
            print("  have  %s/%s" % (subdir, name))
            misses = 0
            n += 1
            continue
        data = fetch("%s/%s-%d.webp" % (BASE, prefix, n))
        if data:
            with open(dest, "wb") as f:
                f.write(data)
            print("  ADDED %s/%s  (%d bytes)" % (subdir, name, len(data)))
            added += 1
            misses = 0
        else:
            print("  none  %s-%d  (not on source yet)" % (prefix, n))
            misses += 1
        n += 1
    return added


def main():
    print("Season icons (s-*):")
    a = scrape("s", "season")
    print("Walpurgisnaught icons (w-*):")
    b = scrape("w", "walpurgis")
    print()
    if a + b:
        print("Done: %d new icon(s) downloaded." % (a + b))
        print("Numeric seasons auto-resolve to icons/season/s-N.webp in the app.")
        print("(Reminder: season colours are sampled by hand and not fetched here.)")
    else:
        print("Done: everything already up to date.")


if __name__ == "__main__":
    main()
