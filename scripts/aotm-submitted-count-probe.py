#!/usr/bin/env python3
"""
End-to-end visual confirmation of finding #2 (premium vs. policy-count).

Renders the LIVE monthly card (sample OFF) for the owner's agency and confirms the
"Agent of the Month" policy number is the SUBMITTED count (matches AP) — the value
get_agency_ap_leaderboard now returns — not the legacy APPROVED policy_count.

This is data-dependent (current-month leaderboard). At authoring time The Standard's
top current-month producer was "Marcus B." with 11 submitted vs 8 approved policies;
pass the expected submitted number via EXPECT_POLICIES to re-point it later.

Usage:
    set -a; source .env.local; set +a
    EXPECT_POLICIES=11 python3 scripts/aotm-submitted-count-probe.py
"""

import os
import re
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
EXPECT = os.environ.get("EXPECT_POLICIES")  # optional exact-match assertion
OUT = pathlib.Path("/tmp/board-shots")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)

        page.goto(f"{BASE}/social-studio", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)

        # Monthly view.
        page.get_by_role("button", name=re.compile(r"^monthly$", re.I)).first.click()
        page.wait_for_timeout(1200)

        # Ensure LIVE (sample off). The owner's agency has producers this month, so it
        # defaults to live; only toggle if the switch happens to be on.
        sw = page.locator("#samplePreview")
        if sw.count() and sw.first.get_attribute("data-state") == "checked" and not sw.first.is_disabled():
            sw.first.click()
            page.wait_for_timeout(800)

        preview = page.locator("[data-testid='social-preview']")
        sample_badge = preview.get_by_text(re.compile(r"sample preview", re.I)).count() > 0
        text = preview.inner_text()
        preview.screenshot(path=str(OUT / "aotm-submitted-count.png"))
        browser.close()

    print("--- monthly preview text ---")
    print(text)
    print("----------------------------")

    if sample_badge:
        print("⚠️  Card is showing SAMPLE (no live current-month producers) — can't confirm live count.")
        return 3

    # The AOTM block renders "<n> POLICIES" for the top performer. Scope to AFTER the
    # "AGENT OF THE MONTH" marker so we don't pick up a number from the total-AP value
    # that happens to sit next to the "POLICIES" stat label (e.g. "$224,604 POLICIES").
    m = re.search(r"AGENT OF THE MONTH.*?(\d+)\s+POLICIES", text, re.I | re.S)
    if not m:
        print("✗ couldn't find the Agent-of-the-Month '<n> POLICIES' stat on the card")
        return 1
    shown = int(m.group(1))
    print(f"✓ Agent-of-the-Month policy number on the LIVE card = {shown} (submitted count)")
    if EXPECT is not None:
        ok = shown == int(EXPECT)
        print(f"{'✓' if ok else '✗'} matches expected submitted count {EXPECT}: {ok}")
        return 0 if ok else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
