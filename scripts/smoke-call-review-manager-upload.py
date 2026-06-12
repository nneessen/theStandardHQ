#!/usr/bin/env python3
"""
Smoke for the NON-admin "upload on behalf of a downline" feature on Call Reviews.

This is the path that ONLY runs for a regular agent/manager (NOT a super-admin),
so it must be tested as a manager — the super-admin smoke exercises a different
(full-roster) branch.

As a MANAGER with downlines (mgr1@epiclife-demo.test):
  1. The upload panel shows the "Whose call is this?" picker.
  2. The picker lists ONLY the manager's downline + "Me" — a known NON-downline
     IMO agent ("Noah Mercer") is absent, and there is NO free-text "Other agent"
     option (super-admin-only).
  3. Uploading on behalf of a real downline agent persists with
     row.agent_id == that downline (the INSERT RLS accepts it — no rejection).

As a LEAF agent with no downline (agent8@epiclife-demo.test):
  4. No picker at all (uploads as self).

Self-cleans the uploaded row + storage object. NEVER mutates auth accounts
(only reads; TOS is pre-set out-of-band by the operator).

Usage:
    set -a; source .env.local; set +a
    python3 scripts/smoke-call-review-manager-upload.py

Exit codes: 0 ok · 1 JS error · 2 missing env · 3 login failed · 4 assertion failed
"""

import os
import sys
import time
import pathlib
import subprocess
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
PASSWORD = os.environ.get("DEMO_PASSWORD", "DemoPass123!")
MGR_EMAIL = "mgr1@epiclife-demo.test"
LEAF_EMAIL = "agent8@epiclife-demo.test"
NON_DOWNLINE_NAME = "Noah Mercer"  # an approved IMO agent NOT under mgr1
OUT = pathlib.Path("/tmp/board-shots")
STAMP = str(int(time.time()))
SEED_FILE = f"__smoke_mgr_upload_{STAMP}.mp3"

IGNORE = (
    "favicon",
    "React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
    "Failed to load resource",
    "transcribe-call-recording",
)
FAKE_MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00fake-smoke-audio"


def sql(query: str) -> str:
    res = subprocess.run(
        ["./scripts/migrations/run-sql.sh", query],
        capture_output=True,
        text=True,
        cwd=str(pathlib.Path(__file__).resolve().parent.parent),
    )
    return (res.stdout or "") + (res.stderr or "")


def login(page, email: str) -> bool:
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=30_000)
    try:
        page.get_by_role("button", name="Got it", exact=False).first.click(timeout=2500)
    except Exception:
        pass
    page.wait_for_selector("input[type=email]", timeout=20_000)
    page.locator("input[type=email]").first.fill(email)
    page.locator("input[type=password]").first.fill(PASSWORD)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(3500)
    return not page.url.rstrip("/").endswith("/login")


