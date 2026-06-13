#!/usr/bin/env python3
"""
Seed the LOCAL Supabase DB with a rich, believable Epic Life agency for a
video demo (KPI dashboards, commissions, hierarchy/overrides, recruiting,
expenses, lead ROI).

What it builds (all under the Epic Life IMO):
  - A demo agency ("The Standard") owned by one login-capable agency owner.
  - A hierarchy: owner -> N managers -> M agents per manager.
  - Per agent: clients, policies (spread over ~18-24 months across every
    status), advance/renewal/chargeback commissions, expenses, lead purchases
    with ROI, carrier contracts + writing numbers, daily sales, KPI targets.
  - Override (passive-income) commissions rolled UP each upline chain, so the
    owner's / managers' "team production" + override income views are full.

Design notes:
  - Idempotent: deterministic agent UUIDs (uuid5) + a delete-then-reinsert of
    every seeded row, so re-running just refreshes the dataset.
  - Triggers stay ON during inserts (the app's own logic computes earned/
    unearned commission amounts, hierarchy_path, agency_id, lead ROI, etc.).
    Epic-scoped carriers have no comp_guide rows, so the auto-override trigger
    simply skips -> our hand-seeded overrides are NOT duplicated.
  - replica mode is used ONLY to make the idempotent cleanup-delete order-
    independent (FK/cascade off for the delete block); inserts run normally.
  - LOCAL ONLY. A guard aborts if the Sunset-Test IMO (a local-only marker)
    is missing, so this can never touch prod.

Usage:
  python3 scripts/seed-epic-life-demo.py                 # massive (default)
  python3 scripts/seed-epic-life-demo.py --scale test    # 2 agents, tiny (validate)
  python3 scripts/seed-epic-life-demo.py --scale rich     # ~15 agents
  python3 scripts/seed-epic-life-demo.py --scale lean     # ~4 agents
  python3 scripts/seed-epic-life-demo.py --managers 6 --agents-per-manager 6
  python3 scripts/seed-epic-life-demo.py --owner-email me@demo.test --password Foo1!
"""

import argparse
import json
import random
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
import uuid
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RUN_SQL = REPO / "scripts" / "migrations" / "run-sql.sh"
SUPABASE_URL = "http://127.0.0.1:54321"

# REAL accounts this script must NEVER create/modify/own/use. The demo runs
# entirely on throwaway @epiclife-demo.test logins. Hard guard below.
PROTECTED_EMAILS = {
    "epiclife.neessen@gmail.com",
    "nickneessen@thestandardhq.com",
    "nick@nickneessen.com",
    "nick.neessen@gmail.com",
    "nickneessen.ffl@gmail.com",
}

EPIC_IMO = "2fd256e9-9abb-445e-b405-62436555648a"
SUNSET_IMO = "5c0f5e7d-0000-4000-a000-000000000001"  # local-only marker for the guard
# Reuse the existing Epic-Life "The Standard" agency (owner was NULL) so the demo
# attaches to the real local agency instead of creating a duplicate.
AGENCY_ID = "ca43b42a-e4e4-49cf-be1b-efd19fb21db9"
NS = uuid.uuid5(uuid.NAMESPACE_URL, "epic-life-demo-seed")  # stable child-row id namespace

CARRIER_NAMES = [
    "Aflac", "Mutual of Omaha", "Americo", "American Amicable",
    "Foresters Financial", "F&G", "Corebridge", "Transamerica",
]
VENDOR_NAMES = ["Quility Live Transfers", "DigitalBGA FB Leads", "Need-A-Lead Aged"]

PRODUCTS = (  # (product_type, monthly_premium_range, weight)
    ("whole_life", (35, 160), 45),
    ("term_life", (20, 95), 25),
    ("indexed_universal_life", (150, 650), 18),
    ("universal_life", (120, 420), 8),
    ("annuity", (250, 900), 4),
)
STATES = ["TX", "FL", "AZ", "GA", "NC", "OH", "CA", "NV", "TN", "SC", "MO", "AL", "IN", "KY"]
FIRST = ["Maria", "James", "Linda", "Devin", "Aisha", "Marcus", "Sofia", "Ethan", "Grace",
         "Noah", "Olivia", "Liam", "Emma", "Mason", "Ava", "Lucas", "Mia", "Caleb", "Zoe",
         "Andre", "Priya", "Hector", "Nina", "Omar", "Tara", "Wes", "Bianca", "Cole", "Dana",
         "Reggie", "Yvonne", "Carlos", "Jade", "Trevor", "Simone", "Derrick", "Lena"]
