#!/usr/bin/env python3
"""
Seed the LOCAL Supabase DB with mock data to test the platform-sunset
"red button" (export-then-wipe) flow end to end.

What it does (idempotent — safe to re-run):
  1. Creates a dedicated test IMO ("Sunset Test Agency"), un-revoked while seeding.
  2. Ensures 3 login-capable agent accounts exist (GoTrue admin API), all sharing
     one easy password so you can log in and click the red button yourself.
  3. Makes each profile a fully-approved regular agent on the test IMO.
  4. Seeds a believable spread of business data per user across the tables the
     export bundle reads (policies, commissions, clients, expenses, lead
     purchases, recruits, carrier contracts, writing numbers, daily sales).
  5. (Optional, default ON) Revokes the test IMO's access LAST, so the red button
     is immediately reachable on login.

Usage:
  python3 scripts/seed-sunset-test-data.py                 # seed + revoke (default)
  python3 scripts/seed-sunset-test-data.py --no-revoke     # seed only, leave live
  python3 scripts/seed-sunset-test-data.py --password Foo1! # custom password

After running, log in at the local app as any of the 3 emails with the password.
A revoked agent lands on the Sunset page: download the Excel/CSV export, then
click the permanent-delete (red) button. Verify login then fails.

NOTE: This talks ONLY to the local stack (127.0.0.1:54321 / 54322). It uses the
sanctioned run-sql.sh path for all DML — no direct psql, no migrations touched.
"""

import argparse
import json
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RUN_SQL = REPO / "scripts" / "migrations" / "run-sql.sh"
SUPABASE_URL = "http://127.0.0.1:54321"
TEST_IMO_ID = "5c0f5e7d-0000-4000-a000-000000000001"  # fixed -> idempotent

# Carriers are IMO-scoped (carriers.imo_id) and a trigger
# (enforce_policy_reference_imo_consistency) requires a policy's carrier to share
# the policy's IMO. So we seed our own carriers under the test IMO with fixed
# UUIDs (idempotent via ON CONFLICT id). Names mirror real carriers for realism.
TEST_CARRIERS = [
    ("5c0f5e7d-0000-4000-c000-000000000001", "Aflac"),
    ("5c0f5e7d-0000-4000-c000-000000000002", "American Amicable"),
    ("5c0f5e7d-0000-4000-c000-000000000003", "F&G"),
    ("5c0f5e7d-0000-4000-c000-000000000004", "Corebridge"),
    ("5c0f5e7d-0000-4000-c000-000000000005", "Foresters Financial"),
]

# (email, first, last)
USERS = [
    ("nick.neessen@gmail.com", "Nick", "Gmail"),
    ("nick@nickneessen.com", "Nick", "Neessen"),
    ("nickneessen.ffl@gmail.com", "Nick", "FFL"),
]


def get_keys():
    """Pull the local anon + service_role JWTs from `supabase status`."""
    out = subprocess.run(
        ["npx", "supabase", "status", "-o", "json"],
        cwd=REPO, capture_output=True, text=True,
    )
    if out.returncode != 0:
        sys.exit(f"`supabase status` failed:\n{out.stderr}")
    d = json.loads(out.stdout)
    return d["ANON_KEY"], d["SERVICE_ROLE_KEY"]


def api(method, path, service_key, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}", data=data, method=method,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def find_user_id(service_key, email):
    """List admin users and return the id matching email (local stack = few users)."""
    page = 1
    while True:
        status, data = api("GET", f"/auth/v1/admin/users?page={page}&per_page=200", service_key)
        if status != 200:
            return None
        users = data.get("users", data if isinstance(data, list) else [])
        for u in users:
            if (u.get("email") or "").lower() == email.lower():
                return u["id"]
        if not users or len(users) < 200:
            return None
        page += 1


