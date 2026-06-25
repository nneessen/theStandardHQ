#!/usr/bin/env python3
"""
Real-auth verification of the Social Studio carousel-deck WRITE PATH via PostgREST
(#8 Phase 3A — social_carousel_decks).

The smoke/UI path can't be click-tested locally (the dev agency has no live metrics →
sample-forced → save still works but needs a real session). This script verifies the
RLS DML path under the real `authenticated` role's JWT — the part tsc/eslint/build can't
prove. Unlike the scheduled-posts table (SELECT-only + SECURITY DEFINER RPCs), decks use
DIRECT RLS DML (mirrors social_templates), so it asserts:

  1. a DIRECT INSERT of the OWNER's own deck SUCCEEDS        (owner_id = auth.uid())
  2. an INSERT spoofing a different owner_id is DENIED       (RLS WITH CHECK)
  3. the list-shape SELECT (no slides blob) returns the row  (imo-scoped)
  4. the full SELECT returns the slides jsonb verbatim
  5. a DIRECT DELETE of the owner's row works; the row is gone

Usage:
    eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (the owner)
    export API_URL ANON_KEY
    python3 scripts/social-studio-deck-authcheck.py
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

API = os.environ["API_URL"].strip().strip('"')
ANON = os.environ["ANON_KEY"].strip().strip('"')
EMAIL = os.environ["E2E_EMAIL"]
PASSWORD = os.environ["E2E_PASSWORD"]

UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def run_sql(sql: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["./scripts/migrations/run-sql.sh", sql],
        capture_output=True,
        text=True,
        timeout=60,
    )


def req(method, path, token, body=None, prefer=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": ANON,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
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


# --- Setup: resolve the owner's user id + imo id ---
setup = run_sql(
    "SELECT up.id, up.imo_id FROM user_profiles up JOIN auth.users u ON u.id=up.id "
    f"WHERE u.email='{EMAIL}' AND up.imo_id IS NOT NULL LIMIT 1;"
)
ids = UUID_RE.findall(setup.stdout)
owner_id = ids[0] if len(ids) >= 1 else None
imo_id = ids[1] if len(ids) >= 2 else None

SLIDES = {"v": 1, "slides": [
    {"t": "data", "view": "daily"},
    {"t": "marketing", "variant": "quote", "text": "Protect what matters."},
]}


def cleanup():
    run_sql(
        "DELETE FROM social_carousel_decks WHERE owner_id IN "
        f"(SELECT id FROM auth.users WHERE email='{EMAIL}') AND name LIKE 'authcheck-%';"
    )


try:
    check("setup: resolved owner + imo", bool(owner_id and imo_id),
          f"out={setup.stdout[-160:]}")
    if not (owner_id and imo_id):
        cleanup()
        sys.exit(1)

    st, bod = req("POST", "/auth/v1/token?grant_type=password", ANON,
                  {"email": EMAIL, "password": PASSWORD})
    token = json.loads(bod).get("access_token") if st == 200 else None
    check("auth: password grant returns a user token", bool(token), f"status={st}")
    if not token:
        cleanup()
        sys.exit(1)

    deck_id = str(uuid.uuid4())

    # 1. Direct INSERT of the owner's OWN deck succeeds.
    st, bod = req("POST", "/rest/v1/social_carousel_decks", token, {
        "id": deck_id, "imo_id": imo_id, "owner_id": owner_id,
        "name": "authcheck-deck", "slides": SLIDES,
        "format": "portrait", "card_theme": "spotlight",
    }, prefer="return=representation")
    check("direct INSERT of own deck SUCCEEDS", st in (200, 201), f"status={st} {bod[:160]}")

    # 2. INSERT spoofing a different owner_id is denied by RLS WITH CHECK.
    st, bod = req("POST", "/rest/v1/social_carousel_decks", token, {
        "id": str(uuid.uuid4()), "imo_id": imo_id,
        "owner_id": "00000000-0000-0000-0000-000000000000",
        "name": "authcheck-spoof", "slides": SLIDES,
        "format": "portrait", "card_theme": "spotlight",
    })
    check("INSERT spoofing another owner_id is DENIED",
          st in (401, 403) or "row-level security" in bod.lower(),
          f"status={st} {bod[:160]}")

    # 3. List-shape SELECT (no slides) returns the row.
    st, bod = req("GET",
                  f"/rest/v1/social_carousel_decks?id=eq.{deck_id}"
                  "&select=id,name,format,card_theme,created_at", token)
    rows = json.loads(bod) if st == 200 else []
    check("list-shape SELECT returns the owner's deck",
          st == 200 and len(rows) == 1 and rows[0].get("name") == "authcheck-deck",
          f"status={st} {bod[:160]}")

    # 4. Full SELECT returns the slides jsonb verbatim.
    st, bod = req("GET",
                  f"/rest/v1/social_carousel_decks?id=eq.{deck_id}&select=slides", token)
    rows = json.loads(bod) if st == 200 else []
    slides_ok = (st == 200 and len(rows) == 1
                 and rows[0]["slides"].get("v") == 1
                 and len(rows[0]["slides"].get("slides", [])) == 2)
    check("full SELECT returns slides jsonb verbatim", slides_ok, f"status={st} {bod[:160]}")

    # 5. Direct DELETE of the owner's row works; row gone.
    st, bod = req("DELETE", f"/rest/v1/social_carousel_decks?id=eq.{deck_id}", token,
                  prefer="return=representation")
    deleted = json.loads(bod) if st in (200, 204) and bod.strip() else []
    check("direct DELETE of own deck works", st in (200, 204) and len(deleted) == 1,
          f"status={st} {bod[:120]}")
    st, bod = req("GET", f"/rest/v1/social_carousel_decks?id=eq.{deck_id}&select=id", token)
    check("row gone after delete", st == 200 and json.loads(bod) == [], f"status={st} {bod[:120]}")
finally:
    cleanup()

fails = sum(1 for ok in checks if not ok)
print(f"\n{'✓ ALL AUTH-PATH CHECKS PASSED' if fails == 0 else f'✗ {fails} FAILURE(S)'}")
sys.exit(1 if fails else 0)
