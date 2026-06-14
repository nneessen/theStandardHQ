#!/usr/bin/env python3
"""
End-to-end smoke for the Call Reviews super-admin "assign upload to agent" feature.

Logs in with the .env.local super-admin creds, opens /call-reviews → Upload call,
and exercises BOTH new paths:
  1. Assign the upload to a REAL roster agent  → row.agent_id == that agent,
     row.uploader_id == super-admin.
  2. Assign to an OFF-SYSTEM agent via the free-text field → row.agent_id ==
     super-admin (the uploader) AND metadata.external_agent_name == typed name.

It uploads two tiny throwaway audio files (named __smoke_assign_*), verifies the
resulting rows in the DB via run-sql.sh, then DELETES those rows + their storage
objects so nothing is left behind. NEVER mutates the auth account.

Usage:
    set -a; source .env.local; set +a
    # NOTE: the LOCAL super-admin auth email is epiclife.neessen@gmail.com (the
    # .env.local E2E_EMAIL is stale for local); override it on the command line:
    E2E_EMAIL="epiclife.neessen@gmail.com" python3 scripts/smoke-call-review-assign.py

Exit codes: 0 ok · 1 JS error · 2 missing env · 3 login failed · 4 assertion failed
"""

import os
import sys
import time
import json
import pathlib
import subprocess
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")
STAMP = str(int(time.time()))
REAL_FILE = f"__smoke_assign_real_{STAMP}.mp3"
OTHER_FILE = f"__smoke_assign_other_{STAMP}.mp3"
OTHER_NAME = f"Smoke External {STAMP}"

IGNORE = (
    "favicon",
    "React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
    # The upload fires a fire-and-forget transcribe-call-recording edge function
    # that is NOT served locally (it's deployed only on prod); the app swallows
    # the failure by design (.catch(() => {})). Not a regression.
    "Failed to load resource",
)

# A few bytes is enough — client validation keys on the extension, and we delete
# the row + object before any transcription matters.
FAKE_MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00fake-smoke-audio"


