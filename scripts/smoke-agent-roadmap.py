#!/usr/bin/env python3
"""
Smoke test for the Agent Roadmap feature — reproduces "does not load at all".

Logs in (E2E_EMAIL/E2E_PASSWORD from .env.local), navigates to /agent-roadmap,
and reports every console error, page error (uncaught exception), and failed
network request, plus whether the roadmap list rendered. Screenshots to
/tmp/agent-roadmap/.

Usage:
    set -a; source .env.local; set +a
    python3 scripts/smoke-agent-roadmap.py
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/agent-roadmap")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    console_errs: list[str] = []
    page_errs: list[str] = []
    failed_reqs: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1680, "height": 1050})

        page.on("console", lambda m: console_errs.append(m.text)
                if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errs.append(str(e)))
        page.on("requestfailed", lambda r: failed_reqs.append(
            f"{r.method} {r.url} — {r.failure}"))

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

        print("→ navigating to /agent-roadmap")
        page.goto(f"{BASE}/agent-roadmap", wait_until="networkidle",
                  timeout=30_000)
        page.wait_for_timeout(3000)
        shot = OUT / "agent-roadmap.png"
        page.screenshot(path=str(shot), full_page=True)

        body = page.locator("body").inner_text()
        print(f"\n→ screenshot: {shot}")
        print(f"→ url: {page.url}")
        print(f"→ visible text (first 400 chars):\n{body[:400]!r}\n")

        browser.close()

    print("=" * 60)
    print(f"PAGE ERRORS (uncaught): {len(page_errs)}")
    for e in page_errs:
        print(f"  ✗ {e}")
    print(f"CONSOLE ERRORS: {len(console_errs)}")
    for e in console_errs[:20]:
        print(f"  • {e}")
    print(f"FAILED REQUESTS: {len(failed_reqs)}")
    for e in failed_reqs[:20]:
        print(f"  • {e}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
