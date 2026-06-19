#!/usr/bin/env python3
"""E2E proof of the rehydration fix: a call fired BEFORE the browser's channel subscribes (so the
one-shot broadcast is already gone) must still pop, recovered by the on-subscribe rehydration query.
Uses existing creds, read-only; cleans up the ringing call afterward."""
import os, subprocess, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:4317")
EMAIL = os.environ.get("E2E_EMAIL"); PASSWORD = os.environ.get("E2E_PASSWORD")

def end_ringing():
    subprocess.run(["./scripts/migrations/run-sql.sh",
        "DELETE FROM inbound_calls WHERE status='ringing' AND request_tag LIKE 'demo-%';"],
        capture_output=True)

# Fire the call FIRST — broadcast goes into the void (no subscriber yet). It is NOT replayed.
end_ringing()
print("→ firing call BEFORE any browser/subscription (broadcast will be missed)…")
subprocess.run(["bash", "scripts/crm-fire-test-call.sh"], capture_output=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1680, "height": 1050})
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
    page.locator("input[type=email]").first.fill(EMAIL)
    page.locator("input[type=password]").first.fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(4000)
    page.goto(f"{BASE}/clients", wait_until="domcontentloaded", timeout=30_000)

    popped = False
    for _ in range(28):  # ~14s for the channel to subscribe + rehydrate
        if "incoming call" in page.inner_text("body").lower():
            popped = True; break
        page.wait_for_timeout(500)
    page.screenshot(path="/tmp/clients-shots/rehydrate-pop.png")
    end_ringing()
    browser.close()
    print("RESULT: PASS — missed pop recovered by rehydration" if popped
          else "RESULT: FAIL — rehydration did not recover the pop")
    sys.exit(0 if popped else 1)
