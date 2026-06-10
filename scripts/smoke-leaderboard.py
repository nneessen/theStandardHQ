#!/usr/bin/env python3
"""
Render smoke for the Leaderboard (/leaderboard). READ-ONLY: logs in with the
.env.local creds, loads the page, captures console + page errors, screenshots.
Does NOT create/modify any data or touch the auth account.

Context: the /leaderboard route + sidebar nav item were changed from being gated
by the paid "leaderboard" subscription feature to always-on (nav public:true,
route noRecruits only). This smoke confirms the route still renders with no
loading errors after dropping the subscription gate. (The .env.local account is
a super-admin, which always had access, so this validates RENDERING; the
all-agents visibility itself is deterministic declarative config in
sidebar-nav.config.ts / router.tsx.)

Usage:
    set -a; source .env.local; set +a
    python3 scripts/smoke-leaderboard.py

Writes PNG to /tmp/board-shots/leaderboard.png ; exits non-zero on JS errors.
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

        page.goto(
            f"{BASE}/leaderboard",
            wait_until="domcontentloaded",
            timeout=30_000,
        )
        page.wait_for_timeout(3500)
        final_url = page.url
        path = OUT / "leaderboard.png"
        page.screenshot(path=str(path), full_page=True)
        # If the route silently redirected away (e.g. an UpgradePrompt or
        # PermissionDenied), final_url would not end in /leaderboard.
        on_page = final_url.rstrip("/").endswith("/leaderboard")
        flag = "✓ on /leaderboard" if on_page else f"⚠ redirected to {final_url}"
        print(f"   leaderboard → {path}  {flag}")

        browser.close()

    if errors:
        print(f"\n✗ {len(errors)} JS error(s):")
        for e in errors[:20]:
            print(f"   {e}")
        return 1
    print("\n✓ Leaderboard rendered with no JS errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
