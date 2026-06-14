#!/usr/bin/env python3
"""
Runtime smoke for the revoked-IMO hard block (platform sunset).

Proves, against LOCAL supabase, that:
  1. A throwaway FFG agent can log in normally while FFG is NOT revoked
     (the new signIn revocation check passes non-revoked users).
  2. Once FFG.access_revoked_at is set, the SAME agent is blocked at login and
     sees the permanent "Account closed" notice — NOT the dashboard, and NOT
     the old "Access to your account is ending" grace page.

Safety:
  - Operates ONLY on the throwaway agent seedtest_throwaway@example.com.
    NEVER touches a real account (see memory: never-touch-real-accounts).
  - Sets a temporary password on the throwaway, toggles FFG.access_revoked_at,
    and ALWAYS reverts it back to NULL in a finally block.

Usage:
    set -a; source .env.local; set +a
    # dev server must be running:  npx vite   (http://localhost:3000)
    python3 scripts/smoke-account-closed.py
"""

import os
import sys
import pathlib
import urllib.request
import urllib.error
import json
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
SUPA = os.environ.get("VITE_LOCAL_SUPABASE_URL") or os.environ.get(
    "VITE_SUPABASE_URL", "http://127.0.0.1:54321"
)
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

FFG_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"
# A fresh throwaway auth user created + torn down by this smoke. NEVER a real
# account (see memory: never-touch-real-accounts).
THROWAWAY_EMAIL = "smoke-ffg-blocked@example.com"
TEMP_PW = "SmokeBlock123!"

OUT = pathlib.Path("/tmp/board-shots")

IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
)


def admin_call(
    method: str, path: str, body: dict | None = None, prefer: str | None = None
) -> dict:
    url = f"{SUPA}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        print(f"  ! admin {method} {path} -> {e.code}: {e.read().decode()[:200]}")
        raise


def set_revoked(revoked: bool) -> None:
    # PATCH imos via PostgREST as service role (bypasses RLS). PostgREST can't
    # eval now(), so send an ISO timestamp.
    if revoked:
        import datetime

        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
        body = {"access_revoked_at": ts}
    else:
        body = {"access_revoked_at": None}
    admin_call("PATCH", f"/rest/v1/imos?id=eq.{FFG_ID}", body)


def find_user_id(email: str) -> str | None:
    res = admin_call("GET", f"/auth/v1/admin/users?email={email}")
    users = res.get("users", res if isinstance(res, list) else [])
    for u in users:
        if u.get("email") == email:
            return u["id"]
    return None


def create_throwaway() -> str:
    existing = find_user_id(THROWAWAY_EMAIL)
    if existing:
        admin_call(
            "PUT",
            f"/auth/v1/admin/users/{existing}",
            {"password": TEMP_PW, "email_confirm": True},
        )
        uid = existing
    else:
        res = admin_call(
            "POST",
            "/auth/v1/admin/users",
            {"email": THROWAWAY_EMAIL, "password": TEMP_PW, "email_confirm": True},
        )
        uid = res["id"]
    # Force the profile into FFG as a non-super-admin agent so the revocation
    # predicate resolves against the revoked IMO. A signup trigger may have
    # already created the row (orphan -> FFG fallback); PATCH is idempotent.
    import datetime

    ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
    fields = {
        "imo_id": FFG_ID,
        "is_super_admin": False,
        "roles": ["agent"],
        "terms_accepted_at": ts,
    }
    # return=representation so we can tell whether a row was actually updated.
    patch = admin_call(
        "PATCH",
        f"/rest/v1/user_profiles?id=eq.{uid}",
        fields,
        prefer="return=representation",
    )
    if not patch:  # signup trigger didn't create a row -> create one
        admin_call(
            "POST",
            "/rest/v1/user_profiles",
            {"id": uid, "email": THROWAWAY_EMAIL, **fields},
        )
    return uid


def teardown_throwaway(uid: str) -> None:
    try:
        admin_call("DELETE", f"/rest/v1/user_profiles?id=eq.{uid}")
    except Exception:  # noqa: BLE001
        pass
    try:
        admin_call("DELETE", f"/auth/v1/admin/users/{uid}")
    except Exception:  # noqa: BLE001
        pass


