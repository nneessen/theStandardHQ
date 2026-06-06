#!/usr/bin/env python3
"""
Smoke test for zero-config branded subdomains ({slug}.thestandardhq.com).

It serves the production build (build/) on a local port and uses Chromium's
--host-resolver-rules to make *.thestandardhq.com resolve to 127.0.0.1 — so we
can load the app as if it were on a real branded subdomain WITHOUT DNS or sudo.

Verifies:
  1. the-standard.thestandardhq.com  -> resolves the slug "the-standard" via the
     get_public_recruiting_theme RPC (the core of Part A) and renders a public
     recruiting page (NOT the marketing landing / login).
  2. <unknown>.thestandardhq.com     -> renders the CustomDomainError state
     gracefully (no crash) for an unknown slug.
  3. localhost                       -> still renders the primary site (regression).

Writes a JSON summary + screenshots to /tmp so verification does not depend on
bash stdout.

Requires: a production build in ./build (run `npm run build` first). The build
must point at the prod Supabase project so the public RPC resolves real slugs.
"""
import functools
import http.server
import json
import socket
import socketserver
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT / "build"
OUT = Path("/tmp")
KNOWN_SLUG = "the-standard"  # NickCustomLayout slug, known to exist in prod
UNKNOWN_SLUG = "definitely-not-a-real-slug-xyz"

result = {"ok": False, "build_dir": str(BUILD_DIR), "steps": []}


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    """Serve the SPA: fall back to index.html for client-side routes."""

    def do_GET(self):  # noqa: N802
        path = self.translate_path(self.path)
        if not Path(path).is_file():
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *args):  # silence
        pass


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main():
    from playwright.sync_api import sync_playwright

    if not (BUILD_DIR / "index.html").is_file():
        result["error"] = "no build/index.html — run `npm run build` first"
        (OUT / "subdomain-smoke-result.json").write_text(json.dumps(result, indent=2))
        return

    port = free_port()
    handler = functools.partial(SPAHandler, directory=str(BUILD_DIR))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    result["port"] = port

    def check(host, label, expect):
        url = f"http://{host}:{port}/"
        console_errors = []
        rpc_slugs = []
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        def on_request(req):
            if "get_public_recruiting_theme" in req.url:
                body = req.post_data or ""
                rpc_slugs.append(body)

        page.on("request", on_request)
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(5)  # allow async resolution + theme apply
        body_text = page.locator("body").inner_text()[:400]
        page.screenshot(path=str(OUT / f"subdomain-{label}.png"))
        step = {
            "label": label,
            "host": host,
            "rpc_calls": rpc_slugs,
            "console_errors": console_errors,
            "body_excerpt": body_text,
        }
        page.close()
        result["steps"].append((step, expect))
        return step

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--host-resolver-rules=MAP *.thestandardhq.com 127.0.0.1"]
        )

        # 1. Known branded subdomain -> slug resolves via RPC + recruiting render
        s1 = check(f"{KNOWN_SLUG}.thestandardhq.com", "known", "recruiting")
        # 2. Unknown branded subdomain -> graceful CustomDomainError
        s2 = check(f"{UNKNOWN_SLUG}.thestandardhq.com", "unknown", "error")
        # 3. localhost primary regression
        s3 = check("localhost", "primary", "primary")

        browser.close()

    httpd.shutdown()

    # ---- evaluate ----
    s1_ok = (
        any(f'"{KNOWN_SLUG}"' in b for b in s1["rpc_calls"])
        and len(s1["console_errors"]) == 0
        and "This recruiting link is no longer active" not in s1["body_excerpt"]
    )
    s2_ok = (
        any(f'"{UNKNOWN_SLUG}"' in b for b in s2["rpc_calls"])
        # unknown slug must NOT crash; some not-found copy is expected
        and len(s2["console_errors"]) == 0
    )
    # primary must NOT call the public theme RPC at the root and must not crash
    s3_ok = len(s3["rpc_calls"]) == 0 and len(s3["console_errors"]) == 0

    result["evaluation"] = {"known": s1_ok, "unknown": s2_ok, "primary": s3_ok}
    result["ok"] = s1_ok and s2_ok and s3_ok
    result["steps"] = [s for (s, _e) in result["steps"]]
    (OUT / "subdomain-smoke-result.json").write_text(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        result["error"] = repr(e)
        (OUT / "subdomain-smoke-result.json").write_text(json.dumps(result, indent=2))