def ensure_user(service_key, email, password):
    """Create the user (login-capable) or reset its password. Returns the id."""
    status, data = api("POST", "/auth/v1/admin/users", service_key, {
        "email": email, "password": password, "email_confirm": True,
    })
    if status in (200, 201) and data.get("id"):
        return data["id"], "created"
    # Already exists -> find + update password.
    uid = find_user_id(service_key, email)
    if not uid:
        sys.exit(f"Could not create or locate user {email}: {data}")
    api("PUT", f"/auth/v1/admin/users/{uid}", service_key,
        {"password": password, "email_confirm": True})
    return uid, "updated"


def verify_login(anon_key, email, password):
    status, data = api("POST", "/auth/v1/token?grant_type=password", anon_key,
                       {"email": email, "password": password})
    return bool(data.get("access_token")), data.get("msg")


def run_sql_file(sql):
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, dir="/tmp") as f:
        f.write(sql)
        path = f.name
    out = subprocess.run([str(RUN_SQL), "-f", path], cwd=REPO,
                         capture_output=True, text=True)
    print(out.stdout[-2000:])
    if out.returncode != 0:
        print(out.stderr, file=sys.stderr)
        sys.exit(f"Seed SQL failed (file kept at {path}).")
    Path(path).unlink(missing_ok=True)


