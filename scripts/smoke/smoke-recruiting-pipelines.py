#!/usr/bin/env python3
"""
Smoke test for the recruiting "add" flow as a NON-ADMIN Epic Life agent.

Verifies, end to end against the LOCAL stack:
  1. /recruiting renders with no JS errors for a plain agent.
  2. The three header buttons are present: Add prospect / Add recruit / Add agent.
  3. "Add agent" opens the dedicated dialog and a throwaway agent can be created
     (exercises the create-auth-user edge-function "add-agent" path).

Logs in as a THROWAWAY demo agent only (never the real super-admin in .env.local).

Usage:
    SMOKE_EMAIL=agent4@epiclife-demo.test SMOKE_PASSWORD='DemoPass123!' \
        python3 scripts/smoke-recruiting-pipelines.py

Prints the throwaway agent email it created so the caller can verify the DB row
and delete it. Exits non-zero on JS errors or a failed assertion.
"""

import os
import sys
import time
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("SMOKE_EMAIL", "agent4@epiclife-demo.test")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "DemoPass123!")
OUT = pathlib.Path("/tmp/board-shots")

IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
    "react-beautiful-dnd",
)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    stamp = str(int(time.time()))
    throwaway = f"addagent_smoke_{stamp}@epiclife-demo.test"

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

        print(f"→ logging in as {EMAIL} at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed. Aborting.")
            browser.close()
            return 3

        print("→ loading /recruiting")
        page.goto(f"{BASE}/recruiting", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(3500)
        page.screenshot(path=str(OUT / "recruiting-agent.png"), full_page=True)

        # 2) three buttons present
        for label in ("Add prospect", "Add recruit", "Add agent"):
            btn = page.get_by_role("button", name=label, exact=False)
            if btn.count() == 0:
                print(f"✗ button not found: {label}")
                browser.close()
                return 4
            print(f"  ✓ button present: {label}")

        # 3) Add agent dialog → create throwaway agent
        print(f"→ opening Add agent, creating {throwaway}")
        page.get_by_role("button", name="Add agent", exact=False).first.click()
        page.wait_for_timeout(1200)
        page.get_by_label("First name", exact=False).first.fill("Smoke")
        page.get_by_label("Last name", exact=False).first.fill("Agent")
        page.get_by_label("Email", exact=False).first.fill(throwaway)
        page.screenshot(path=str(OUT / "recruiting-addagent-dialog.png"))
        # Submit (the dialog's own "Add agent" button is the last match)
        submit = page.get_by_role("button", name="Add agent", exact=False).last
        submit.click()
        page.wait_for_timeout(5000)
        page.screenshot(path=str(OUT / "recruiting-addagent-result.png"))

        body = page.inner_text("body").lower()
        created = ("welcome email" in body) or ("successfully added" in body)
        if created:
            print(f"  ✓ Add agent succeeded (toast seen) for {throwaway}")
        else:
            print(
                "  ⚠ no success toast detected; check screenshots + DB. "
                "(local edge runtime may need a reload)"
            )

        browser.close()

    print(f"THROWAWAY_EMAIL={throwaway}")
    if errors:
        print("✗ JS errors:")
        for e in errors[:20]:
            print("   ", e)
        return 1
    print("✓ no JS errors; screenshots in /tmp/board-shots/")
    return 0 if created else 5


if __name__ == "__main__":
    sys.exit(main())
