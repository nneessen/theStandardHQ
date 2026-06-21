#!/usr/bin/env python3
"""
Runtime smoke for the Spotlight Template Library (Step 4).

Proves the library WORKS end-to-end in the running app against the real DB:
  1. The library section renders with built-in "Starters" tiles.
  2. "Save current style" inserts a row → it appears under "Saved templates".
  3. Clicking a starter APPLIES its config (the studio view switches).
  4. Deleting the saved template removes it.
  5. No console errors throughout (storage/font noise filtered like the studio smoke).

Usage:
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (owner)
    python3 scripts/social-library-smoke.py
"""

import os
import re
import sys
import time
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    # Unique name so repeat runs don't collide / accumulate.
    tpl_name = f"Smoke {int(time.time())}"

    failures = 0
    checks: list[tuple[str, bool]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        console_errors: list[str] = []
        IGNORED = re.compile(r"inlining remote css|cssRules|fonts\.googleapis\.com|fontshare", re.I)
        page.on("console", lambda m: (m.type == "error" and not IGNORED.search(m.text)) and console_errors.append(m.text))
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))

        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed")
            return 3

        page.goto(f"{BASE}/social-studio", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)
        console_errors.clear()

        # 1. Library renders with starters.
        page.get_by_text("Template library", exact=False).scroll_into_view_if_needed()
        page.wait_for_timeout(800)
        checks.append(("Template library section present", page.get_by_text("Template library", exact=False).count() > 0))
        checks.append(("Starters present", page.get_by_text("Starters", exact=False).count() > 0))
        # Starter tiles are buttons titled Apply "<name>".
        checks.append(('Aurora Spotlight starter tile', page.locator('button[title=\'Apply "Aurora Spotlight"\']').count() > 0))
        page.screenshot(path=str(OUT / "social-library.png"))

        # 2. Save current style → appears under Saved.
        name_input = page.get_by_placeholder(re.compile(r"name this style", re.I))
        saved_ok = False
        if name_input.count():
            name_input.first.fill(tpl_name)
            page.get_by_role("button", name=re.compile(r"save current style", re.I)).first.click()
            try:
                page.wait_for_selector(f'button[title=\'Apply "{tpl_name}"\']', timeout=10000)
                saved_ok = True
            except Exception:
                saved_ok = False
        checks.append(("Save current style → template appears in Saved", saved_ok))
        page.screenshot(path=str(OUT / "social-library-saved.png"))

        # 3. Apply a starter changes the studio (Monthly Report starter → report card).
        #    Scope to the PREVIEW pane — the Library itself renders a Monthly Report
        #    thumbnail, so a global match would be true even before applying.
        preview = page.locator("[data-testid='social-preview']")
        monthly_starter = page.locator('button[title=\'Apply "Monthly Report"\']')
        if monthly_starter.count():
            monthly_starter.first.click()
            page.wait_for_timeout(900)
        checks.append((
            "Applying 'Monthly Report' starter switches the studio to the report card",
            preview.get_by_text(re.compile(r"agent of the month", re.I)).count() > 0,
        ))

        # 3b. Caption is per-post content — applying a template must NOT clobber it
        #     (regression guard for the review fix that strips caption from templates).
        caption_box = page.locator("textarea").first
        cap_ok = False
        if caption_box.count():
            caption_box.fill("KEEP THIS CAPTION 123")
            page.locator('button[title=\'Apply "Aurora Spotlight"\']').first.click()
            page.wait_for_timeout(700)
            cap_ok = caption_box.input_value() == "KEEP THIS CAPTION 123"
        checks.append(("Applying a template preserves the working caption", cap_ok))

        # 4. Delete the saved template.
        deleted_ok = False
        if saved_ok:
            tile = page.locator(f'div.group:has(button[title=\'Apply "{tpl_name}"\'])')
            # hover to reveal the delete button, then click it
            tile.first.hover()
            page.wait_for_timeout(300)
            del_btn = tile.first.locator('button[title="Delete template"]')
            if del_btn.count():
                del_btn.first.click()
                try:
                    page.wait_for_selector(f'button[title=\'Apply "{tpl_name}"\']', state="detached", timeout=10000)
                    deleted_ok = True
                except Exception:
                    deleted_ok = False
        checks.append(("Delete removes the saved template", deleted_ok))

        # 5. Console errors.
        checks.append((f"no console errors ({len(console_errors)})", len(console_errors) == 0))

        for label, ok in checks:
            mark = "✓" if ok else "✗ FAIL"
            if not ok:
                failures += 1
            print(f"   {mark} {label}")
        if console_errors:
            for e in console_errors[:6]:
                print(f"      • {e[:160]}")
        browser.close()

    print(f"\n{'✓ ALL CHECKS PASSED' if failures == 0 else f'✗ {failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
