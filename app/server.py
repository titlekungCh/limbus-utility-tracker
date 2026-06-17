"""Tiny local server for the Limbus Utility Tracker.

Serves the static web/ frontend and a minimal JSON state API:
    GET  /api/state  -> current data.json
    POST /api/state  -> overwrite data.json (a .bak copy is kept)

Run:
    python app/server.py
Then open http://localhost:8765 in your browser.
"""
import json
import os
import re
import shutil
import threading
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
DATA = os.path.join(HERE, "data.json")
PORT = 8765

# Some icon hosts (wiki.gg / gll-fun) 403 a bare urllib request; mimic a browser.
ICON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "image/webp,image/png,image/*,*/*;q=0.8",
}
IMG_EXTS = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # quiet

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/state":
            try:
                with open(DATA, encoding="utf-8") as f:
                    self._send(200, f.read())
            except FileNotFoundError:
                self._send(404, json.dumps({"error": "data.json not found; run import_xlsx.py"}))
            return

        # static files
        if path == "/":
            path = "/index.html"
        target = os.path.normpath(os.path.join(WEB, path.lstrip("/")))
        if not target.startswith(WEB) or not os.path.isfile(target):
            self._send(404, "Not found", "text/plain; charset=utf-8")
            return
        ext = os.path.splitext(target)[1]
        with open(target, "rb") as f:
            self._send(200, f.read(), CONTENT_TYPES.get(ext, "application/octet-stream"))

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        if path == "/api/fetch-icon":
            self._fetch_icon(raw)
            return
        if path != "/api/state":
            self._send(404, json.dumps({"error": "unknown endpoint"}))
            return
        try:
            parsed = json.loads(raw)  # validate
        except json.JSONDecodeError as e:
            self._send(400, json.dumps({"error": f"invalid JSON: {e}"}))
            return
        if os.path.isfile(DATA):
            shutil.copy2(DATA, DATA + ".bak")
        with open(DATA, "w", encoding="utf-8") as f:
            json.dump(parsed, f, ensure_ascii=False, indent=2)
        self._send(200, json.dumps({"ok": True}))

    def _fetch_icon(self, raw):
        """Download an image URL into web/icons/keyword/ so it works offline.

        Body: {"url": <image url>, "name": <keyword name>} ->
        {"ok": true, "path": "icons/keyword/<slug>.<ext>"}
        """
        try:
            body = json.loads(raw or b"{}")
        except json.JSONDecodeError as e:
            return self._send(400, json.dumps({"error": f"invalid JSON: {e}"}))
        url = (body.get("url") or "").strip()
        name = (body.get("name") or "").strip()
        if not url or not name:
            return self._send(400, json.dumps({"error": "url and name are both required"}))
        if not url.lower().startswith(("http://", "https://")):
            return self._send(400, json.dumps({"error": "url must be http(s)"}))
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "keyword"
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
        if ext not in IMG_EXTS:
            ext = ".webp"
        origin = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(url))
        req = urllib.request.Request(url, headers={**ICON_HEADERS, "Referer": origin + "/"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
        except Exception as e:  # network / 403 / timeout
            return self._send(502, json.dumps({"error": f"download failed: {e}"}))
        dest_dir = os.path.join(WEB, "icons", "keyword")
        os.makedirs(dest_dir, exist_ok=True)
        fname = slug + ext
        with open(os.path.join(dest_dir, fname), "wb") as f:
            f.write(data)
        self._send(200, json.dumps({"ok": True, "path": "icons/keyword/" + fname}))


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print(f"Limbus Utility Tracker running at {url}")
    print("Press Ctrl+C to stop.")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
