#!/usr/bin/env python3
"""
FUNCTIONAL smoke for the Recruiting → Prospects tab. Proves a plain agent can:
  1. Open /recruiting/prospects and render it with no JS errors.
  2. Add a prospect via the dialog → a prospects row is created (verified through
     the same RLS-scoped REST endpoint the app uses) WITHOUT creating a
     user_profiles auth account (i.e. no welcome email path is triggered).
  3. Change a prospect's status inline → the change persists to the DB.
  4. Click "Convert" → the Add Recruit dialog opens PRE-FILLED with the prospect's
     name (no submit — we don't want to create a real recruit / send an email).

NEVER touches a real auth account (uses @epiclife-demo.test only).

Usage:
    set -a; source .env; set +a
    export E2E_EMAIL=agent4@epiclife-demo.test E2E_PASSWORD=DemoPass123!
    python3 scripts/smoke-prospects.py
"""

import os
import sys
import json
import time
import urllib.request
import pathlib
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
SB_URL = os.environ.get("VITE_SUPABASE_URL", "http://127.0.0.1:54321").rstrip("/")
ANON = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
EMAIL = os.environ.get("E2E_EMAIL", "agent4@epiclife-demo.test")
PASSWORD = os.environ.get("E2E_PASSWORD", "DemoPass123!")
OUT = pathlib.Path("/tmp/board-shots")


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


def my_prospects(token, uid):
    return _req(
        "GET",
        f"/rest/v1/prospects?select=id,first_name,last_name,status,email&owner_id=eq.{uid}&order=created_at.desc",
        token,
    ) or []


def profiles_by_email(token, email):
    return _req(
        "GET",
        f"/rest/v1/user_profiles?select=id,email&email=eq.{email}",
        token,
    ) or []


def main() -> int:
    if not (ANON):
        print("✗ need VITE_SUPABASE_ANON_KEY in env (source .env)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    token, uid = login_token()
    results: list[tuple[str, bool, str]] = []

    ts = str(int(time.time()))[-6:]
    fname = f"Smoke{ts}"
    lname = "Prospect"
    pemail = f"smoke{ts}@example.com"
    print(f"→ adding prospect: {fname} {lname} <{pemail}>")

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

        # ===== TEST 0: page renders =====
        page.goto(f"{BASE}/recruiting/prospects", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)
        rendered = page.get_by_role("heading", name="Prospects").first
        try:
            expect(rendered).to_be_visible(timeout=6000)
            ok0 = True
        except Exception:
            ok0 = False
        results.append(("/recruiting/prospects renders", ok0, ""))
        page.screenshot(path=str(OUT / "prospects-0-render.png"), full_page=True)

        # ===== TEST 1: add prospect persists, NO auth account created =====
        before = my_prospects(token, uid)
        page.get_by_role("button", name="Add prospect").first.click()
        page.wait_for_timeout(700)
        dialog = page.get_by_role("dialog")
        dialog.locator("#p_first").fill(fname)
        dialog.locator("#p_last").fill(lname)
        dialog.locator("#p_email").fill(pemail)
        dialog.locator("#p_phone").fill("(555) 123-4567")
        # submit (button inside the dialog, not the header pill)
        dialog.get_by_role("button", name="Add prospect").click()
        page.wait_for_timeout(2200)
        after = my_prospects(token, uid)
        added = next((r for r in after if r["first_name"] == fname), None)
        ok1 = (len(after) == len(before) + 1) and (added is not None)
        results.append(("Add prospect creates a prospects row", ok1,
                        f"before={len(before)} after={len(after)}"))
        # No auth account / welcome-email path: prospect email must NOT exist as a user_profile
        no_account = len(profiles_by_email(token, pemail)) == 0
        results.append(("Add prospect does NOT create an auth account (no welcome email)",
                        no_account, f"user_profiles with {pemail}: {0 if no_account else '>=1'}"))
        page.screenshot(path=str(OUT / "prospects-1-added.png"), full_page=True)

        # ===== TEST 2: inline status change persists =====
        ok2 = False
        note2 = "row not found"
        if added:
            row = page.locator("tr", has_text=fname).first
            row.get_by_role("combobox").click()
            page.wait_for_timeout(300)
            page.get_by_role("option", name="Contacted", exact=True).click()
            page.wait_for_timeout(1800)
            refreshed = my_prospects(token, uid)
            match = next((r for r in refreshed if r["id"] == added["id"]), None)
            ok2 = bool(match and match["status"] == "contacted")
            note2 = f"db status now '{match['status'] if match else '??'}'"
        results.append(("inline status change persists", ok2, note2))
        page.screenshot(path=str(OUT / "prospects-2-status.png"), full_page=True)

        # ===== TEST 3: Convert opens Add Recruit prefilled =====
        ok3 = False
        note3 = "row not found"
        if added:
            row = page.locator("tr", has_text=fname).first
            # the Convert action is the UserPlus button (title="Convert to recruit")
            row.get_by_title("Convert to recruit").click()
            page.wait_for_timeout(1000)
            try:
                recruit_dialog = page.get_by_role("dialog")
                expect(recruit_dialog).to_be_visible(timeout=4000)
                # the basic-info first_name input should be prefilled with the prospect's name
                val = recruit_dialog.locator("#first_name").input_value()
                ok3 = (val == fname)
                note3 = f"Add Recruit first_name prefilled='{val}'"
            except Exception as e:
                note3 = f"dialog/prefill check failed: {e}"
        results.append(("Convert opens Add Recruit prefilled", ok3, note3))
        page.screenshot(path=str(OUT / "prospects-3-convert.png"), full_page=True)

        browser.close()

    print("\n── functional results ──")
    all_ok = True
    for name, ok, note in results:
        print(f"  {'✓' if ok else '✗'} {name}" + (f"  [{note}]" if note else ""))
        all_ok = all_ok and ok
    if js_errors:
        print(f"\n✗ {len(js_errors)} JS error(s): {js_errors[:5]}")
        all_ok = False
    print("\n" + ("✓ all prospect checks passed" if all_ok else "✗ gaps remain"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
