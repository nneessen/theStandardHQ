#!/usr/bin/env python3
"""
Export-fidelity probe for the LEADERBOARD social card (daily/weekly/monthly).

WHY (companion to aotw-export-probe.py): the real in-app "Download PNG" was
switched from html-to-image (lossy on webfonts + CSS gradients) to
modern-screenshot. The leaderboard is the data-dense card that should benefit
most — it uses the amber rank-badge gradients + Archivo/Hanken webfonts but NO
backdrop-filter, so the new rasterizer should make the download match the
on-screen preview. This drives the REAL download path and ALSO screenshots the
live preview element, so the two PNGs can be compared pixel-for-pixel:

    download.png  ≈  preview.png   → rasterizer is faithful.

Usage:
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (owner)
    python3 scripts/leaderboard-export-probe.py [daily|weekly|monthly]
"""

import os
import re
import sys
import struct
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")
VIEW = (sys.argv[1] if len(sys.argv) > 1 else "weekly").lower()


def png_dims(path: pathlib.Path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">I", head[16:20])[0], struct.unpack(">I", head[20:24])[0]


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed")
            return 3

        page.goto(f"{BASE}/social-studio", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)
        # Select the leaderboard cadence (daily/weekly/monthly).
        page.get_by_role("button", name=re.compile(rf"^{VIEW}$", re.I)).first.click()
        page.wait_for_timeout(1500)

        dl = page.get_by_role("button", name=re.compile(r"download png", re.I))
        if not (dl.count() and dl.first.is_enabled()):
            print("✗ Download disabled (sample mode? — owner agency needs real producers)")
            browser.close()
            return 4

        # Ground-truth: screenshot the live preview card element (real browser render).
        preview_path = OUT / f"leaderboard-{VIEW}-preview.png"
        card = page.locator("[data-card-root], #card").first
        if card.count():
            card.screenshot(path=str(preview_path))

        # The REAL download path (now modern-screenshot).
        out_path = OUT / f"leaderboard-{VIEW}-download.png"
        try:
            with page.expect_download(timeout=25000) as d:
                dl.first.click()
            d.value.save_as(str(out_path))
        except Exception as ex:
            print(f"✗ export download failed: {ex}")
            browser.close()
            return 5
        browser.close()

    w, h = png_dims(out_path)
    size_kb = out_path.stat().st_size // 1024
    print(f"✓ download saved {out_path}  ({w}×{h}px, {size_kb}KB)")
    if preview_path.exists():
        pw, ph = png_dims(preview_path)
        print(f"✓ preview  saved {preview_path}  ({pw}×{ph}px)")
    errs = [e for e in console_errors if "favicon" not in e.lower()]
    print(f"{'⚠️  console errors: ' + '; '.join(errs[:5]) if errs else '✓ no console errors'}")
    print("→ READ both PNGs: download should match preview — Archivo/Hanken fonts (not")
    print("  Arial fallback), smooth amber rank-badge gradients, correct ranks/AP.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
