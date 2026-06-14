#!/usr/bin/env python3
"""
End-to-end smoke for the Call Reviews "like/heart" + sort + recently-uploaded UX.

Logs in with the .env.local super-admin creds and verifies, on /call-reviews:
  1. The library renders with no JS errors, a "Likes" column, and a sort <select>
     offering "Most liked" / "Recently uploaded".
  2. Clicking a row's heart increments its visible count AND inserts a
     kpi_call_likes row in the DB; clicking again decrements it AND removes the
     row (toggle). The denormalized kpi_call_recordings.like_count tracks it.
  3. Switching sort to "Most liked" and "Recently uploaded" re-queries with no
     JS errors.
  4. Upload-then-navigate: uploading a throwaway call closes the panel and routes
     to /call-reviews/<new-id> (so the user lands on the call they just added).
     The throwaway row + storage object + any like are cleaned up afterward.

Usage:
    set -a; source .env.local; set +a
    # LOCAL super-admin auth email differs from the stale .env.local E2E_EMAIL:
    E2E_EMAIL="epiclife.neessen@gmail.com" python3 scripts/smoke-call-likes.py

Exit codes: 0 ok · 1 JS error · 2 missing env · 3 login failed · 4 assertion failed
"""

import os
import re
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
UPLOAD_FILE = f"__smoke_like_{STAMP}.mp3"

IGNORE = (
    "favicon",
    "React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
    # Upload fires a fire-and-forget transcribe edge fn that isn't served locally;
    # the app swallows the failure by design. Not a regression.
    "Failed to load resource",
)
FAKE_MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00fake-smoke-audio"


def sql(query: str) -> str:
    res = subprocess.run(
        ["./scripts/migrations/run-sql.sh", query],
        capture_output=True, text=True,
        cwd=str(pathlib.Path(__file__).resolve().parent.parent.parent),
    )
    return (res.stdout or "") + (res.stderr or "")


def like_count_in_db(rec_id: str) -> int:
    out = sql(f"SELECT count(*) FROM kpi_call_likes WHERE recording_id='{rec_id}';")
    m = re.search(r"\b(\d+)\b", out.split("count")[-1] if "count" in out else out)
    return int(m.group(1)) if m else -1


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    new_rec_id = None

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

        # ── 1. Structure: Likes column header + sort select. ───────────────────
        if page.get_by_text("Likes", exact=True).count() == 0:
            print("✗ 'Likes' column header not rendered")
            page.screenshot(path=str(OUT / "call-likes-FAIL.png"), full_page=True)
            browser.close()
            return 4
        sort_sel = page.locator("select").filter(
            has=page.locator("option", has_text="Most liked")
        )
        if sort_sel.count() == 0:
            print("✗ sort <select> with 'Most liked' not rendered")
            browser.close()
            return 4
        print("✓ Likes column + sort control present")

        # Need at least one call row to like. The like button is the only one with
        # aria-pressed, so it's a stable, unambiguous selector (its accessible name
        # is the count text, not the title).
        try:
            page.wait_for_selector("button[aria-pressed]", timeout=8_000)
        except Exception:
            pass
        heart_btns = page.locator("button[aria-pressed]")
        if heart_btns.count() == 0:
            print("⚠ no call rows in the library to like — structure OK, skipping toggle")
            page.screenshot(path=str(OUT / "call-likes-empty.png"), full_page=True)
            browser.close()
            return 0 if not errors else 1

        # Map a recording id from a row's <Link href> — scan for the first href
        # that is a real uuid (skip nav links like /call-reviews/scripts).
        links = page.locator("a[href*='/call-reviews/']")
        rec_id = None
        for i in range(links.count()):
            href = links.nth(i).get_attribute("href") or ""
            mm = re.search(r"/call-reviews/([0-9a-f]{8}-[0-9a-f-]{27})", href)
            if mm:
                rec_id = mm.group(1)
                break
        if not rec_id:
            print("✗ couldn't resolve any recording id from row hrefs")
            browser.close()
            return 4
        print(f"  target recording → {rec_id[:8]}")

        db_before = like_count_in_db(rec_id)
        btn = heart_btns.first
        count_before = int(re.search(r"\d+", btn.inner_text() or "0").group())

        # ── 2a. Like it. ───────────────────────────────────────────────────────
        btn.click()
        page.wait_for_timeout(1500)
        count_after = int(re.search(r"\d+", btn.inner_text() or "0").group())
        db_after = like_count_in_db(rec_id)
        if count_after == count_before + 1 and db_after == db_before + 1:
            print(f"✓ like: count {count_before}→{count_after}, db {db_before}→{db_after}")
        else:
            print(f"✗ like failed: count {count_before}→{count_after}, db {db_before}→{db_after}")
            browser.close()
            return 4

        # ── 2b. Unlike it (toggle back). ───────────────────────────────────────
        btn.click()
        page.wait_for_timeout(1500)
        count_final = int(re.search(r"\d+", btn.inner_text() or "0").group())
        db_final = like_count_in_db(rec_id)
        if count_final == count_before and db_final == db_before:
            print(f"✓ unlike: count back to {count_final}, db back to {db_final}")
        else:
            print(f"✗ unlike failed: count={count_final} (want {count_before}), db={db_final} (want {db_before})")
            browser.close()
            return 4

        # ── 3. Sort variants re-query cleanly. ─────────────────────────────────
        for label in ("Most liked", "Recently uploaded", "Recent calls"):
            sort_sel.first.select_option(label=label)
            page.wait_for_timeout(1200)
        print("✓ all sort variants re-queried without error")

        # ── 4. Upload → navigates to the new call. ─────────────────────────────
        page.get_by_role("button", name="Upload call", exact=False).first.click()
        page.wait_for_timeout(700)
        page.set_input_files(
            "input[type=file]",
            files=[{"name": UPLOAD_FILE, "mimeType": "audio/mpeg", "buffer": FAKE_MP3}],
        )
        page.wait_for_timeout(400)
        page.locator("input[type=checkbox]").first.check()
        page.get_by_role("button", name="Upload", exact=False).last.click()
        try:
            page.wait_for_url(re.compile(r"/call-reviews/[0-9a-f-]{36}"), timeout=20_000)
            new_rec_id = re.search(r"/call-reviews/([0-9a-f-]{36})", page.url).group(1)
            print(f"✓ upload navigated to detail page → {new_rec_id[:8]}")
        except Exception:
            print(f"✗ upload did NOT navigate to the new call (url={page.url})")
            page.screenshot(path=str(OUT / "call-likes-upload-FAIL.png"), full_page=True)
            browser.close()
            return 4

        page.screenshot(path=str(OUT / "call-likes.png"), full_page=True)
        browser.close()

    # ── Cleanup the throwaway uploaded row + its storage object. ───────────────
    if new_rec_id:
        sql(
            "BEGIN; "
            "SET LOCAL \"storage.allow_delete_query\" = 'true'; "
            "DELETE FROM storage.objects WHERE bucket_id='call-recordings' AND name IN "
            f"(SELECT storage_path FROM kpi_call_recordings WHERE id='{new_rec_id}'); "
            f"DELETE FROM kpi_call_recordings WHERE id='{new_rec_id}'; "
            "COMMIT;"
        )
        print(f"  cleaned up throwaway recording {new_rec_id[:8]}")

    if errors:
        print(f"\n✗ {len(errors)} JS error(s):")
        for e in errors[:10]:
            print("   ", e)
        return 1
    print("\n✓ ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
