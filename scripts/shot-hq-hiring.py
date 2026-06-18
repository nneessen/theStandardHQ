#!/usr/bin/env python3
"""
Focused visual check for the "Now Hiring" hero highlight on the HQ landing page.
Confirms the eyebrow pill (.hero-tag) and QoL callout (.hero-hiring) render under
the "THE STANDARD HQ" headline, and captures hero screenshots at desktop + mobile
widths (to verify above-the-fold visibility + no horizontal overflow).

Assumes a vite dev server at SMOKE_BASE_URL (default :3001).
Writes result JSON + screenshots to /tmp.
"""
import json
import os
import time
import urllib.request
from pathlib import Path

BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:3001")
OUT = Path("/tmp")
result = {"base": BASE, "ok": False, "checks": {}}


def wait_for_server(timeout=120):
    # Raw vite returns 404 at "/" (SPA host-routing decides client-side), so any
    # HTTP *response* — including HTTPError — means the server is up. Only a
    # connection-level failure (URLError) counts as "not up yet".
    for _ in range(timeout):
        try:
            urllib.request.urlopen(BASE, timeout=2)
            return True
        except urllib.error.HTTPError:
            return True
        except Exception:
            time.sleep(1)
    return False


def main():
    from playwright.sync_api import sync_playwright

    if not wait_for_server():
        result["error"] = "server never came up"
        (OUT / "hq-hiring-result.json").write_text(json.dumps(result, indent=2))
        return

    with sync_playwright() as p:
        browser = p.chromium.launch()
        errors = []

        # ---- desktop ----
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        time.sleep(4)  # lazy three.js + effects

        title = page.locator(".theme-hq .hero-title")
        hiring = page.locator(".theme-hq .hero-hiring")
        result["checks"]["desktop"] = {
            "hero_title_count": title.count(),
            "hero_title_text": title.first.inner_text() if title.count() else "",
            "hero_hiring_count": hiring.count(),
            "hero_hiring_text": hiring.first.inner_text() if hiring.count() else "",
            # is the hiring callout within the first viewport (above the fold)?
            "hiring_in_viewport": page.evaluate(
                "(() => { const el=document.querySelector('.theme-hq .hero-hiring');"
                "if(!el) return false; const r=el.getBoundingClientRect();"
                "return r.top >= 0 && r.bottom <= window.innerHeight; })()"
            ),
            "doc_scroll_width": page.evaluate("document.documentElement.scrollWidth"),
            "inner_width": page.evaluate("window.innerWidth"),
        }
        page.screenshot(path=str(OUT / "hq-hiring-desktop-hero.png"))
        page.close()

        # ---- mobile ----
        m = browser.new_page(viewport={"width": 390, "height": 844})
        m.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        m.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        time.sleep(4)
        result["checks"]["mobile"] = {
            "hero_hiring_count": m.locator(".theme-hq .hero-hiring").count(),
            "doc_scroll_width": m.evaluate("document.documentElement.scrollWidth"),
            "inner_width": m.evaluate("window.innerWidth"),
            "no_h_overflow": m.evaluate(
                "document.documentElement.scrollWidth <= window.innerWidth + 1"
            ),
        }
        m.screenshot(path=str(OUT / "hq-hiring-mobile-hero.png"))
        m.close()

        browser.close()

    d = result["checks"]["desktop"]
    mob = result["checks"]["mobile"]
    result["console_errors"] = errors
    result["ok"] = (
        d["hero_title_count"] >= 1
        and "STANDARD" in d["hero_title_text"].upper()
        and d["hero_hiring_count"] >= 1
        and mob["hero_hiring_count"] >= 1
        and mob["no_h_overflow"]
        and len(errors) == 0
    )
    (OUT / "hq-hiring-result.json").write_text(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        result["error"] = repr(e)
        (OUT / "hq-hiring-result.json").write_text(json.dumps(result, indent=2))