def open_upload(page):
    page.goto(f"{BASE}/call-reviews", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(2500)
    page.get_by_role("button", name="Upload call", exact=False).first.click()
    page.wait_for_timeout(1000)


def main() -> int:
    errors: list[str] = []
    OUT.mkdir(parents=True, exist_ok=True)
    ok = True

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context()
        page = ctx.new_page()
        page.set_viewport_size({"width": 1680, "height": 1050})
        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        # ── MANAGER path ───────────────────────────────────────────────────────
        print(f"→ login manager {MGR_EMAIL}")
        if not login(page, MGR_EMAIL):
            print("✗ manager login failed (TOS not set? wrong password?)")
            browser.close()
            return 3
        open_upload(page)

        # The picker is the select that contains the "Me (assign…" option.
        picker = page.locator("select").filter(
            has=page.locator("option", has_text="Me (assign to my own calls)")
        )
        if picker.count() == 0:
            print("✗ manager did NOT see the assign picker (expected — has downline)")
            page.screenshot(path=str(OUT / "mgr-upload-FAIL.png"), full_page=True)
            browser.close()
            return 4
        print("✓ manager sees the assign picker")

        sel = picker.first
        opts = sel.locator("option")
        labels = [(opts.nth(i).inner_text() or "").strip() for i in range(opts.count())]
        print(f"  picker options: {labels}")

        if any("Other agent" in l for l in labels):
            print("✗ manager picker should NOT offer the free-text 'Other agent'")
            ok = False
        else:
            print("✓ no free-text 'Other agent' option for a manager")

        if any(NON_DOWNLINE_NAME in l for l in labels):
            print(f"✗ non-downline agent '{NON_DOWNLINE_NAME}' leaked into the picker")
            ok = False
        else:
            print(f"✓ non-downline agent '{NON_DOWNLINE_NAME}' is absent (scoped)")

        # Pick a real downline agent (first option that isn't "Me").
        dl_value = dl_label = None
        for i in range(opts.count()):
            val = opts.nth(i).get_attribute("value")
            txt = (opts.nth(i).inner_text() or "").strip()
            if val and val != "__other__" and not txt.startswith("Me ("):
                dl_value, dl_label = val, txt
                break
        if not dl_value:
            print("✗ no downline agent option to upload on behalf of")
            browser.close()
            return 4
        print(f"  uploading on behalf of downline → {dl_label} ({dl_value[:8]})")

        sel.select_option(dl_value)
        page.set_input_files(
            "input[type=file]",
            files=[{"name": SEED_FILE, "mimeType": "audio/mpeg", "buffer": FAKE_MP3}],
        )
        page.wait_for_timeout(400)
        page.locator("input[type=checkbox]").first.check()
        page.get_by_role("button", name="Upload", exact=False).last.click()
        page.wait_for_selector("text=1 uploaded", timeout=20_000)
        print("✓ upload on behalf of downline completed (no RLS rejection)")

        page.screenshot(path=str(OUT / "mgr-upload.png"), full_page=True)

        # ── LEAF path (no downline → no picker) ────────────────────────────────
        print(f"\n→ login leaf agent {LEAF_EMAIL}")
        ctx.clear_cookies()
        leaf_page = ctx.new_page()
        leaf_page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        leaf_page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        if not login(leaf_page, LEAF_EMAIL):
            print("✗ leaf login failed (TOS not set?)")
            browser.close()
            return 3
        open_upload(leaf_page)
        leaf_picker = leaf_page.locator("select").filter(
            has=leaf_page.locator("option", has_text="Me (assign to my own calls)")
        )
        if leaf_picker.count() == 0:
            print("✓ leaf agent (no downline) sees NO picker — uploads as self")
        else:
            print("✗ leaf agent should NOT see the assign picker")
            ok = False

        browser.close()

    # ── Verify the manager's upload attribution in the DB. ─────────────────────
    row = sql(
        "SELECT agent_id, uploader_id FROM kpi_call_recordings WHERE "
        f"original_filename = '{SEED_FILE}';"
    )
    print("\n--- uploaded row ---")
    print(row)
    if dl_value[:8] in row:
        print("✓ agent_id == the downline agent (attributed on their behalf)")
    else:
        print("✗ agent_id not the downline agent")
        ok = False

    # ── Cleanup. ───────────────────────────────────────────────────────────────
    sql(
        "BEGIN; "
        "SET LOCAL \"storage.allow_delete_query\" = 'true'; "
        "DELETE FROM storage.objects WHERE bucket_id='call-recordings' AND name IN "
        "(SELECT storage_path FROM kpi_call_recordings WHERE original_filename = "
        f"'{SEED_FILE}'); "
        f"DELETE FROM kpi_call_recordings WHERE original_filename = '{SEED_FILE}'; "
        "COMMIT;"
    )
    print("✓ cleaned up test row + storage object")

    if errors:
        print(f"\n✗ {len(errors)} JS error(s):")
        for e in errors[:15]:
            print(f"   {e}")
        return 1
    if not ok:
        return 4
    print("\n✓ Call Reviews manager-upload-on-behalf smoke PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
