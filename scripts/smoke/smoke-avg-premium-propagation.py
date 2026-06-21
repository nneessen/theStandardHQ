#!/usr/bin/env python3
"""
E2E guard for the PER-AGENT average-premium override (user_targets.avg_premium_override).

This is the read+WRITE+propagation counterpart to smoke-targets.py. It exercises
the real user action — not a SQL injection — to prove the full loop:

  1. WRITE path: edit the avg premium on /targets (Simple view) → it persists to
     user_targets.avg_premium_override. This is the one path tsc CANNOT verify,
     because UserTargetsRepository.transformToDB writes a stringly-typed
     `result.avg_premium_override = ...` into a Record<string, unknown>.
  2. READ-after-write: reload /targets → the override is still in effect.
  3. PROPAGATION: with an override active, the Dashboard and Analytics heroes
     (which now read targets.avgPremiumOverride via useCalculatedTargets /
     resolveGoalAvgAP) render a DIFFERENT set of currency figures than they do
     on auto — i.e. the override actually moves the cross-surface numbers.
  4. CLEAR: "Use auto" clears the override back to NULL.

It mutates LOCAL data (sets then clears the override) and ALWAYS restores the
row to NULL in a finally block via run-sql.sh, so the local DB ends clean.

Run:
  set -a; source .env.local; set +a; python3 scripts/smoke/smoke-avg-premium-propagation.py
"""
import os
import re
import subprocess
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OVERRIDE_VALUE = 50000  # large + distinctive → dominates the premium-goal delta

CURRENCY_RE = re.compile(r"\$\s?[\d,]{2,}(?:\.\d+)?")
HERE = os.path.dirname(os.path.abspath(__file__))
RUN_SQL = os.path.join(HERE, "..", "migrations", "run-sql.sh")


def sql(query: str) -> str:
    """Run a SQL statement against the LOCAL db via the repo runner."""
    out = subprocess.run(
        [RUN_SQL, query],
        capture_output=True,
        text=True,
        cwd=os.path.join(HERE, "..", ".."),
    )
    return out.stdout + out.stderr


def db_override() -> str:
    """Return the E2E user's avg_premium_override as a trimmed string ('' = NULL)."""
    raw = sql(
        "SELECT COALESCE(ut.avg_premium_override::text, 'NULL') "
        "FROM user_targets ut JOIN auth.users u ON u.id = ut.user_id "
        f"WHERE u.email = '{EMAIL}';"
    )
    for line in raw.splitlines():
        s = line.strip()
        if s == "NULL":
            return ""
        if re.fullmatch(r"\d+(\.\d+)?", s):
            return s
    return ""


def clear_override() -> None:
    sql(
        "UPDATE user_targets ut SET avg_premium_override = NULL "
        "FROM auth.users u WHERE u.id = ut.user_id "
        f"AND u.email = '{EMAIL}';"
    )


def currency_set(page) -> set:
    body = page.locator("body").inner_text()
    return {m.replace(" ", "") for m in CURRENCY_RE.findall(body)}


