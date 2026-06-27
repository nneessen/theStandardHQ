#!/usr/bin/env python3
"""
Real-auth verification of the Social Studio single-card "Generate with AI" caption
(the generate-social-caption edge function).

This function was MISSING from prod (404) — the cause of the "Generate captions doesn't
work" bug. After deploying it, this exercises it the way the app does (a real
`authenticated` JWT) and asserts the parts tsc/build can't:

  1. unauthenticated (anon key as bearer, no user) is rejected (401)   [HARD]
  2. an invalid `view` is rejected (400)                               [HARD]
  3. a daily-leaderboard context returns a non-empty caption           [AI call]

The AI call (3) tolerates a 502 ("AI generation failed" — e.g. Anthropic credit balance
low, see memory project_ai_edge_functions_500_credit_balance...) and a 403 (the test
account lacks AI access): those are reported as SKIP, not FAIL — they're infra/entitlement,
not a contract/deploy regression. The deploy + contract guards (1, 2) are HARD checks.

Usage (REMOTE, against the deployed function):
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (the owner)
    export API_URL="$REMOTE_SUPABASE_URL" ANON_KEY="$REMOTE_SUPABASE_ANON_KEY"
    python3 scripts/social-studio-caption-authcheck.py
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

# Framework Python lacks a system CA bundle; prefer certifi, fall back to unverified (smoke
# against a known host, not a security boundary). Local http:// targets never reach here.
try:
    import certifi  # type: ignore

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl._create_unverified_context()

API = os.environ["API_URL"].strip().strip('"').rstrip("/")
ANON = os.environ["ANON_KEY"].strip().strip('"')
EMAIL = os.environ["E2E_EMAIL"]
PASSWORD = os.environ["E2E_PASSWORD"]
FN = "/functions/v1/generate-social-caption"


def req(path, token, body=None, method="POST"):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": ANON, "Authorization": f"Bearer {token}",
               "Content-Type": "application/json"}
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, context=SSL_CTX, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


checks = []


def check(label, ok, detail=""):
    checks.append(ok)
    print(f"   {'✓' if ok else '✗ FAIL'} {label}" + (f" — {detail}" if (detail and not ok) else ""))


def skip(label, detail=""):
    print(f"   ~ SKIP {label}" + (f" — {detail}" if detail else ""))


# ── auth: real password grant for the test owner ─────────────────────────────
st, bod = req("/auth/v1/token?grant_type=password", ANON,
              {"email": EMAIL, "password": PASSWORD})
token = json.loads(bod).get("access_token") if st == 200 else None
check("auth: password grant returns a token", bool(token), f"status={st} {bod[:160]}")
if not token:
    sys.exit(1)

# 1. Unauthenticated (anon key is not a user JWT) → 401. Proves the function is DEPLOYED
#    (a missing function would 404 here) AND enforces auth.
st, bod = req(FN, ANON, {"view": "daily", "agencyName": "Smoke", "periodLabel": "DAILY"})
check("unauthenticated request rejected (401, not 404)", st == 401, f"status={st} {bod[:160]}")

# 2. Invalid view → 400.
st, bod = req(FN, token, {"view": "bogus", "agencyName": "Smoke", "periodLabel": "x"})
check("invalid view rejected (400)", st == 400, f"status={st} {bod[:160]}")

# 3. A real daily-leaderboard context returns a non-empty caption (AI call).
st, bod = req(FN, token, {
    "view": "daily",
    "agencyName": "Smoke Agency",
    "network": "Smoke Network",
    "periodLabel": "DAILY · JUN 26, 2026",
    "topAgent": "Marcus W.",
    "totalAP": 84210,
    "policies": 9,
})
if st in (403, 502):
    skip("daily context returns a caption (AI gated/unavailable — infra, not deploy)",
         f"status={st} {bod[:160]}")
else:
    try:
        caption = json.loads(bod).get("caption")
    except Exception:
        caption = None
    ok = st == 200 and isinstance(caption, str) and bool(caption.strip())
    check("daily context returns a non-empty caption", ok, f"status={st} {bod[:200]}")
    if ok:
        print(f"     caption preview: {caption[:160]!r}")

fails = sum(1 for ok in checks if not ok)
print(f"\n{'✓ ALL CONTRACT CHECKS PASSED' if fails == 0 else f'✗ {fails} FAILURE(S)'}")
sys.exit(1 if fails else 0)
