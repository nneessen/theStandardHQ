#!/usr/bin/env python3
"""
Runtime smoke for the Add Policy dialog redesign (Direction B — Two-Pane Linear).

tsc/build/vitest prove the code compiles and the money math is intact; this
proves the dialog actually RENDERS in the running app with no console errors,
in BOTH themes, at desktop and mobile widths, and that the two-pane IA is real:

  1. The dialog opens from the /policies "New Policy" button.
  2. The LEFT field column renders its ordered groups (Client … Notes).
  3. The RIGHT rail renders Compensation + the computed Financial-summary panel.
  4. The money panel (Annual premium / Expected advance hero) is present and is
     positioned as a rail beside the fields on desktop, stacked below on mobile.
  5. No uncaught errors / console errors while opening.

Runs in light AND dark (the app shipped dual themes; a hardcoded dark well would
invert in light, so we verify both).

Usage:
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD
    python3 scripts/policy-dialog-smoke.py
"""

import os
import re
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")

# Distinctive strings that prove each region rendered.
LEFT_FIELDS = [
    "Client name",
    "Carrier",
    "Submit date",
    "Premium amount",
    "Application status",
]
RAIL = ["Compensation", "Financial summary", "Your contract level"]
MONEY = ["Annual premium", "Expected Advance (9 mo)"]

# (name, width, height, expected_orientation). The tablet band (768–1023px) is
# the regime a two-point desktop/mobile smoke misses: the two-pane is gated to
# `lg` so it must stay single-column (stacked) here, not squeeze the fields.
CASES = [
    ("desktop", 1440, 900, "row"),
    ("tablet", 820, 1000, "col"),
    ("mobile", 480, 900, "col"),
]


def set_theme(page, theme: str) -> None:
    """Force next-themes light/dark; the dialog palette keys off the html .dark."""
    page.evaluate("(t) => localStorage.setItem('theme', t)", theme)
    page.evaluate(
        """(t) => {
            const el = document.documentElement;
            if (t === 'dark') el.classList.add('dark');
            else el.classList.remove('dark');
        }""",
        theme,
    )


def dismiss_inbound_pop(page) -> None:
    """The inbound-CRM screen-pop (InboundCallModal) is a global overlay for the
    test agent (this branch sits on the inbound-crm stack). Dismiss it so the
    /policies "New policy" trigger is clickable."""
    for _ in range(4):
        if page.get_by_text("Save intake", exact=False).count() == 0:
            return
        close = page.get_by_role("button", name="Close", exact=True)
        if close.count():
            close.first.click()
        else:
            page.keyboard.press("Escape")
        page.wait_for_timeout(500)


def box(page, text):
    loc = page.get_by_text(text, exact=False).first
    if loc.count() == 0:
        return None
    return loc.bounding_box()


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        console_errors: list[str] = []
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))

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

        for cname, vw, vh, orientation in CASES:
            for theme in ("light", "dark"):
                page.set_viewport_size({"width": vw, "height": vh})
                page.goto(
                    f"{BASE}/policies",
                    wait_until="domcontentloaded",
                    timeout=30_000,
                )
                page.wait_for_timeout(2500)
                set_theme(page, theme)
                page.wait_for_timeout(200)
                dismiss_inbound_pop(page)

                tag = f"{cname}/{theme} [{vw}x{vh}]"
                console_errors.clear()

                btn = page.locator("button").filter(
                    has_text=re.compile(r"new policy", re.I)
                )
                if btn.count() == 0:
                    print(f"\n── {tag}\n   ✗ FAIL 'New Policy' button not found")
                    failures += 1
                    continue
                btn.first.click()

                # Wait for the dialog + a definitive rail marker to render.
                try:
                    page.get_by_role("dialog").wait_for(timeout=8000)
                    page.get_by_text("Financial summary", exact=False).first.wait_for(
                        timeout=8000
                    )
                except Exception:
                    print(f"\n── {tag}\n   ✗ FAIL dialog/rail did not render")
                    failures += 1
                    page.screenshot(path=str(OUT / f"policy-dialog-{cname}-{theme}-FAIL.png"))
                    continue
                page.wait_for_timeout(400)

                shot = OUT / f"policy-dialog-{cname}-{theme}.png"
                page.screenshot(path=str(shot))

                checks = []
                checks.append(
                    ("title 'New Policy'", page.get_by_text("New Policy", exact=False).count() > 0)
                )
                for t in LEFT_FIELDS:
                    checks.append((f"left field: {t}", page.get_by_text(t, exact=False).count() > 0))
                for t in RAIL:
                    checks.append((f"rail: {t}", page.get_by_text(t, exact=False).count() > 0))
                for t in MONEY:
                    checks.append((f"money panel: {t}", page.get_by_text(t, exact=False).count() > 0))
                checks.append(
                    ("footer: Required fields", page.get_by_text("Required fields", exact=False).count() > 0)
                )

                # Two-pane geometry: rail right of fields on desktop, below on mobile.
                lb = box(page, "Client name")
                rb = box(page, "Financial summary")
                if lb and rb:
                    if orientation == "row":
                        geo_ok = rb["x"] > lb["x"] + 40
                        checks.append((f"rail is RIGHT of fields (rail.x={int(rb['x'])} > {int(lb['x'])})", geo_ok))
                    else:
                        geo_ok = rb["y"] > lb["y"]
                        checks.append((f"rail STACKS below fields (rail.y={int(rb['y'])} > {int(lb['y'])})", geo_ok))
                else:
                    checks.append(("two-pane geometry measurable", False))

                # No horizontal document overflow.
                h_overflow = page.evaluate(
                    "Math.max(0, document.documentElement.scrollWidth - window.innerWidth)"
                )
                checks.append((f"no horizontal overflow ({h_overflow}px)", h_overflow <= 1))

                # No console errors / uncaught exceptions while opening.
                checks.append(
                    (f"no console errors ({len(console_errors)})", len(console_errors) == 0)
                )

                print(f"\n── {tag} → {shot}")
                for label, ok in checks:
                    mark = "✓" if ok else "✗ FAIL"
                    if not ok:
                        failures += 1
                    print(f"   {mark} {label}")
                if console_errors:
                    for e in console_errors[:8]:
                        print(f"      • {e[:160]}")

                # Close before the next iteration.
                page.keyboard.press("Escape")
                page.wait_for_timeout(400)

        browser.close()

    print(f"\n{'✓ ALL CHECKS PASSED' if failures == 0 else f'✗ {failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
