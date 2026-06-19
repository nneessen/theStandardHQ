#!/usr/bin/env python3
"""
Authed visual check for the Clients pages: the list (/clients) and the rebuilt detail page
(/clients/<id>) which must now have full parity with the inbound intake — same rail + the same
4 editable tabs (Client · Call Details · Coverage · Health).

Usage:
    set -a; source .env.local; set +a
    CLIENT_ID=<uuid> BOARD_BASE=http://localhost:4317 python3 scripts/shot-clients-parity.py

Writes PNGs to /tmp/clients-shots/.
"""
import os
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:4317")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
CLIENT_ID = os.environ.get("CLIENT_ID")
OUT = pathlib.Path("/tmp/clients-shots")
TABS = ["Client", "Call Details", "Coverage", "Health"]


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL / E2E_PASSWORD (source .env.local)")
        return 2
    if not CLIENT_ID:
        print("✗ set CLIENT_ID=<uuid>")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1680, "height": 1050})

        print(f"→ login {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed — check creds")
            browser.close()
            return 3

        # List page
        page.goto(f"{BASE}/clients", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(3000)
        page.screenshot(path=str(OUT / "clients-list.png"), full_page=True)
        print(f"   /clients → {OUT/'clients-list.png'}")

        # Detail page — capture every tab
        page.goto(
            f"{BASE}/clients/{CLIENT_ID}",
            wait_until="domcontentloaded",
            timeout=30_000,
        )
        page.wait_for_timeout(3500)
        for tab in TABS:
            try:
                page.get_by_role("tab", name=tab, exact=False).first.click(
                    timeout=4000
                )
                page.wait_for_timeout(700)
            except Exception as e:  # noqa: BLE001
                print(f"   tab '{tab}' click failed: {e}")
            slug = tab.lower().replace(" ", "-")
            shot = OUT / f"detail-{slug}.png"
            page.screenshot(path=str(shot), full_page=True)
            overflow = page.evaluate(
                "Math.max(0, document.documentElement.scrollWidth - window.innerWidth)"
            )
            flag = f"⚠ +{overflow}px" if overflow > 1 else "✓"
            print(f"   detail [{tab}] → {shot}  {flag}")

        browser.close()
    print(f"\n✓ shots in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