def per_user_block(email, first, last, idx):
    """A self-contained PL/pgSQL block seeding one user, FK-linked via variables."""
    # Vary the data a little per user so the export looks real.
    base_prem = 65 + idx * 20          # monthly premium baseline
    return f"""
DO $$
DECLARE
  v_uid uuid; v_imo uuid := '{TEST_IMO_ID}';
  v_c1 uuid; v_c2 uuid; v_c3 uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid; v_p5 uuid;
  v_aflac uuid; v_amam uuid; v_fg uuid; v_cb uuid; v_for uuid;
  v_vendor uuid; v_exp uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = '{email}';
  IF v_uid IS NULL THEN RAISE EXCEPTION 'user {email} not found'; END IF;

  -- Carriers MUST be the test-IMO-scoped ones we seeded (the consistency
  -- trigger rejects a policy whose carrier belongs to another IMO).
  SELECT id INTO v_aflac FROM carriers WHERE name = 'Aflac'               AND imo_id = v_imo LIMIT 1;
  SELECT id INTO v_amam  FROM carriers WHERE name = 'American Amicable'   AND imo_id = v_imo LIMIT 1;
  SELECT id INTO v_fg    FROM carriers WHERE name = 'F&G'                 AND imo_id = v_imo LIMIT 1;
  SELECT id INTO v_cb    FROM carriers WHERE name = 'Corebridge'          AND imo_id = v_imo LIMIT 1;
  SELECT id INTO v_for   FROM carriers WHERE name = 'Foresters Financial' AND imo_id = v_imo LIMIT 1;
  SELECT id INTO v_vendor FROM lead_vendors ORDER BY name LIMIT 1;

  -- Fully-approved regular agent on the test IMO (so they pass ApprovalGuard
  -- and reach the Sunset page rather than a pending screen).
  -- agency_id := NULL: a separate trigger (enforce_user_profile_imo_consistency)
  -- rejects a profile whose agency belongs to a different IMO, which would block
  -- moving an existing user (e.g. one already on Epic Life) onto the test IMO.
  UPDATE user_profiles SET
    imo_id = v_imo, agency_id = NULL,
    approval_status = 'approved', agent_status = 'licensed',
    roles = ARRAY['agent']::text[], is_super_admin = false,
    first_name = '{first}', last_name = '{last}', updated_at = now()
  WHERE id = v_uid;

  -- Idempotent: clear any prior seed for this user before re-inserting.
  DELETE FROM commissions            WHERE user_id = v_uid;
  DELETE FROM policies               WHERE user_id = v_uid;
  DELETE FROM clients                WHERE user_id = v_uid;
  DELETE FROM lead_purchases         WHERE user_id = v_uid;
  DELETE FROM expenses               WHERE user_id = v_uid;
  DELETE FROM recruiting_leads       WHERE recruiter_id = v_uid;
  DELETE FROM carrier_contracts      WHERE agent_id = v_uid;
  DELETE FROM agent_writing_numbers  WHERE agent_id = v_uid;
  DELETE FROM daily_sales_logs       WHERE first_seller_id = v_uid;

  -- ── Clients ──────────────────────────────────────────────────────────────
  INSERT INTO clients (user_id, name, email, phone, state, status)
    VALUES (v_uid, 'Maria Sanchez', 'maria.s+{idx}@example.com', '555-010{idx}1', 'TX', 'active')
    RETURNING id INTO v_c1;
  INSERT INTO clients (user_id, name, email, phone, state, status)
    VALUES (v_uid, 'James Carter', 'james.c+{idx}@example.com', '555-010{idx}2', 'FL', 'active')
    RETURNING id INTO v_c2;
  INSERT INTO clients (user_id, name, email, phone, state, status)
    VALUES (v_uid, 'Linda Nguyen', 'linda.n+{idx}@example.com', '555-010{idx}3', 'AZ', 'active')
    RETURNING id INTO v_c3;

  -- ── Policies ─────────────────────────────────────────────────────────────
  INSERT INTO policies (user_id, client_id, imo_id, carrier_id, product, policy_number,
      status, lifecycle_status, monthly_premium, annual_premium, effective_date, commission_percentage)
    VALUES (v_uid, v_c1, v_imo, v_aflac, 'whole_life', 'POL-{idx}-1001',
      'approved', 'active', {base_prem}, {base_prem}*12, current_date - 200, 100)
    RETURNING id INTO v_p1;
  INSERT INTO policies (user_id, client_id, imo_id, carrier_id, product, policy_number,
      status, lifecycle_status, monthly_premium, annual_premium, effective_date, commission_percentage)
    VALUES (v_uid, v_c1, v_imo, v_amam, 'term_life', 'POL-{idx}-1002',
      'approved', 'active', {base_prem}+15, ({base_prem}+15)*12, current_date - 140, 90)
    RETURNING id INTO v_p2;
  INSERT INTO policies (user_id, client_id, imo_id, carrier_id, product, policy_number,
      status, lifecycle_status, monthly_premium, annual_premium, effective_date, commission_percentage)
    VALUES (v_uid, v_c2, v_imo, v_fg, 'indexed_universal_life', 'POL-{idx}-1003',
      'approved', 'active', {base_prem}+40, ({base_prem}+40)*12, current_date - 95, 85)
    RETURNING id INTO v_p3;
  INSERT INTO policies (user_id, client_id, imo_id, carrier_id, product, policy_number,
      status, lifecycle_status, monthly_premium, annual_premium, effective_date, commission_percentage)
    VALUES (v_uid, v_c3, v_imo, v_cb, 'whole_life', 'POL-{idx}-1004',
      'approved', 'lapsed', {base_prem}+5, ({base_prem}+5)*12, current_date - 300, 100)
    RETURNING id INTO v_p4;
  INSERT INTO policies (user_id, client_id, imo_id, carrier_id, product, policy_number,
      status, lifecycle_status, monthly_premium, annual_premium, effective_date, commission_percentage)
    VALUES (v_uid, v_c3, v_imo, v_for, 'term_life', 'POL-{idx}-1005',
      'approved', 'active', {base_prem}+25, ({base_prem}+25)*12, current_date - 30, 95)
    RETURNING id INTO v_p5;

  -- ── Commissions (advance + renewal + one chargeback) ─────────────────────
  INSERT INTO commissions (user_id, policy_id, imo_id, type, status, amount, earned_amount,
      advance_months, months_paid, payment_date)
    VALUES (v_uid, v_p1, v_imo, 'advance', 'earned', {base_prem}*9, {base_prem}*9, 9, 9, current_date - 190);
  INSERT INTO commissions (user_id, policy_id, imo_id, type, status, amount, earned_amount,
      advance_months, months_paid, payment_date)
    VALUES (v_uid, v_p2, v_imo, 'advance', 'earned', ({base_prem}+15)*9, ({base_prem}+15)*9, 9, 9, current_date - 130);
  INSERT INTO commissions (user_id, policy_id, imo_id, type, status, amount, earned_amount,
      advance_months, months_paid, payment_date)
    VALUES (v_uid, v_p3, v_imo, 'advance', 'pending', ({base_prem}+40)*9, 0, 9, 0, NULL);
  INSERT INTO commissions (user_id, policy_id, imo_id, type, status, amount, earned_amount, payment_date)
    VALUES (v_uid, v_p5, v_imo, 'renewal', 'earned', ({base_prem}+25), ({base_prem}+25), current_date - 20);
  INSERT INTO commissions (user_id, policy_id, imo_id, type, status, amount,
      chargeback_amount, chargeback_date, chargeback_reason)
    VALUES (v_uid, v_p4, v_imo, 'advance', 'earned', ({base_prem}+5)*9,
      ({base_prem}+5)*6, current_date - 40, 'Policy lapsed within advance period');

  -- ── Expenses ─────────────────────────────────────────────────────────────
  INSERT INTO expenses (user_id, name, description, category, amount, date) VALUES
    (v_uid, 'Facebook Leads',  'Monthly FB lead spend',     'Life Insurance Leads', 450.00, current_date - 60),
    (v_uid, 'CRM Subscription','Monthly CRM software',      'Software',             99.00,  current_date - 45),
    (v_uid, 'Office Rent',     'Shared office space',       'Rent & Lease',         600.00, current_date - 30),
    (v_uid, 'Mileage',         'Client visits mileage',     'Travel',               180.50, current_date - 22),
    (v_uid, 'Mailers',         'Direct-mail final expense', 'Marketing',            275.00, current_date - 15),
    (v_uid, 'Phone Bill',      'Business line',             'Utilities',            85.00,  current_date - 5);

  -- ── Lead purchases (link the first one to an expense row) ────────────────
  SELECT id INTO v_exp FROM expenses WHERE user_id = v_uid AND name = 'Facebook Leads' LIMIT 1;
  -- NOTE: cost_per_lead is a GENERATED column (total_cost / lead_count) — never insert it.
  IF v_vendor IS NOT NULL THEN
    INSERT INTO lead_purchases (user_id, imo_id, vendor_id, expense_id, purchase_name,
        lead_count, total_cost, purchase_date, policies_sold, commission_earned)
      VALUES (v_uid, v_imo, v_vendor, v_exp, 'FB Final Expense Batch', 50, 450.00, current_date - 60, 4, {base_prem}*30);
    INSERT INTO lead_purchases (user_id, imo_id, vendor_id, purchase_name,
        lead_count, total_cost, purchase_date, policies_sold, commission_earned)
      VALUES (v_uid, v_imo, v_vendor, 'Aged Mortgage Protection', 100, 300.00, current_date - 40, 3, {base_prem}*18);
    INSERT INTO lead_purchases (user_id, imo_id, vendor_id, purchase_name,
        lead_count, total_cost, purchase_date, policies_sold, commission_earned)
      VALUES (v_uid, v_imo, v_vendor, 'Live Transfer Pack', 20, 600.00, current_date - 12, 5, {base_prem}*45);
  END IF;

  -- ── Recruiting leads (owned via recruiter_id) ────────────────────────────
  -- CHECK constraints: availability ∈ (full_time|part_time|exploring),
  -- insurance_experience ∈ (none|less_than_1_year|1_to_3_years|3_plus_years),
  -- status ∈ (pending|accepted|rejected|expired).
  INSERT INTO recruiting_leads (recruiter_id, imo_id, first_name, last_name, email, phone,
      city, state, availability, why_interested, insurance_experience, status) VALUES
    (v_uid, v_imo, 'Devin',  'Brooks',  'devin.b+{idx}@example.com',  '555-020{idx}1', 'Dallas',  'TX', 'full_time', 'Wants uncapped income',       'none',          'pending'),
    (v_uid, v_imo, 'Aisha',  'Khan',    'aisha.k+{idx}@example.com',  '555-020{idx}2', 'Tampa',   'FL', 'part_time', 'Side income while in school', '3_plus_years',  'accepted'),
    (v_uid, v_imo, 'Marcus', 'Lee',     'marcus.l+{idx}@example.com', '555-020{idx}3', 'Phoenix', 'AZ', 'full_time', 'Career change from retail',   '1_to_3_years',  'accepted'),
    (v_uid, v_imo, 'Sofia',  'Ramirez', 'sofia.r+{idx}@example.com',  '555-020{idx}4', 'Houston', 'TX', 'exploring', 'Referred by a friend',        'none',          'rejected');

  -- ── Carrier contracts + writing numbers (owned via agent_id) ─────────────
  INSERT INTO carrier_contracts (agent_id, carrier_id) VALUES (v_uid, v_aflac), (v_uid, v_fg);
  INSERT INTO agent_writing_numbers (agent_id, carrier_id, writing_number) VALUES
    (v_uid, v_aflac, 'WN-{idx}-AFL-{idx}001'),
    (v_uid, v_fg,    'WN-{idx}-FG-{idx}002');

  -- ── Daily sales logs (owned via first_seller_id) ─────────────────────────
  INSERT INTO daily_sales_logs (imo_id, channel_id, first_seller_id, log_date, title) VALUES
    (v_imo, 'C-SEED-{idx}', v_uid, current_date - 3, 'First sale of the day'),
    (v_imo, 'C-SEED-{idx}', v_uid, current_date - 1, 'Big IUL close');

  RAISE NOTICE 'Seeded user {email} (uid=%)', v_uid;
END $$;
"""


