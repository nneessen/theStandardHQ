#!/usr/bin/env python3
"""Deterministic regression test for the Jarvis voice ERROR VIEW resilience fix.

Background: a connect/token/mic failure used to flip the session to `unavailable`, which
dropped the full-screen VoiceImmersion overlay out of its `active` set so it UNMOUNTED — the
"waves screen vanishes and dumps you back to the Command Center" complaint. The fix keeps the
overlay mounted on `unavailable` and renders an explicit error view (reason + Try again + Use
text instead).

This probe forces the failure deterministically by intercepting the realtime token endpoint
(the non-warm POST) and returning 500, then asserts:
  1. the immersion overlay STAYS (the "Voice didn't start" error view renders), and
  2. it PERSISTS (still there ~4s later — it did not vanish), and
  3. "Use text instead" closes it.

Runs the LOCAL frontend (localhost:3000 via dev-voice-prod.sh) against PROD auth. The warm
probe is left intact so availability stays true; no LiveKit room is ever joined (token mint is
blocked), so there is NO billable voice session. Exit 0 = pass, non-zero = fail.
"""
import os, re, sys, pathlib
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
    print("MISSING E2E creds in .env.local", file=sys.stderr); sys.exit(2)

BASE = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
print(f"### target: {BASE}")
fails = []


def check(cond, label):
    print(f"[{'PASS' if cond else 'FAIL'}] {label}")
    if not cond:
        fails.append(label)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
        "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
    ctx = browser.new_context(permissions=["microphone"])
    page = ctx.new_page()

    # Force the realtime token mint to fail (but leave the warm availability probe intact).
    def route_token(route):
        url = route.request.url
        if "assistant-voice-livekit-token" in url and "warm=1" not in url:
            print("[intercept] 500 <-", url[:90])
            route.fulfill(status=500, body="{}",
                          headers={"content-type": "application/json"})
        else:
            route.continue_()
    page.route("**/assistant-voice-livekit-token*", route_token)

    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(1500)
    for name in ["Got it", "Accept", "OK"]:
        try:
            page.get_by_role("button", name=re.compile(name, re.I)).first.click(timeout=1500)
            break
        except Exception:
            pass
    page.locator("#email").fill(EMAIL, timeout=20000)
    page.locator("#password").fill(PASSWORD, timeout=20000)
    page.get_by_role("button", name=re.compile("^sign in$", re.I)).first.click(timeout=20000)
    try:
        page.wait_for_url(lambda u: "/login" not in u, timeout=30000)
    except Exception:
        pass
    page.wait_for_timeout(3000)

    # Launch voice (dock → requestVoiceLaunch → /command-center → start()).
    try:
        page.locator('[aria-label="Open Jarvis (Command Center)"]').first.click(timeout=8000)
    except Exception:
        page.goto(f"{BASE}/command-center", wait_until="domcontentloaded")
        page.keyboard.press("Meta+j")

    # The error view renders once start() reaches the blocked token mint and flips to unavailable.
    err_heading = page.get_by_text("Voice didn't start", exact=False)
    try:
        err_heading.wait_for(state="visible", timeout=15000)
        appeared = True
    except Exception:
        appeared = False
    check(appeared, "error view appears on token failure (overlay did NOT vanish)")

    try_again = page.get_by_role("button", name=re.compile("try again", re.I))
    use_text = page.get_by_role("button", name=re.compile("use text instead", re.I))
    check(try_again.count() > 0, "'Try again' button present")
    check(use_text.count() > 0, "'Use text instead' button present")

    # Persistence: still there after 4s (the old bug unmounted it near-instantly).
    page.wait_for_timeout(4000)
    check(err_heading.is_visible(), "error view PERSISTS after 4s (no silent vanish)")

    page.screenshot(path="/tmp/voice-error-view.png")
    print("[shot] /tmp/voice-error-view.png")

    # 'Use text instead' closes the overlay (stop → idle).
    if use_text.count() > 0:
        use_text.first.click()
        page.wait_for_timeout(800)
        check(not err_heading.is_visible(), "'Use text instead' closes the overlay")

    ctx.close(); browser.close()

print("\n===== RESULT =====")
if fails:
    print("FAILED:", "; ".join(fails)); sys.exit(1)
print("ALL CHECKS PASSED"); sys.exit(0)
