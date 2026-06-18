#!/usr/bin/env python3
"""
Capture a high-DPI screenshot of the authed /dashboard ("The Board") and crop the
left sidebar out, to use as the HQ landing hero image.

Unlike the bulk crop-landing-screenshots.py (which downscales to 1600px wide for
the gallery), this keeps full retina resolution so the single hero image stays
crisp when shown large.

Usage:
    set -a; source .env.local; set +a       # load E2E_EMAIL / E2E_PASSWORD
    python3 scripts/capture-landing-dashboard.py

Writes public/landing/screens/screen-dashboard.png (and a raw /tmp copy).
"""
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = Path("public/landing/screens/screen-dashboard.png")
RAW = Path("/tmp/dashboard-raw.png")


def detect_sidebar_right(arr: np.ndarray) -> int:
    """Strongest full-height vertical divider in the expected 11–17% band."""
    h, w, _ = arr.shape
    gray = arr[:, :, :3].mean(axis=2)
    lo, hi = int(w * 0.11), int(w * 0.17)
    rows = slice(int(h * 0.08), int(h * 0.92))
    best_x, best_frac = 0, 0.0
    for x in range(lo, hi):
        diff = np.abs(gray[rows, x + 2] - gray[rows, x])
        frac = float((diff > 18).mean())
        if frac > best_frac:
            best_frac, best_x = frac, x
    return best_x if best_frac > 0.45 else int(w * 0.14)


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL / E2E_PASSWORD (source .env.local first)")
        return 2

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(
            viewport={"width": 1500, "height": 950}, device_scale_factor=2
        )
        print(f"→ logging in at {BASE}/login")
        pg.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        pg.locator("input[type=email]").first.fill(EMAIL)
        pg.locator("input[type=password]").first.fill(PASSWORD)
        pg.get_by_role("button", name="Sign in", exact=False).first.click()
        pg.wait_for_timeout(3500)
        if pg.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login) — check .env.local")
            b.close()
            return 3
        try:
            pg.get_by_role("button", name="Got it", exact=False).first.click(
                timeout=2500
            )
            pg.wait_for_timeout(300)
        except Exception:  # noqa: BLE001
            pass

        print("→ /dashboard")
        pg.goto(f"{BASE}/dashboard", wait_until="domcontentloaded", timeout=30_000)
        pg.wait_for_timeout(4000)
        for _ in range(20):  # wait out loading spinners
            try:
                if pg.locator(".animate-spin").count() == 0:
                    break
            except Exception:  # noqa: BLE001
                break
            pg.wait_for_timeout(500)
        pg.screenshot(path=str(RAW))  # viewport @ DSF=2
        b.close()

    img = Image.open(RAW).convert("RGB")
    w, h = img.size
    x = detect_sidebar_right(np.asarray(img))
    cut = x + 6
    cropped = img.crop((cut, 0, w, h))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(OUT, optimize=True)
    print(f"✓ wrote {OUT}  {cropped.size}  (sidebar cut @ {cut}/{w})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
