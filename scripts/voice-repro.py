#!/usr/bin/env python3
"""Reproduce the realtime Jarvis voice session in a real browser (localhost:3000 -> PROD
backend via dev-voice-prod.sh) and capture the EXACT failure: console, page errors, failed
requests, WebSocket close codes (the app swallows room.connect errors in an empty catch, so
the LiveKit signal WS close code is the primary evidence), and which voice failure-message
renders. Read-only; nothing is shipped."""
import os, re, sys, time, pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

def env_from(path, key):
    try:
        for line in (ROOT / path).read_text().splitlines():
            if line.startswith(key + "="):
                return line[len(key) + 1:].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return None

EMAIL = env_from(".env.local", "E2E_EMAIL")
PASSWORD = env_from(".env.local", "E2E_PASSWORD")
if not EMAIL or not PASSWORD:
    print("MISSING E2E creds in .env.local", file=sys.stderr); sys.exit(1)

BASE = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
print(f"### target: {BASE}")

events = []  # (kind, text)
def rec(kind, text):
    events.append((kind, text))
    print(f"[{kind}] {text}", flush=True)

with sync_playwright() as p:
    DENY = os.environ.get("DENY_MIC") == "1"
    launch_args = ["--autoplay-policy=no-user-gesture-required"]
    if not DENY:
        launch_args += ["--use-fake-ui-for-media-stream",
                        "--use-fake-device-for-media-stream"]
    browser = p.chromium.launch(headless=True, args=launch_args)
    ctx = browser.new_context(permissions=([] if DENY else ["microphone"]))
    if DENY:
        rec("mode", "MIC DENIED (no fake device, no permission)")
    page = ctx.new_page()

    page.on("console", lambda m: rec("console." + m.type, m.text[:500]))
    page.on("pageerror", lambda e: rec("pageerror", str(e)[:500]))
    page.on("requestfailed", lambda r: rec(
        "reqfail", f"{r.method} {r.url[:120]} :: {r.failure}"))

    def on_resp(r):
        u = r.url
        if "assistant-voice-livekit-token" in u or "/auth/v1/token" in u:
            rec("resp", f"{r.status} {u[:120]}")
    page.on("response", on_resp)

    def on_ws(ws):
        rec("ws.open", ws.url[:140])
        ws.on("close", lambda *_: rec(
            "ws.close", f"code={getattr(ws,'close_code',None)} "
                        f"reason={getattr(ws,'close_reason',None)!r} {ws.url[:120]}"))
        ws.on("socketerror", lambda err: rec("ws.error", f"{err} {ws.url[:120]}"))
    page.on("websocket", on_ws)

    rec("nav", f"goto {BASE}/login")
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(2000)

    # dismiss cookie banner (intercepts clicks at the bottom of the page)
    for name in ["Got it", "Accept", "OK"]:
        try:
            page.get_by_role("button", name=re.compile(name, re.I)).first.click(timeout=2000)
            rec("cookie", f"dismissed via {name}"); break
        except Exception:
            pass

    # --- login (#email / #password / "Sign in") ---
    try:
        page.locator("#email").fill(EMAIL, timeout=20000)
        page.locator("#password").fill(PASSWORD, timeout=20000)
        page.get_by_role("button", name=re.compile("^sign in$", re.I)).first.click(timeout=20000)
        rec("login", "submitted")
    except Exception as e:
        rec("login.err", str(e)[:300])

    # wait for app shell after auth (URL leaves /login)
    try:
        page.wait_for_url(lambda u: "/login" not in u, timeout=30000)
    except Exception:
        pass
    page.wait_for_timeout(4000)
    rec("after-login-url", page.url)

    # --- trigger voice: click the Jarvis dock (requestVoiceLaunch + navigate /command-center) ---
    clicked = False
    for sel in ['[aria-label="Open Jarvis (Command Center)"]']:
        try:
            page.locator(sel).first.click(timeout=8000)
            clicked = True; rec("dock", f"clicked {sel}"); break
        except Exception as e:
            rec("dock.err", f"{sel} :: {str(e)[:160]}")
    if not clicked:
        # fallback: navigate directly + fire the launch signal via the keyboard shortcut
        try:
            page.goto(f"{BASE}/command-center", wait_until="domcontentloaded")
            page.keyboard.press("Meta+j")
            rec("dock", "fallback goto+Meta+j")
        except Exception as e:
            rec("dock.err2", str(e)[:200])

    # Poll the visible text while start() runs (token -> connect -> mic -> agent-ready). Polling
    # (not a single end-read) is required to catch the failure TOAST, which auto-dismisses after
    # 7s, AND the transient CONNECTING/LISTENING captions.
    needles = ["Couldn't connect to voice", "Voice isn't available",
               "Assistant didn't connect", "Jarvis didn't finish connecting",
               "Microphone access is needed", "Please sign in again",
               "Voice isn't configured", "CONNECTING", "LISTENING"]
    seen = set()
    # POLL_STEPS × 0.5s. Default 30 (~15s); raise past the 25s readiness watchdog to observe a
    # cold worker actually reaching LISTENING (e.g. POLL_STEPS=80 ≈ 40s).
    poll_steps = int(os.environ.get("POLL_STEPS", "30"))
    for _ in range(poll_steps):
        try:
            body = page.inner_text("body", timeout=2000)
        except Exception:
            body = ""
        for n in needles:
            if n.lower() in body.lower() and n not in seen:
                seen.add(n); rec("ui-msg", n)
        page.wait_for_timeout(500)
    rec("final-url", page.url)

    page.screenshot(path="/tmp/voice-repro.png", full_page=False)
    rec("done", "screenshot /tmp/voice-repro.png")
    ctx.close(); browser.close()

print("\n===== SUMMARY =====")
from collections import Counter
c = Counter(k for k, _ in events)
for k, n in c.most_common():
    print(f"{n:3d}  {k}")
