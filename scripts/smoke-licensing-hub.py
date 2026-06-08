#!/usr/bin/env python3
"""
Smoke test for the Licensing hub (SureLC links + My Documents + Writing Numbers).

Logs in (E2E_EMAIL/E2E_PASSWORD from .env.local — expects a super-admin so the
Company-links CRUD is exercised), opens /the-standard-team, and verifies:
  - the hub renders with the SureLC / My Documents / Writing Numbers tabs
  - the SureLC tab shows the Company + My links sections
  - a SureLC link can be created and then deleted (full write path, cleaned up)
  - the My Documents tab renders
  - no uncaught page errors on any tab
Screenshots to /tmp/licensing-hub/.

Usage:
    set -a; source .env.local; set +a
    python3 scripts/smoke-licensing-hub.py
"""

import os
import sys
import time
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/licensing-hub")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    label = f"PROBE SureLC {int(time.time())}"
    page_errs: list[str] = []
    console_errs: list[str] = []
    failures: list[str] = []

    def check(cond: bool, msg: str) -> None:
        print(f"  {'✓' if cond else '✗'} {msg}")
        if not cond:
            failures.append(msg)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1680, "height": 1050})
        page.on("pageerror", lambda e: page_errs.append(str(e)))
        page.on("console", lambda m: console_errs.append(m.text)
                if m.type == "error" else None)
        # auto-accept the delete confirm() dialog
        page.on("dialog", lambda d: d.accept())

        print(f"→ logging in at {BASE}/login as {EMAIL}")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        print("→ /the-standard-team")
        page.goto(f"{BASE}/the-standard-team", wait_until="networkidle",
                  timeout=30_000)
        # wait for the SureLC panel (and its query) to actually render
        page.wait_for_selector("text=Company SureLC links", timeout=20_000)
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "1-surelc.png"), full_page=True)

        # NOTE: inner_text() applies CSS text-transform, so headings/tab labels
        # come back uppercased — compare case-insensitively.
        body = page.locator("body").inner_text().lower()
        check("licensing" in body, "hub header 'Licensing' present")
        check("surelc" in body, "SureLC tab present")
        check("my documents" in body, "My Documents tab present")
        check("writing numbers" in body, "Writing Numbers tab present")
        check("company surelc links" in body, "Company links section present")
        check("my surelc logins" in body, "My links section present")

        # --- create a personal SureLC link (My section: always available) -----
        print("→ creating a personal SureLC link")
        # 'My SureLC logins' is the 2nd "Add link" button (Company is first)
        add_btns = page.get_by_role("button", name="Add link")
        target = add_btns.last if add_btns.count() > 1 else add_btns.first
        target.click()
        page.get_by_placeholder("Label (e.g. SureLC Producer Portal)").fill(label)
        page.get_by_placeholder("https://surelc.surancebay.com/…").fill(
            "https://accounts.surancebay.com/oauth/authorize")
        page.get_by_role("button", name="Save").click()
        page.wait_for_timeout(2500)
        check(label.lower() in page.locator("body").inner_text().lower(),
              "created link appears in the list")
        page.screenshot(path=str(OUT / "2-created.png"), full_page=True)

        # --- delete it (cleanup + exercises delete path) ----------------------
        print("→ deleting the probe link")
        # the row is the innermost div that BOTH holds the label and has the
        # delete button as a descendant
        row = page.locator(
            "div:has(button[aria-label='Delete link'])"
        ).filter(has_text=label).last
        row.get_by_role("button", name="Delete link").click(timeout=10_000)
        page.wait_for_timeout(2500)
        check(label.lower() not in page.locator("body").inner_text().lower(),
              "deleted link no longer in the list")

        # --- My Documents tab --------------------------------------------------
        print("→ My Documents tab")
        page.get_by_role("button", name="My Documents").click()
        page.wait_for_timeout(1500)
        docs_body = page.locator("body").inner_text().lower()
        check("my licensing documents" in docs_body,
              "My Documents panel rendered")
        page.screenshot(path=str(OUT / "3-documents.png"), full_page=True)

        # --- Writing Numbers tab (should at least render, gate or content) ----
        print("→ Writing Numbers tab")
        page.get_by_role("button", name="Writing Numbers").click()
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "4-writing-numbers.png"), full_page=True)

        browser.close()

    print("=" * 60)
    print(f"UNCAUGHT PAGE ERRORS: {len(page_errs)}")
    for e in page_errs:
        print(f"  ✗ {e}")
    # console errors are informational (3rd-party noise is common); show a few
    if console_errs:
        print(f"CONSOLE ERRORS (informational): {len(console_errs)}")
        for e in console_errs[:8]:
            print(f"  • {e}")

    ok = not failures and not page_errs
    print("=" * 60)
    print("RESULT:", "✅ PASS" if ok else f"❌ FAIL ({len(failures)} checks, "
          f"{len(page_errs)} page errors)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
