#!/usr/bin/env python3
"""
Light-mode visual check for shadcn OVERLAYS + INPUTS — the surfaces the owner
named explicitly (selects, dialogs, dropdowns, inputs). These render into the
`.theme-v2-portal-host` (a DIFFERENT subtree from the page), so the page-level
smoke can't see them. Here we open a Dialog, a Select listbox, and a form page
in light mode and screenshot each.

    set -a; source .env.local; set +a
    python3 scripts/smoke/shot-light-overlays.py [BASE_URL]

Shots → /tmp/light-overlay-*.png. Best-effort: prints what it managed to open.
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL/E2E_PASSWORD (source .env.local)")
        return 1
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 940})

        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.get_by_label("Email", exact=False).first.fill(EMAIL)
        page.get_by_label("Password", exact=False).first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3000)

        # Force light.
        page.evaluate(
            "() => localStorage.setItem('commission-tracker-theme', 'light')"
        )
        page.reload(wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(1500)

        # 1) Settings — form inputs / selects in light.
        page.goto(f"{BASE}/settings", wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(1800)
        page.screenshot(path="/tmp/light-overlay-settings.png", full_page=True)
        print("→ /tmp/light-overlay-settings.png (form inputs)")

        # 2) Add-Policy dialog — a modal with inputs + Selects.
        page.goto(f"{BASE}/dashboard", wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(1500)
        opened = False
        for name in ["Add Policy", "Add a Policy", "New Policy"]:
            btn = page.get_by_role("button", name=name, exact=False)
            if btn.count() > 0:
                try:
                    btn.first.click(timeout=4000)
                    page.wait_for_timeout(1200)
                    opened = True
                    break
                except Exception:
                    continue
        if opened:
            page.screenshot(path="/tmp/light-overlay-dialog.png")
            print("→ /tmp/light-overlay-dialog.png (Dialog + inputs)")
            # 3) Open a Select inside the dialog → portaled listbox.
            combo = page.get_by_role("combobox")
            if combo.count() > 0:
                try:
                    combo.first.click(timeout=3000)
                    page.wait_for_timeout(800)
                    page.screenshot(path="/tmp/light-overlay-select.png")
                    print("→ /tmp/light-overlay-select.png (portaled Select)")
                except Exception as e:
                    print(f"  (couldn't open a Select: {e})")
            else:
                print("  (no combobox/Select found in dialog)")
        else:
            print("  (Add-Policy button not found — dialog shot skipped)")

        browser.close()
    print("✓ overlay shots captured")
    return 0


if __name__ == "__main__":
    sys.exit(main())