LAST = ["Sanchez", "Carter", "Nguyen", "Brooks", "Khan", "Lee", "Ramirez", "Bell", "Foster",
        "Patel", "Diaz", "Howard", "Reed", "Cole", "Ward", "Price", "Hayes", "Long", "Bishop",
        "Watts", "Mercer", "Stone", "Vance", "Frost", "Boone", "Cross", "Pruitt", "Maddox"]
EXPENSE_CATS = ["Life Insurance Leads", "Software", "Rent & Lease", "Marketing", "Travel",
                "Utilities", "Credit Card Bill"]


# ───────────────────────── SQL value helpers ────────────────────────────────
def q(v):
    """Render a Python value as a SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    return "'" + str(v).replace("'", "''") + "'"


def row(*vals):
    return "(" + ", ".join(q(v) for v in vals) + ")"


# commissions rows are always rendered with this fixed 13-column shape so a
# single INSERT covers advance/renewal/chargeback/pending alike.
COMM_COLS = ("id, user_id, policy_id, imo_id, type, status, amount, advance_months, "
             "months_paid, payment_date, chargeback_amount, chargeback_date, chargeback_reason")


def comm(cid, uid, pid, ctype, status, amount, mpaid, payment_date=None,
         cb_amt=None, cb_date=None, cb_reason=None, advance_months=9):
    return row(cid, uid, pid, EPIC_IMO, ctype, status, amount, advance_months,
               mpaid, payment_date, cb_amt, cb_date, cb_reason)


# ───────────────────────── local Supabase admin API ─────────────────────────
def get_keys():
    out = subprocess.run(["npx", "supabase", "status", "-o", "json"],
                         cwd=REPO, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"`supabase status` failed (is the local stack up?):\n{out.stderr}")
    d = json.loads(out.stdout)
    return d["ANON_KEY"], d["SERVICE_ROLE_KEY"]


def api(method, path, key, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}", data=data, method=method,
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def find_user_id(key, email):
    page = 1
    while True:
        s, d = api("GET", f"/auth/v1/admin/users?page={page}&per_page=200", key)
        if s != 200:
            return None
        users = d.get("users", d if isinstance(d, list) else [])
        for u in users:
            if (u.get("email") or "").lower() == email.lower():
                return u["id"]
        if not users or len(users) < 200:
            return None
        page += 1


def ensure_auth_user(key, email, password):
    """Create a NEW login-capable auth user, or REUSE an existing one untouched.

    CRITICAL: if the email already belongs to a real account, we DO NOT modify it
    (no password reset, no email change) — we only read its id. This protects the
    owner's real login. Only freshly-created demo users get the shared password."""
    # Reuse an existing account UNTOUCHED first (this is how a real owner login like
    # epiclife.neessen@gmail.com is used as the demo owner without altering its auth).
    existing = find_user_id(key, email)
    if existing:
        return existing, "existing"
    if email.lower() in PROTECTED_EMAILS:
        sys.exit(f"REFUSING to create protected account {email} (it does not exist).")
    s, d = api("POST", "/auth/v1/admin/users", key,
               {"email": email, "password": password, "email_confirm": True})
    if s in (200, 201) and d.get("id"):
        return d["id"], "created"
    sys.exit(f"Could not create user {email}: {d}")


def verify_login(anon, email, password):
    _, d = api("POST", "/auth/v1/token?grant_type=password", anon,
               {"email": email, "password": password})
    return bool(d.get("access_token")), d.get("msg")


def run_sql(sql, label):
    # ON_ERROR_STOP: psql otherwise exits 0 even when a statement inside a
    # transaction errors (aborting the whole txn) -> silent rollback. This makes
    # any failure surface as a non-zero exit AND we still scan output for ERROR.
    sql = "\\set ON_ERROR_STOP on\n" + sql
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, dir="/tmp") as f:
        f.write(sql)
        path = f.name
    out = subprocess.run([str(RUN_SQL), "-f", path], cwd=REPO, capture_output=True, text=True)
    combined = out.stdout + "\n" + out.stderr
    if out.returncode != 0 or "ERROR:" in combined:
        print(combined[-4000:])
        sys.exit(f"[{label}] SQL failed (file kept at {path}).")
    Path(path).unlink(missing_ok=True)
    return out.stdout


