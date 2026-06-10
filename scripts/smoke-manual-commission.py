#!/usr/bin/env python3
"""
Smoke test for MANUAL commission entry on the Add Policy flow.

Context: comp_guide auto-calculation is paused (Epic Life has no comp guides).
Agents now type their OWN commission % on the policy form and the advance is
computed from it; an optional flat-dollar advance overrides the % math.

This verifies, at runtime, from BOTH add-policy entry points:
  1. Dashboard "Quick Actions" → Add Policy
  2. Policies page → "New policy"
that the dialog mounts with no runtime errors, the editable "Your Commission %"
field is present, and the "Expected Advance" preview recomputes live from the
agent's typed % and from a flat-dollar override.

It intentionally does NOT submit — we don't write junk policies into the real
local account (see memory: never touch real accounts).

Run:
  source .env.local && python3 scripts/smoke-manual-commission.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = os.environ.get("MC_SHOT", "/tmp/manual-commission-smoke.png")


def open_dialog_and_check(page, label: str) -> list[str]:
    """Assert the commission UI is present and computes. Returns list of problems."""
    problems: list[str] = []

    # The editable commission field (Pro-gated Financial Summary).
    comm = page.locator("#commissionPercentage")
    if comm.count() == 0:
        problems.append(
            f"[{label}] '#commissionPercentage' input not found "
            "(Financial Summary may be Pro-gated for this account)"
        )
        return problems

    # Premium drives annual premium; commission % drives the advance.
    page.locator("#premium").first.fill("250")
    comm.first.fill("85")
    page.wait_for_timeout(600)

    body = page.locator("body").inner_text()
    # 250/mo => 3000/yr; 3000/12 * 9 * 0.85 = 1912.50
    if "1912.5" not in body and "1,912.5" not in body:
        problems.append(
            f"[{label}] expected advance ~$1912.50 not shown after entering "
            "85% on $250/mo premium"
        )
    else:
        print(f"  ✓ [{label}] % → advance computed live ($1912.50)")

    # Flat-dollar override path.
    manual = page.locator("#manualAdvanceAmount")
    if manual.count() > 0:
        manual.first.fill("1900")
        page.wait_for_timeout(600)
        body = page.locator("body").inner_text()
        if "1900.00" in body and "manual" in body.lower():
            print(f"  ✓ [{label}] flat-$ override shows '$1900.00 (manual)'")
        else:
            problems.append(
                f"[{label}] flat-$ override did not surface $1900.00 (manual)"
            )
    else:
        problems.append(f"[{label}] '#manualAdvanceAmount' override input missing")

    return problems


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    console_errors: list[str] = []
    page_errors: list[str] = []
    problems: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_selector("input[type=email]", timeout=15_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.locator("button[type=submit]").first.click()
        # Wait for navigation away from /login (auth + redirect can take a bit).
        for _ in range(20):
            page.wait_for_timeout(1000)
            if not page.url.rstrip("/").endswith("/login"):
                break
        if page.url.rstrip("/").endswith("/login"):
            page.screenshot(path="/tmp/manual-commission-login-fail.png")
            print(
                "✗ login failed (still on /login). "
                "shot: /tmp/manual-commission-login-fail.png"
            )
            print("  page errors:", page_errors[:5])
            print("  console errors:", console_errors[:5])
            browser.close()
            return 1
        print(f"  ✓ logged in (at {page.url})")

        # ---- Entry point 1: Dashboard Quick Actions → Add Policy ----
        print("→ [1/2] dashboard Quick Actions → Add Policy")
        page.goto(f"{BASE}/", wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(2500)
        add = page.get_by_text("Add Policy", exact=True)
        if add.count() == 0:
            problems.append("[dashboard] 'Add Policy' quick action not found")
        else:
            add.first.click()
            page.wait_for_timeout(1500)
            problems += open_dialog_and_check(page, "dashboard")
            page.screenshot(path=OUT, full_page=True)
            print(f"  → screenshot: {OUT}")
            # close dialog
            page.keyboard.press("Escape")
            page.wait_for_timeout(800)

        # ---- Entry point 2: Policies page → New policy ----
        print("→ [2/2] policies page → New policy")
        page.goto(f"{BASE}/policies", wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(2500)
        newp = page.get_by_text("New policy", exact=False)
        if newp.count() == 0:
            problems.append("[policies] 'New policy' button not found")
        else:
            newp.first.click()
            page.wait_for_timeout(1500)
            problems += open_dialog_and_check(page, "policies")

        browser.close()

    if page_errors:
        print("✗ uncaught page errors:\n  " + "\n  ".join(page_errors[:10]))
        return 1
    real = [
        e
        for e in console_errors
        if "favicon" not in e.lower()
        and "404" not in e
        and "the message port closed" not in e.lower()
    ]
    if real:
        print(f"⚠ console errors ({len(real)}):\n  " + "\n  ".join(real[:10]))

    if problems:
        print("✗ problems:\n  " + "\n  ".join(problems))
        return 1

    print("✓ manual commission entry works from both entry points (no errors).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
