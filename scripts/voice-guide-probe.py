#!/usr/bin/env python3
"""Smoke test for the in-app Jarvis guide (the "?" CapabilitiesSheet) and its click-to-run
wiring through CommandCenterLayout.onRunPrompt → AssistantPage.handleSend.

Asserts:
  1. the "?" command-bar button opens the guide with grounded capability content, and
  2. clicking an example prompt closes the guide AND posts that exact text as a user message
     in the transcript (proving the onRunPrompt plumbing is connected).

The orchestrator endpoint is blocked (500) so NO real LLM turn is billed — the user message
bubble renders optimistically before the network call, which is all we assert. Runs the LOCAL
frontend against PROD auth. Exit 0 = pass.
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
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()
    # Block real LLM turns — we only assert the optimistic user bubble renders.
    page.route("**/assistant-orchestrator*",
               lambda r: r.fulfill(status=500, body="{}",
                                   headers={"content-type": "application/json"}))

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
    page.goto(f"{BASE}/command-center", wait_until="domcontentloaded")
    page.wait_for_timeout(2500)

    # Open the guide via the "?" command-bar button.
    opened = False
    for sel in ['[aria-label^="What can"]', '[aria-label*="do?"]']:
        try:
            page.locator(sel).first.click(timeout=5000)
            opened = True; break
        except Exception:
            pass
    check(opened, "'?' button opens the guide")

    heading = page.get_by_text(re.compile(r"What can .* do\?", re.I))
    try:
        heading.first.wait_for(state="visible", timeout=5000); shown = True
    except Exception:
        shown = False
    check(shown, "guide shows 'What can <name> do?' header")

    EXAMPLE = "Brief me on what needs my attention today"
    example_btn = page.get_by_role("button", name=re.compile(re.escape(EXAMPLE), re.I))
    check(example_btn.count() > 0, f"guide lists the example prompt: {EXAMPLE!r}")

    if example_btn.count() > 0:
        example_btn.first.click()
        page.wait_for_timeout(1500)
        # The guide should close and the example should appear as a user message.
        still_open = heading.first.is_visible() if heading.count() else False
        check(not still_open, "guide closes after running an example")
        # Look for the example text in a transcript bubble (not the now-closed sheet).
        appeared = page.get_by_text(EXAMPLE, exact=False).count() > 0
        check(appeared, "example posts as a user message (onRunPrompt wired)")

    page.screenshot(path="/tmp/voice-guide.png")
    print("[shot] /tmp/voice-guide.png")
    ctx.close(); browser.close()

print("\n===== RESULT =====")
if fails:
    print("FAILED:", "; ".join(fails)); sys.exit(1)
print("ALL CHECKS PASSED"); sys.exit(0)
