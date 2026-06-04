#!/usr/bin/env python3
"""
Capture the Licensing (writing-numbers) workspace across its view modes.
The modes are component STATE (not routes), so this clicks the switcher.

Usage:
    set -a; source .env.local; set +a
    python3 scripts/shots-licensing.py

Writes PNGs to /tmp/board-shots/licensing-<mode>.png
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")
ROUTE = "/the-standard-team"


def shot(page, name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"licensing-{name}.png"
    page.screenshot(path=str(path), full_page=True)
    overflow = page.evaluate(
        "Math.max(0, document.documentElement.scrollWidth - window.innerWidth)"
    )
    flag = f"⚠ H-OVERFLOW +{overflow}px" if overflow > 1 else "✓ no h-overflow"
    print(f"   {name} → {path}  {flag}")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1680, "height": 1050})

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

        page.goto(f"{BASE}{ROUTE}", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(3500)
        shot(page, "my")

        # Team view
        try:
            page.get_by_role("button", name="Team", exact=False).first.click()
            page.wait_for_timeout(2500)
            shot(page, "team")
            # Agent drill-in: click the first "View" button.
            view_btn = page.get_by_role("button", name="View", exact=False).first
            if view_btn.count() > 0:
                view_btn.click()
                page.wait_for_timeout(2500)
                shot(page, "agent-detail")
        except Exception as e:  # noqa: BLE001
            print(f"   team/agent-detail → {e}")

        # Compare view (re-navigate to reset state, then click Compare)
        try:
            page.goto(f"{BASE}{ROUTE}", wait_until="domcontentloaded", timeout=30_000)
            page.wait_for_timeout(2500)
            page.get_by_role("button", name="Compare", exact=False).first.click()
            page.wait_for_timeout(2500)
            shot(page, "compare")
        except Exception as e:  # noqa: BLE001
            print(f"   compare → {e}")

        browser.close()
    print(f"\n✓ screenshots in {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
