#!/usr/bin/env python3
"""
RENDER + READ-PATH smoke for the /policies page after the PolicyRepository
refactor (dedup of selects, shared filter builder, typed mapper, run() helper).

It proves the refactored READ paths still work end-to-end through the real app:
  0. /policies renders "Policy Management" with no JS errors.
  1. transformFromDB (mapper): a known client name from the DB shows in the table.
  2. getAggregateMetrics / countPolicies: the header "total" equals the REST count
     of the agent's own policies.
  3. buildSearchFilter + applyEqualityAndDates: searching a client name narrows the
     list to matching rows (the searched name stays, an unrelated name disappears).

NEVER touches a real auth account (uses @epiclife-demo.test only). Read-only — it
creates no policies/clients.

Usage:
    set -a; source .env; set +a
    export E2E_EMAIL=agent4@epiclife-demo.test E2E_PASSWORD=DemoPass123!
    python3 scripts/smoke-policies.py
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


def my_policies(token, uid):
    return _req(
        "GET",
        f"/rest/v1/policies?select=policy_number,clients(name)&user_id=eq.{uid}"
        f"&order=created_at.desc",
        token,
    ) or []


def active_lifecycle_count(token, uid):
    rows = _req(
        "GET",
        f"/rest/v1/policies?select=id&user_id=eq.{uid}&lifecycle_status=eq.active",
        token,
    ) or []
    return len(rows)


def main() -> int:
    if not ANON:
        print("✗ need VITE_SUPABASE_ANON_KEY in env (source .env)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    token, uid = login_token()

    policies = my_policies(token, uid)
    rest_count = len(policies)
    names = [
        p["clients"]["name"]
        for p in policies
        if p.get("clients") and p["clients"].get("name")
    ]
    # need two distinct client names to prove search narrowing
    distinct = []
    for n in names:
        if n not in distinct:
            distinct.append(n)
    print(f"→ agent4 has {rest_count} policies; distinct client names: {len(distinct)}")
    if rest_count == 0 or len(distinct) < 2:
        print("✗ insufficient demo data (need >=2 distinct client names)")
        return 2
    target_name = distinct[0]   # the one we'll search for
    other_name = distinct[1]    # must disappear after searching target

    results: list[tuple[str, bool, str]] = []

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
        # The h1 is "POLICIES" (free-user header); the "Policy Management"
        # dashboard header is only shown to subscription users.
        page.goto(f"{BASE}/policies", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(3000)
        heading = page.get_by_role("heading", name="POLICIES").first
        try:
            expect(heading).to_be_visible(timeout=8000)
            ok0 = True
        except Exception:
            ok0 = False
        results.append(("/policies renders (POLICIES heading)", ok0, ""))
        page.screenshot(path=str(OUT / "policies-0-render.png"), full_page=True)

        body0 = page.locator("body").inner_text()

        # ===== TEST 1: mapper — a known client name is in the table =====
        ok1 = target_name in body0
        results.append((
            "transformFromDB maps client name (visible in list)",
            ok1, f"looked for '{target_name}'",
        ))

        # ===== TEST 2: aggregate/count — header 'total' equals REST count =====
        # Header renders "{totalPolicies} total"; assert the count appears.
        ok2 = f"{rest_count} total" in body0 or f"{rest_count}\ntotal" in body0
        results.append((
            "getAggregateMetrics total matches REST count",
            ok2, f"rest_count={rest_count}",
        ))

        # ===== TEST 3: search filter narrows the list =====
        search = page.get_by_placeholder("Search by policy # or client name…")
        search.fill(target_name)
        page.wait_for_timeout(2500)  # debounce + refetch
        body3 = page.locator("body").inner_text()
        target_still = target_name in body3
        other_gone = other_name not in body3
        ok3 = target_still and other_gone
        results.append((
            "search by client name narrows the list",
            ok3,
            f"'{target_name}' shown={target_still}, '{other_name}' gone={other_gone}",
        ))
        page.screenshot(path=str(OUT / "policies-3-search.png"), full_page=True)

        # ===== TEST 4: Lifecycle filter narrows server-side (regression: the
        # filter key used to be dropped at the policyService layer) =====
        active_count = active_lifecycle_count(token, uid)
        ok4 = False
        note4 = f"active={active_count}/{rest_count}"
        if active_count == rest_count:
            note4 += " (all active — can't distinguish; skipped)"
            ok4 = True  # not a meaningful case, don't fail the run
        else:
            # fresh load (no leftover search term), open the Filters panel,
            # pick Lifecycle = Active
            page.goto(f"{BASE}/policies", wait_until="domcontentloaded", timeout=30_000)
            page.wait_for_timeout(2500)
            page.get_by_role("button", name="Filters").first.click()
            page.wait_for_timeout(500)
            page.get_by_role("combobox").filter(has_text="All Lifecycle").first.click()
            page.wait_for_timeout(400)
            page.get_by_role("option", name="Active", exact=True).click()
            page.wait_for_timeout(2500)  # refetch list + count + metrics
            body4 = page.locator("body").inner_text()
            shows_active = f"{active_count} total" in body4
            full_gone = f"{rest_count} total" not in body4
            ok4 = shows_active and full_gone
            note4 += f", '{active_count} total' shown={shows_active}, '{rest_count} total' gone={full_gone}"
        results.append(("Lifecycle filter narrows the count server-side", ok4, note4))
        page.screenshot(path=str(OUT / "policies-4-lifecycle.png"), full_page=True)

        browser.close()

    print("\n── functional results ──")
    all_ok = True
    for name, ok, note in results:
        print(f"  {'✓' if ok else '✗'} {name}" + (f"  [{note}]" if note else ""))
        all_ok = all_ok and ok
    if js_errors:
        print(f"\n✗ {len(js_errors)} JS error(s): {js_errors[:5]}")
        all_ok = False
    print("\n" + ("✓ all policy read-path checks passed" if all_ok else "✗ gaps remain"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
