#!/usr/bin/env python3
"""
Export-fidelity probe for the Agent-of-the-Week aurora design.

WHY THIS EXISTS (separate from the render harness): the render harness
(scripts/leaderboard-card-render/run.mjs) screenshots with Playwright's NATIVE
`element.screenshot()` — a real browser, flawless fidelity. The user's actual
"Download PNG" goes through `html-to-image` (SVG <foreignObject> → canvas), which
is LOSSY on backdrop-blur, custom gradients, and cross-origin webfonts. Those are
DIFFERENT renderers, so a great-looking harness PNG proves nothing about the real
download. This probe drives the REAL in-app download path and saves the file so a
human (or the agent) can READ it and confirm:
  • the design fonts actually EMBED (not a system fallback), and
  • the aurora "glass" backdrop-blur survives html-to-image.

Usage:
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (owner)
    python3 scripts/aotw-export-probe.py [aurora|editorial|noir] [FontLabel]
    # e.g. ... aurora "Clash Display"   → also exercises the font dropdown so we can
    #   confirm a runtime-selected (Fontshare) font actually EMBEDS in the export.
"""

import os
import re
import sys
import struct
import zlib
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")
DESIGN = (sys.argv[1] if len(sys.argv) > 1 else "aurora").lower()
FONT_LABEL = sys.argv[2] if len(sys.argv) > 2 else None


def _make_test_png(path: str, w: int = 600, h: int = 600, rgb=(214, 31, 154)) -> None:
    def chunk(typ: bytes, data: bytes) -> bytes:
        body = typ + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    row = b"\x00" + bytes(rgb) * w
    idat = zlib.compress(row * h, 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
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
        page.get_by_role("button", name=re.compile(rf"^{DESIGN}$", re.I)).first.click()
        page.wait_for_timeout(800)

        # Optionally drive the Font dropdown so we confirm a RUNTIME-selected font
        # (e.g. a Fontshare family) actually embeds in the html-to-image export.
        if FONT_LABEL:
            # NB: the super-admin header has its own "Act as IMO" combobox, so target
            # the FONT select by its initial value ("Design default"), not .first.
            trigger = page.get_by_role("combobox").filter(has_text="Design default").first
            trigger.click()
            page.wait_for_timeout(300)
            page.get_by_role("option", name=re.compile(rf"^{re.escape(FONT_LABEL)}$", re.I)).first.click()
            page.wait_for_timeout(1200)
            out_suffix = "-" + FONT_LABEL.lower().replace(" ", "")
        else:
            out_suffix = ""

        # Upload a distinctive photo so we also confirm the image embeds in the export.
        test_png = "/tmp/spotlight-probe-agent.png"
        _make_test_png(test_png)
        fi = page.locator("input[type=file]")
        if fi.count():
            fi.first.set_input_files(test_png)
            try:
                page.wait_for_selector("img[alt='Agent']", timeout=15000)
            except Exception:
                print("   ⚠ photo thumbnail never appeared")
        page.wait_for_timeout(800)

        dl = page.get_by_role("button", name=re.compile(r"download png", re.I))
        if not (dl.count() and dl.first.is_enabled()):
            print("✗ Download disabled (sample mode?) — cannot probe export")
            browser.close()
            return 4
        out_path = OUT / f"aotw-{DESIGN}{out_suffix}-REAL-export.png"
        try:
            with page.expect_download(timeout=25000) as d:
                dl.first.click()
            d.value.save_as(str(out_path))
        except Exception as ex:
            print(f"✗ export download failed: {ex}")
            browser.close()
            return 5
        browser.close()

    # Report dimensions so we know it's the full 1080px card.
    with open(out_path, "rb") as f:
        head = f.read(24)
    w = struct.unpack(">I", head[16:20])[0]
    h = struct.unpack(">I", head[20:24])[0]
    size_kb = out_path.stat().st_size // 1024
    print(f"✓ saved {out_path}  ({w}×{h}px, {size_kb}KB)")
    print("→ READ this PNG to confirm: (1) Unbounded/display font (not Arial fallback),")
    print("  (2) the aurora glass stat-panel blur, (3) the magenta agent photo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
