#!/usr/bin/env python3
"""E2E proof of review fix #3: when a call ends, the intake modal stays OPEN in a 'Call ended'
state (no auto-dismiss / no lost work). Inserts ONE call, captures its id, ends THAT exact id, and
asserts the modal stayed open and flipped. Read-only auth; self-cleans by id."""
import os, re, subprocess, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:4317")
EMAIL = os.environ.get("E2E_EMAIL"); PASSWORD = os.environ.get("E2E_PASSWORD")
AGENT_EMAIL = "epiclife.neessen@gmail.com"
TAG = "e2e-flip"
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

def sql(q): subprocess.run(["./scripts/migrations/run-sql.sh", q], capture_output=True)
def sql_out(q): return subprocess.run(["./scripts/migrations/run-sql.sh", q], capture_output=True, text=True).stdout

# clean slate: any prior e2e-flip + any stale ringing for the agent
sql(f"DELETE FROM inbound_calls WHERE request_tag = '{TAG}';")
sql(f"DELETE FROM inbound_calls WHERE status='ringing' AND agent_id=(SELECT up.id FROM user_profiles up JOIN auth.users au ON au.id=up.id WHERE au.email='{AGENT_EMAIL}' LIMIT 1);")

with sync_playwright() as p:
    page = p.chromium.launch().new_page(viewport={"width": 1680, "height": 1050})
    page.on("console", lambda m: print("CONSOLE:", m.text[:120]) if "inbound-call" in m.text else None)
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
    page.locator("input[type=email]").first.fill(EMAIL)
    page.locator("input[type=password]").first.fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(4000)
    page.goto(f"{BASE}/clients", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(8000)  # private channel subscribes (rehydration finds nothing)

    # Insert ONE ringing call, capture its exact id.
    out = sql_out(f"""INSERT INTO inbound_calls (imo_id, request_tag, agent_id, client_id, ani, phone_e164, status, fired_pop, patch_only)
            SELECT up.imo_id, '{TAG}', up.id, (SELECT id FROM clients WHERE user_id=up.id LIMIT 1),
                   '5551234567', public.normalize_phone_e164('5551234567'), 'ringing', true, false
            FROM user_profiles up JOIN auth.users au ON au.id=up.id WHERE au.email='{AGENT_EMAIL}' LIMIT 1
            RETURNING id;""")
    m = re.search(UUID, out)
    call_id = m.group(0) if m else None
    print("inserted call id:", call_id)
    popped = False
    for _ in range(24):
        # The pop no longer dresses itself up as a ringing phone ("Incoming call"); it's just the
        # client intake form. Detect it by the neutral "Client intake" header eyebrow.
        if "client intake" in page.inner_text("body").lower():
            popped = True; break
        page.wait_for_timeout(500)

    # End THAT exact call by id -> a single 'ended' broadcast for the call that's showing.
    sql(f"UPDATE inbound_calls SET status='ended' WHERE id='{call_id}';")
    page.wait_for_timeout(3000)
    body = page.inner_text("body").lower()
    still_open = "save intake" in body
    flipped = "call ended" in body
    page.screenshot(path="/tmp/clients-shots/call-ended-open.png")
    sql(f"DELETE FROM inbound_calls WHERE id='{call_id}';")
    page.context.browser.close()

    ok = popped and still_open and flipped
    print(f"popped={popped} still_open={still_open} ended_banner={flipped}")
    print("RESULT: PASS — modal stayed open + flipped to 'Call ended'" if ok else "RESULT: FAIL")
    sys.exit(0 if ok else 1)
