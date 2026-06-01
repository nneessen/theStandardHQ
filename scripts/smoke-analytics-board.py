#!/usr/bin/env python3
"""
Smoke test + screenshot for the Analytics "Board" redesign.

Boots the app and verifies there are no runtime console errors. The Analytics
page (/analytics) is authenticated, so a full visual capture needs credentials:

  E2E_EMAIL=you@example.com E2E_PASSWORD=secret \
    python3 scripts/smoke-analytics-board.py [BASE_URL]

Without creds it runs a PUBLIC boot check only (loads /login + / and asserts the
shared bundle — which now includes the board primitives + lazy analytics chunks
— boots with zero console errors). This catches import/runtime breakage even
though it can't render the authed page.

Screenshots → /tmp/analytics-smoke-*.png. Exit 0 = clean, 1 = console errors.
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")


def main() -> int:
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1680, "height": 1050})
        page.on(
            "console",
            lambda m: errors.append(f"{m.type}: {m.text}")
            if m.type == "error"
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        # Public boot check (always runs).
        for route in ["/login", "/"]:
            url = f"{BASE}{route}"
            print(f"→ boot check {url}")
            page.goto(url, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(600)

        # Authenticated capture (only with creds).
        if EMAIL and PASSWORD:
            print("→ logging in")
            page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
            page.get_by_label("Email", exact=False).first.fill(EMAIL)
            page.get_by_label("Password", exact=False).first.fill(PASSWORD)
            page.get_by_role("button", name="Sign in", exact=False).first.click()
            page.wait_for_timeout(2500)

            # Capture each authed page at desktop + mobile, and flag horizontal
            # overflow (scrollWidth > viewport = "cut off on the right").
            routes = ["/dashboard", "/analytics", "/targets", "/policies"]
            viewports = [("desktop", 1680, 1050), ("mobile", 390, 844)]
            for route in routes:
                for vname, vw, vh in viewports:
                    page.set_viewport_size({"width": vw, "height": vh})
                    page.goto(
                        f"{BASE}{route}",
                        wait_until="networkidle",
                        timeout=30_000,
                    )
                    page.wait_for_timeout(2000)
                    slug = route.strip("/").replace("/", "_") or "root"
                    shot = f"/tmp/analytics-smoke-{slug}-{vname}.png"
                    page.screenshot(path=shot, full_page=True)
                    overflow = page.evaluate(
                        "Math.max(0, document.documentElement.scrollWidth"
                        " - window.innerWidth)"
                    )
                    flag = (
                        f"  ⚠ HORIZONTAL OVERFLOW +{overflow}px"
                        if overflow > 1
                        else "  ✓ no h-overflow"
                    )
                    print(f"   {route} [{vname}] → {shot}{flag}")
                    if overflow > 1:
                        errors.append(
                            f"h-overflow {route} [{vname}] +{overflow}px"
                        )
        else:
            print(
                "ⓘ no E2E_EMAIL/E2E_PASSWORD — skipped authed /analytics capture"
            )

        browser.close()

    if errors:
        print(f"\n✗ {len(errors)} console error(s):")
        for e in errors[:25]:
            print("   -", e)
        return 1
    print("\n✓ booted with zero console errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
