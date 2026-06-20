#!/usr/bin/env python3
"""
Runtime smoke for the Add/Edit Policy dialog — Direction A (Guided Wizard).

Proves the 4-step wizard RENDERS and WORKS in the running app, in both themes:

  1. The stepper renders (Client → Product & Policy → Premium & Comp → Review).
  2. The persistent "Running estimate" rail is visible on every step.
  3. NEW mode gates Continue: pressing it with an empty step stays on step 1.
  4. EDIT mode (valid data) advances through all 4 steps via "Continue →" and
     lands on the Review summary with an "Update policy" button.
  5. No console errors while doing any of it.

EDIT mode is used for the full walk because an existing policy already has valid
data, so each step's Continue passes without brittle Radix-select form-filling.

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

# Step intros (always visible, unlike the stepper labels which hide on mobile).
STEP_INTRO = [
    "Who's the policy for?",
    "What did they buy?",
    "Premium & your comp",
    "Review & confirm",
]

CASES = [
    ("desktop", 1440, 900, "light"),
    ("desktop", 1440, 900, "dark"),
    ("mobile", 480, 900, "light"),
]


def set_theme(page, theme: str) -> None:
    page.evaluate("(t) => localStorage.setItem('theme', t)", theme)
    page.evaluate(
        """(t) => { const el = document.documentElement;
            if (t === 'dark') el.classList.add('dark'); else el.classList.remove('dark'); }""",
        theme,
    )


def dismiss_inbound_pop(page) -> None:
    for _ in range(4):
        if page.get_by_text("Save intake", exact=False).count() == 0:
            return
        close = page.get_by_role("button", name="Close", exact=True)
        (close.first.click() if close.count() else page.keyboard.press("Escape"))
        page.wait_for_timeout(500)


def open_new(page) -> bool:
    btn = page.locator("button").filter(has_text=re.compile(r"new policy", re.I))
    if btn.count() == 0:
        return False
    btn.first.click()
    try:
        page.get_by_role("dialog").wait_for(timeout=8000)
        page.get_by_text("Running estimate", exact=False).first.wait_for(timeout=8000)
        return True
    except Exception:
        return False


def open_edit(page) -> bool:
    try:
        row = page.locator("table tbody tr").first
        if row.count() == 0:
            return False
        row.scroll_into_view_if_needed(timeout=5000)
        row.locator("button").last.click()  # actions kebab
        page.wait_for_timeout(400)
        item = page.get_by_role("menuitem", name=re.compile(r"edit policy", re.I))
        if item.count() == 0:
            item = page.get_by_text("Edit Policy", exact=False)
        if item.count() == 0:
            return False
        item.first.click()
        page.get_by_role("dialog").wait_for(timeout=8000)
        page.get_by_text("Running estimate", exact=False).first.wait_for(timeout=8000)
        return True
    except Exception:
        return False


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

        for cname, vw, vh, theme in CASES:
            tag = f"{cname}/{theme} [{vw}x{vh}]"

            def fresh_policies():
                page.set_viewport_size({"width": vw, "height": vh})
                page.goto(
                    f"{BASE}/policies", wait_until="domcontentloaded", timeout=30_000
                )
                page.wait_for_timeout(2500)
                set_theme(page, theme)
                page.wait_for_timeout(150)
                dismiss_inbound_pop(page)

            checks = []

            # ── NEW mode: stepper renders + Continue-gating ─────────────────
            fresh_policies()
            # Clear here — AFTER the page load + inbound-pop dismissal — so the
            # tally reflects only MY dialog, not the pre-existing inbound-pop
            # `DialogTitle` a11y warning that fires on every /policies load.
            console_errors.clear()
            if not open_new(page):
                checks.append(("open New policy", False))
            else:
                checks.append(("new: step 1 intro", page.get_by_text(STEP_INTRO[0], exact=False).count() > 0))
                checks.append(("new: running-estimate rail", page.get_by_text("Running estimate", exact=False).count() > 0))
                # Press Continue with an empty form → must stay on step 1.
                cont = page.get_by_role("button", name=re.compile(r"continue", re.I))
                if cont.count():
                    cont.first.click()
                    page.wait_for_timeout(600)
                checks.append(("new: Continue gated (still on step 1)", page.get_by_text(STEP_INTRO[0], exact=False).count() > 0))
                page.screenshot(path=str(OUT / f"policy-wizard-{cname}-{theme}-new.png"))
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            checks.append((f"new: no console errors ({len(console_errors)})", len(console_errors) == 0))

            # ── EDIT mode: walk all 4 steps via Continue (desktop only — the
            #    /policies row kebab isn't reliably reachable at mobile width) ─
            if cname == "desktop":
                fresh_policies()
                console_errors.clear()
                if not open_edit(page):
                    checks.append(("open Edit policy", False))
                else:
                    for i, intro in enumerate(STEP_INTRO):
                        present = page.get_by_text(intro, exact=False).count() > 0
                        checks.append((f"edit step {i + 1}: {intro}", present))
                        checks.append((f"  rail present @ step {i + 1}", page.get_by_text("Running estimate", exact=False).count() > 0))
                        if not present:
                            break
                        if i < len(STEP_INTRO) - 1:
                            nxt = page.get_by_role("button", name=re.compile(r"continue", re.I))
                            if nxt.count() == 0:
                                checks.append((f"  Continue button @ step {i + 1}", False))
                                break
                            nxt.first.click()
                            page.wait_for_timeout(600)
                    checks.append(("edit: Review shows 'Update policy'", page.locator("button").filter(has_text=re.compile(r"update policy", re.I)).count() > 0))
                    page.screenshot(path=str(OUT / f"policy-wizard-{cname}-{theme}-edit.png"))
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                checks.append((f"edit: no console errors ({len(console_errors)})", len(console_errors) == 0))

            print(f"\n── {tag} → /tmp/board-shots/policy-wizard-{cname}-{theme}-*.png")
            for label, ok in checks:
                mark = "✓" if ok else "✗ FAIL"
                if not ok:
                    failures += 1
                print(f"   {mark} {label}")
            if console_errors:
                for e in console_errors[:6]:
                    print(f"      • {e[:160]}")

        browser.close()

    print(f"\n{'✓ ALL CHECKS PASSED' if failures == 0 else f'✗ {failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
