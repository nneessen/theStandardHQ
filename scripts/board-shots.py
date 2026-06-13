#!/usr/bin/env python3
"""
Authed screenshot helper for "The Board" redesign — lets the assistant SEE
authenticated pages while iterating on the visual rebuild.

Usage:
    set -a; source .env.local; set +a          # load E2E_EMAIL / E2E_PASSWORD
    python3 scripts/board-shots.py /targets /expenses /hierarchy
    python3 scripts/board-shots.py              # default route set

Env:
    E2E_EMAIL, E2E_PASSWORD   required (put them in gitignored .env.local)
    BOARD_BASE                optional, defaults to http://localhost:3000

Writes full-page PNGs to /tmp/board-shots/<route>-<viewport>.png and prints
each path + a horizontal-overflow flag ("cut off on the right" detector).
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")

DEFAULT_ROUTES = ["/targets", "/expenses", "/hierarchy", "/leaderboard"]
# Viewport(s). Override with BOARD_VIEWPORT="1440x900" (or comma-separate a few:
# "1440x900,2560x1440") so we can screenshot at the width the owner actually uses.
# Default stays the historical 1680x1050 desktop.
def _parse_viewports() -> list[tuple[str, int, int]]:
    raw = os.environ.get("BOARD_VIEWPORT", "").strip()
    if not raw:
        return [("desktop", 1680, 1050)]
    out: list[tuple[str, int, int]] = []
    for spec in raw.split(","):
        spec = spec.strip().lower()
        if "x" not in spec:
            continue
        w_s, h_s = spec.split("x", 1)
        w, h = int(w_s), int(h_s)
        out.append((f"{w}w", w, h))
    return out or [("desktop", 1680, 1050)]


VIEWPORTS = _parse_viewports()
# How long to let a route settle after navigation (local DB + data fetch can be
# slower than prod). Override with BOARD_WAIT_MS.
WAIT_MS = int(os.environ.get("BOARD_WAIT_MS", "3500"))


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2

    routes = [a for a in sys.argv[1:] if a.startswith("/")] or DEFAULT_ROUTES
    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        # Login inputs are placeholder-only (no <label> association), so
        # get_by_label() silently matches nothing — select by input type.
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print(
                "✗ login failed (still on /login) — check E2E_EMAIL/"
                "E2E_PASSWORD in .env.local. Aborting."
            )
            browser.close()
            return 3

        # Dismiss the cookie/consent banner once so it doesn't cover the footer
        # of every screenshot. Best-effort — ignore if it isn't present.
        try:
            page.get_by_role(
                "button", name="Got it", exact=False
            ).first.click(timeout=2500)
            page.wait_for_timeout(300)
        except Exception:  # noqa: BLE001
            pass

        for route in routes:
            for vname, vw, vh in VIEWPORTS:
                page.set_viewport_size({"width": vw, "height": vh})
                try:
                    # domcontentloaded (not networkidle) — pages that poll
                    # (close-kpi, voice) never go idle and would hang.
                    page.goto(
                        f"{BASE}{route}",
                        wait_until="domcontentloaded",
                        timeout=30_000,
                    )
                except Exception as e:  # noqa: BLE001
                    print(f"   {route} [{vname}] → LOAD ERROR: {e}")
                    continue
                page.wait_for_timeout(WAIT_MS)
                # Give data-driven pages a chance to finish their first fetch:
                # poll until the animated loading spinner (Loader2 → .animate-spin)
                # disappears, up to ~8s past the base wait. Harmless if none.
                for _ in range(16):
                    try:
                        spinners = page.locator(".animate-spin").count()
                    except Exception:  # noqa: BLE001
                        break
                    if spinners == 0:
                        break
                    page.wait_for_timeout(500)
                slug = route.strip("/").replace("/", "_") or "root"
                shot = OUT / f"{slug}-{vname}.png"
                page.screenshot(path=str(shot), full_page=True)
                overflow = page.evaluate(
                    "Math.max(0, document.documentElement.scrollWidth"
                    " - window.innerWidth)"
                )
                flag = (
                    f"  ⚠ H-OVERFLOW +{overflow}px"
                    if overflow > 1
                    else "  ✓ no h-overflow"
                )
                print(f"   {route} [{vname}] → {shot}{flag}")

        browser.close()
    print(f"\n✓ screenshots in {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
