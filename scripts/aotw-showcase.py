#!/usr/bin/env python3
"""
Owner-facing SHOWCASE of the Agent-of-the-Week Step-3 customization controls.

Renders a curated grid of font / background / size combinations across all three
designs (aurora / editorial / noir) — produced through the REAL in-app "Download PNG"
path (client html-to-image), NOT the render harness, so every PNG is exactly what the
owner gets when they click Download. Saves to /tmp/aotw-showcase/.

Usage:
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (owner)
    python3 scripts/aotw-showcase.py
"""

import os
import re
import sys
import zlib
import struct
import pathlib
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/aotw-showcase")

# design, font label (None = design default), bg preset title (None), use bg image, agency scale
COMBOS = [
    ("aurora-1-default",            "aurora",    None,                  None,      False, 1.0),
    ("aurora-2-clash-indigo",       "aurora",    "Clash Display",       "Indigo",  False, 1.0),
    ("aurora-3-satoshi-bgimage",    "aurora",    "Satoshi",             None,      True,  1.5),
    ("editorial-1-default",         "editorial", None,                  None,      False, 1.0),
    ("editorial-2-bricolage-blush", "editorial", "Bricolage Grotesque", "Blush",   False, 1.6),
    ("editorial-3-generalsans-slate","editorial","General Sans",        "Slate",   False, 1.0),
    ("noir-1-default",              "noir",      None,                  None,      False, 1.0),
    ("noir-2-clash-emerald",        "noir",      "Clash Display",       "Emerald", False, 1.0),
    ("noir-3-generalsans-bgimage",  "noir",      "General Sans",        None,      True,  1.0),
]


def mk_gradient(path, w=1080, h=1080, top=(46, 16, 84), bot=(8, 84, 92)):
    """Vertical gradient PNG (no PIL) used as a stand-in 'brand photo' background."""
    raw = bytearray()
    for y in range(h):
        t = y / (h - 1)
        r = int(top[0] + (bot[0] - top[0]) * t)
        g = int(top[1] + (bot[1] - top[1]) * t)
        b = int(top[2] + (bot[2] - top[2]) * t)
        raw.append(0)
        raw.extend(bytes((r, g, b)) * w)

    def chunk(typ, data):
        body = typ + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def set_agency_scale(page, target):
    """Agency-name slider is the 2nd <Slider> (Name size is 1st). Normalize to min then step up."""
    thumb = page.get_by_role("slider").nth(1)
    thumb.click()
    thumb.press("Home")  # min = 1.0
    for _ in range(round((target - 1.0) / 0.1)):
        thumb.press("ArrowRight")
    page.wait_for_timeout(150)


def set_font(page, label):
    cb = page.get_by_role("combobox").nth(1)  # 0 = super-admin "Act as IMO", 1 = font
    cb.click()
    page.wait_for_timeout(300)
    name = "Design default" if label is None else label
    page.get_by_role("option", name=re.compile(rf"^{re.escape(name)}$", re.I)).first.click()
    page.wait_for_timeout(400)


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    bg_img = "/tmp/aotw-showcase-bg.png"
    mk_gradient(bg_img)
    face = "/tmp/aotw-showcase-face.jpg"
    try:
        urllib.request.urlretrieve("https://i.pravatar.cc/640?img=15", face)
    except Exception as ex:
        print(f"   ℹ no agent face fetched ({ex}) — cards use the monogram fallback")
        face = None

    saved = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
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
        page.get_by_role("button", name=re.compile(r"^agent of week$", re.I)).first.click()
        page.wait_for_timeout(800)

        # Upload the agent face ONCE (persists across design/font/bg changes).
        if face:
            page.locator('input[type=file]').first.set_input_files(face)
            try:
                page.wait_for_selector("img[alt='Agent']", timeout=15000)
            except Exception:
                print("   ⚠ face thumbnail never appeared")
        page.wait_for_timeout(500)

        for key, design, font, bg, bgimg, agency in COMBOS:
            # Design FIRST — it resets the background to the design default.
            page.get_by_role("button", name=re.compile(rf"^{design}$", re.I)).first.click()
            page.wait_for_timeout(500)
            set_font(page, font)
            if agency != 1.0:
                set_agency_scale(page, agency)
            else:
                set_agency_scale(page, 1.0)  # normalize back from any prior combo
            if bgimg:
                page.locator('label[title="Upload a background image"] input[type=file]').first.set_input_files(bg_img)
                page.wait_for_timeout(1000)
            elif bg:
                page.locator(f'button[title="{bg}"]').first.click()
                page.wait_for_timeout(400)
            # else: default bg (already reset by the design switch)

            page.wait_for_timeout(500)
            dl = page.get_by_role("button", name=re.compile(r"download png", re.I))
            if not (dl.count() and dl.first.is_enabled()):
                print(f"   ✗ {key}: download disabled (sample mode?) — skipped")
                continue
            try:
                with page.expect_download(timeout=25000) as d:
                    dl.first.click()
                out = OUT / f"{key}.png"
                d.value.save_as(str(out))
                saved.append(out)
                print(f"   ✓ {key}")
            except Exception as ex:
                print(f"   ✗ {key}: {ex}")
        browser.close()

    print(f"\n✓ {len(saved)}/{len(COMBOS)} showcase cards saved to {OUT}/")
    print(f"  open: open {OUT}")
    return 0 if len(saved) == len(COMBOS) else 1


if __name__ == "__main__":
    sys.exit(main())