# ───────────────────────── guard: local only ────────────────────────────────
def assert_local():
    """Confirm run-sql.sh (psql) targets the LOCAL DB. The Sunset-Test IMO is a
    local-only seed marker that does NOT exist on prod, so its presence proves
    we are not about to write to production. Goes through run-sql.sh on purpose
    (that is the exact connection the data SQL will use)."""
    out = subprocess.run(
        [str(RUN_SQL),
         f"SELECT 'GUARD_MARKER=' || count(*) FROM imos WHERE id='{SUNSET_IMO}';"],
        cwd=REPO, capture_output=True, text=True)
    if out.returncode != 0:
        print(out.stderr, file=sys.stderr)
        sys.exit("GUARD: marker query failed; refusing to seed.")
    marker = 0
    for line in out.stdout.splitlines():
        if "GUARD_MARKER=" in line:
            try:
                marker = int(line.split("GUARD_MARKER=")[1].strip())
            except ValueError:
                pass
    if marker < 1:
        print(out.stdout)
        sys.exit("GUARD: Sunset-Test marker IMO absent — this looks like a NON-local DB. Aborting.")
    print("  guard: local DB confirmed (Sunset-Test marker present).")


# ───────────────────────── scale presets ────────────────────────────────────
# A 3-level downline under the owner: owner -> managers -> team leads -> agents.
# Comps strictly DECREASE down every chain (145 > 125 > 110 > <=100) so every
# upline earns a positive override spread.
SCALES = {
    "test":    dict(managers=1, leads_per_manager=1, agents_per_lead=1,
                    owner_pol=4,  mgr_pol=3,  lead_pol=3,  agent_pol=(2, 4)),
    "lean":    dict(managers=2, leads_per_manager=1, agents_per_lead=2,
                    owner_pol=12, mgr_pol=9,  lead_pol=6,  agent_pol=(4, 8)),
    "rich":    dict(managers=3, leads_per_manager=2, agents_per_lead=3,
                    owner_pol=28, mgr_pol=20, lead_pol=14, agent_pol=(8, 18)),
    "massive": dict(managers=3, leads_per_manager=3, agents_per_lead=3,
                    owner_pol=40, mgr_pol=26, lead_pol=16, agent_pol=(8, 18)),
}
OWNER_LVL, MGR_LVL, LEAD_LVL = 145, 125, 110
AGENT_LVLS = [80, 85, 90, 95, 100]  # all strictly below LEAD_LVL


# ───────────────────────── agent model ──────────────────────────────────────
class Agent:
    def __init__(self, aid, first, last, email, level, role, tier, upline, npolicies):
        self.id, self.first, self.last, self.email = aid, first, last, email
        self.level, self.role, self.tier = level, role, tier
        self.upline, self.npolicies = upline, npolicies
        self.chain = []  # upline agents from immediate parent up to the owner


def build_team(cfg, rng, owner_email):
    """owner -> managers -> team leads -> agents, ids filled later from auth.users.
    Comps strictly decrease along every parent->child edge."""
    owner = Agent(None, "Marcus", "Bell", owner_email, OWNER_LVL, "agency_owner", "owner",
                  None, cfg["owner_pol"])
    team = [owner]
    n = [0]

    def mk(parent, level, role, tier, pol):
        n[0] += 1
        i = n[0]
        npol = rng.randint(*pol) if isinstance(pol, tuple) else pol
        ag = Agent(None, FIRST[(i * 3 + 5) % len(FIRST)], LAST[(i * 5 + 2) % len(LAST)],
                   f"{tier}{i}@epiclife-demo.test", level, role, tier, parent, npol)
        team.append(ag)
        return ag

    for _ in range(cfg["managers"]):
        mgr = mk(owner, MGR_LVL, "imo_manager", "mgr", cfg["mgr_pol"])
        for _ in range(cfg["leads_per_manager"]):
            lead = mk(mgr, LEAD_LVL, "agent", "lead", cfg["lead_pol"])
            for _ in range(cfg["agents_per_lead"]):
                mk(lead, rng.choice(AGENT_LVLS), "agent", "agent", cfg["agent_pol"])

    # Build override chains (parent -> ... -> owner) and assert strict comp decrease.
    for ag in team:
        chain, p = [], ag.upline
        while p is not None:
            assert p.level > ag.level, (
                f"comp not strictly decreasing: {ag.tier}({ag.level}) under {p.tier}({p.level})")
            chain.append(p)
            p = p.upline
        ag.chain = chain
    return team


