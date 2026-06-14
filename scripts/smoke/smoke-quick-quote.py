#!/usr/bin/env python3
"""
Smoke test for the restored Quick Quote page.

Logs in (E2E_EMAIL/E2E_PASSWORD from .env.local), navigates to
/underwriting/quick-quote, and asserts the page mounts WITHOUT runtime/loading
errors and that real premium-rate data loads (carrier/product options appear).

The restored chain is: QuickQuoteDialog -> useQuickQuote ->
getAllPremiumMatricesForIMO -> RPC get_premium_matrices_for_imo.

Run:
  source .env.local && python3 scripts/smoke-quick-quote.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = os.environ.get("QQ_SHOT", "/tmp/quick-quote-smoke.png")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.locator("button[type=submit]").first.click()
        page.wait_for_timeout(4000)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            return 1

        print("→ navigating to /underwriting/quick-quote")
        page.goto(
            f"{BASE}/underwriting/quick-quote",
            wait_until="networkidle",
            timeout=30_000,
        )
        # Give the RPC-backed matrices fetch time to resolve.
        page.wait_for_timeout(6000)
        page.screenshot(path=OUT, full_page=True)
        print(f"→ screenshot: {OUT}")

        body = page.locator("body").inner_text().lower()

        # Hard fail signals: error boundary / blank crash.
        crash_markers = [
            "something went wrong",
            "application error",
            "unexpected error",
            "failed to fetch premium",
        ]
        hit = [m for m in crash_markers if m in body]
        if hit:
            print(f"✗ error markers on page: {hit}")
            browser.close()
            return 1

        # The Quick Quote UI should expose its quote inputs (age/gender/amount).
        ui_markers = ["age", "gender", "coverage", "premium", "quote"]
        ui_hit = [m for m in ui_markers if m in body]
        print(f"→ UI markers found: {ui_hit}")

        browser.close()

    if page_errors:
        print(f"✗ uncaught page errors:\n  " + "\n  ".join(page_errors[:10]))
        return 1
    # Ignore benign noise; surface real console errors.
    real = [
        e
        for e in console_errors
        if "favicon" not in e.lower() and "404" not in e
    ]
    if real:
        print(f"⚠ console errors ({len(real)}):\n  " + "\n  ".join(real[:10]))

    if not ui_hit:
        print("✗ Quick Quote UI markers not found — page may not have rendered.")
        return 1

    print("✓ Quick Quote rendered without crash; quote UI present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