def build_sql(revoke):
    blocks = [per_user_block(e, f, l, i + 1) for i, (e, f, l) in enumerate(USERS)]
    imo_setup = f"""
-- Test IMO (un-revoked while seeding so FKs/UPDATEs aren't gate-blocked).
INSERT INTO imos (id, name, code)
  VALUES ('{TEST_IMO_ID}', 'Sunset Test Agency', 'SUNSET-TEST')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
UPDATE imos SET access_revoked_at = NULL WHERE id = '{TEST_IMO_ID}';
"""
    carriers_sql = "\n-- Test-IMO-scoped carriers (so policies pass the consistency trigger).\n"
    for cid, cname in TEST_CARRIERS:
        carriers_sql += (
            f"INSERT INTO carriers (id, name, imo_id) "
            f"VALUES ('{cid}', '{cname}', '{TEST_IMO_ID}') "
            f"ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, imo_id = EXCLUDED.imo_id;\n"
        )
    imo_setup += carriers_sql
    revoke_sql = (
        f"\n-- Revoke LAST: flips the red button on for these agents.\n"
        f"UPDATE imos SET access_revoked_at = now() WHERE id = '{TEST_IMO_ID}';\n"
        if revoke else "\n-- (left un-revoked: pass no flag to revoke)\n"
    )
    return imo_setup + "\n".join(blocks) + revoke_sql


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--password", default="SunsetTest123!",
                    help="shared login password for the 3 test agents")
    ap.add_argument("--no-revoke", dest="revoke", action="store_false",
                    help="seed data but leave the IMO live (no red button yet)")
    ap.set_defaults(revoke=True)
    args = ap.parse_args()

    print("→ reading local keys from `supabase status`...")
    anon_key, service_key = get_keys()

    print("→ ensuring login-capable agent accounts...")
    for email, _, _ in USERS:
        uid, action = ensure_user(service_key, email, args.password)
        ok, msg = verify_login(anon_key, email, args.password)
        flag = "OK" if ok else f"LOGIN FAILED: {msg}"
        print(f"   {email:32s} {action:8s} id={uid}  login={flag}")
        if not ok:
            sys.exit("Aborting: a seeded user cannot log in. Fix before seeding data.")

    print("→ seeding business data (idempotent)...")
    run_sql_file(build_sql(args.revoke))

    print("\n✅ Done.")
    print(f"   Login with any of these and password: {args.password}")
    for email, _, _ in USERS:
        print(f"     - {email}")
    if args.revoke:
        print("   IMO is REVOKED -> log in to land on the Sunset page (red button).")
        print("   Flow: download the Excel/CSV export, then click permanent delete,")
        print("         then try to log in again (should fail = account wiped).")
    else:
        print("   IMO left LIVE. Re-run without --no-revoke to enable the red button.")


if __name__ == "__main__":
    main()
