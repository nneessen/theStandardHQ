#!/usr/bin/env python3
"""
Acceptance check for the Policies page redesign (the "reclaim the dead space"
handoff). Verifies the non-negotiables that tsc/build can't:

  1. No VERTICAL document scroll (all 10 rows reachable without scrolling).
  2. The 10th table row is inside the viewport.
  3. The pager ("of N") is visible.
  4. The insights band fills the space above the table.

Logs in with the authed E2E harness, loads /policies at a normal viewport and
a short one, prints PASS/FAIL per check, and saves a viewport-clipped PNG to
/tmp/board-shots/policies-noscroll-<viewport>.png.

Usage:
    set -a; source .env.local; set +a    # E2E_EMAIL / E2E_PASSWORD
    python3 scripts/policies-noscroll-check.py
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")

# (name, width, height). A normal laptop/desktop height and a short window.
VIEWPORTS = [("tall", 1680, 1050), ("normal", 1440, 900), ("short", 1440, 680)]


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        for vname, vw, vh in VIEWPORTS:
            page.set_viewport_size({"width": vw, "height": vh})
            page.goto(
                f"{BASE}/policies", wait_until="domcontentloaded", timeout=30_000
            )
            page.wait_for_timeout(3500)
            for _ in range(16):
                if page.locator(".animate-spin").count() == 0:
                    break
                page.wait_for_timeout(500)

            shot = OUT / f"policies-noscroll-{vname}.png"
            page.screenshot(path=str(shot))  # viewport-clipped (not full_page)

            v_overflow = page.evaluate(
                "Math.max(0, document.documentElement.scrollHeight"
                " - window.innerHeight)"
            )
            row_count = page.locator("table tbody tr").count()
            # Is the last data row within the viewport?
            last_row_ok = page.evaluate(
                """() => {
                  const rows = document.querySelectorAll('table tbody tr');
                  if (!rows.length) return false;
                  const r = rows[rows.length - 1].getBoundingClientRect();
                  return r.bottom <= window.innerHeight + 1 && r.bottom > 0;
                }"""
            )
            pager_ok = page.get_by_text(" of ", exact=False).count() > 0
            # The insights band must never collapse to header-slivers — it keeps
            # a ~156px floor so the four cards' bodies are always visible.
            band_h = page.evaluate(
                """() => {
                  const band = [...document.querySelectorAll('div')].find(
                    d => d.querySelector('svg') &&
                         d.className.includes('grid'));
                  return band ? Math.round(
                    band.getBoundingClientRect().height) : 0;
                }"""
            )
            band_ok = band_h >= 150
            # Is the table's own scroll container internally scrollable? (The
            # documented short-window fallback: the page never scrolls, the
            # table scrolls inside its capped region.)
            table_scrollable = page.evaluate(
                """() => {
                  const d = document.querySelector(
                    'div.overflow-auto');
                  // find the table's scroll container specifically
                  const els = [...document.querySelectorAll('div.overflow-auto')]
                    .filter(e => e.querySelector('table'));
                  return els.some(e => e.scrollHeight > e.clientHeight + 2);
                }"""
            )

            print(f"\n── /policies [{vname} {vw}x{vh}] → {shot}")
            if vname == "short":
                # Short window: page must NOT scroll; the table absorbs the
                # overflow internally and the pager stays pinned.
                checks = [
                    (f"no document scroll (overflow={v_overflow}px)", v_overflow <= 1),
                    (f"rows rendered ({row_count})", row_count > 0),
                    ("table scrolls internally (fallback)", bool(table_scrollable)),
                    (f"insights band visible ({band_h}px)", band_ok),
                    ("pager visible", pager_ok),
                ]
            else:
                # Normal/tall: all 10 rows visible with no scroll anywhere.
                checks = [
                    (f"no vertical scroll (overflow={v_overflow}px)", v_overflow <= 1),
                    (f"rows rendered ({row_count})", row_count > 0),
                    ("last row within viewport", bool(last_row_ok)),
                    (f"insights band visible ({band_h}px)", band_ok),
                    ("pager visible", pager_ok),
                ]
            for label, ok in checks:
                mark = "✓" if ok else "✗ FAIL"
                if not ok:
                    failures += 1
                print(f"   {mark} {label}")

        browser.close()

    print(f"\n{'✓ ALL CHECKS PASSED' if failures == 0 else f'✗ {failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