def login(page) -> bool:
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_selector("input[type=email]", timeout=15_000)
    page.locator("input[type=email]").first.fill(EMAIL)
    page.locator("input[type=password]").first.fill(PASSWORD)
    page.locator("button[type=submit]").first.click()
    for _ in range(20):
        page.wait_for_timeout(1000)
        if not page.url.rstrip("/").endswith("/login"):
            return True
    return False


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    problems: list[str] = []
    page_errors: list[str] = []

    # Deterministic starting point.
    clear_override()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        try:
            print(f"→ logging in at {BASE}/login")
            if not login(page):
                print("✗ login failed (still on /login)")
                return 1
            print(f"  ✓ logged in (at {page.url})")

            # ── AUTO baseline on the cross-surface heroes ───────────────────
            page.goto(f"{BASE}/dashboard", wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2500)
            dash_auto = currency_set(page)
            page.goto(f"{BASE}/analytics", wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2500)
            ana_auto = currency_set(page)
            print(
                f"  ✓ captured AUTO baselines (dashboard={len(dash_auto)} "
                f"figures, analytics={len(ana_auto)})"
            )

            # ── WRITE the override through the real UI ──────────────────────
            page.goto(f"{BASE}/targets", wait_until="networkidle", timeout=30_000)
            page.wait_for_selector("text=Apps to write", timeout=20_000)
            # Simple view → "Your Numbers" → reveal the custom-premium input.
            page.get_by_role(
                "button", name="Set custom $ premium", exact=True
            ).first.click()
            inp = page.locator('input[aria-label="Average premium override"]')
            inp.wait_for(state="visible", timeout=8_000)
            inp.fill(str(OVERRIDE_VALUE))
            inp.press("Enter")
            try:
                page.wait_for_selector(
                    "text=Average premium updated", timeout=8_000
                )
                print("  ✓ save toast shown (UI write fired)")
            except Exception:
                problems.append("no 'Average premium updated' toast after save")
            page.wait_for_timeout(1500)

            # The WRITE path (transformToDB column mapping) — tsc can't see this.
            persisted = db_override()
            if persisted == str(OVERRIDE_VALUE):
                print(f"  ✓ DB write OK: avg_premium_override = {persisted}")
            else:
                problems.append(
                    f"DB write FAILED: expected {OVERRIDE_VALUE}, got "
                    f"{persisted or 'NULL'} (transformToDB column mapping?)"
                )

            # ── READ-after-write: reload, override still active ─────────────
            page.goto(f"{BASE}/targets", wait_until="networkidle", timeout=30_000)
            page.wait_for_selector("text=Apps to write", timeout=20_000)
            page.wait_for_timeout(1000)
            if page.get_by_role(
                "button", name=re.compile("Use auto", re.I)
            ).count() == 0:
                problems.append(
                    "after reload, override not in effect (no 'Use auto' control)"
                )
            else:
                print("  ✓ override persisted across reload")

            # ── PROPAGATION: heroes must move with the override ─────────────
            page.goto(f"{BASE}/dashboard", wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2500)
            dash_ovr = currency_set(page)
            page.goto(f"{BASE}/analytics", wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2500)
            ana_ovr = currency_set(page)

            if dash_ovr == dash_auto:
                problems.append(
                    "Dashboard hero did NOT change with the override active"
                )
            else:
                print(
                    f"  ✓ Dashboard figures moved (Δ={len(dash_ovr ^ dash_auto)})"
                )
            if ana_ovr == ana_auto:
                problems.append(
                    "Analytics hero did NOT change with the override active"
                )
            else:
                print(
                    f"  ✓ Analytics figures moved (Δ={len(ana_ovr ^ ana_auto)})"
                )

            # ── CLEAR via UI ────────────────────────────────────────────────
            page.goto(f"{BASE}/targets", wait_until="networkidle", timeout=30_000)
            page.wait_for_selector("text=Apps to write", timeout=20_000)
            try:
                page.get_by_role(
                    "button", name=re.compile("Use auto", re.I)
                ).first.click()
                page.wait_for_selector(
                    "text=Using your book average", timeout=8_000
                )
                page.wait_for_timeout(1000)
                if db_override() == "":
                    print("  ✓ 'Use auto' cleared the override (DB = NULL)")
                else:
                    problems.append("'Use auto' did not clear the override")
            except Exception as e:
                problems.append(f"clear-via-UI failed: {e}")
        finally:
            # Safety net — local DB must end clean regardless of failures.
            clear_override()
            browser.close()

    if page_errors:
        print("✗ uncaught page errors:\n  " + "\n  ".join(page_errors[:8]))
        return 1
    if problems:
        print("✗ problems:\n  " + "\n  ".join(problems))
        return 1
    print(
        "✓ Per-agent avg-premium override: UI write persists, survives reload, "
        "and moves the Dashboard + Analytics heroes. Local DB restored."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
