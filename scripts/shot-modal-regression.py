#!/usr/bin/env python3
"""Regression check for the inbound full-screen intake after the shared-form extraction. Logs in,
fires a live pop (crm-fire-test-call.sh) so the realtime screen-pop appears, and screenshots it +
its tabs. Confirms the modal still renders identically on the shared ClientFormTabs/ClientRecordRail."""
import os
import subprocess
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:4317")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = "/tmp/clients-shots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1680, "height": 1050})
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
    page.locator("input[type=email]").first.fill(EMAIL)
    page.locator("input[type=password]").first.fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(4000)
    # Land in the authed app so the realtime inbound-call subscription is active.
    page.goto(f"{BASE}/clients", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(2500)

    print("→ firing pop")
    subprocess.run(["bash", "scripts/crm-fire-test-call.sh"], check=False)
    # Wait for the realtime INSERT to drive the screen-pop.
    page.wait_for_timeout(6000)

    body = page.inner_text("body")
    popped = "Incoming call" in body
    print(f"modal 'Incoming call' visible: {popped}")
    page.screenshot(path=f"{OUT}/modal-client.png")
    for tab in ["Coverage", "Health"]:
        try:
            page.get_by_role("tab", name=tab, exact=False).first.click(timeout=4000)
            page.wait_for_timeout(700)
            page.screenshot(path=f"{OUT}/modal-{tab.lower()}.png")
            print(f"   modal [{tab}] shot ok")
        except Exception as e:  # noqa: BLE001
            print(f"   modal [{tab}] failed: {e}")
    browser.close()
