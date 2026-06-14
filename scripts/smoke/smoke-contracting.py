#!/usr/bin/env python3
"""
Render smoke for the Contracting Hub (/contracting). READ-ONLY: logs in with the
.env.local creds, loads each tab, captures console + page errors, screenshots.
Does NOT create/modify any data or touch the auth account.

Usage:
    set -a; source .env.local; set +a
    python3 scripts/smoke-contracting.py

Writes PNGs to /tmp/board-shots/contracting-<tab>.png ; exits non-zero on JS errors.
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")

# Console noise unrelated to this feature (kept out of the pass/fail gate).
IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
)


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1680, "height": 1050})

        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed. Aborting.")
            browser.close()
            return 3

        for tab in ("mine", "downline"):
            page.goto(
                f"{BASE}/contracting?tab={tab}",
                wait_until="domcontentloaded",
                timeout=30_000,
            )
            page.wait_for_timeout(3000)
            heading = page.get_by_role("heading", name="Contracting").count()
            path = OUT / f"contracting-{tab}.png"
            page.screenshot(path=str(path), full_page=True)
            overflow = page.evaluate(
                "Math.max(0, document.documentElement.scrollWidth - window.innerWidth)"
            )
            flag = f"⚠ H-OVERFLOW +{overflow}px" if overflow > 1 else "✓"
            print(f"   {tab:9s} heading={heading} → {path}  {flag}")

        browser.close()

    if errors:
        print(f"\n✗ {len(errors)} JS error(s):")
        for e in errors[:20]:
            print(f"   {e}")
        return 1
    print("\n✓ Contracting Hub rendered with no JS errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
