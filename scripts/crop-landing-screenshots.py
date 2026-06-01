#!/usr/bin/env python3
"""
Crop the left sidebar out of the real app screenshots the user dropped in
docs/todo/landing/screenshots/, and emit web-ready images to
public/landing/screens/.

Two jobs:
 1. SIDEBAR removal — the app has a fixed left nav rail. We find its full-height
    vertical divider in a tight 11–17% band (≈14% consistently across captures),
    crop a few px to its right, and downscale to ≤1600px wide.
 2. TECH-STACK exclusion — some captures expose vendor/IMO names or the AI voice
    agent (which the product doesn't have) in the app UI itself. Those are listed
    in EXCLUDE and NEVER written: an unreferenced PNG in public/ is still
    publicly downloadable, so it must not ship at all. Survivors are renumbered
    screen-01..NN in order.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

SRC = Path("docs/todo/landing/screenshots")
OUT = Path("public/landing/screens")
OUT.mkdir(parents=True, exist_ok=True)

MAX_W = 1600
BAND_LO, BAND_HI = 0.11, 0.17
FALLBACK = 0.14

# Captures that reveal the tech stack inside the app UI (vendor/IMO names, or the
# AI voice agent the user doesn't have). Identified by visual audit. Excluded so
# they never reach public/. NOTE: macOS screenshot filenames use a NARROW
# NO-BREAK SPACE (U+202F) before AM/PM, so we match the unique, space-free TIME
# TOKEN as a substring rather than the full filename (which never matched).
EXCLUDE_TIME_TOKENS = {
    "5.43.06",  # dashboard w/ Slack + Discord buttons
    "5.43.12",  # 2nd dashboard capture — same Slack/Discord action bar
    "5.45.59",  # "AI VOICE AGENT" (not a real feature)
    "5.46.06",  # Channel Orchestration — Voice Agent / Voice Sessions
    "5.46.28",  # "CLOSE KPI" (vendor name in title)
    "5.46.42",  # workflow — "Generate Close CRM ..."
}


def is_excluded(name: str) -> bool:
    return any(tok in name for tok in EXCLUDE_TIME_TOKENS)


# Full-bleed captures that have NO sidebar (e.g. the /command-center page renders
# without the app nav rail). These must NOT be sidebar-cropped — doing so eats
# real left-edge content (the Command Center's STATUS + TEAM LEADERBOARD column).
# They're only downscaled. Match the same space-free time token.
NO_CROP_TIME_TOKENS = {
    "5.43.01",  # /command-center — full-bleed, no sidebar
}


def is_no_crop(name: str) -> bool:
    return any(tok in name for tok in NO_CROP_TIME_TOKENS)


def detect_sidebar_right(arr: np.ndarray) -> int:
    """Strongest full-height vertical divider within the expected sidebar band."""
    h, w, _ = arr.shape
    gray = arr[:, :, :3].mean(axis=2)
    lo, hi = int(w * BAND_LO), int(w * BAND_HI)
    step = 2
    rows = slice(int(h * 0.08), int(h * 0.92))
    best_x, best_frac = 0, 0.0
    for x in range(lo, hi):
        diff = np.abs(gray[rows, x + step] - gray[rows, x])
        frac = float((diff > 18).mean())
        if frac > best_frac:
            best_frac, best_x = frac, x
    return best_x if best_frac > 0.45 else int(w * FALLBACK)


def main():
    # Dedup case-insensitively (case-insensitive FS) and drop EXCLUDED captures.
    seen, files = set(), []
    for f in sorted(SRC.iterdir()):
        if f.suffix.lower() != ".png":
            continue
        if is_excluded(f.name):
            print(f"SKIP (tech-stack exposed): {f.name!r}")
            continue
        if f.name.lower() in seen:
            continue
        seen.add(f.name.lower())
        files.append(f)
    if not files:
        print("NO SOURCE FILES")
        return

    for i, f in enumerate(files, start=1):
        img = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
        w, h = img.size
        if is_no_crop(f.name):
            cropped = img  # full-bleed page, no sidebar to remove
            cut = 0
            x = -1
        else:
            x = detect_sidebar_right(np.asarray(img))
            cut = x + 6  # clear the divider's border line
            cropped = img.crop((cut, 0, w, h))
        cw, ch = cropped.size
        if cw > MAX_W:
            ratio = MAX_W / cw
            cropped = cropped.resize((MAX_W, int(ch * ratio)), Image.LANCZOS)
        out_name = f"screen-{i:02d}.png"
        cropped.save(OUT / out_name, optimize=True)
        tag = "NO-CROP (full-bleed)" if cut == 0 else f"cut@{cut}/{w} (edge {x})"
        print(f"{out_name}  {tag}  -> {cropped.size}  [{f.name}]")

    print(f"\nWROTE {len(files)} files to {OUT}/ (excluded {len(EXCLUDE_TIME_TOKENS)})")


if __name__ == "__main__":
    sys.exit(main())
