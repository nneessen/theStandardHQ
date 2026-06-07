#!/usr/bin/env python3
"""
Authed screenshot harness for the guided Recruiting → Your Page wizard.

Drives the REAL app (local Supabase + dev server) through all 7 steps so we can
SEE the rendered UX — tsc/build green is not proof the user's "looks the same"
complaint is resolved.

Usage:
    set -a; source .env.local; set +a       # E2E_EMAIL / E2E_PASSWORD
    python3 scripts/shots-recruiting-wizard.py

Env:
    E2E_EMAIL, E2E_PASSWORD   required (gitignored .env.local)
    BASE                      optional, defaults to http://localhost:3000

Writes PNGs to /tmp/recruiting-wizard/NN-<step>.png and prints the visible
step heading at each stop + a flag if any "Upgrade"/locked prompt is showing
(which would mean the login user lacks the custom_branding entitlement and the
screenshots would be misleading).
"""

import os
import re
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/recruiting-wizard")

STEPS = ["link", "about", "look", "booking", "visitors", "domain", "review"]


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1680, "height": 1050})

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        print("→ /recruiting/your-page")
        page.goto(
            f"{BASE}/recruiting/your-page",
            wait_until="domcontentloaded",
            timeout=30_000,
        )
        page.wait_for_timeout(3500)

        advance = re.compile(r"^(Save & continue|Continue)$")

        for i, step in enumerate(STEPS):
            page.wait_for_timeout(1500)
            # Heading of the current step (the big <h2>)
            try:
                heading = page.locator("main h2").first.inner_text(timeout=4000)
            except Exception:  # noqa: BLE001
                heading = "(no h2 found)"
            # Detect a locked/upgrade prompt (entitlement missing)
            locked = page.get_by_text(
                re.compile(r"upgrade|locked|not included", re.I)
            ).count()
            shot = OUT / f"{i:02d}-{step}.png"
            page.screenshot(path=str(shot), full_page=True)
            flag = f"  ⚠ {locked} upgrade/lock prompt(s)" if locked else ""
            print(f"   [{i + 1}/7] {step:9s} → h2={heading!r}{flag}\n            {shot}")

            if step == "review":
                break
            # Advance to the next step
            btn = page.get_by_role("button", name=advance)
            if btn.count() == 0:
                print(f"   ✗ no advance button on step '{step}' — stopping")
                break
            btn.first.click()

        browser.close()
    print(f"\n✓ screenshots in {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