# ───────────────────────── SQL builders ─────────────────────────────────────
def setup_sql(team):
    owner_id = team[0].id
    s = [f"""
INSERT INTO agencies (id, imo_id, name, code, owner_id, is_active, contact_email, city, state)
VALUES ('{AGENCY_ID}', '{EPIC_IMO}', 'The Standard', 'EPIC-STD', '{owner_id}', true,
        {q(team[0].email)}, 'Austin', 'TX')
ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, name = EXCLUDED.name,
        is_active = true, updated_at = now();
"""]
    # Carriers + vendors: insert-if-absent by name (carriers has no name-unique
    # constraint, and an "Aflac" may already exist under Epic -> avoid dupes).
    for n in CARRIER_NAMES:
        s.append(f"INSERT INTO carriers (id, name, imo_id) SELECT gen_random_uuid(), {q(n)}, '{EPIC_IMO}' "
                 f"WHERE NOT EXISTS (SELECT 1 FROM carriers WHERE name={q(n)} AND imo_id='{EPIC_IMO}');")
    for n in VENDOR_NAMES:
        s.append(f"INSERT INTO lead_vendors (id, name, imo_id, created_by) "
                 f"SELECT gen_random_uuid(), {q(n)}, '{EPIC_IMO}', '{owner_id}' "
                 f"WHERE NOT EXISTS (SELECT 1 FROM lead_vendors WHERE name={q(n)} AND imo_id='{EPIC_IMO}');")
    # Profiles top-down so hierarchy_path triggers populate in order.
    for ag in team:
        upline = "NULL" if ag.upline is None else f"'{ag.upline.id}'"
        if ag.tier == "owner":
            # The owner login may be an EXISTING privileged account (e.g. a super-admin).
            # NEVER demote it: omit is_super_admin entirely (preserve current value) and
            # MERGE roles rather than overwrite, so an existing 'super-admin' role survives.
            base = "ARRAY['agency_owner','admin','agent']::text[]"
            s.append(f"""
INSERT INTO user_profiles (id, email, first_name, last_name, imo_id, agency_id, upline_id,
    roles, contract_level, agent_status, approval_status, onboarding_status, state)
VALUES ('{ag.id}', {q(ag.email)}, {q(ag.first)}, {q(ag.last)}, '{EPIC_IMO}', '{AGENCY_ID}', NULL,
    {base}, {ag.level}, 'licensed', 'approved', 'completed', 'TX')
ON CONFLICT (id) DO UPDATE SET imo_id='{EPIC_IMO}', agency_id='{AGENCY_ID}', upline_id=NULL,
    roles = ARRAY(SELECT DISTINCT e FROM unnest(COALESCE(user_profiles.roles,'{{}}'::text[]) || {base}) e),
    contract_level={ag.level}, agent_status='licensed', approval_status='approved',
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, updated_at=now();""")
        else:
            roles = ("ARRAY['imo_manager','agent']::text[]" if ag.role == "imo_manager"
                     else "ARRAY['agent']::text[]")
            s.append(f"""
INSERT INTO user_profiles (id, email, first_name, last_name, imo_id, agency_id, upline_id,
    roles, contract_level, agent_status, approval_status, onboarding_status, state, is_super_admin)
VALUES ('{ag.id}', {q(ag.email)}, {q(ag.first)}, {q(ag.last)}, '{EPIC_IMO}', '{AGENCY_ID}', {upline},
    {roles}, {ag.level}, 'licensed', 'approved', 'completed', 'TX', false)
ON CONFLICT (id) DO UPDATE SET imo_id='{EPIC_IMO}', agency_id='{AGENCY_ID}', upline_id={upline},
    roles={roles}, contract_level={ag.level}, agent_status='licensed', approval_status='approved',
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, is_super_admin=false,
    updated_at=now();""")
    return "\n".join(s)


def targets_sql(team):
    vals = []
    for ag in team:
        mult = 3.0 if ag.role == "agency_owner" else 1.6 if ag.role == "imo_manager" else 1.0
        vals.append(row(ag.id, round(120000 * mult), round(10000 * mult), round(30000 * mult),
                        int(100 * mult), max(6, int(9 * mult)), 1500))
    return ("INSERT INTO user_targets (user_id, annual_income_target, monthly_income_target, "
            "quarterly_income_target, annual_policies_target, monthly_policies_target, avg_premium_target) "
            "VALUES\n" + ",\n".join(vals) +
            "\nON CONFLICT (user_id) DO UPDATE SET "
            "annual_income_target=EXCLUDED.annual_income_target, "
            "monthly_income_target=EXCLUDED.monthly_income_target, "
            "quarterly_income_target=EXCLUDED.quarterly_income_target, "
            "annual_policies_target=EXCLUDED.annual_policies_target, "
            "monthly_policies_target=EXCLUDED.monthly_policies_target, "
            "avg_premium_target=EXCLUDED.avg_premium_target;")


def pick_product(rng):
    bag = []
    for p, rng_, w in PRODUCTS:
        bag += [(p, rng_)] * w
    return rng.choice(bag)


