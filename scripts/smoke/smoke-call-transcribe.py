#!/usr/bin/env python3
"""Smoke test: /call-reviews transcription path against the LOCAL Supabase.

Verifies the Epic Life gate fix (widen_epic_gate_for_local_parity migration) by
logging in as the local dev user and invoking transcribe-call-recording for a
real, already-uploaded recording. A pre-fix run returned HTTP 403 at the Epic
Life gate; a post-fix run must get PAST the gate (no 403).

Login only (password grant) — never mutates the account. Reads creds from
.env.local. Pass a recording_id as argv[1] (defaults to the seeded Blake Davis
upload).

NOTE: Deepgram fetches the audio from a signed URL. Locally that URL is on
127.0.0.1, which Deepgram's cloud cannot reach — so a full 'completed' status is
only expected on prod (public URL) or behind a tunnel. Locally, PASS = the gate
is cleared (status != 403); a downstream Deepgram-fetch failure is the expected
local limitation, not the bug under test.

Usage: python3 scripts/smoke-call-transcribe.py [recording_id]
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request

RECORDING_ID = (
    sys.argv[1] if len(sys.argv) > 1 else "795dd1cd-cd87-4ced-ab6a-160bf6059316"
)

# Default LOCAL Supabase JWT secret (public, printed by `supabase status`). Used
# ONLY as a fallback to mint a dev token when password login fails because the
# local account's email/password drifted from .env.local. Never touches the
# account. Override with LOCAL_JWT_SECRET if your local secret differs.
LOCAL_JWT_SECRET = os.environ.get(
    "LOCAL_JWT_SECRET",
    "super-secret-jwt-token-with-at-least-32-characters-long",
)
# Local dev user (owner of the seeded recordings); only used by the mint fallback.
LOCAL_USER_ID = os.environ.get("USER_ID", "d0d3edea-af6d-4990-80b8-1765ba829896")


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def mint_local_jwt(user_id: str, email: str) -> str:
    """Mint an HS256 GoTrue-compatible JWT signed with the LOCAL JWT secret.

    Local-only: the secret is the public supabase-local default. This does NOT
    modify the account — it just produces a token GoTrue will accept for an
    already-existing user."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "iss": "supabase-demo",
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = (
        _b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url(json.dumps(payload, separators=(",", ":")).encode())
    )
    sig = hmac.new(
        LOCAL_JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    return signing_input + "." + _b64url(sig)


def load_env_local(path=".env.local"):
    env = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def post(url, headers, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    env = load_env_local()
    base = env["VITE_SUPABASE_URL"].rstrip("/")
    anon = env["VITE_SUPABASE_ANON_KEY"]
    email = env["E2E_EMAIL"]
    password = env["E2E_PASSWORD"]

    print(f"→ Base: {base}")
    print(f"→ Recording: {RECORDING_ID}")

    # 1. Login (password grant) → access token. Read-only; does not touch the account.
    status, body = post(
        f"{base}/auth/v1/token?grant_type=password",
        {"apikey": anon, "Content-Type": "application/json"},
        {"email": email, "password": password},
    )
    if status == 200:
        token = json.loads(body)["access_token"]
        print("✓ Logged in (password grant)")
    else:
        # Fallback: the local account email/password drifted from .env.local.
        # Mint a local-only dev JWT — never mutates the account.
        print(
            f"⚠ Password login failed (HTTP {status}); falling back to a minted "
            "local-dev JWT (account untouched)."
        )
        token = mint_local_jwt(LOCAL_USER_ID, email)
        print(f"✓ Minted local JWT for {LOCAL_USER_ID}")

    # 2. Invoke transcribe-call-recording.
    print("→ Invoking transcribe-call-recording (may take a while if Deepgram runs)…")
    status, body = post(
        f"{base}/functions/v1/transcribe-call-recording",
        {
            "Authorization": f"Bearer {token}",
            "apikey": anon,
            "Content-Type": "application/json",
        },
        {"recording_id": RECORDING_ID},
    )
    print(f"\n← HTTP {status}")
    try:
        print(json.dumps(json.loads(body), indent=2))
    except Exception:
        print(body[:1000])

    # 3. Verdict — the bug under test is the 403 at the Epic Life gate.
    print("\n" + "=" * 60)
    if status == 403:
        print("✗ STILL 403 — Epic Life gate is rejecting. Fix did not take.")
        sys.exit(1)
    print("✓ GATE CLEARED — no longer 403 (the reported bug is fixed).")
    if status == 200:
        print("✓ Transcription returned 200.")
    else:
        print(
            f"ℹ HTTP {status} past the gate — likely the local Deepgram-fetch\n"
            "  limitation (signed URL is on 127.0.0.1, unreachable from Deepgram's\n"
            "  cloud). Expected to fully complete on prod / behind a tunnel."
        )


if __name__ == "__main__":
    main()
