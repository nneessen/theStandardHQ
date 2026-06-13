#!/usr/bin/env python3
"""
Runtime smoke for the instagram-oauth-init Epic Life 403 fix.

Background:
  Connecting Instagram from Settings -> Integrations called the edge function
  `instagram-oauth-init` and got HTTP 403 ("requires Team tier subscription")
  for Epic Life users, even though Epic Life has imos.free_all_features = true.

  Root cause: the function checked the IMO feature bypass by calling the RPC
  `current_user_imo_grants_all_features()` on a SERVICE-ROLE client, which has no
  user JWT, so auth.uid() was NULL and the RPC always returned false. The fix
  calls that RPC on a USER-SCOPED client built from the request Authorization
  header (mirroring close-ai-builder / business-tools-proxy).

What this proves (against LOCAL supabase + a locally-served function):
  A real Epic Life user's JWT now reaches the IMO-bypass check, so the function
  returns 200 { ok:true, url:<instagram oauth url> } instead of 403.

Prereqs:
  - Local supabase running:  supabase status  (API at http://127.0.0.1:54321)
  - The function served with a dummy INSTAGRAM_APP_ID + a SLACK_SIGNING_SECRET:
        supabase functions serve instagram-oauth-init --env-file <tmp.env> --no-verify-jwt
    (The wrapper script scripts/run-smoke-instagram-oauth-init.sh does this.)

Safety:
  - Read-only OAuth *init*: it only builds an authorize URL. No Instagram account
    is connected without completing Meta's flow. Logs in as the seeded throwaway
    demo account agent1@epiclife-demo.test (NEVER a real account).

Usage:
    set -a; source .env; set +a            # optional; sensible local defaults below
    python3 scripts/smoke-instagram-oauth-init.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

# Local supabase defaults (the well-known supabase-demo keys from `supabase status`).
SUPA = (
    os.environ.get("VITE_LOCAL_SUPABASE_URL")
    or os.environ.get("VITE_SUPABASE_URL")
    or "http://127.0.0.1:54321"
).rstrip("/")
ANON = os.environ.get("VITE_LOCAL_SUPABASE_ANON_KEY") or os.environ.get(
    "VITE_SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9."
    "CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
)

# Seeded throwaway Epic Life demo agent (imo "Epic Life", free_all_features = true).
EMAIL = os.environ.get("SMOKE_IG_EMAIL", "agent1@epiclife-demo.test")
PASSWORD = os.environ.get("SMOKE_IG_PASSWORD", "DemoPass123!")


def _post(path: str, body: dict, token: str) -> tuple[int, dict]:
    url = f"{SUPA}{path}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST"
    )
    req.add_header("apikey", ANON)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"_raw": raw}


def _get(path: str, token: str) -> tuple[int, object]:
    req = urllib.request.Request(f"{SUPA}{path}", method="GET")
    req.add_header("apikey", ANON)
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, {"_raw": e.read().decode()}


def main() -> int:
    print(f"• supabase: {SUPA}")
    print(f"• login as: {EMAIL}")

    # 1. Authenticate -> access token + user id.
    status, auth = _post(
        "/auth/v1/token?grant_type=password",
        {"email": EMAIL, "password": PASSWORD},
        ANON,  # password grant is sent with the anon key as bearer
    )
    if status != 200 or "access_token" not in auth:
        print(f"FAIL: login HTTP {status}: {auth}")
        return 1
    token = auth["access_token"]
    uid = auth["user"]["id"]
    print(f"  ✓ logged in, user id {uid}")

    # 2. Resolve the user's own imo_id (RLS lets a user read their own profile).
    status, rows = _get(
        f"/rest/v1/user_profiles?id=eq.{uid}&select=imo_id", token
    )
    imo_id = rows[0]["imo_id"] if isinstance(rows, list) and rows else None
    if not imo_id:
        print(f"FAIL: could not read imo_id (HTTP {status}): {rows}")
        return 1
    print(f"  ✓ imo_id {imo_id}")

    # 3. Invoke instagram-oauth-init with the USER JWT (the real frontend flow).
    status, res = _post(
        "/functions/v1/instagram-oauth-init",
        {
            "imoId": imo_id,
            "userId": uid,
            "returnUrl": "http://localhost:3000/settings?tab=integrations",
        },
        token,
    )
    print(f"  → instagram-oauth-init HTTP {status}: {json.dumps(res)[:200]}")

    # 4. Assertions: the regression was 403/upgradeRequired; the fix returns a URL.
    if status == 403 or res.get("upgradeRequired"):
        print("FAIL: still 403 / upgradeRequired — Epic Life bypass did NOT fire.")
        return 1
    if status != 200 or res.get("ok") is not True:
        print(f"FAIL: expected 200 ok:true, got HTTP {status} {res}")
        return 1
    url = res.get("url", "")
    if "instagram.com/oauth/authorize" not in url:
        print(f"FAIL: missing/invalid OAuth url: {url!r}")
        return 1

    print("  ✓ got Instagram OAuth url (access granted via IMO feature bypass)")
    print("\nPASS: Epic Life user reaches Instagram OAuth (no 403).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