def pick_outcome(rng, age_days):
    # Brand-new policies are still in-force or pending; lapses/cancels/denials
    # only happen to older business.
    if age_days < 45:
        r = rng.random()
        if r < 0.80:  return ("approved", "active", "advance")
        if r < 0.96:  return ("pending", "pending", "pending")
        return ("withdrawn", None, None)
    r = rng.random()
    if r < 0.58:  return ("approved", "active", "advance")
    if r < 0.70:  return ("approved", "lapsed", "chargeback")
    if r < 0.75:  return ("approved", "cancelled", "cancel")
    if r < 0.86:  return ("pending", "pending", "pending")
    if r < 0.93:  return ("denied", None, None)
    return ("withdrawn", None, None)


def data_sql(team, carriers, vendors, rng, today):
    ids = [a.id for a in team]
    ids_arr = "ARRAY[" + ",".join(f"'{i}'" for i in ids) + "]::uuid[]"

    cleanup = f"""
SET session_replication_role = replica;  -- FK/cascade off for an order-free idempotent wipe
DELETE FROM override_commissions WHERE base_agent_id = ANY({ids_arr}) OR override_agent_id = ANY({ids_arr});
DELETE FROM chargebacks WHERE commission_id IN (SELECT id FROM commissions WHERE user_id = ANY({ids_arr}));
DELETE FROM commissions WHERE user_id = ANY({ids_arr});
DELETE FROM policies WHERE user_id = ANY({ids_arr});
DELETE FROM lead_purchases WHERE user_id = ANY({ids_arr});
DELETE FROM expenses WHERE user_id = ANY({ids_arr});
DELETE FROM clients WHERE user_id = ANY({ids_arr});
DELETE FROM recruiting_leads WHERE recruiter_id = ANY({ids_arr});
DELETE FROM carrier_contracts WHERE agent_id = ANY({ids_arr});
DELETE FROM agent_writing_numbers WHERE agent_id = ANY({ids_arr});
DELETE FROM daily_sales_logs WHERE first_seller_id = ANY({ids_arr});
SET session_replication_role = origin;  -- triggers back ON for inserts
"""

    clients, policies, comms, overrides, chargebacks = [], [], [], [], []
    expenses, leads, contracts, wnums, sales, recruits = [], [], [], [], [], []
    cnames = list(carriers.items())  # (name, id)

    for ai, ag in enumerate(team):
        aid = ag.id
        # Clients (one per ~1.3 policies)
        nclients = max(3, int(ag.npolicies * 0.8))
        client_ids = []
        for ci in range(nclients):
            cid = str(uuid.uuid5(NS, f"client-{ai}-{ci}"))
            client_ids.append(cid)
            nm = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
            clients.append(row(cid, aid, nm, f"client{ai}_{ci}@example.com",
                               f"555-{200+ai:03d}-{1000+ci:04d}", rng.choice(STATES), "active"))

        for pi in range(ag.npolicies):
            pid = str(uuid.uuid5(NS, f"pol-{ai}-{pi}"))
            cname, crange = pick_product(rng)
            carrier_name, carrier_id = rng.choice(cnames)
            monthly = float(rng.randint(*crange))
            annual = round(monthly * 12, 2)
            # Recency-weighted SUBMIT date (the dashboard filters AP by submit_date),
            # so the current day / week / month / year are all populated.
            r = rng.random()
            if r < 0.16:
                submit_age = rng.randint(0, max(0, today.day - 1))   # this calendar month
            elif r < 0.36:
                submit_age = rng.randint(0, 90)
            elif r < 0.72:
                submit_age = rng.randint(0, 365)
            else:
                submit_age = rng.randint(30, 545)
            submit = today - timedelta(days=submit_age)
            eff = min(today, submit + timedelta(days=rng.randint(0, 21)))
            age_days = (today - eff).days
            status, lifecycle, kind = pick_outcome(rng, age_days)
            comp = ag.level + rng.choice([-5, 0, 0, 5])
            freq = rng.choice(["monthly", "monthly", "monthly", "quarterly", "annual"])
            lst = rng.choice(["lead_purchase", "free_lead", "other"])
            # Store the rate as a DECIMAL (0.95 = 95%) to match the app/prod
            # convention. `comp` stays a whole-percentage contract level so the
            # advance math below (comp / 100.0) remains correct.
            policies.append(row(pid, aid, rng.choice(client_ids), EPIC_IMO, AGENCY_ID, carrier_id,
                                cname, f"EP-{ai:02d}-{pi:04d}", status, lifecycle, monthly, annual,
                                eff, submit, round(comp / 100.0, 4), freq, lst))
            if kind is None:
                continue
            months_since = max(0, age_days // 30)
            mpaid = min(9, months_since)
            advance = round(annual * (comp / 100.0) * 0.75, 2)
            if kind == "advance":
                cstatus = "paid" if mpaid >= 9 else "earned" if mpaid >= 1 else "pending"
                cid = str(uuid.uuid5(NS, f"comm-{ai}-{pi}"))
                comms.append(comm(cid, aid, pid, "advance", cstatus, advance, mpaid,
                                  (eff + timedelta(days=20)) if mpaid >= 1 else None))
                # ~12% of in-force policies also show a renewal
                if rng.random() < 0.12 and age_days > 365:
                    comms.append(comm(str(uuid.uuid5(NS, f"ren-{ai}-{pi}")), aid, pid,
                                      "renewal", "earned", round(annual * 0.05, 2), 9,
                                      today - timedelta(days=rng.randint(5, 60))))
                # Override income up the chain (active policies only)
                for depth, up in enumerate(ag.chain, start=1):
                    up_id = up.id
                    spread = up.level - ag.level
                    if spread <= 0:
                        continue
                    oamt = round(annual * (spread / 100.0) * 0.75, 2)
                    oearn = round(oamt * mpaid / 9.0, 2)
                    overrides.append(row(str(uuid.uuid5(NS, f"ovr-{ai}-{pi}-{depth}")), pid, aid, up_id,
                                         depth, ag.level, up.level, carrier_id, annual, advance, oamt,
                                         9, mpaid, oearn, EPIC_IMO, AGENCY_ID,
                                         "paid" if mpaid >= 9 else "earned" if mpaid >= 1 else "pending"))
            elif kind == "chargeback":
                cid = str(uuid.uuid5(NS, f"comm-{ai}-{pi}"))
                cb = round(advance * rng.uniform(0.4, 0.8), 2)
                cb_date = eff + timedelta(days=rng.randint(60, 180))
                comms.append(comm(cid, aid, pid, "advance", "charged_back", advance,
                                  min(5, mpaid), eff + timedelta(days=20), cb, cb_date,
                                  "Policy lapsed within advance period"))
                chargebacks.append((cid, cb, cb_date))
            elif kind == "cancel":
                cid = str(uuid.uuid5(NS, f"comm-{ai}-{pi}"))
                cb = round(advance * rng.uniform(0.2, 0.5), 2)
                comms.append(comm(cid, aid, pid, "advance", "earned", advance, min(8, mpaid),
                                  eff + timedelta(days=20), cb,
                                  eff + timedelta(days=rng.randint(40, 120)), "Client cancelled"))
            elif kind == "pending":
                comms.append(comm(str(uuid.uuid5(NS, f"comm-{ai}-{pi}")), aid, pid,
                                  "advance", "pending", advance, 0))

        # Expenses (+ link first lead spend to a lead purchase)
        lead_expense_id = None
        nexp = rng.randint(8, 16)
        for ei in range(nexp):
            eid = str(uuid.uuid5(NS, f"exp-{ai}-{ei}"))
            cat = EXPENSE_CATS[ei % len(EXPENSE_CATS)]
            amt = round(rng.uniform(60, 700), 2)
            d = today - timedelta(days=rng.randint(3, 200))
            etype = "personal" if cat == "Credit Card Bill" else "business"
            recurring = cat in ("Software", "Rent & Lease", "Utilities")
            expenses.append(("exp", eid, aid, cat, amt, d, etype, recurring, EPIC_IMO, AGENCY_ID))
            if cat == "Life Insurance Leads" and lead_expense_id is None:
                lead_expense_id = eid

        # Lead purchases (ROI shown via policies_sold / commission_earned)
        for li in range(rng.randint(5, 11)):
            vname, vid = rng.choice(list(vendors.items()))
            lc = rng.choice([20, 25, 50, 100])
            tc = round(lc * rng.uniform(6, 18), 2)
            sold = rng.randint(0, max(1, lc // 12))
            earned = round(sold * rng.uniform(180, 520), 2)
            fresh = rng.choice(["fresh", "fresh", "aged"])
            # NOTE: cost_per_lead AND roi_percentage are GENERATED columns — never insert them.
            leads.append(row(str(uuid.uuid5(NS, f"lead-{ai}-{li}")), aid, EPIC_IMO, AGENCY_ID, vid,
                             (lead_expense_id if li == 0 else None),
                             f"{vname} batch {li+1}", fresh, lc, tc,
                             today - timedelta(days=rng.randint(10, 150)), sold, earned))

        # Carrier contracts + writing numbers
        for ci2, (cn, cid2) in enumerate(rng.sample(cnames, k=min(4, len(cnames)))):
            st = rng.choice(["approved", "approved", "pending"])
            contracts.append(row(aid, cid2, st,
                                 today - timedelta(days=rng.randint(60, 400)),
                                 (today - timedelta(days=rng.randint(20, 60))) if st == "approved" else None))
            wnums.append(row(aid, cid2, EPIC_IMO,
                             f"WN-{ai:02d}-{cn[:3].upper()}-{1000+ci2}",
                             "active" if st == "approved" else "pending"))

        # Recruiting pipeline — everyone recruits, weighted by tier (more volume).
        n_recruits = {"owner": rng.randint(12, 18), "mgr": rng.randint(8, 12),
                      "lead": rng.randint(5, 9), "agent": rng.randint(2, 5)}[ag.tier]
        if n_recruits:
            for ri in range(n_recruits):
                rstatus = rng.choice(["pending", "pending", "accepted", "accepted", "rejected", "expired"])
                avail = rng.choice(["full_time", "part_time", "exploring"])
                exp = rng.choice(["none", "less_than_1_year", "1_to_3_years", "3_plus_years"])
                recruits.append(row(aid, EPIC_IMO, AGENCY_ID, rng.choice(FIRST), rng.choice(LAST),
                                    f"recruit{ai}_{ri}@example.com", f"555-{700+ai:03d}-{2000+ri:04d}",
                                    rng.choice(["Dallas", "Tampa", "Phoenix", "Atlanta", "Reno"]),
                                    rng.choice(STATES), avail, "Wants uncapped income", exp, rstatus,
                                    rng.random() < 0.4))

        # Daily sales logs (recent)
        if ag.tier != "owner" and rng.random() < 0.7:
            sales.append(row(EPIC_IMO, f"C-EPIC-{ai}", aid, today - timedelta(days=rng.randint(1, 14)),
                             rng.choice(["First sale of the day!", "Big IUL close", "FE double-app day"])))

    parts = [cleanup, "BEGIN;"]

    def insert(tbl, cols, vals):
        if vals:
            parts.append(f"INSERT INTO {tbl} ({cols}) VALUES\n" + ",\n".join(vals) + ";")

    insert("clients", "id, user_id, name, email, phone, state, status", clients)
    insert("policies",
           "id, user_id, client_id, imo_id, agency_id, carrier_id, product, policy_number, status, "
           "lifecycle_status, monthly_premium, annual_premium, effective_date, submit_date, "
           "commission_percentage, payment_frequency, lead_source_type", policies)
    insert("commissions", COMM_COLS, comms)  # fixed 13-col shape via comm()
    insert("override_commissions",
           "id, policy_id, base_agent_id, override_agent_id, hierarchy_depth, base_comp_level, "
           "override_comp_level, carrier_id, policy_premium, base_commission_amount, "
           "override_commission_amount, advance_months, months_paid, earned_amount, imo_id, "
           "agency_id, status", overrides)
    if chargebacks:
        parts.append("INSERT INTO chargebacks (commission_id, chargeback_amount, chargeback_date, reason) VALUES\n"
                     + ",\n".join(row(c, a, d, "Advance chargeback (policy lapsed)") for c, a, d in chargebacks) + ";")
    if expenses:
        parts.append("INSERT INTO expenses (id, user_id, name, description, category, amount, date, "
                     "expense_type, is_recurring, imo_id, agency_id) VALUES\n" +
                     ",\n".join(row(e[1], e[2], e[3], f"{e[3]} expense", e[3], e[4], e[5], e[6], e[7], e[8], e[9])
                                for e in expenses) + ";")
    insert("lead_purchases",
           "id, user_id, imo_id, agency_id, vendor_id, expense_id, purchase_name, lead_freshness, "
           "lead_count, total_cost, purchase_date, policies_sold, commission_earned", leads)
    insert("carrier_contracts", "agent_id, carrier_id, status, requested_date, approved_date", contracts)
    insert("agent_writing_numbers", "agent_id, carrier_id, imo_id, writing_number, status", wnums)
    insert("recruiting_leads",
           "recruiter_id, imo_id, agency_id, first_name, last_name, email, phone, city, state, "
           "availability, why_interested, insurance_experience, status, discovery_call_scheduled", recruits)
    insert("daily_sales_logs", "imo_id, channel_id, first_seller_id, log_date, title", sales)
    parts.append("COMMIT;")
    return "\n".join(parts), dict(
        clients=len(clients), policies=len(policies), commissions=len(comms),
        overrides=len(overrides), expenses=len(expenses), leads=len(leads),
        recruits=len(recruits), contracts=len(contracts))


# ───────────────────────── carrier/vendor id resolution ─────────────────────
def resolve_named(table, key):
    """Resolve name->id for Epic-scoped rows via PostgREST JSON (clean, not psql parsing).
    Safe to read from local REST because assert_local() already proved run-sql is local."""
    s, d = api("GET", f"/rest/v1/{table}?imo_id=eq.{EPIC_IMO}&select=id,name", key)
    if s != 200 or not isinstance(d, list):
        sys.exit(f"resolve_named({table}) failed: {s} {d}")
    return {r["name"]: r["id"] for r in d if r.get("name") and r.get("id")}


# ───────────────────────── main ─────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", choices=list(SCALES), default="massive")
    ap.add_argument("--managers", type=int)
    ap.add_argument("--leads-per-manager", type=int, dest="lpm")
    ap.add_argument("--agents-per-lead", type=int, dest="apl")
    ap.add_argument("--owner-email", default="epiclife.neessen@gmail.com")
    ap.add_argument("--password", default="DemoPass123!")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    # NOTE: a protected/real owner email is allowed ONLY because ensure_auth_user
    # reuses an existing account read-only (never resets its password/email). The
    # owner's PROFILE is attached to the demo agency; auth is left intact.

    cfg = dict(SCALES[args.scale])
    if args.managers is not None:
        cfg["managers"] = args.managers
    if args.lpm is not None:
        cfg["leads_per_manager"] = args.lpm
    if args.apl is not None:
        cfg["agents_per_lead"] = args.apl

    rng = random.Random(args.seed)
    today = date.today()

    print("→ reading local keys...")
    anon, key = get_keys()
    print("→ guard: confirming LOCAL database...")
    assert_local()

    team = build_team(cfg, rng, args.owner_email)
    nmgr = sum(1 for a in team if a.tier == "mgr")
    nlead = sum(1 for a in team if a.tier == "lead")
    nagent = sum(1 for a in team if a.tier == "agent")
    print(f"→ team: 1 owner -> {nmgr} managers -> {nlead} team leads -> {nagent} agents "
          f"= {len(team)} people (3 downline levels)")

    print(f"→ ensuring {len(team)} login-capable auth users (shared password)...")
    owner_action = None
    for ag in team:
        ag.id, action = ensure_auth_user(key, ag.email, args.password)
        if ag.tier == "owner":
            owner_action = action
    if owner_action == "created":
        ok, msg = verify_login(anon, args.owner_email, args.password)
        print(f"   owner {args.owner_email}: id={team[0].id}  login={'OK' if ok else 'FAILED: ' + str(msg)}")
        if not ok:
            sys.exit("Owner cannot log in; aborting before seeding.")
    else:
        # Existing real account reused read-only — DO NOT test/alter its password.
        print(f"   owner {args.owner_email}: id={team[0].id}  (existing account — auth left untouched)")

    print("→ phase 1: agency, carriers, vendors, profiles, targets (triggers ON)...")
    run_sql(setup_sql(team) + "\n" + targets_sql(team), "setup")

    carriers = resolve_named("carriers", key)
    vendors = resolve_named("lead_vendors", key)
    carriers = {k: v for k, v in carriers.items() if k in CARRIER_NAMES}
    vendors = {k: v for k, v in vendors.items() if k in VENDOR_NAMES}
    if not carriers or not vendors:
        sys.exit(f"Failed to resolve carriers/vendors: carriers={carriers} vendors={vendors}")
    print(f"   resolved {len(carriers)} carriers, {len(vendors)} vendors")

    print("→ phase 2: business data (idempotent wipe + insert)...")
    sql, counts = data_sql(team, carriers, vendors, rng, today)
    run_sql(sql, "data")

    print("\n✅ Done. Seeded under Epic Life IMO / agency 'The Standard':")
    for k, v in counts.items():
        print(f"     {k:12s} {v}")
    owner_pw = args.password if owner_action == "created" else "<your existing password — unchanged>"
    print(f"\n  Log in at the local app as the AGENCY OWNER (top of the hierarchy):")
    print(f"     email:    {args.owner_email}")
    print(f"     password: {owner_pw}")
    print(f"  Every DOWNLINE member (managers / team leads / agents) shares password")
    print(f"  '{args.password}', so you can also log in as any of them (e.g. mgr1@epiclife-demo.test).")
    print(f"  Team page shows your downlines AND their downlines (3 levels), with override")
    print(f"  income rolling up each chain. Super-admins can instead switch acting-IMO to 'Epic Life'.")
    print(f"\n  Re-run any time to refresh; pass --scale test|lean|rich|massive to resize.")


if __name__ == "__main__":
    main()
