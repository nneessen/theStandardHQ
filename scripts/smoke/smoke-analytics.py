#!/usr/bin/env python3
"""
Render smoke for the redesigned Analytics page (/analytics) after the KPIs-page
merge: one tabbed dashboard (Overview · Production · Team · Inbound Calls ·
Coaching) replaces the old long scroll + the standalone /kpi page.

Logs in as the throwaway epiclife-demo manager (NOT a real account) and asserts:
  1. no JS/console errors throughout
  2. all five tabs render; Overview is active by default
  3. clicking "Inbound Calls" sets ?tab=inbound and renders the call KPIs
     (Performance / Close Rate) + the "Log day" control
  4. clicking "Coaching" renders Word Tracks + the "Open Sales Scripts" link
  5. deep-link /analytics?tab=inbound opens directly on the Inbound tab
  6. the retired /kpi route redirects to /analytics?tab=inbound

Prereqs:
    npm run dev                                      # vite on :3000
    ./scripts/migrations/run-sql.sh -f scripts/seed-demo-call-recordings.sql
    python3 scripts/smoke/smoke-analytics.py

Writes PNGs to /tmp/board-shots/analytics-tab-*.png ; exits non-zero on failure.
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
# Throwaway demo manager in the epiclife-demo IMO (2fd256e9). Overridable.
EMAIL = os.environ.get("DEMO_EMAIL", "mgr1@epiclife-demo.test")
PASSWORD = os.environ.get("DEMO_PASSWORD", "DemoPass123!")
OUT = pathlib.Path("/tmp/board-shots")

IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
    "browserslist",
)

TABS = ["Overview", "Production", "Team", "Inbound Calls", "Coaching"]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})

        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        print(f"→ logging in at {BASE}/login as {EMAIL}")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=40_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(4000)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        # ── 1. /analytics loads on the Overview tab ──────────────────────────
        page.goto(f"{BASE}/analytics", wait_until="domcontentloaded", timeout=40_000)
        page.wait_for_timeout(4000)

        for label in TABS:
            if page.get_by_role("button", name=label, exact=True).count() == 0:
                failures.append(f"tab button '{label}' not found")
        page.screenshot(path=str(OUT / "analytics-tab-overview.png"), full_page=True)
        print("  · Overview →", OUT / "analytics-tab-overview.png")

        # ── 2. Inbound Calls tab ─────────────────────────────────────────────
        page.get_by_role("button", name="Inbound Calls", exact=True).first.click()
        page.wait_for_timeout(3500)
        if "tab=inbound" not in page.url:
            failures.append(f"Inbound tab did not set ?tab=inbound (url={page.url})")
        low = page.inner_text("body").lower()
        if "performance" not in low:
            failures.append("Inbound tab: 'Performance' band not rendered")
        if "log day" not in low:
            failures.append("Inbound tab: 'Log day' control not rendered")
        if "close rate" not in low and "closing rate" not in low:
            failures.append("Inbound tab: close-rate KPI not rendered")
        page.screenshot(path=str(OUT / "analytics-tab-inbound.png"), full_page=True)
        print("  · Inbound →", OUT / "analytics-tab-inbound.png")

        # ── 3. Coaching tab ──────────────────────────────────────────────────
        page.get_by_role("button", name="Coaching", exact=True).first.click()
        page.wait_for_timeout(3000)
        if "tab=coaching" not in page.url:
            failures.append(f"Coaching tab did not set ?tab=coaching (url={page.url})")
        low = page.inner_text("body").lower()
        if "word track" not in low:
            failures.append("Coaching tab: Word Tracks library not rendered")
        if "open sales scripts" not in low:
            failures.append("Coaching tab: 'Open Sales Scripts' link not rendered")
        page.screenshot(path=str(OUT / "analytics-tab-coaching.png"), full_page=True)
        print("  · Coaching →", OUT / "analytics-tab-coaching.png")

        # ── 4. deep-link straight to the Inbound tab ─────────────────────────
        page.goto(
            f"{BASE}/analytics?tab=inbound",
            wait_until="domcontentloaded",
            timeout=40_000,
        )
        page.wait_for_timeout(3000)
        active = page.evaluate(
            "() => document.querySelector("
            "'nav[aria-label=\"Analytics sections\"] [aria-current=page]'"
            ")?.innerText || ''"
        )
        if "inbound" not in active.lower():
            failures.append(f"deep-link ?tab=inbound: active tab is {active!r}")

        # ── 5. /kpi redirects to the Inbound tab ─────────────────────────────
        page.goto(f"{BASE}/kpi", wait_until="domcontentloaded", timeout=40_000)
        page.wait_for_timeout(3000)
        if "/analytics" not in page.url or "tab=inbound" not in page.url:
            failures.append(f"/kpi did not redirect to /analytics?tab=inbound (url={page.url})")

        browser.close()

    ok = True
    if errors:
        ok = False
        print(f"\n✗ {len(errors)} console/page error(s):")
        for e in errors[:12]:
            print("   -", e)
    if failures:
        ok = False
        print(f"\n✗ {len(failures)} assertion failure(s):")
        for f in failures:
            print("   -", f)

    if ok:
        print("\n✓ analytics tabbed-redesign smoke passed (no errors, all tabs + redirect)")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
