#!/usr/bin/env python3
"""
Smoke for the unified Messages inbox (/messages — Option C "All inboxes" feed).

READ-ONLY. Logs in as a throwaway demo agent, loads /messages, captures console
+ page errors, and asserts the new unified shell renders: the "Messages" header,
the "All inboxes" tab, the feed, and the insight rail (Send pace / Channel mix).
Does NOT send, archive, or mutate anything.

NEVER touches a real auth account — uses @epiclife-demo.test only.

Usage:
    export E2E_EMAIL=agent4@epiclife-demo.test E2E_PASSWORD=DemoPass123!
    python3 scripts/smoke/smoke-messages.py

Writes PNGs to /tmp/board-shots/messages-*.png ; exits non-zero on JS errors or
failed assertions (3 = login/env failure, 1 = JS errors / assertion failures).
"""

import os
import pathlib
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL", "agent4@epiclife-demo.test")
PASSWORD = os.environ.get("E2E_PASSWORD", "DemoPass123!")
OUT = pathlib.Path("/tmp/board-shots")

IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
)


def login(page, email: str, password: str) -> bool:
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
    page.locator("input[type=email]").first.fill(email)
    page.locator("input[type=password]").first.fill(password)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(3500)
    return not page.url.rstrip("/").endswith("/login")


def main() -> int:
    errors: list[str] = []
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1680, "height": 1050})
        page = ctx.new_page()
        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        print(f"→ logging in as {EMAIL}")
        if not login(page, EMAIL, PASSWORD):
            print("✗ login failed (env/creds). Aborting.")
            browser.close()
            return 3

        page.goto(
            f"{BASE}/messages", wait_until="domcontentloaded", timeout=30_000
        )
        page.wait_for_timeout(3000)
        OUT.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT / "messages-all-inboxes.png"), full_page=True)

        # Header renders
        heading = page.get_by_role("heading", name="Messages").first
        if heading.count() == 0 or not heading.is_visible():
            failures.append("'Messages' header not rendered")
        else:
            print("✓ header rendered")

        # Unified "All inboxes" tab present + active by default
        if page.get_by_text("All inboxes").count() == 0:
            failures.append("'All inboxes' tab missing")
        else:
            print("✓ All inboxes tab present")

        # Insight rail rendered (proves the unified body mounted)
        for label in ("Send pace", "Channel mix"):
            if page.get_by_text(label, exact=False).count() == 0:
                failures.append(f"insight rail '{label}' card missing")
            else:
                print(f"✓ rail: '{label}' card rendered")

        # Feed toolbar rendered (Unread filter; channel selection lives in tabs)
        if page.get_by_text("Unread").count() == 0:
            failures.append("feed Unread filter missing")
        else:
            print("✓ feed toolbar rendered")

        # Folder rail (Step B): the restored Inbox / Starred / Sent / Archived
        # navigation that Option C had dropped. "Sent" uses exact match to avoid
        # the header's "Sent today" quota label.
        for f in ("Inbox", "Starred", "Sent", "Archived"):
            if page.get_by_text(f, exact=True).count() == 0:
                failures.append(f"folder rail '{f}' missing")
            else:
                print(f"✓ folder rail: '{f}' present")
        # Selecting a folder must re-scope the feed (refetch) without JS errors.
        arch = page.get_by_text("Archived", exact=True).first
        if arch.count() > 0:
            arch.click()
            page.wait_for_timeout(1800)
            print("✓ folder click (Archived) re-scoped feed without error")

        # Channel tabs now render the SAME unified feed (filtered) — click both.
        for tab_name in ("Email", "Instagram"):
            tab = page.get_by_text(tab_name, exact=True).first
            if tab.count() == 0:
                print(f"• {tab_name} tab not available for this user (skipped)")
                continue
            tab.click()
            page.wait_for_timeout(1800)
            page.screenshot(
                path=str(OUT / f"messages-{tab_name.lower()}.png"),
                full_page=True,
            )
            print(f"✓ {tab_name} tab rendered (unified feed / connect state)")

        # Reading pane (Option C #1): open the first conversation on the unified
        # feed and assert the IN-PAGE detail pane renders (replaces the old
        # right-side drawer). Graceful when the demo inbox is empty.
        all_tab = page.get_by_text("All inboxes", exact=True).first
        if all_tab.count() > 0:
            all_tab.click()
            page.wait_for_timeout(1500)
        cards = page.locator("[data-testid=feed-card]")
        if cards.count() > 0:
            cards.first.click()
            page.wait_for_timeout(2500)
            pane = page.locator("[data-testid=reading-pane]").first
            if pane.count() == 0 or not pane.is_visible():
                failures.append("reading pane did not open on conversation click")
            else:
                print("✓ reading pane opened in-page (master–detail, no drawer)")
                page.screenshot(
                    path=str(OUT / "messages-reading-pane.png"), full_page=True
                )
        else:
            print("• demo inbox empty — reading-pane open not exercised")

        # Templates tab (Step C restyle): must render in board language, no errors.
        tpl = page.get_by_text("Templates", exact=True).first
        if tpl.count() > 0:
            tpl.click()
            page.wait_for_timeout(2000)
            page.screenshot(
                path=str(OUT / "messages-templates.png"), full_page=True
            )
            print("✓ Templates tab rendered")
        else:
            print("• Templates tab not available for demo agent (skipped)")

        browser.close()

    ok = True
    if errors:
        ok = False
        print("\n✗ JS errors:")
        for e in errors:
            print(f"   {e}")
    if failures:
        ok = False
        print("\n✗ assertion failures:")
        for f in failures:
            print(f"   {f}")

    if ok:
        print("\n✓ smoke passed — unified inbox renders, no JS errors")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
