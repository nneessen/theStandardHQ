#!/usr/bin/env python3
"""
End-to-end discriminating check for the Add Expense wizard's LEAD path.

Covers the two things the render-only smoke could not:
  A. The SAVE path actually runs — create a "Life Insurance Leads" expense
     through all 3 steps and click "Add expense"; the linked lead_purchase is
     created (toast + row appears).
  B. The EDIT preload race fix — re-open that expense; its vendor + lead count
     must be PRE-POPULATED (the bug the guarded effect fixes), even though
     `useLeadPurchaseByExpense` resolves after the form mounts.

It writes one clearly-labelled "SMOKE lead verify" expense to the E2E account and
DELETES it again at the end. Best-effort cleanup runs even on failure.

Usage:
    set -a; source .env.local; set +a
    python3 scripts/expense-lead-create-verify.py
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
NAME = "SMOKE lead verify"


def dismiss_inbound_pop(page) -> None:
    for _ in range(4):
        if page.get_by_text("Save intake", exact=False).count() == 0:
            return
        close = page.get_by_role("button", name="Close", exact=True)
        (close.first.click() if close.count() else page.keyboard.press("Escape"))
        page.wait_for_timeout(500)


def goto_expenses(page):
    page.goto(f"{BASE}/expenses", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(2500)
    dismiss_inbound_pop(page)


def row_for_name(page, name: str):
    rows = page.locator("table tbody tr")
    for i in range(rows.count()):
        row = rows.nth(i)
        if row.get_by_text(name, exact=False).count() > 0:
            return row
    return None


def cleanup(page, checks):
    """Delete the SMOKE expense if present."""
    try:
        goto_expenses(page)
        row = row_for_name(page, NAME)
        if row is None:
            return
        row.scroll_into_view_if_needed(timeout=4000)
        row.locator("button").last.click()
        page.wait_for_timeout(400)
        page.get_by_role("menuitem", name=re.compile(r"^\s*delete\s*$", re.I)).first.click()
        # ExpenseDeleteDialog renders as an alertdialog (not a plain dialog).
        page.get_by_role("alertdialog").wait_for(timeout=6000)
        page.get_by_role("alertdialog").get_by_role("button", name=re.compile(r"^\s*delete\s*$", re.I)).first.click()
        page.wait_for_timeout(1500)
        gone = row_for_name(page, NAME) is None
        checks.append(("cleanup: SMOKE expense deleted", gone))
    except Exception as e:
        checks.append((f"cleanup failed: {e}", False))


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    checks = []
    failures = 0

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

        try:
            goto_expenses(page)
            console_errors.clear()

            # ── A. CREATE a lead expense end-to-end ───────────────────────────
            page.get_by_role("button", name=re.compile(r"^\s*add\s*$", re.I)).first.click()
            dlg = page.get_by_role("dialog")
            dlg.wait_for(timeout=8000)

            dlg.get_by_placeholder("e.g., Lunch with client").fill(NAME)
            dlg.get_by_placeholder("0.00").fill("500")
            dlg.get_by_role("button", name="Leads", exact=True).click()  # lead category pill
            page.wait_for_timeout(400)
            checks.append(("lead block revealed", dlg.get_by_text("Lead purchase details", exact=False).count() > 0))

            # Vendor: pick the first existing, else add one.
            vtrigger = dlg.locator('[role="combobox"]').filter(has_text="Select vendor")
            vtrigger.first.click()
            page.wait_for_timeout(400)
            opts = page.get_by_role("option")
            if opts.count() > 0:
                opts.first.click()
            else:
                page.keyboard.press("Escape")
                dlg.get_by_role("button", name="Add vendor").click()
                vdlg = page.get_by_role("dialog").filter(has_text="Add Lead Vendor")
                vdlg.get_by_placeholder("e.g., LeadGenPro").fill("SMOKE Vendor")
                vdlg.get_by_role("button", name=re.compile(r"add vendor", re.I)).click()
                page.wait_for_timeout(1200)
            page.wait_for_timeout(300)
            checks.append(("vendor selected (placeholder gone)", dlg.get_by_text("Select vendor", exact=True).count() == 0))

            dlg.get_by_placeholder("50").fill("50")
            page.wait_for_timeout(400)
            checks.append(("rail shows cost-per-lead $10.00", dlg.get_by_text("$10.00", exact=False).count() > 0))
            page.screenshot(path=str(OUT / "expense-lead-create-step1.png"))

            # Walk to Review and submit.
            dlg.get_by_role("button", name=re.compile(r"continue", re.I)).first.click()
            page.wait_for_timeout(500)
            dlg.get_by_role("button", name=re.compile(r"continue", re.I)).first.click()
            page.wait_for_timeout(500)
            checks.append(("review shows lead cost-per-lead", dlg.get_by_text("Cost per lead", exact=False).count() > 0))
            page.screenshot(path=str(OUT / "expense-lead-create-review.png"))
            dlg.get_by_role("button", name=re.compile(r"add expense", re.I)).first.click()

            # Dialog should close on success.
            try:
                page.get_by_role("dialog").wait_for(state="detached", timeout=8000)
                checks.append(("create: dialog closed (saved)", True))
            except Exception:
                checks.append(("create: dialog closed (saved)", False))
            page.wait_for_timeout(1500)

            row = row_for_name(page, NAME)
            checks.append(("create: expense row appears", row is not None))
            checks.append((f"create: no console errors ({len(console_errors)})", len(console_errors) == 0))

            # ── B. EDIT preload race ──────────────────────────────────────────
            if row is not None:
                console_errors.clear()
                row.scroll_into_view_if_needed(timeout=4000)
                row.locator("button").last.click()
                page.wait_for_timeout(400)
                page.get_by_role("menuitem", name=re.compile(r"^\s*edit\s*$", re.I)).first.click()
                edlg = page.get_by_role("dialog")
                edlg.wait_for(timeout=8000)
                page.wait_for_timeout(2500)  # let the async lead-purchase query resolve

                checks.append(("edit: lead block present", edlg.get_by_text("Lead purchase details", exact=False).count() > 0))
                checks.append(("edit: vendor PRE-POPULATED (no placeholder)", edlg.get_by_text("Select vendor", exact=True).count() == 0))
                cnt = edlg.get_by_placeholder("50")
                cval = cnt.first.input_value() if cnt.count() else ""
                checks.append((f"edit: lead count pre-filled (= '{cval}')", cval.strip() == "50"))
                page.screenshot(path=str(OUT / "expense-lead-edit-preload.png"))
                checks.append((f"edit: no console errors ({len(console_errors)})", len(console_errors) == 0))
                page.keyboard.press("Escape")
                page.wait_for_timeout(500)
        finally:
            cleanup(page, checks)
            browser.close()

    print("\n── lead create + edit-preload → /tmp/board-shots/expense-lead-*.png")
    for label, ok in checks:
        mark = "✓" if ok else "✗ FAIL"
        if not ok:
            failures += 1
        print(f"   {mark} {label}")
    print(f"\n{'✓ ALL CHECKS PASSED' if failures == 0 else f'✗ {failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
