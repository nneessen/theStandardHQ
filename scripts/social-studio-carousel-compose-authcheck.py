#!/usr/bin/env python3
"""
Real-auth verification of the Social Studio "Build with AI" carousel composer
(Phase 3C — the social-carousel-compose edge function: compose mode + caption mode).

The carousel-builder UI can't be click-tested locally (sample-forced), so this exercises
the edge function the way the app does — a real `authenticated` JWT, the two request modes —
and asserts the parts tsc/build can't:

  1. unauthenticated (anon key as bearer, no user) is rejected (401)
  2. compose with no idea is rejected (400)
  3. compose returns a usable deck: slides[] (>=2) + a caption  [AI call]
  4. attribution OFF → EVERY quote slide's attribution is empty   [hard server guarantee]
  5. caption mode returns a non-empty caption                     [AI call]

The AI calls (3, 5) are tolerant of a 502 ("AI generation failed" — e.g. Anthropic credit
balance low, see memory) and a 403 (the test account lacks AI access): those are reported as
SKIP, not FAIL, because they're infra/entitlement, not a contract regression. The contract
guards (1, 2) and the attribution-OFF invariant (4) are HARD checks.

Usage (LOCAL, against `supabase functions serve social-carousel-compose`):
    eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (the owner)
    export API_URL ANON_KEY
    python3 scripts/social-studio-carousel-compose-authcheck.py

Usage (REMOTE, against the deployed function):
    set -a; source .env.local; set +a
    export API_URL="$REMOTE_SUPABASE_URL" ANON_KEY="$REMOTE_SUPABASE_ANON_KEY"
    python3 scripts/social-studio-carousel-compose-authcheck.py
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

# This framework Python lacks a system CA bundle, so HTTPS to the remote project fails cert
# verification. Prefer certifi's bundle; fall back to unverified (this is a smoke against a
# known host, not a security boundary). Local http:// targets never reach here.
try:
    import certifi  # type: ignore

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl._create_unverified_context()

API = os.environ["API_URL"].strip().strip('"').rstrip("/")
ANON = os.environ["ANON_KEY"].strip().strip('"')
EMAIL = os.environ["E2E_EMAIL"]
PASSWORD = os.environ["E2E_PASSWORD"]
FN = "/functions/v1/social-carousel-compose"


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

# 1. Unauthenticated (anon key is not a user JWT) → 401.
st, bod = req(FN, ANON, {"mode": "compose", "idea": "x", "slideCount": 3,
                         "agencyName": "Smoke"})
check("unauthenticated request rejected (401)", st == 401, f"status={st} {bod[:160]}")

# 2. Compose with no idea → 400.
st, bod = req(FN, token, {"mode": "compose", "slideCount": 3, "agencyName": "Smoke"})
check("compose with no idea rejected (400)", st == 400, f"status={st} {bod[:160]}")

# 3. Compose returns a usable deck (AI call). allowDataSlides false → all marketing.
st, bod = req(FN, token, {
    "mode": "compose",
    "idea": "motivational quotes and quick tips about persistence for life-insurance agents",
    "slideCount": 4,
    "agencyName": "Smoke Agency",
    "allowRealAttribution": False,
    "allowDataSlides": False,
})
if st in (403, 502):
    skip("compose returns a deck (AI gated/unavailable)", f"status={st} {bod[:120]}")
else:
    try:
        payload = json.loads(bod)
    except Exception:
        payload = {}
    slides = payload.get("slides") if isinstance(payload, dict) else None
    caption = payload.get("caption") if isinstance(payload, dict) else None
    ok = (st == 200 and isinstance(slides, list) and len(slides) >= 2
          and isinstance(caption, str))
    check("compose returns slides[>=2] + caption", ok, f"status={st} {bod[:200]}")

    # 4. attribution OFF → every quote slide's attribution is empty (HARD server guarantee).
    if ok:
        quotes = [s for s in slides if isinstance(s, dict)
                  and s.get("t") == "marketing" and s.get("variant") == "quote"]
        all_blank = all(not (s.get("attribution") or "").strip() for s in quotes)
        check(f"attribution OFF → all {len(quotes)} quote slide(s) unattributed",
              all_blank, f"quotes={json.dumps(quotes)[:200]}")

# 4b. attribution ON → the deck SHOULD carry at least one real attributed quote (AI call).
#     Soft: the prompt legitimately bails to an original line when unsure, so zero is a WARN,
#     not a FAIL — the printed quotes are for eyeballing the core "real quotes" ask.
st, bod = req(FN, token, {
    "mode": "compose",
    "idea": "famous motivational quotes from real well-known people about persistence and grit",
    "slideCount": 4,
    "agencyName": "Smoke Agency",
    "allowRealAttribution": True,
    "allowDataSlides": False,
})
if st in (403, 502):
    skip("compose ON returns attributed quotes (AI gated/unavailable)", f"status={st} {bod[:120]}")
else:
    try:
        slides = json.loads(bod).get("slides") or []
    except Exception:
        slides = []
    check("compose ON returns slides", st == 200 and len(slides) >= 2, f"status={st} {bod[:160]}")
    attributed = [s for s in slides if isinstance(s, dict)
                  and s.get("variant") == "quote" and (s.get("attribution") or "").strip()]
    print(f"     attributed quotes returned: {len(attributed)}")
    for s in attributed:
        print(f"       • “{s.get('text')}” — {s.get('attribution')}")
    if not attributed:
        print("     ~ WARN: no attributed quotes this run (model stayed original); re-run or eyeball the UI")

# 5. Caption mode returns a non-empty caption (AI call).
st, bod = req(FN, token, {
    "mode": "caption",
    "agencyName": "Smoke Agency",
    "slides": [
        {"variant": "tip", "headline": "Follow up fast", "body": "Speed wins deals."},
        {"variant": "cta", "headline": "Join us", "body": "We are hiring."},
        {"view": "weekly"},
    ],
})
if st in (403, 502):
    skip("caption mode returns a caption (AI gated/unavailable)", f"status={st} {bod[:120]}")
else:
    try:
        caption = json.loads(bod).get("caption")
    except Exception:
        caption = None
    check("caption mode returns a non-empty caption",
          st == 200 and isinstance(caption, str) and bool(caption.strip()),
          f"status={st} {bod[:200]}")

fails = sum(1 for ok in checks if not ok)
print(f"\n{'✓ ALL CONTRACT CHECKS PASSED' if fails == 0 else f'✗ {fails} FAILURE(S)'}")
sys.exit(1 if fails else 0)
