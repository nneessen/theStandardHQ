#!/usr/bin/env python3
"""
Mobile-responsiveness smoke for the Contracting Hub (/contracting). READ-ONLY:
logs in with .env.local creds, loads each tab at a phone viewport (375px) and at
the 768px breakpoint boundary, and fails on horizontal page overflow or JS errors.
Does NOT create/modify any data or touch the auth account.

Usage:
    set -a; source .env.local; set +a
    python3 scripts/smoke-contracting-mobile.py

Writes PNGs to /tmp/board-shots/contracting-mobile-<w>-<tab>.png ; exits non-zero
on JS errors or horizontal overflow (the "looks weird" symptom on mobile).
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")

# (width, height) — iPhone-ish phone + the md breakpoint boundary (767 = mobile).
VIEWPORTS = ((375, 812), (767, 900))

IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
)


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    overflow_fail = False

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 375, "height": 812})

        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed. Aborting.")
            browser.close()
            return 3

        for w, h in VIEWPORTS:
            page.set_viewport_size({"width": w, "height": h})
            for tab in ("mine", "downline"):
                page.goto(
                    f"{BASE}/contracting?tab={tab}",
                    wait_until="domcontentloaded",
                    timeout=30_000,
                )
                page.wait_for_timeout(3000)
                heading = page.get_by_role("heading", name="Contracting").count()
                path = OUT / f"contracting-mobile-{w}-{tab}.png"
                page.screenshot(path=str(path), full_page=True)
                # Horizontal overflow of the whole document = the page itself
                # scrolls sideways = "looks weird". Inner table h-scroll is fine.
                overflow = page.evaluate(
                    "Math.max(0, document.documentElement.scrollWidth"
                    " - document.documentElement.clientWidth)"
                )
                bad = overflow > 1
                overflow_fail = overflow_fail or bad
                flag = f"⚠ PAGE H-OVERFLOW +{overflow}px" if bad else "✓"
                print(f"   {w}px {tab:9s} heading={heading} → {path}  {flag}")

        browser.close()

    rc = 0
    if errors:
        print(f"\n✗ {len(errors)} JS error(s):")
        for e in errors[:20]:
            print(f"   {e}")
        rc = 1
    if overflow_fail:
        print("\n✗ page-level horizontal overflow detected on a mobile viewport")
        rc = rc or 4
    if rc == 0:
        print("\n✓ Contracting Hub mobile layout: no page overflow, no JS errors")
    return rc


if __name__ == "__main__":
    sys.exit(main())
