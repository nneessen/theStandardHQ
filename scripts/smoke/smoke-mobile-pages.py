#!/usr/bin/env python3
"""
Mobile-responsiveness harness for arbitrary app routes. READ-ONLY: logs in with
the creds in the env, visits each route at a 375px phone viewport, screenshots
full-page, and reports page-level horizontal overflow + JS errors. Used to both
diagnose and verify the mobile-polish sweep.

Usage:
    set -a; source .env.local; set +a
    export E2E_EMAIL=mgr1@epiclife-demo.test E2E_PASSWORD='DemoPass123!'
    python3 scripts/smoke-mobile-pages.py            # all default routes
    ROUTES=/targets,/expenses python3 scripts/smoke-mobile-pages.py

PNGs → /tmp/board-shots/mobile-<slug>.png ; exits non-zero on overflow/JS errors.
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")
WIDTH = int(os.environ.get("MOBILE_W", "375"))
HEIGHT = int(os.environ.get("MOBILE_H", "812"))

DEFAULT_ROUTES = [
    "/targets",
    "/expenses",
    "/leaderboard",
    "/messages",
    "/agent-roadmap",
    "/contracting?tab=mine",
    "/contracting?tab=downline",
]
ROUTES = [
    r.strip()
    for r in os.environ.get("ROUTES", ",".join(DEFAULT_ROUTES)).split(",")
    if r.strip()
]

IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
)


def slug(route: str) -> str:
    return route.strip("/").replace("/", "-").replace("?", "-").replace("=", "-") or "root"


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD")
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    overflow_fail = False

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": WIDTH, "height": HEIGHT})

        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        print(f"→ logging in at {BASE}/login  ({WIDTH}x{HEIGHT})")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed. Aborting.")
            browser.close()
            return 3

        for route in ROUTES:
            page.goto(
                f"{BASE}{route}", wait_until="domcontentloaded", timeout=30_000
            )
            page.wait_for_timeout(2800)
            path = OUT / f"mobile-{slug(route)}.png"
            page.screenshot(path=str(path), full_page=True)
            overflow = page.evaluate(
                "Math.max(0, document.documentElement.scrollWidth"
                " - document.documentElement.clientWidth)"
            )
            # Element-level probe: any element whose right edge spills past the
            # viewport — catches clipped-but-broken panes (e.g. a fixed-width
            # sidebar) that document-level scrollWidth misses, and pinpoints the
            # exact offender instead of guessing across a big file.
            offenders = page.evaluate(
                "(() => { const cw = document.documentElement.clientWidth;"
                " return [...document.querySelectorAll('*')]"
                "  .filter(el => el.getBoundingClientRect().right > cw + 1)"
                "  .map(el => ({tag: el.tagName,"
                "    cls: String(el.className||'').slice(0,48),"
                "    w: Math.round(el.getBoundingClientRect().width),"
                "    right: Math.round(el.getBoundingClientRect().right)}))"
                "  .sort((a,b) => b.right - a.right).slice(0, 8); })()"
            )
            bad = overflow > 1
            overflow_fail = overflow_fail or bad
            flag = f"⚠ PAGE H-OVERFLOW +{overflow}px" if bad else "✓"
            print(f"   {route:28s} → {path.name}  {flag}")
            for o in offenders:
                print(
                    f"        ↳ <{o['tag'].lower()} class='{o['cls']}'>"
                    f"  w={o['w']} right={o['right']} (vw={WIDTH})"
                )

        browser.close()

    rc = 0
    if errors:
        print(f"\n✗ {len(errors)} JS error(s):")
        for e in errors[:20]:
            print(f"   {e}")
        rc = 1
    if overflow_fail:
        print("\n⚠ page-level horizontal overflow on one or more routes")
        rc = rc or 4
    if rc == 0:
        print("\n✓ all routes: no page overflow, no JS errors")
    return rc


if __name__ == "__main__":
    sys.exit(main())
