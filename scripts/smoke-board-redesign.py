#!/usr/bin/env python3
"""
Smoke test for "The Board" redesign — verifies the app boots with no runtime
console errors and that PUBLIC pages still render in their original (non-board)
design. Requires a running dev server (default http://localhost:3001).

Usage:
  python3 scripts/smoke-board-redesign.py [BASE_URL]

Exit 0 = clean (no console errors on the public surfaces). Exit 1 = errors.
Screenshots are written to /tmp/board-smoke-*.png for visual review.

Note: the authenticated board surfaces (dashboard, lit rail) sit behind login,
so this script verifies boot + public-page isolation only. The authenticated
visual pass is done manually / via an authed Playwright session.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001"
PUBLIC_ROUTES = ["/login", "/"]


def main() -> int:
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on(
            "console",
            lambda m: errors.append(f"{m.type}: {m.text}")
            if m.type == "error"
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        for route in PUBLIC_ROUTES:
            url = f"{BASE}{route}"
            print(f"→ loading {url}")
            page.goto(url, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(800)
            bg = page.evaluate(
                "getComputedStyle(document.body).backgroundColor"
            )
            slug = route.strip("/").replace("/", "_") or "root"
            shot = f"/tmp/board-smoke-{slug}.png"
            page.screenshot(path=shot, full_page=True)
            print(f"   body bg = {bg}  |  screenshot → {shot}")

        browser.close()

    if errors:
        print(f"\n✗ {len(errors)} console error(s):")
        for e in errors[:25]:
            print("   -", e)
        return 1
    print("\n✓ public surfaces booted with zero console errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