def login(page, email: str, password: str) -> None:
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
    page.locator("input[type=email]").first.fill(email)
    page.locator("input[type=password]").first.fill(password)
    page.get_by_role("button", name="Sign in", exact=False).first.click()
    page.wait_for_timeout(3500)


def main() -> int:
    if not SERVICE_KEY:
        print("✗ set SUPABASE_SERVICE_ROLE_KEY (source .env.local first)")
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    rc = 0

    # 1. Create the throwaway FFG agent (torn down at the end — never a real acct).
    print(f"→ creating throwaway FFG agent {THROWAWAY_EMAIL}")
    uid: str | None = None
    uid = create_throwaway()
    print(f"  uid={uid}")

    try:
        # Ensure FFG starts NOT revoked.
        set_revoked(False)

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.set_viewport_size({"width": 1440, "height": 900})
            page.on(
                "console",
                lambda m: errors.append(f"console.{m.type}: {m.text}")
                if m.type == "error" and not any(s in m.text for s in IGNORE)
                else None,
            )
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

            # ── Phase A: NOT revoked → login should pass through ───────────────
            print("→ [A] login while FFG NOT revoked (expect app, NOT blocked)")
            login(page, THROWAWAY_EMAIL, TEMP_PW)
            body_a = page.locator("body").inner_text().lower()
            url_a = page.url
            page.screenshot(path=str(OUT / "account-closed-A-allowed.png"))
            # Positive assertion: must actually LEAVE /login (not just lack the
            # closed text), else an unrelated guard (TOS/approval) false-passes.
            left_login = "/login" not in url_a
            if "account closed" in body_a:
                print(f"  ✗ A FAILED: user was blocked when NOT revoked (url={url_a})")
                rc = 1
            elif not left_login:
                print(f"  ✗ A FAILED: stayed on /login when NOT revoked (url={url_a})")
                rc = 1
            else:
                print(f"  ✓ A passed: reached app (url={url_a})")

            # sign out for a clean slate
            page.context.clear_cookies()

            # ── Phase B: revoked → login should show Account closed ────────────
            print("→ setting FFG.access_revoked_at = now()")
            set_revoked(True)

            print("→ [B] login while FFG revoked (expect 'Account closed')")
            login(page, THROWAWAY_EMAIL, TEMP_PW)
            body_b = page.locator("body").inner_text().lower()
            url_b = page.url
            page.screenshot(path=str(OUT / "account-closed-B-blocked.png"))

            shows_closed = "account closed" in body_b and (
                "no longer accessible" in body_b
            )
            shows_old = "access to your account is ending" in body_b
            reached_app = "/policies" in url_b or "dashboard" in body_b

            if shows_old:
                print("  ✗ B FAILED: still shows OLD 'Access is ending' grace page")
                rc = 1
            if reached_app and not shows_closed:
                print(f"  ✗ B FAILED: revoked user reached the app (url={url_b})")
                rc = 1
            if shows_closed:
                print("  ✓ B passed: permanent 'Account closed' notice shown")
            else:
                print(f"  ✗ B FAILED: 'Account closed' notice NOT found (url={url_b})")
                print(f"    body snippet: {body_b[:300]}")
                rc = 1

            browser.close()
    finally:
        # ALWAYS revert FFG to active.
        print("→ reverting FFG.access_revoked_at = NULL")
        try:
            set_revoked(False)
            print("  ✓ reverted")
        except Exception as e:  # noqa: BLE001
            print(f"  ! REVERT FAILED — set manually: {e}")
            rc = 1
        # ALWAYS delete the throwaway account.
        print("→ tearing down throwaway account")
        teardown_throwaway(uid)
        print("  ✓ removed")

    if errors:
        print("\nJS errors during smoke:")
        for e in errors[:20]:
            print(f"  - {e}")
        rc = 1

    print("\n" + ("✓ SMOKE PASSED" if rc == 0 else "✗ SMOKE FAILED"))
    return rc


if __name__ == "__main__":
    sys.exit(main())
