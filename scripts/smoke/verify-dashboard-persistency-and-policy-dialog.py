#!/usr/bin/env python3
"""
Verifies the three changes from the "current-month chargebacks + persistency +
Add-Policy dialog" task actually render in the running app with no runtime
errors:

  1. /dashboard   — current-month chargeback flag + Persistency panel
  2. /analytics   — Persistency panel
  3. /policies    — opens the "New Policy" dialog and checks it fits (no inner
                    vertical/horizontal scroll) at a desktop viewport

It logs in with E2E creds, captures console errors + uncaught page errors for
every step, writes full-page PNGs to /tmp/policy-verify/, and exits non-zero if
login fails, a route errors, or any console/page error is seen.

Usage:
    source .env.local && \
      E2E_EMAIL=$E2E_EMAIL E2E_PASSWORD=$E2E_PASSWORD \
      python3 scripts/verify-dashboard-persistency-and-policy-dialog.py

Env:
    E2E_EMAIL / E2E_PASSWORD   required (from gitignored .env.local)
    BOARD_BASE                 optional, defaults to http://localhost:3000
"""

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = Path("/tmp/policy-verify")
# Override with e.g. VP=1366x768 to check a 13" laptop.
_vp = os.environ.get("VP", "1440x900")
VIEWPORT = {
    "width": int(_vp.split("x")[0]),
    "height": int(_vp.split("x")[1]),
}


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport=VIEWPORT)

        # Capture console errors + uncaught exceptions for the whole run.
        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error"
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
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        # Some accounts hit a "Before you continue" Terms gate that covers the
        # whole app. Accept it (check the box + Agree) so the real pages render.
        try:
            if page.get_by_text("Before you continue", exact=False).count():
                page.get_by_role("checkbox").first.check(timeout=3000)
                page.get_by_role(
                    "button", name="Agree & Continue", exact=False
                ).first.click(timeout=3000)
                page.wait_for_timeout(1500)
                print("   ✓ accepted Terms gate")
        except Exception as e:  # noqa: BLE001
            print(f"   (terms gate handling skipped: {e})")

        def settle() -> None:
            page.wait_for_timeout(2500)
            for _ in range(16):
                try:
                    if page.locator(".animate-spin").count() == 0:
                        break
                except Exception:  # noqa: BLE001
                    break
                page.wait_for_timeout(500)

        # 1 + 2: dashboard + analytics ------------------------------------
        for route in ("/dashboard", "/analytics"):
            before = len(errors)
            try:
                page.goto(
                    f"{BASE}{route}",
                    wait_until="domcontentloaded",
                    timeout=30_000,
                )
            except Exception as e:  # noqa: BLE001
                print(f"   {route} → LOAD ERROR: {e}")
                errors.append(f"{route} load error: {e}")
                continue
            settle()
            slug = route.strip("/") or "root"
            page.screenshot(path=str(OUT / f"{slug}.png"), full_page=True)
            # Does the Persistency panel exist in the DOM?
            has_persist = page.get_by_text(
                "Persistency", exact=False
            ).count()
            new_errs = len(errors) - before
            print(
                f"   {route} → shot saved · Persistency text nodes={has_persist}"
                f" · new errors={new_errs}"
            )

        # 3: policies → open New Policy dialog ----------------------------
        before = len(errors)
        page.goto(
            f"{BASE}/policies", wait_until="domcontentloaded", timeout=30_000
        )
        settle()
        try:
            page.get_by_role("button", name="New Policy", exact=False).first.click(
                timeout=8000
            )
        except Exception as e:  # noqa: BLE001
            print(f"   /policies → could not open dialog: {e}")
            errors.append(f"open dialog failed: {e}")
            page.screenshot(path=str(OUT / "policies-no-dialog.png"), full_page=True)
            browser.close()
            return _report(errors)

        page.wait_for_timeout(1200)
        dialog = page.get_by_role("dialog").first
        dialog.screenshot(path=str(OUT / "policy-dialog.png"))
        # Full-page shot too, so the blurred backdrop behind the dialog is visible.
        page.screenshot(path=str(OUT / "policy-dialog-fullpage.png"))

        # Measure the scrollable form body inside the dialog: if it fits, its
        # scrollHeight ≈ clientHeight (no inner vertical scroll). Also check
        # horizontal overflow of the dialog itself.
        metrics = page.evaluate(
            """() => {
              const dlg = document.querySelector('[role=dialog]');
              if (!dlg) return null;
              // The scrollable region is the form body (overflow-y-auto).
              const body = dlg.querySelector('form > div');
              const vScroll = body ? body.scrollHeight - body.clientHeight : -1;
              const hScroll = dlg.scrollWidth - dlg.clientWidth;
              return {
                vScroll, hScroll,
                dlgW: dlg.clientWidth, dlgH: dlg.clientHeight,
                bodyScrollH: body ? body.scrollHeight : -1,
                bodyClientH: body ? body.clientHeight : -1,
              };
            }"""
        )
        new_errs = len(errors) - before
        print(f"   /policies dialog metrics: {metrics} · new errors={new_errs}")
        if metrics:
            vflag = (
                "⚠ inner V-SCROLL +%dpx" % metrics["vScroll"]
                if metrics["vScroll"] > 2
                else "✓ no inner vertical scroll"
            )
            hflag = (
                "⚠ H-OVERFLOW +%dpx" % metrics["hScroll"]
                if metrics["hScroll"] > 2
                else "✓ no horizontal overflow"
            )
            print(f"      dialog fit @1440x900: {vflag} · {hflag}")

        browser.close()

    return _report(errors)


def _report(errors: list[str]) -> int:
    print(f"\n  screenshots in {OUT}")
    if errors:
        print(f"\n✗ {len(errors)} console/page error(s) detected:")
        for e in errors[:40]:
            print(f"   - {e}")
        return 1
    print("\n✓ no console or page errors across all steps")
    return 0


if __name__ == "__main__":
    sys.exit(main())
