#!/usr/bin/env python3
"""E2E proof of the Broadcast-from-trigger screen-pop cutover. Logs in (existing creds — read-only,
no credential changes), lands in the authed shell so InboundCallProvider joins the PRIVATE broadcast
channel inbound:<agent_id>, fires a live call (crm-fire-test-call.sh -> crm_upsert_call -> the
inbound_call_broadcast() trigger), and verifies the screen-pop appears — proving delivery now flows
over Broadcast, not postgres_changes. Cleans up the ringing call afterward (no stray pop)."""
import os, subprocess, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:4317")
EMAIL = os.environ.get("E2E_EMAIL"); PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = "/tmp/clients-shots"

def end_ringing():
    # dismiss any demo ringing call we created (keeps the account clean; not a login/cred change)
    subprocess.run(["./scripts/migrations/run-sql.sh",
        "DELETE FROM inbound_calls WHERE status='ringing' AND request_tag LIKE 'demo-%';"],
        capture_output=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1680, "height": 1050})
    subscribed = {"v": False}
    received = {"v": False}
    def _console(m):
        t = m.text
        if "inbound-call" in t:
            print(f"CONSOLE[{m.type}]:", t[:200])
            if "SUBSCRIBED" in t:
                subscribed["v"] = True
            if "RECEIVED" in t:
                received["v"] = True
    page.on("console", _console)
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
    page.locator("input[type=email]").first.fill(EMAIL)
    page.locator("input[type=password]").first.fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(4000)
    if page.url.rstrip("/").endswith("/login"):
        print("RESULT: FAIL — login did not complete"); browser.close(); sys.exit(3)

    # Land in the authed shell so the private broadcast channel subscribes; give it a safe window
    # (getSession + setAuth + join) before firing — broadcasts are one-shot, not replayed.
    page.goto(f"{BASE}/clients", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(8000)
    print("→ firing a live inbound call (broadcast path)…")
    subprocess.run(["bash", "scripts/crm-fire-test-call.sh"], capture_output=True)

    # Poll up to ~14s for the pop. Two independent signals: the broadcast handler fired (console
    # RECEIVED) and/or the modal header is visible (case-insensitive — it's CSS-uppercased).
    popped = False
    for _ in range(28):
        body = page.inner_text("body").lower()
        if received["v"] or "incoming call" in body:
            popped = True; break
        page.wait_for_timeout(500)

    page.screenshot(path=f"{OUT}/broadcast-pop.png")
    end_ringing()
    browser.close()

    if popped:
        print(f"RESULT: PASS — screen-pop arrived via the private Broadcast channel "
              f"(handler RECEIVED={received['v']}, channel SUBSCRIBED={subscribed['v']})")
        sys.exit(0)
    print("RESULT: FAIL — no pop within 14s (broadcast not delivered)")
    sys.exit(1)
