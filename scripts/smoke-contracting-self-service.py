#!/usr/bin/env python3
"""
FUNCTIONAL smoke for SELF-SERVICE contracting in "My Contracting" — proves a PLAIN
downline agent (no admin / no staff role) can now manage their OWN carrier contracts
end-to-end from /contracting, and that carrier contracts are GONE from /settings.

Exercises the Jun-10-2026 change: set_carrier_contract_status relaxed so any agent
may set any status on their own contracts (incl. approved + writing #) and add any
carrier in their org directly (the direct-upline eligibility gate was removed).

NEVER touches a real auth account — uses a throwaway @epiclife-demo.test plain agent.
NOTE: the demo agent must have terms_accepted_at set (clears the TOS gate); otherwise
the app shows the "Before you continue" overlay and no page renders.

Covers (with DB read-back through the same RLS-scoped REST the app uses):
  1. /contracting "My Contracting" renders the new self-service controls
     (inline status <Select> per row, "+ Add carrier", "Request different upline").
  2. Inline status <Select> on my OWN row → Approved persists to DB with approved_date
     stamped (proves SELF-APPROVAL — the headline complaint — works through the UI).
  3. /settings → Profile renders with NO carrier-contracts card and no JS errors.

Usage:
    set -a; source .env; set +a            # SUPABASE url/anon (local)
    export E2E_EMAIL=agent4@epiclife-demo.test E2E_PASSWORD=DemoPass123!
    python3 scripts/smoke-contracting-self-service.py
"""

import os
import sys
import json
import urllib.request
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
SB_URL = os.environ.get("VITE_SUPABASE_URL", "http://127.0.0.1:54321").rstrip("/")
ANON = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
EMAIL = os.environ.get("E2E_EMAIL", "agent4@epiclife-demo.test")
PASSWORD = os.environ.get("E2E_PASSWORD", "DemoPass123!")
OUT = pathlib.Path("/tmp/board-shots")

IGNORE = (
    "favicon", "React DevTools", "[vite]", "manifest.json", "ResizeObserver",
    # Background dashboard/layout queries unrelated to contracting/settings that can
    # fail with a transient local "Failed to fetch" — not part of the feature under test.
    "commissions.findByAgent", "lead_purchases", "getCommissionsByUser",
    "CommissionRepository", "Failed to fetch",
)


def _req(method, path, token, body=None):
    url = f"{SB_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", ANON)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def login_token():
    out = _req("POST", "/auth/v1/token?grant_type=password", ANON,
               {"email": EMAIL, "password": PASSWORD})
    return out["access_token"], out["user"]["id"]


def my_contracts(token, uid):
    return _req("GET",
                f"/rest/v1/carrier_contracts?select=carrier_id,status,approved_date&agent_id=eq.{uid}",
                token) or []


def carrier_name(token, cid):
    rows = _req("GET", f"/rest/v1/carriers?select=name&id=eq.{cid}", token) or []
    return rows[0]["name"] if rows else None


def main() -> int:
    if not (ANON and EMAIL and PASSWORD):
        print("✗ need VITE_SUPABASE_ANON_KEY + E2E_EMAIL + E2E_PASSWORD")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    token, uid = login_token()
    print(f"→ plain agent {EMAIL}  uid={uid}")

    # pick one of my own non-approved rows to self-approve via the UI
    mine = my_contracts(token, uid)
    target = next((c for c in mine if c["status"] in ("pending", "submitted")), None)
    if not target:
        print("✗ agent has no pending/submitted row to self-approve — seed one first")
        return 2
    cid = target["carrier_id"]
    cname = carrier_name(token, cid)
    print(f"→ self-approve target: {cname} ({target['status']} → approved)")

    results: list[tuple[str, bool, str]] = []
    js_errors: list[str] = []
    console_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1680, "height": 1050})
        page.on("pageerror", lambda e: js_errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text)
                if m.type == "error" and not any(s in m.text for s in IGNORE) else None)

        # login
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3000)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (check demo password)")
            return 3

        # ===== TEST 1: My Contracting renders the new self-service controls =====
        page.goto(f"{BASE}/contracting?tab=mine", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(3500)
        body = page.inner_text("body")
        combos = page.get_by_role("combobox").count()
        ok1 = (
            "My carrier contracting" in body
            and "Add carrier" in body
            and "Request different upline" in body
            and combos >= len(mine)  # one inline status Select per row (+ Add carrier)
        )
        results.append(("My Contracting renders inline status + Add-carrier controls",
                        ok1, f"combobox count={combos}, rows={len(mine)}"))
        page.screenshot(path=str(OUT / "selfservice-1-mycontracting.png"), full_page=True)

        # ===== TEST 2: self-approve own row via the inline status <Select> =====
        row = page.locator("li").filter(has_text=cname).filter(
            has=page.get_by_role("combobox")).first
        row.get_by_role("combobox").click()
        page.wait_for_timeout(300)
        page.get_by_role("option", name="Approved", exact=True).click()
        page.wait_for_timeout(2200)
        appr = next((c for c in my_contracts(token, uid) if c["carrier_id"] == cid), None)
        ok2 = bool(appr) and appr["status"] == "approved" and bool(appr["approved_date"])
        results.append(("inline Select self-approves own row (+approved_date)", ok2,
                        f"db row now {appr}"))
        page.screenshot(path=str(OUT / "selfservice-2-approved.png"), full_page=True)

        # ===== TEST 3: Settings has NO carrier-contracts card =====
        page.goto(f"{BASE}/settings", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(3000)
        sbody = page.inner_text("body")
        ok3 = ("My Carrier Contracts" not in sbody) and ("carrier contract toggles" not in sbody.lower())
        results.append(("Settings → Profile has no carrier-contracts card", ok3,
                        "found leftover card text" if not ok3 else ""))
        page.screenshot(path=str(OUT / "selfservice-3-settings.png"), full_page=True)

        browser.close()

    print("\n── self-service results ──")
    all_ok = True
    for name, ok, note in results:
        print(f"  {'✓' if ok else '✗'} {name}" + (f"  [{note}]" if note else ""))
        all_ok = all_ok and ok
    if js_errors:
        print(f"\n✗ {len(js_errors)} JS pageerror(s): {js_errors[:5]}")
        all_ok = False
    if console_errors:
        print(f"\n✗ {len(console_errors)} console error(s): {console_errors[:5]}")
        all_ok = False
    print("\n" + ("✓ self-service contracting works for a plain agent"
                  if all_ok else "✗ gaps remain"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
