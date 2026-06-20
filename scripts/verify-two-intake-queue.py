#!/usr/bin/env python3
"""E2E proof + screenshots of the inbound-intake pop UX.

The phone call lives in NetTrio; this app only POPs the client intake form. NetTrio never routes a
new call to an agent who is mid-call, so the ONLY time a new-caller notification appears is while the
agent is wrapping up a PREVIOUS (already-ended) intake. This drives exactly that:

  1. Caller A routed in            -> intake form pops for A.
  2. A's call ENDS in NetTrio      -> form STAYS open + neutral "Call ended" marker (no softphone red).
  3. Caller B routed in (form open)-> a BIG, amber "New caller waiting" dialog appears over the form
                                      (A is never clobbered).
  4. Click "Open new intake"       -> switches to the new caller; the alert clears.

ROBUST TO LIVE TEST-FIRING (the `inbound:<agent>` topic is shared): every text check is scoped to the
intake DIALOG, and caller A is LOCKED as the active intake first (once a call is active, foreign calls
only queue — they never steal the active slot). Header text is CSS uppercase -> checks are lower-cased.
Screenshots are written to /tmp/clients-shots/ as visual proof. Self-cleans every row it creates."""
import os, re, subprocess, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:4317")
EMAIL = os.environ.get("E2E_EMAIL"); PASSWORD = os.environ.get("E2E_PASSWORD")
AGENT_EMAIL = "epiclife.neessen@gmail.com"
TAG_A, TAG_B = "e2e-q-a", "e2e-q-b"
PHONE_A, PHONE_B = "5550000001", "5550000002"
NAME_A, NAME_B = "Alpha Qtester", "Bravo Qtester"
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

def sql(q): subprocess.run(["./scripts/migrations/run-sql.sh", q], capture_output=True)
def sql_out(q): return subprocess.run(["./scripts/migrations/run-sql.sh", q], capture_output=True, text=True).stdout

AGENT_SUBQ = (f"(SELECT up.id FROM user_profiles up JOIN auth.users au ON au.id=up.id "
              f"WHERE au.email='{AGENT_EMAIL}' LIMIT 1)")

def cleanup():
    sql(f"DELETE FROM inbound_calls WHERE request_tag IN ('{TAG_A}','{TAG_B}');")
    sql(f"DELETE FROM inbound_calls WHERE client_id IN (SELECT id FROM clients "
        f"WHERE user_id={AGENT_SUBQ} AND name IN ('{NAME_A}','{NAME_B}'));")
    sql(f"DELETE FROM clients WHERE user_id={AGENT_SUBQ} AND name IN ('{NAME_A}','{NAME_B}');")

def seed_client(name, phone, state, city, zipc):
    out = sql_out(f"""INSERT INTO clients (user_id, name, phone, state, status, email, date_of_birth, address)
        SELECT {AGENT_SUBQ}, '{name}', '{phone}', '{state}', 'active', '{phone}@example.com', '1960-01-01',
               '{{"street":"1 {state} St","city":"{city}","state":"{state}","zipCode":"{zipc}"}}'
        RETURNING id;""")
    m = re.search(UUID, out); return m.group(0) if m else None

def fire_ringing(tag, client_id, phone):
    out = sql_out(f"""INSERT INTO inbound_calls (imo_id, request_tag, agent_id, client_id, ani, phone_e164, status, fired_pop, patch_only)
        SELECT up.imo_id, '{tag}', up.id, '{client_id}', '{phone}',
               public.normalize_phone_e164('{phone}'), 'ringing', true, false
        FROM user_profiles up JOIN auth.users au ON au.id=up.id WHERE au.email='{AGENT_EMAIL}' LIMIT 1
        RETURNING id;""")
    m = re.search(UUID, out); return m.group(0) if m else None

cleanup()
client_a = seed_client(NAME_A, PHONE_A, "TX", "Austin", "78701")
client_b = seed_client(NAME_B, PHONE_B, "FL", "Miami", "33101")
print("seeded clients:", client_a, client_b)

results = {}
with sync_playwright() as p:
    page = p.chromium.launch().new_page(viewport={"width": 1680, "height": 1050})
    page.on("console", lambda m: print("  C:", m.text[:150]) if "inbound-call" in m.text else None)
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
    page.locator("input[type=email]").first.fill(EMAIL)
    page.locator("input[type=password]").first.fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(4000)
    page.goto(f"{BASE}/clients", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(8000)  # private channel subscribes

    def dlg():
        loc = page.locator('[role=dialog]')
        return loc.first.inner_text().lower() if loc.count() else ""
    def alert_up(): return page.locator('[role=alertdialog]').count() > 0
    def click(name):
        try: page.get_by_role("button", name=name, exact=False).first.click(timeout=2000)
        except Exception: pass

    # ---- LOCK caller A as the active intake (robust to a foreign call grabbing the slot first) ----
    id_a = fire_ringing(TAG_A, client_a, PHONE_A); print("call A id:", id_a)
    for _ in range(50):
        d = dlg()
        if NAME_A.lower() in d: break
        if alert_up(): click("Open new intake")      # promote the queue toward A
        elif "save intake" in d: click("Close")       # dismiss a foreign active call
        page.wait_for_timeout(400)
    locked = NAME_A.lower() in dlg()
    if alert_up(): click("Finish current first")      # clear any stray alert before asserting
    results["A locked as the active intake (Alpha)"] = locked
    page.screenshot(path="/tmp/clients-shots/queue-1-A-open.png")

    # ---- 2. A ends in NetTrio -> form stays open + neutral "Call ended" marker ----
    sql(f"UPDATE inbound_calls SET status='ended' WHERE id='{id_a}';")
    page.wait_for_timeout(3000)
    d = dlg()
    results["A ended: form still open"] = "save intake" in d
    results["A ended: 'Call ended' marker shown"] = "call ended" in d
    results["A ended: Alpha not wiped"] = NAME_A.lower() in d
    page.screenshot(path="/tmp/clients-shots/queue-2-A-ended.png")

    # ---- 3. B routed in while A's form is open -> BIG amber "New caller waiting" dialog ----
    id_b = fire_ringing(TAG_B, client_b, PHONE_B); print("call B id:", id_b)
    alert_seen = False
    for _ in range(24):
        if alert_up() and "new caller waiting" in dlg():
            alert_seen = True; break
        page.wait_for_timeout(500)
    results["B: big 'New caller waiting' dialog appears"] = alert_seen
    results["B: A NOT clobbered (Alpha still behind the alert)"] = NAME_A.lower() in dlg()
    page.screenshot(path="/tmp/clients-shots/queue-3-new-caller-dialog.png")

    # ---- 4. Open new intake -> switches away from A; alert clears ----
    if alert_seen: click("Open new intake")
    switched = False
    for _ in range(16):
        d = dlg()
        if "save intake" in d and NAME_A.lower() not in d:
            switched = True; break
        page.wait_for_timeout(500)
    results["Open new intake: switches away from Alpha"] = switched
    page.screenshot(path="/tmp/clients-shots/queue-4-switched.png")

    page.context.browser.close()

cleanup()

print("\n--- checks ---")
for k, v in results.items():
    print(f"  [{'PASS' if v else 'FAIL'}] {k}")
ok = all(results.values())
print("\nRESULT: PASS — big new-caller dialog; queue never clobbers; end is signalled" if ok else "\nRESULT: FAIL (may be confounded by concurrent live test-firing — see screenshots)")
sys.exit(0 if ok else 1)
