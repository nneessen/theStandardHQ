#!/usr/bin/env python3
"""
Real-auth verification of the Social Studio scheduled-posts WRITE PATH via PostgREST.

The smoke test (social-studio-smoke.py) can't click the Schedule flow locally because
the dev agency has no live metrics → the UI is sample-forced → Post/Schedule are
(correctly) disabled. This script verifies the same write path WITHOUT the UI/data gate,
under the real `authenticated` role's JWT — which is the part tsc/eslint/build can't
prove. It asserts the grant-hardening holds:

  1. a DIRECT table INSERT is DENIED        (authenticated has SELECT only)
  2. schedule_instagram_post RPC works       (future-only, ownership from auth.uid())
  3. the row is visible via the RLS SELECT    (imo-scoped, authenticated)
  4. a PAST time is rejected by the RPC
  5. cancel_instagram_scheduled_post deletes it (owner-only)

Usage:
    eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (the owner)
    export API_URL ANON_KEY
    python3 scripts/social-studio-schedule-authcheck.py
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

API = os.environ["API_URL"].strip().strip('"')
ANON = os.environ["ANON_KEY"].strip().strip('"')
EMAIL = os.environ["E2E_EMAIL"]
PASSWORD = os.environ["E2E_PASSWORD"]
SEED = "smoke_ig_user"

UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def run_sql(sql: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["./scripts/migrations/run-sql.sh", sql],
        capture_output=True,
        text=True,
        timeout=60,
    )


def req(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": ANON,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


checks = []


def check(label, ok, detail=""):
    checks.append(ok)
    mark = "✓" if ok else "✗ FAIL"
    print(f"   {mark} {label}" + (f" — {detail}" if (detail and not ok) else ""))


# --- Setup: seed a connected integration for the owner; capture integ id + imo id ---
setup = run_sql(
    f"DELETE FROM instagram_integrations WHERE instagram_user_id='{SEED}'; "
    "INSERT INTO instagram_integrations "
    "(imo_id,user_id,instagram_user_id,instagram_username,facebook_page_id,access_token_encrypted) "
    f"SELECT up.imo_id, up.id, '{SEED}','smoke_test','smoke_fb','smoke_dummy' "
    "FROM user_profiles up JOIN auth.users u ON u.id=up.id "
    f"WHERE u.email='{EMAIL}' AND up.imo_id IS NOT NULL LIMIT 1 "
    "RETURNING id, imo_id;"
)
ids = UUID_RE.findall(setup.stdout)
integ_id = ids[0] if len(ids) >= 1 else None
imo_id = ids[1] if len(ids) >= 2 else None


def cleanup():
    run_sql(
        f"DELETE FROM instagram_scheduled_posts WHERE scheduled_by IN "
        f"(SELECT id FROM auth.users WHERE email='{EMAIL}'); "
        f"DELETE FROM instagram_integrations WHERE instagram_user_id='{SEED}';"
    )


try:
    check("setup: seeded integration + resolved imo", bool(integ_id and imo_id),
          f"out={setup.stdout[-160:]}")
    if not (integ_id and imo_id):
        cleanup()
        sys.exit(1)

    st, bod = req("POST", "/auth/v1/token?grant_type=password", ANON,
                  {"email": EMAIL, "password": PASSWORD})
    token = json.loads(bod).get("access_token") if st == 200 else None
    check("auth: password grant returns a user token", bool(token), f"status={st}")
    if not token:
        cleanup()
        sys.exit(1)

    post_id = str(uuid.uuid4())
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    # 1. Direct table INSERT must be denied (authenticated lacks INSERT).
    st, bod = req("POST", "/rest/v1/instagram_scheduled_posts", token, {
        "id": post_id, "imo_id": imo_id, "image_url": "https://x/y.png",
        "scheduled_for": future, "scheduled_by": "00000000-0000-0000-0000-000000000000",
    })
    check("direct table INSERT is DENIED (grant-hardening)",
          st in (401, 403) or "permission denied" in bod.lower(), f"status={st} {bod[:120]}")

    # 2. Schedule via the SECURITY DEFINER RPC (future) works.
    st, bod = req("POST", "/rest/v1/rpc/schedule_instagram_post", token, {
        "p_id": post_id, "p_integration_id": integ_id, "p_image_url": "https://x/y.png",
        "p_caption": "cap", "p_view": "daily", "p_card_theme": "spotlight",
        "p_scheduled_for": future,
    })
    check("schedule_instagram_post RPC works (future)", st == 200, f"status={st} {bod[:160]}")

    # 3. The row is visible to the owner via the RLS SELECT.
    st, bod = req("GET",
                  f"/rest/v1/instagram_scheduled_posts?id=eq.{post_id}&select=id,status,imo_id",
                  token)
    rows = json.loads(bod) if st == 200 else []
    check("RLS SELECT returns the owner's row (pending)",
          st == 200 and len(rows) == 1 and rows[0].get("status") == "pending",
          f"status={st} {bod[:160]}")

    # 4. A past time is rejected by the RPC.
    st, bod = req("POST", "/rest/v1/rpc/schedule_instagram_post", token, {
        "p_id": str(uuid.uuid4()), "p_integration_id": integ_id, "p_image_url": "https://x/z.png",
        "p_caption": "", "p_view": "daily", "p_card_theme": "spotlight", "p_scheduled_for": past,
    })
    check("past time rejected by RPC", st >= 400 and "future" in bod.lower(),
          f"status={st} {bod[:160]}")

    # 5. Cancel via RPC deletes it.
    st, bod = req("POST", "/rest/v1/rpc/cancel_instagram_scheduled_post", token, {"p_id": post_id})
    check("cancel_instagram_scheduled_post RPC works", st == 200, f"status={st} {bod[:160]}")
    st, bod = req("GET", f"/rest/v1/instagram_scheduled_posts?id=eq.{post_id}&select=id", token)
    check("row gone after cancel", st == 200 and json.loads(bod) == [], f"status={st} {bod[:120]}")
finally:
    cleanup()

fails = sum(1 for ok in checks if not ok)
print(f"\n{'✓ ALL AUTH-PATH CHECKS PASSED' if fails == 0 else f'✗ {fails} FAILURE(S)'}")
sys.exit(1 if fails else 0)
