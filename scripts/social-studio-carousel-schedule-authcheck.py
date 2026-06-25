#!/usr/bin/env python3
"""
Real-auth verification of the Social Studio CAROUSEL scheduling WRITE PATH (#8 Phase 3B —
schedule_instagram_carousel + the additive image_urls column).

The UI can't be click-tested locally (sample-forced). This verifies, under the real
`authenticated` JWT, the part tsc/build can't:

  1. schedule_instagram_carousel RPC works (future, 3 https URLs)
  2. the row stores image_urls (len 3) AND image_url = image_urls[0]   (back-compat mirror)
  3. fewer than 2 URLs is rejected
  4. a non-https URL is rejected
  5. a PAST time is rejected
  6. BACK-COMPAT: schedule_instagram_post (single) still works → image_urls is null
  7. cancel_instagram_scheduled_post deletes a carousel row (owner-only)

Usage:
    eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (the owner)
    export API_URL ANON_KEY
    python3 scripts/social-studio-carousel-schedule-authcheck.py
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
SEED = "smoke_ig_carousel"

UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def run_sql(sql: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["./scripts/migrations/run-sql.sh", sql],
        capture_output=True, text=True, timeout=60,
    )


def req(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": ANON, "Authorization": f"Bearer {token}",
               "Content-Type": "application/json"}
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


checks = []


def check(label, ok, detail=""):
    checks.append(ok)
    print(f"   {'✓' if ok else '✗ FAIL'} {label}" + (f" — {detail}" if (detail and not ok) else ""))


setup = run_sql(
    f"DELETE FROM instagram_integrations WHERE instagram_user_id='{SEED}'; "
    "INSERT INTO instagram_integrations "
    "(imo_id,user_id,instagram_user_id,instagram_username,facebook_page_id,access_token_encrypted) "
    f"SELECT up.imo_id, up.id, '{SEED}','smoke_carousel','smoke_fb','smoke_dummy' "
    "FROM user_profiles up JOIN auth.users u ON u.id=up.id "
    f"WHERE u.email='{EMAIL}' AND up.imo_id IS NOT NULL LIMIT 1 RETURNING id, imo_id;"
)
ids = UUID_RE.findall(setup.stdout)
integ_id = ids[0] if len(ids) >= 1 else None
imo_id = ids[1] if len(ids) >= 2 else None

URLS = ["https://x/0.png", "https://x/1.png", "https://x/2.png"]


def cleanup():
    run_sql(
        "DELETE FROM instagram_scheduled_posts WHERE scheduled_by IN "
        f"(SELECT id FROM auth.users WHERE email='{EMAIL}'); "
        f"DELETE FROM instagram_integrations WHERE instagram_user_id='{SEED}';"
    )


try:
    check("setup: seeded integration + imo", bool(integ_id and imo_id), f"out={setup.stdout[-160:]}")
    if not (integ_id and imo_id):
        cleanup(); sys.exit(1)

    st, bod = req("POST", "/auth/v1/token?grant_type=password", ANON,
                  {"email": EMAIL, "password": PASSWORD})
    token = json.loads(bod).get("access_token") if st == 200 else None
    check("auth: password grant returns a token", bool(token), f"status={st}")
    if not token:
        cleanup(); sys.exit(1)

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    car_id = str(uuid.uuid4())

    # 1. Carousel RPC works (future, 3 urls).
    st, bod = req("POST", "/rest/v1/rpc/schedule_instagram_carousel", token, {
        "p_id": car_id, "p_integration_id": integ_id, "p_image_urls": URLS,
        "p_caption": "cap", "p_view": "daily", "p_card_theme": "spotlight",
        "p_scheduled_for": future,
    })
    check("schedule_instagram_carousel RPC works (future, 3 urls)", st == 200, f"status={st} {bod[:160]}")

    # 2. Row stores image_urls (3) AND image_url = image_urls[0].
    st, bod = req("GET",
                  f"/rest/v1/instagram_scheduled_posts?id=eq.{car_id}&select=image_url,image_urls,status", token)
    rows = json.loads(bod) if st == 200 else []
    ok2 = (len(rows) == 1 and rows[0]["image_urls"] == URLS
           and rows[0]["image_url"] == URLS[0] and rows[0]["status"] == "pending")
    check("row stores image_urls[3] + image_url=image_urls[0]", ok2, f"status={st} {bod[:200]}")

    # 3. Fewer than 2 URLs rejected.
    st, bod = req("POST", "/rest/v1/rpc/schedule_instagram_carousel", token, {
        "p_id": str(uuid.uuid4()), "p_integration_id": integ_id, "p_image_urls": ["https://x/only.png"],
        "p_caption": "", "p_view": "daily", "p_card_theme": "spotlight", "p_scheduled_for": future,
    })
    check("<2 URLs rejected", st >= 400 and "at least 2" in bod.lower(), f"status={st} {bod[:160]}")

    # 4. Non-https URL rejected.
    st, bod = req("POST", "/rest/v1/rpc/schedule_instagram_carousel", token, {
        "p_id": str(uuid.uuid4()), "p_integration_id": integ_id,
        "p_image_urls": ["https://x/0.png", "http://insecure/1.png"],
        "p_caption": "", "p_view": "daily", "p_card_theme": "spotlight", "p_scheduled_for": future,
    })
    check("non-https URL rejected", st >= 400 and "https" in bod.lower(), f"status={st} {bod[:160]}")

    # 5. Past time rejected.
    st, bod = req("POST", "/rest/v1/rpc/schedule_instagram_carousel", token, {
        "p_id": str(uuid.uuid4()), "p_integration_id": integ_id, "p_image_urls": URLS,
        "p_caption": "", "p_view": "daily", "p_card_theme": "spotlight", "p_scheduled_for": past,
    })
    check("past time rejected", st >= 400 and "future" in bod.lower(), f"status={st} {bod[:160]}")

    # 6. BACK-COMPAT: single-image RPC still works → image_urls null.
    single_id = str(uuid.uuid4())
    st, bod = req("POST", "/rest/v1/rpc/schedule_instagram_post", token, {
        "p_id": single_id, "p_integration_id": integ_id, "p_image_url": "https://x/single.png",
        "p_caption": "", "p_view": "daily", "p_card_theme": "spotlight", "p_scheduled_for": future,
    })
    single_ok = st == 200
    st2, bod2 = req("GET",
                    f"/rest/v1/instagram_scheduled_posts?id=eq.{single_id}&select=image_url,image_urls", token)
    rows2 = json.loads(bod2) if st2 == 200 else []
    single_ok = single_ok and len(rows2) == 1 and rows2[0]["image_urls"] is None
    check("BACK-COMPAT: single-image RPC works, image_urls null", single_ok,
          f"rpc={st} {bod[:120]} | row={st2} {bod2[:120]}")

    # 7. Cancel the carousel row.
    st, bod = req("POST", "/rest/v1/rpc/cancel_instagram_scheduled_post", token, {"p_id": car_id})
    check("cancel removes the carousel row", st == 200, f"status={st} {bod[:160]}")
finally:
    cleanup()

fails = sum(1 for ok in checks if not ok)
print(f"\n{'✓ ALL CAROUSEL AUTH-PATH CHECKS PASSED' if fails == 0 else f'✗ {fails} FAILURE(S)'}")
sys.exit(1 if fails else 0)
