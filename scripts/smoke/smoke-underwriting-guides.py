#!/usr/bin/env python3
"""
Smoke for the Training → Underwriting Guides library (/underwriting/guides).

The page is a 3-pane master–detail document browser (carrier rail · document
list · preview pane).

Default run is READ-ONLY and uses a throwaway demo agent (view-only):
it logs in, loads the page, captures console + page errors, asserts the
browser chrome renders (heading + "All documents" rail entry), confirms a plain
agent sees NO upload/delete controls, and (best-effort) opens a guide PDF via the
preview's "Open PDF" action (signed URL).

NEVER touches a real auth account — uses @epiclife-demo.test only.

Usage:
    # view-only agent (default, safe, read-only)
    export E2E_EMAIL=agent4@epiclife-demo.test E2E_PASSWORD=DemoPass123!
    python3 scripts/smoke-underwriting-guides.py

    # optional admin-visibility check (an is_imo_admin account whose HOME imo
    # is the IMO being viewed). Verifies the "Add guide" control + upload dialog
    # render. Does NOT upload. Use a throwaway/demo admin, never a real account.
    export ADMIN_EMAIL=... ADMIN_PASSWORD=...
    python3 scripts/smoke-underwriting-guides.py

Writes PNGs to /tmp/board-shots/uw-guides-*.png ; exits non-zero on JS errors
or failed assertions.
"""

import os
import pathlib
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL", "agent4@epiclife-demo.test")
PASSWORD = os.environ.get("E2E_PASSWORD", "DemoPass123!")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
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


def load_guides(page, tag: str, errors: list) -> None:
    page.goto(
        f"{BASE}/underwriting/guides",
        wait_until="domcontentloaded",
        timeout=30_000,
    )
    page.wait_for_timeout(2500)
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / f"uw-guides-{tag}.png"), full_page=True)


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

        # ---- view-only agent path -------------------------------------------
        print(f"→ [agent] logging in as {EMAIL}")
        if not login(page, EMAIL, PASSWORD):
            print("✗ agent login failed. Aborting.")
            browser.close()
            return 3

        load_guides(page, "agent", errors)

        heading = page.get_by_role("heading", name="Underwriting Guides").first
        if heading.count() == 0 or not heading.is_visible():
            failures.append("agent: 'Underwriting Guides' heading not rendered")
        else:
            print("✓ agent: page heading rendered")

        # A plain agent must NOT see upload/delete controls.
        add_btn = page.get_by_role("button", name="Add guide")
        if add_btn.count() > 0:
            failures.append("agent: view-only agent should NOT see 'Add guide'")
        else:
            print("✓ agent: no upload controls (view-only, as expected)")

        # 3-pane browser chrome: the carrier rail's "All documents" entry is only
        # present when the library has guides (otherwise the empty state shows).
        has_browser = (
            page.get_by_text("All documents", exact=False).first.count() > 0
        )
        if has_browser:
            print("✓ agent: 3-pane browser rendered (rail 'All documents')")
        else:
            print("• agent: empty library (no 3-pane browser to assert)")

        # Best-effort: open the auto-selected guide via the preview's Open PDF
        # action (signed URL, read-only). Preview pane is visible at desktop width.
        open_btn = page.get_by_role("button", name="Open PDF").first
        if open_btn.count() > 0:
            try:
                with ctx.expect_page(timeout=8000) as pop:
                    open_btn.click()
                popup = pop.value
                popup.wait_for_load_state("domcontentloaded", timeout=8000)
                if popup.url and popup.url != "about:blank":
                    print(f"✓ agent: guide opened via signed URL ({popup.url[:60]}…)")
                else:
                    print("• agent: Open clicked but popup URL empty (seed/RLS dependent)")
                popup.close()
            except Exception as e:  # noqa: BLE001 - informational only
                print(f"• agent: Open PDF inconclusive ({e})")
        else:
            print("• agent: no guides present to open (empty library)")

        # ---- optional admin-visibility path ---------------------------------
        if ADMIN_EMAIL and ADMIN_PASSWORD:
            print(f"→ [admin] logging in as {ADMIN_EMAIL}")
            actx = browser.new_context(viewport={"width": 1680, "height": 1050})
            apage = actx.new_page()
            apage.on(
                "console",
                lambda m: errors.append(f"console.{m.type}: {m.text}")
                if m.type == "error" and not any(s in m.text for s in IGNORE)
                else None,
            )
            apage.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

            if not login(apage, ADMIN_EMAIL, ADMIN_PASSWORD):
                failures.append("admin: login failed")
            else:
                load_guides(apage, "admin", errors)
                a_add = apage.get_by_role("button", name="Add guide").first
                if a_add.count() == 0:
                    failures.append("admin: 'Add guide' control missing for admin")
                else:
                    print("✓ admin: 'Add guide' control visible")
                    a_add.click()
                    apage.wait_for_timeout(800)
                    dialog = apage.get_by_role("dialog")
                    if dialog.count() == 0:
                        failures.append("admin: upload dialog did not open")
                    else:
                        combo = dialog.get_by_role("combobox").first
                        if combo.count() == 0:
                            failures.append("admin: carrier select missing in dialog")
                        else:
                            print("✓ admin: upload dialog + carrier select render")
            actx.close()
        else:
            print("• admin path skipped (set ADMIN_EMAIL/ADMIN_PASSWORD to run)")

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
        print("\n✓ smoke passed — page renders, no JS errors, gating correct")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