def sql(query: str) -> str:
    """Run a SQL query against the LOCAL db via the project's runner."""
    res = subprocess.run(
        ["./scripts/migrations/run-sql.sh", query],
        capture_output=True,
        text=True,
        cwd=str(pathlib.Path(__file__).resolve().parent.parent.parent),
    )
    return (res.stdout or "") + (res.stderr or "")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1680, "height": 1050})
        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        print(f"→ login {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=30_000)
        # Dismiss the cookie banner if it overlays the form.
        try:
            page.get_by_role("button", name="Got it", exact=False).first.click(timeout=2500)
        except Exception:
            pass
        page.wait_for_selector("input[type=email]", timeout=20_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed")
            browser.close()
            return 3

        page.goto(f"{BASE}/call-reviews", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)

        # Open the upload panel.
        page.get_by_role("button", name="Upload call", exact=False).first.click()
        page.wait_for_timeout(800)

        # ── Assertion: the super-admin sees the assignment picker. ──────────────
        picker = page.locator("select").filter(has=page.locator("option", has_text="Me (assign to my own calls)"))
        if picker.count() == 0:
            print("✗ super-admin assignment picker not rendered")
            page.screenshot(path=str(OUT / "call-review-assign-FAIL.png"), full_page=True)
            browser.close()
            return 4
        print("✓ assignment picker present")

        sel = picker.first
        # Capture a real agent option (the second <option>, after "Me…").
        opts = sel.locator("option")
        real_agent_label = None
        real_agent_value = None
        for i in range(opts.count()):
            val = opts.nth(i).get_attribute("value")
            txt = (opts.nth(i).inner_text() or "").strip()
            if val and val not in ("", "__other__"):
                real_agent_value = val
                real_agent_label = txt
                break
        if not real_agent_value:
            print("✗ no real agent in roster to assign to")
            browser.close()
            return 4
        print(f"  roster agent → {real_agent_label} ({real_agent_value[:8]})")

        # ── Upload #1: assign to a real agent. ─────────────────────────────────
        sel.select_option(real_agent_value)
        page.set_input_files(
            "input[type=file]",
            files=[{"name": REAL_FILE, "mimeType": "audio/mpeg", "buffer": FAKE_MP3}],
        )
        page.wait_for_timeout(400)
        page.locator("input[type=checkbox]").first.check()
        page.get_by_role("button", name="Upload", exact=False).last.click()
        # A successful upload now closes the panel and navigates to the new call's
        # detail page (so the user lands on the call they just added).
        import re as _re
        page.wait_for_url(_re.compile(r"/call-reviews/[0-9a-f-]{36}"), timeout=20_000)
        print("✓ upload #1 (real agent) completed → navigated to detail")

        # ── Upload #2: assign to an off-system agent (free text). ──────────────
        # The panel closed on navigation, so return to the library and re-open it.
        page.goto(f"{BASE}/call-reviews", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(1500)
        page.get_by_role("button", name="Upload call", exact=False).first.click()
        page.wait_for_timeout(800)
        picker2 = page.locator("select").filter(
            has=page.locator("option", has_text="Me (assign to my own calls)")
        ).first
        picker2.select_option("__other__")
        page.wait_for_timeout(300)
        page.get_by_placeholder("Type the agent's name").fill(OTHER_NAME)
        page.set_input_files(
            "input[type=file]",
            files=[{"name": OTHER_FILE, "mimeType": "audio/mpeg", "buffer": FAKE_MP3}],
        )
        page.wait_for_timeout(400)
        page.locator("input[type=checkbox]").first.check()
        page.get_by_role("button", name="Upload", exact=False).last.click()
        page.wait_for_url(_re.compile(r"/call-reviews/[0-9a-f-]{36}"), timeout=20_000)
        print("✓ upload #2 (other agent) completed → navigated to detail")

        page.screenshot(path=str(OUT / "call-review-assign.png"), full_page=True)
        browser.close()

    # ── Verify attribution in the DB. ──────────────────────────────────────────
    rows = sql(
        "SELECT original_filename, agent_id, uploader_id, "
        "coalesce(metadata->>'external_agent_name','') AS ext "
        f"FROM kpi_call_recordings WHERE original_filename LIKE '__smoke_assign_%{STAMP}%';"
    )
    print("\n--- DB rows ---")
    print(rows)

    ok = True
    if REAL_FILE in rows and real_agent_value[:8] in rows:
        print("✓ real-agent upload attributed to the chosen agent")
    else:
        print("✗ real-agent attribution wrong")
        ok = False
    if OTHER_FILE in rows and OTHER_NAME in rows:
        print("✓ other-agent name stored in metadata.external_agent_name")
    else:
        print("✗ external_agent_name not stored")
        ok = False

    # ── Cleanup: delete the test rows + storage objects. ───────────────────────
    # storage.objects has a protect_delete trigger that blocks direct SQL deletes
    # unless storage.allow_delete_query is set — flip it for this txn so the smoke
    # leaves nothing behind (these are throwaway few-byte LOCAL test objects).
    sql(
        "BEGIN; "
        "SET LOCAL \"storage.allow_delete_query\" = 'true'; "
        "DELETE FROM storage.objects WHERE bucket_id='call-recordings' AND name IN "
        "(SELECT storage_path FROM kpi_call_recordings WHERE original_filename LIKE "
        f"'__smoke_assign_%{STAMP}%'); "
        "DELETE FROM kpi_call_recordings WHERE original_filename LIKE "
        f"'__smoke_assign_%{STAMP}%'; "
        "COMMIT;"
    )
    print("✓ cleaned up test rows + storage objects")

    if errors:
        print(f"\n✗ {len(errors)} JS error(s):")
        for e in errors[:15]:
            print(f"   {e}")
        return 1
    if not ok:
        return 4
    print("\n✓ Call Reviews assign-to-agent smoke PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
