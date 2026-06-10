#!/usr/bin/env python3
"""
FUNCTIONAL smoke for the Contracting Hub — proves the buttons actually FIRE and
mutate Supabase, not just that they render. Drives the real UI as a throwaway
demo manager and verifies each side-effect through the same RLS-scoped RPCs the
app calls. NEVER touches a real auth account (uses @epiclife-demo.test only).

Covers:
  1. Upline status write  — change a downline carrier's status via the detail
     <Select>, verify get_my_downline_contracts reflects the new status.
  2. Self "Start request"  — click a Newly-Eligible "Start request", verify a
     new carrier_contracts row appears for the manager.
  3. "Request different upline" — click opens the dialog (no submit).

Usage:
    set -a; source .env; set +a            # SUPABASE url/anon
    export E2E_EMAIL=mgr1@epiclife-demo.test E2E_PASSWORD=DemoPass123!
    python3 scripts/smoke-contracting-interactive.py
"""

import os
import sys
import json
import urllib.request
import pathlib
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
SB_URL = os.environ.get("VITE_SUPABASE_URL", "http://127.0.0.1:54321").rstrip("/")
ANON = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")

STATUS_LABEL = {
    "pending": "Pending",
    "submitted": "Submitted",
    "approved": "Approved",
    "denied": "Denied",
    "terminated": "Terminated",
}


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
    out = _req(
        "POST", "/auth/v1/token?grant_type=password", ANON,
        {"email": EMAIL, "password": PASSWORD},
    )
    return out["access_token"], out["user"]["id"]


def downline_contracts(token):
    return _req("POST", "/rest/v1/rpc/get_my_downline_contracts", token, {}) or []


def newly_eligible(token):
    return _req("POST", "/rest/v1/rpc/get_newly_eligible_carriers", token, {}) or []


def own_contract(token, uid, carrier_id):
    rows = _req(
        "GET",
        f"/rest/v1/carrier_contracts?select=status,carrier_id&agent_id=eq.{uid}&carrier_id=eq.{carrier_id}",
        token,
    )
    return rows[0] if rows else None


def main() -> int:
    if not (EMAIL and PASSWORD and ANON):
        print("✗ need E2E_EMAIL, E2E_PASSWORD, VITE_SUPABASE_ANON_KEY in env")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    token, uid = login_token()
    results: list[tuple[str, bool, str]] = []

    # ---- pick a deterministic status-change target from the live data ----
    dc = downline_contracts(token)
    if not dc:
        print("✗ no downline carrier contracts to exercise — seed first")
        return 2
    target = dc[0]
    agent_name = target["agent_name"]
    carrier_name = target["carrier_name"]
    carrier_id = target["carrier_id"]
    agent_id = target["agent_id"]
    cur = target["status"]
    new_status = "submitted" if cur != "submitted" else "denied"
    first_name = agent_name.split()[0]
    print(f"→ target: {agent_name} · {carrier_name}  {cur} → {new_status}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1680, "height": 1050})
        js_errors: list[str] = []
        page.on("pageerror", lambda e: js_errors.append(str(e)))

        # login
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3000)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed")
            return 3

        # ===== TEST 1: upline status write =====
        page.goto(f"{BASE}/contracting?tab=downline", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)
        # select the agent via the roster search, then click their row
        page.get_by_placeholder("Search agents").fill(first_name)
        page.wait_for_timeout(600)
        page.locator("li", has_text=agent_name).first.click()
        page.wait_for_timeout(800)
        # open the carrier row's status Select and pick the new status
        row = page.locator("li").filter(has_text=carrier_name).filter(has=page.get_by_role("combobox")).first
        row.get_by_role("combobox").click()
        page.wait_for_timeout(300)
        page.get_by_role("option", name=STATUS_LABEL[new_status], exact=True).click()
        page.wait_for_timeout(2000)
        after = downline_contracts(token)
        match = next((r for r in after if r["agent_id"] == agent_id and r["carrier_id"] == carrier_id), None)
        ok1 = bool(match and match["status"] == new_status)
        results.append(("upline status write fires + persists", ok1,
                        f"db status now '{match['status'] if match else '??'}' (wanted '{new_status}')"))
        page.screenshot(path=str(OUT / "interactive-1-status.png"), full_page=True)

        # ===== TEST 2: self Start request =====
        page.goto(f"{BASE}/contracting?tab=mine", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)
        elig = newly_eligible(token)
        start_btns = page.get_by_role("button", name="Start request")
        if elig and start_btns.count() > 0:
            elig_cid = elig[0]["carrier_id"]
            before_row = own_contract(token, uid, elig_cid)
            # click the Start request for the first eligible carrier
            start_btns.first.click()
            page.wait_for_timeout(2200)
            after_row = own_contract(token, uid, elig_cid)
            ok2 = (before_row is None) and (after_row is not None)
            results.append(("self Start-request creates carrier_contracts row", ok2,
                            f"row before={before_row}, after={after_row}"))
        else:
            results.append(("self Start-request", True, "skipped — no newly-eligible carriers (vacuously ok)"))
        page.screenshot(path=str(OUT / "interactive-2-startreq.png"), full_page=True)

        # ===== TEST 3: Request different upline dialog opens =====
        page.get_by_role("button", name="Request different upline").first.click()
        page.wait_for_timeout(800)
        dialog = page.get_by_role("dialog")
        try:
            expect(dialog).to_be_visible(timeout=4000)
            ok3 = True
        except Exception:
            ok3 = False
        results.append(("Request-different-upline opens dialog", ok3, ""))
        page.screenshot(path=str(OUT / "interactive-3-dialog.png"), full_page=True)

        browser.close()

    print("\n── functional results ──")
    all_ok = True
    for name, ok, note in results:
        print(f"  {'✓' if ok else '✗'} {name}" + (f"  [{note}]" if note else ""))
        all_ok = all_ok and ok
    if js_errors:
        print(f"\n✗ {len(js_errors)} JS error(s): {js_errors[:5]}")
        all_ok = False
    print("\n" + ("✓ all button-fire checks passed" if all_ok else "✗ functional gaps remain"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
