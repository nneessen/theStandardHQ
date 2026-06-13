#!/usr/bin/env python3
"""
Smoke: the Licensing hub (/the-standard-team) renders with exactly two tabs —
SureLC + My Documents — and the Writing Numbers tab is GONE (moved to the
Contracting page). Also asserts no uncaught console errors and that both
remaining tab bodies switch without throwing.

Usage (real .env.local super-admin, OR a throwaway demo account):
    set -a; source .env.local; set +a
    python3 scripts/smoke-licensing-tabs.py
    # demo fallback (safe throwaway):
    E2E_EMAIL=mgr1@epiclife-demo.test E2E_PASSWORD='DemoPass123!' \
        python3 scripts/smoke-licensing-tabs.py
"""

import os
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
ROUTE = "/the-standard-team"


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1680, "height": 1050})
        page.on(
            "console",
            lambda m: errors.append(m.text) if m.type == "error" else None,
        )
        page.on("pageerror", lambda e: errors.append(str(e)))

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
        page.wait_for_timeout(3000)

        ok = True

        # Writing Numbers tab must be gone.
        wn = page.get_by_role("button", name="Writing Numbers", exact=False)
        if wn.count() > 0:
            print("✗ 'Writing Numbers' tab still present — expected removed")
            ok = False
        else:
            print("✓ 'Writing Numbers' tab removed")

        # SureLC + My Documents tabs must exist and switch.
        for label in ("SureLC", "My Documents"):
            btn = page.get_by_role("button", name=label, exact=False)
            if btn.count() == 0:
                print(f"✗ '{label}' tab missing")
                ok = False
                continue
            btn.first.click()
            page.wait_for_timeout(1200)
            print(f"✓ '{label}' tab present + clickable")

        if errors:
            print(f"✗ {len(errors)} console error(s):")
            for e in errors[:8]:
                print(f"   • {e}")
            ok = False
        else:
            print("✓ no console errors")

        browser.close()
        return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
