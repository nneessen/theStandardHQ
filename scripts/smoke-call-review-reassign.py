#!/usr/bin/env python3
"""
End-to-end smoke for the Call Reviews super-admin "reassign an EXISTING call to a
different agent" feature (the per-row pencil → Reassign call dialog).

Logs in with the super-admin creds, seeds one throwaway recording via the upload
panel, then exercises the new edit affordance on its library row:
  1. Pencil → pick "Other agent" + type a name → Save  ⇒ metadata.external_agent_name
     set, agent_id unchanged (stays the uploader).
  2. Pencil again → pick a REAL roster agent → Save     ⇒ agent_id == that agent
     AND metadata.external_agent_name cleared.

Verifies each transition in the DB via run-sql.sh, then DELETES the row + its
storage object. NEVER mutates the auth account.

Usage:
    set -a; source .env.local; set +a
    # NOTE: the LOCAL super-admin auth email is epiclife.neessen@gmail.com (the
    # .env.local E2E_EMAIL is stale for local); override it on the command line:
    E2E_EMAIL="epiclife.neessen@gmail.com" python3 scripts/smoke-call-review-reassign.py

Exit codes: 0 ok · 1 JS error · 2 missing env · 3 login failed · 4 assertion failed
"""

import os
import sys
import time
import pathlib
import subprocess
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")
STAMP = str(int(time.time()))
SEED_FILE = f"__smoke_reassign_{STAMP}.mp3"
OTHER_NAME = f"Smoke Reassigned {STAMP}"

IGNORE = (
    "favicon",
    "React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
    # Upload fires a fire-and-forget transcribe edge fn not served locally; the
    # app swallows the failure by design (.catch(() => {})). Not a regression.
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

        # ── Seed one recording (assigned to me) via the upload panel. ──────────
        page.get_by_role("button", name="Upload call", exact=False).first.click()
        page.wait_for_timeout(800)
        page.set_input_files(
            "input[type=file]",
            files=[{"name": SEED_FILE, "mimeType": "audio/mpeg", "buffer": FAKE_MP3}],
        )
        page.wait_for_timeout(400)
        page.locator("input[type=checkbox]").first.check()
        page.get_by_role("button", name="Upload", exact=False).last.click()
        page.wait_for_selector("text=1 uploaded", timeout=20_000)
        print("✓ seed recording uploaded")
        # Close the upload panel so the library row's pencil is unobstructed.
        page.get_by_role("button", name="Upload call", exact=False).first.click()
        page.wait_for_timeout(800)

        # CRITICAL: the seed has no call_at, so it sorts to the BOTTOM of the
        # library — clicking the first row's pencil would hit an unrelated
        # recording. Filter the list to JUST the seed via the search box (it
        # ILIKEs original_filename) so the only row — and only pencil — is ours.
        page.get_by_placeholder("Search caller, file, transcript", exact=False).first.fill(
            SEED_FILE
        )
        page.wait_for_timeout(1500)  # 350ms debounce + server refetch

        # Resolve the seeded row id + the uploader (super-admin) id from the DB.
        seed = sql(
            "SELECT id, agent_id FROM kpi_call_recordings WHERE original_filename = "
            f"'{SEED_FILE}';"
        )
        print("--- seed row ---")
        print(seed)

        # ── Edit #1: reassign to an OFF-SYSTEM agent (free text). ──────────────
        page.locator('button[title="Reassign agent"]').first.click()
        page.wait_for_selector("text=Reassign call", timeout=8_000)
        dialog_sel = page.get_by_role("dialog").locator("select").first
        dialog_sel.select_option("__other__")
        page.wait_for_timeout(300)
        page.get_by_placeholder("Type the agent's name").fill(OTHER_NAME)
        page.get_by_role("button", name="Save", exact=False).first.click()
        page.wait_for_timeout(1500)
        print("✓ edit #1 (other agent) saved")

        after_other = sql(
            "SELECT coalesce(metadata->>'external_agent_name','') AS ext "
            f"FROM kpi_call_recordings WHERE original_filename = '{SEED_FILE}';"
        )
        ok = True
        if OTHER_NAME in after_other:
            print("✓ metadata.external_agent_name set by reassign")
        else:
            print("✗ external_agent_name not stored after edit #1")
            print(after_other)
            ok = False

        # ── Edit #2: reassign to a REAL roster agent (clears external name). ───
        page.locator('button[title="Reassign agent"]').first.click()
        page.wait_for_selector("text=Reassign call", timeout=8_000)
        dialog_sel = page.get_by_role("dialog").locator("select").first
        opts = dialog_sel.locator("option")
        real_value = None
        real_label = None
        for i in range(opts.count()):
            val = opts.nth(i).get_attribute("value")
            txt = (opts.nth(i).inner_text() or "").strip()
            if val and val not in ("", "__other__") and not txt.startswith("Me ("):
                real_value = val
                real_label = txt
                break
        if not real_value:
            print("✗ no real roster agent option in the edit dialog")
            page.screenshot(path=str(OUT / "call-review-reassign-FAIL.png"), full_page=True)
            browser.close()
            return 4
        print(f"  roster agent → {real_label} ({real_value[:8]})")
        dialog_sel.select_option(real_value)
        page.get_by_role("button", name="Save", exact=False).first.click()
        page.wait_for_timeout(1500)
        print("✓ edit #2 (real agent) saved")

        page.screenshot(path=str(OUT / "call-review-reassign.png"), full_page=True)
        browser.close()

    # ── Verify the final state in the DB. ──────────────────────────────────────
    final = sql(
        "SELECT agent_id, coalesce(metadata->>'external_agent_name','(cleared)') AS ext "
        f"FROM kpi_call_recordings WHERE original_filename = '{SEED_FILE}';"
    )
    print("\n--- final row ---")
    print(final)
    if real_value[:8] in final:
        print("✓ agent_id updated to the chosen roster agent")
    else:
        print("✗ agent_id not updated after edit #2")
        ok = False
    if "(cleared)" in final:
        print("✓ external_agent_name cleared when a roster agent was picked")
    else:
        print("✗ external_agent_name lingered after reassigning to a roster agent")
        ok = False

    # ── Cleanup: delete the test row + storage object. ─────────────────────────
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
    print("\n✓ Call Reviews reassign-agent smoke PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
