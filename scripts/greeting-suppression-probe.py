#!/usr/bin/env python3
"""Behavioral check for the rundown-suppression fix (assistant-orchestrator v52).

Sends a bare "hi" straight to the PROD orchestrator (no browser) with a real user JWT and reads
the streamed reply. Asserts the model no longer volunteers a self-introduction or a capability
menu — the "Hello! I'm Jarvis… here are a few things you can ask me…" rundown the owner kept
getting. The new BASE_SYSTEM_RULES greeting-discipline rule should yield a short hello + "what do
you need", with NO capability list.

Reads creds the same way the app does: anon key from services/jarvis-voice-worker/.env.local,
E2E login from .env.local. One cheap prod turn. Exit 0 = pass.
"""
import json, ssl, sys, pathlib, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]
SUPABASE_URL = "https://pcyaqwodnyrpkaiojnpz.supabase.co"

# macOS framework-Python often ships without a CA bundle → CERTIFICATE_VERIFY_FAILED. Prefer
# certifi; fall back to an unverified context (fine here — local diagnostic hitting our OWN
# known prod host, reading our own assistant's reply, no secrets exchanged beyond the login).
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl._create_unverified_context()


def env_from(path, key):
    try:
        for line in (ROOT / path).read_text().splitlines():
            if line.startswith(key + "="):
                return line[len(key) + 1:].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return None


ANON = env_from("services/jarvis-voice-worker/.env.local", "SUPABASE_ANON_KEY")
EMAIL = env_from(".env.local", "E2E_EMAIL")
PASSWORD = env_from(".env.local", "E2E_PASSWORD")
if not (ANON and EMAIL and PASSWORD):
    print("MISSING creds (anon key / E2E login)", file=sys.stderr); sys.exit(2)


def post(url, headers, body, stream=False):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers=headers, method="POST")
    return urllib.request.urlopen(req, timeout=60, context=SSL_CTX)


# 1. Log in → JWT.
auth = post(f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            {"apikey": ANON, "Content-Type": "application/json"},
            {"email": EMAIL, "password": PASSWORD})
jwt = json.load(auth)["access_token"]
print("[auth] got JWT")

# 2. Stream the orchestrator for a bare greeting.
resp = post(f"{SUPABASE_URL}/functions/v1/assistant-orchestrator",
            {"Authorization": f"Bearer {jwt}", "apikey": ANON,
             "Content-Type": "application/json"},
            {"message": "hi"}, stream=True)

reply, event = "", None
for raw in resp:
    line = raw.decode("utf-8", "replace").rstrip("\n")
    if line.startswith("event: "):
        event = line[7:]
    elif line.startswith("data: "):
        try:
            payload = json.loads(line[6:])
        except Exception:
            continue
        if event == "delta":
            reply += payload.get("text", "")

print("\n----- REPLY TO \"hi\" -----")
print(reply.strip() or "(empty)")
print("--------------------------\n")

low = reply.lower()
# Hard markers of the OLD self-intro / capability-menu behavior.
menu_markers = [
    "a few things you can ask", "here are a few", "you can ask me",
    "things you can ask", "here's what i can", "here is what i can",
    "i can help you with", "what i can do for you",
]
hit = [m for m in menu_markers if m in low]
# Count enumerated example prompts (a menu lists several at once).
examples = ["brief me", "production this month", "team doing", "team's production",
            "policies at risk", "pending policies", "draft an email", "what's at risk"]
ex_hits = [e for e in examples if e in low]

fails = []
if hit:
    fails.append(f"capability-menu phrase present: {hit}")
if len(ex_hits) >= 3:
    fails.append(f"enumerates {len(ex_hits)} example prompts (a rundown): {ex_hits}")
if len(reply) > 700:
    fails.append(f"reply is {len(reply)} chars — too long for a bare 'hi' (rundown-like)")

print(f"[check] menu phrases={hit or 'none'} | example-prompts={len(ex_hits)} | len={len(reply)}")
if fails:
    print("FAILED:", "; ".join(fails)); sys.exit(1)
print("PASS — no rundown: short greeting, no volunteered capability menu."); sys.exit(0)
