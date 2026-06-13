#!/usr/bin/env python3
"""
Smoke test for the Targets page commission-rate sanity.

Regression guard for the bug where local policies stored commission_percentage
as whole percentages (e.g. 145) instead of decimals (1.45). The Targets RPC
premium-weighted those raw values and the page multiplied by 100 again, rendering
"÷ Commission Rate 14540.8%" / "÷ Effective Rate 10905.6%" and nonsensically tiny
premium/policy targets.

This verifies, at runtime, that /targets:
  - mounts with no uncaught page/console errors,
  - renders the Optimistic and Realistic plans,
  - shows NO absurd percentage (>= 1000%) anywhere — the unmistakable signature
    of the unit bug,
  - shows a sane commission rate (<= ~200%).

Read-only: it never writes anything (the dev user already has an income target).

Run:
  source .env.local && python3 scripts/smoke-targets.py
"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = os.environ.get("TARGETS_SHOT", "/tmp/targets-smoke.png")

# Any rendered percentage at or above this is the unit-bug signature (real
# first-year comp tops out around 150%).
ABSURD_PCT = 1000.0
SANE_MAX_PCT = 200.0

PCT_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*%")


def collect_percentages(text: str) -> list[float]:
    vals: list[float] = []
    for m in PCT_RE.finditer(text):
        try:
            vals.append(float(m.group(1).replace(",", "")))
        except ValueError:
            pass
    return vals


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    console_errors: list[str] = []
    page_errors: list[str] = []
    problems: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_selector("input[type=email]", timeout=15_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.locator("button[type=submit]").first.click()
        for _ in range(20):
            page.wait_for_timeout(1000)
            if not page.url.rstrip("/").endswith("/login"):
                break
        if page.url.rstrip("/").endswith("/login"):
            page.screenshot(path="/tmp/targets-login-fail.png")
            print("✗ login failed (still on /login). shot: /tmp/targets-login-fail.png")
            print("  page errors:", page_errors[:5])
            browser.close()
            return 1
        print(f"  ✓ logged in (at {page.url})")

        print(f"→ loading {BASE}/targets")
        page.goto(f"{BASE}/targets", wait_until="networkidle", timeout=30_000)
        # The plans only render once targets + historical averages resolve.
        try:
            page.wait_for_selector("text=Optimistic Plan", timeout=20_000)
        except Exception:
            page.screenshot(path=OUT, full_page=True)
            print(
                "✗ 'Optimistic Plan' never rendered — the dev user may have no "
                f"income target set, or the page is degraded. shot: {OUT}"
            )
            print("  page errors:", page_errors[:5])
            browser.close()
            return 1
        page.wait_for_timeout(1500)

        body = page.locator("body").inner_text()
        page.screenshot(path=OUT, full_page=True)
        print(f"  → screenshot: {OUT}")

        # Section labels render via a <Cap> component that uppercases with CSS,
        # so match case-insensitively.
        body_lc = body.lower()
        if "optimistic plan" not in body_lc:
            problems.append("'Optimistic Plan' section missing")
        if "realistic plan" not in body_lc:
            problems.append("'Realistic Plan' section missing")
        if "commission rate" not in body_lc:
            problems.append("'Commission Rate' row missing")

        pcts = collect_percentages(body)
        absurd = [v for v in pcts if v >= ABSURD_PCT]
        if absurd:
            problems.append(
                f"absurd percentage(s) rendered (unit bug): "
                f"{', '.join(f'{v:g}%' for v in sorted(set(absurd), reverse=True)[:6])}"
            )
        else:
            print(f"  ✓ no absurd percentages (max rendered: {max(pcts, default=0):g}%)")

        # The commission/effective rate should be in a sane band. We can't bind
        # to an exact value (depends on the user's book), but anything > 200% is
        # the bug's fingerprint even below the 1000% threshold.
        suspicious = [v for v in pcts if SANE_MAX_PCT < v < ABSURD_PCT]
        if suspicious:
            problems.append(
                f"suspiciously high percentage(s) (>{SANE_MAX_PCT:g}%): "
                f"{', '.join(f'{v:g}%' for v in sorted(set(suspicious), reverse=True)[:6])}"
            )

        browser.close()

    if page_errors:
        print("✗ uncaught page errors:\n  " + "\n  ".join(page_errors[:10]))
        return 1
    real = [
        e
        for e in console_errors
        if "favicon" not in e.lower()
        and "404" not in e
        and "the message port closed" not in e.lower()
    ]
    if real:
        print(f"⚠ console errors ({len(real)}):\n  " + "\n  ".join(real[:10]))

    if problems:
        print("✗ problems:\n  " + "\n  ".join(problems))
        return 1

    print("✓ Targets page renders sane commission rates (no unit bug, no errors).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
