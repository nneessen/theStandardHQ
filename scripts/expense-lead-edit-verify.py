#!/usr/bin/env python3
"""
Discriminating runtime check for the lead-expense EDIT preload race.

The Add/Edit Expense wizard seeds its lead fields from an async query
(`useLeadPurchaseByExpense`) that resolves AFTER the form mounts. This proves the
guarded re-sync effect works: opening an existing "Life Insurance Leads" expense
must show its vendor + lead count PRE-POPULATED (not empty).

Strategy: filter the /expenses table to "Life Insurance Leads", open the first
row's Edit, and assert the lead block shows a real vendor (not the "Select
vendor" placeholder) and a positive lead count. Read-only — writes nothing.

If the account has no lead expense, it reports SKIP (create one, then re-run).

Usage:
    set -a; source .env.local; set +a
    python3 scripts/expense-lead-edit-verify.py
"""

import os
import re
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")
LEAD_CAT = "Life Insurance Leads"


def dismiss_inbound_pop(page) -> None:
    for _ in range(4):
        if page.get_by_text("Save intake", exact=False).count() == 0:
            return
        close = page.get_by_role("button", name="Close", exact=True)
        (close.first.click() if close.count() else page.keyboard.press("Escape"))
        page.wait_for_timeout(500)


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))

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

        page.goto(f"{BASE}/expenses", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)
        dismiss_inbound_pop(page)

        # Find a row whose category cell is exactly the lead category.
        rows = page.locator("table tbody tr")
        n = rows.count()
        target = None
        for i in range(n):
            row = rows.nth(i)
            if row.get_by_text(LEAD_CAT, exact=True).count() > 0:
                target = row
                break

        if target is None:
            print(f"⚠ SKIP: no '{LEAD_CAT}' expense found in this account.")
            print("  Create one (Add → Leads → vendor + count → Add), then re-run.")
            browser.close()
            return 0

        console_errors.clear()
        target.scroll_into_view_if_needed(timeout=5000)
        target.locator("button").last.click()  # kebab
        page.wait_for_timeout(400)
        item = page.get_by_role("menuitem", name=re.compile(r"^\s*edit\s*$", re.I))
        if item.count() == 0:
            item = page.get_by_text("Edit", exact=True)
        item.first.click()
        page.get_by_role("dialog").wait_for(timeout=8000)
        # Wait out the async lead-purchase query the fix depends on.
        page.wait_for_timeout(2500)

        dlg = page.get_by_role("dialog")
        checks = []
        checks.append(("on step 1 (Details)", dlg.get_by_text("Expense details", exact=False).count() > 0))
        checks.append(("lead block present", dlg.get_by_text("Lead purchase details", exact=False).count() > 0))
        # The bug: vendor would show the placeholder "Select vendor" if not preloaded.
        placeholder_visible = dlg.get_by_text("Select vendor", exact=True).count() > 0
        checks.append(("vendor PRE-POPULATED (no 'Select vendor' placeholder)", not placeholder_visible))
        # Lead count input (placeholder "50") must hold a positive value.
        count_val = ""
        cnt = dlg.get_by_placeholder("50")
        if cnt.count():
            count_val = cnt.first.input_value()
        checks.append((f"lead count pre-filled (= '{count_val}')", count_val.strip().isdigit() and int(count_val) > 0))

        page.screenshot(path=str(OUT / "expense-lead-edit-preload.png"))
        checks.append((f"no console errors ({len(console_errors)})", len(console_errors) == 0))

        failures = 0
        print("\n── lead-expense EDIT preload → /tmp/board-shots/expense-lead-edit-preload.png")
        for label, ok in checks:
            mark = "✓" if ok else "✗ FAIL"
            if not ok:
                failures += 1
            print(f"   {mark} {label}")
        for e in console_errors[:6]:
            print(f"      • {e[:160]}")

        browser.close()
        print(f"\n{'✓ PRELOAD VERIFIED' if failures == 0 else f'✗ {failures} FAILURE(S)'}")
        return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
