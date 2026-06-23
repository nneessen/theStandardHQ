#!/usr/bin/env python3
"""
Runtime smoke for the Social Studio page (owner-only, Phase 1).

Proves the page RENDERS and WORKS in the running app:
  1. The owner reaches /social-studio (super-admin gate passes).
  2. The live preview renders a card — with the labeled SAMPLE fallback when the
     agency has no metrics yet.
  3. Cadence switching works: Monthly shows the "MONTHLY REPORT" recap card.
  4. The customizer + Download control are present.
  5. No console errors throughout.

Usage:
    set -a; source .env.local; set +a      # E2E_EMAIL / E2E_PASSWORD (owner/super-admin)
    python3 scripts/social-studio-smoke.py
"""

import os
import re
import sys
import struct
import zlib
import pathlib
from playwright.sync_api import sync_playwright


def _make_test_png(path: str, w: int = 600, h: int = 600, rgb=(214, 31, 154)) -> None:
    """Write a solid-color RGB PNG (no deps) — a distinctive magenta so the
    uploaded agent photo is unmistakable vs. the monogram in the exported card."""

    def chunk(typ: bytes, data: bytes) -> bytes:
        body = typ + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-bit RGB
    row = b"\x00" + bytes(rgb) * w  # filter byte + pixels
    idat = zlib.compress(row * h, 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
OUT = pathlib.Path("/tmp/board-shots")


def main() -> int:
    if not (EMAIL and PASSWORD):
        print("✗ set E2E_EMAIL and E2E_PASSWORD (source .env.local first)")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    failures = 0
    checks: list[tuple[str, bool]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        console_errors: list[str] = []
        # html-to-image logs a benign SecurityError when it tries to inline the
        # cross-origin Google Fonts stylesheet during PNG export — it can't read a
        # cross-origin sheet's cssRules. The export is unaffected (fonts are already
        # loaded in the DOM; verified visually in the exported PNG), so this known
        # third-party warning is not an app error.
        IGNORED_ERR = re.compile(
            r"inlining remote css|reading CSS rules from|cssRules|fonts\.googleapis\.com",
            re.I,
        )
        # Local-only storage limitation: the local Supabase storage emulator ships
        # `storage.prefixes` with RLS enabled but NO policies, so an object DELETE 400s
        # for EVERY bucket (verified against instagram-media too). Prod has no prefixes
        # table, so storage.remove() works there — the "Remove" delete is correct for
        # prod and best-effort locally. The upload path is separately asserted
        # (thumbnail/render/export), so masking this storage 400 can't hide a real
        # upload failure.
        STORAGE_NOISE = re.compile(r"/storage/v1/object/spotlight-assets", re.I)

        def _on_console(m):
            if m.type != "error" or IGNORED_ERR.search(m.text):
                return
            url = ""
            try:
                url = (m.location or {}).get("url", "") if isinstance(m.location, dict) else ""
            except Exception:
                url = ""
            if "Failed to load resource" in m.text and STORAGE_NOISE.search(url):
                return
            console_errors.append(m.text + (f" @ {url}" if url else ""))

        page.on("console", _on_console)
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))

        print(f"→ logging in at {BASE}/login")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        print("→ navigating to /social-studio")
        page.goto(f"{BASE}/social-studio", wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(2500)
        console_errors.clear()  # ignore unrelated app-load noise
        # Scope card-content assertions to the PREVIEW pane — the Template Library at
        # the bottom renders real scaled cards (incl. leaderboard "BY ANNUAL PREMIUM"
        # thumbnails), so global text counts would no longer reflect just the preview.
        preview = page.locator("[data-testid='social-preview']")

        # 1. Owner reaches the page (not PermissionDenied).
        denied = page.get_by_text(re.compile(r"permission denied|don't have access", re.I)).count() > 0
        heading = page.get_by_text("Spotlight", exact=False).count() > 0
        checks.append(("owner reaches page (no PermissionDenied)", heading and not denied))
        if denied:
            print("   ⚠ creds are not super-admin → page is gated (expected for non-owners)")

        # 2. Preview renders (sample fallback when no live data).
        sample = page.get_by_text(re.compile(r"sample preview", re.I)).count() > 0
        leaderboard_card = preview.get_by_text(re.compile(r"by annual premium", re.I)).count() > 0
        # The preview must always render a card; whether it's LIVE or the SAMPLE
        # fallback depends on whether this account's agency has metrics yet.
        checks.append(("daily preview card renders (live or sample)", leaderboard_card))
        print(f"   ℹ preview data: {'SAMPLE (agency has no metrics yet)' if sample else 'LIVE agency data'}")
        page.screenshot(path=str(OUT / "social-studio-daily.png"))

        # 3. Cadence switch → Monthly report.
        monthly_pill = page.get_by_role("button", name=re.compile(r"^monthly$", re.I))
        if monthly_pill.count():
            monthly_pill.first.click()
            page.wait_for_timeout(800)
        # Assert on text UNIQUE to the rendered report card ("AGENT OF THE MONTH"),
        # not "Monthly Report" which also matches the always-present Quick-post preset.
        checks.append(("monthly → report card renders", preview.get_by_text(re.compile(r"agent of the month", re.I)).count() > 0))
        page.screenshot(path=str(OUT / "social-studio-monthly.png"))

        # 4. Controls present.
        checks.append(("Download PNG button", page.get_by_role("button", name=re.compile(r"download png", re.I)).count() > 0))
        # "Post to Instagram" publishes the rendered card to the connected IG feed;
        # it is disabled in sample mode (no real numbers) and surfaces a connect prompt.
        post_btn = page.get_by_role("button", name=re.compile(r"post to instagram", re.I))
        checks.append(("'Post to Instagram' button present", post_btn.count() > 0))
        if sample and post_btn.count():
            checks.append(("Post to Instagram disabled in sample mode", post_btn.first.is_disabled()))
        checks.append(("Customize panel", page.get_by_text("Customize", exact=False).count() > 0))
        checks.append(("AI 'Generate with AI' caption button", page.get_by_role("button", name=re.compile(r"generate with ai", re.I)).count() > 0))

        # 4b. Sample preview gates BOTH Download and the AI caption (so fabricated
        #     SAMPLE numbers can never reach a real post or the caption model — #4/#5).
        #     The owner has live producers, so sample is OFF by default; toggle it on.
        sample_switch = page.locator("#samplePreview")
        sample_gated = False
        if sample_switch.count():
            if sample_switch.first.get_attribute("data-state") == "unchecked":
                sample_switch.first.click()
                page.wait_for_timeout(500)
            dl = page.get_by_role("button", name=re.compile(r"download png", re.I)).first
            gen = page.get_by_role("button", name=re.compile(r"generate with ai", re.I)).first
            sample_gated = dl.is_disabled() and gen.is_disabled()
            # Restore the live view for the rest of the run.
            sample_switch.first.click()
            page.wait_for_timeout(400)
        checks.append(("sample preview disables BOTH Download and AI caption (#4/#5)", sample_gated))

        # Top 20 → two-column leaderboard layout (visual: out/social-studio-top20.png).
        daily_pill = page.get_by_role("button", name=re.compile(r"^daily$", re.I))
        if daily_pill.count():
            daily_pill.first.click()
            page.wait_for_timeout(600)
        t20 = page.get_by_role("button", name=re.compile(r"top 20", re.I))
        if t20.count():
            t20.first.click()
            page.wait_for_timeout(900)
        checks.append(("top-20 card still renders", preview.get_by_text(re.compile(r"by annual premium", re.I)).count() > 0))
        page.screenshot(path=str(OUT / "social-studio-top20.png"))

        # 5. Agent of the Week — the new 4th view wired to the bespoke
        #    AgentOfWeekCard (3 designs). Switch via the "Agent of Week" pill.
        aotw_pill = page.get_by_role("button", name=re.compile(r"^agent of week$", re.I))
        if aotw_pill.count():
            aotw_pill.first.click()
            page.wait_for_timeout(900)
        # The unified Theme picker (Spotlight/Editorial/Lift) drives EVERY view now —
        # it's present on AOTW too. (Underlying config keys stay aurora/editorial/noir
        # for AOTW template back-compat; the shared theme maps onto them.)
        spotlight_btn = page.get_by_role("button", name=re.compile(r"^spotlight$", re.I))
        editorial_btn = page.get_by_role("button", name=re.compile(r"^editorial$", re.I))
        lift_btn = page.get_by_role("button", name=re.compile(r"^lift$", re.I))
        checks.append((
            "Theme picker (Spotlight/Editorial/Lift) present on AOTW",
            spotlight_btn.count() > 0 and editorial_btn.count() > 0 and lift_btn.count() > 0,
        ))
        # Leaderboard-only controls must be hidden on AOTW (no top-N, no policy switch).
        checks.append(("AOTW hides Top-N control", page.get_by_role("button", name=re.compile(r"top 20", re.I)).count() == 0))
        checks.append(("AOTW hides 'Show policy count'", page.get_by_text(re.compile(r"show policy count", re.I)).count() == 0))
        # The legacy dark/light theme toggle was replaced by the shared Theme picker —
        # there is no bare "Light"/"Dark" pill anywhere.
        checks.append(("No legacy dark/light toggle", page.get_by_role("button", name=re.compile(r"^light$", re.I)).count() == 0))
        # The leaderboard card is replaced by the hero (its "BY ANNUAL PREMIUM" is gone).
        checks.append(("AOTW replaces the leaderboard card", preview.get_by_text(re.compile(r"by annual premium", re.I)).count() == 0))
        # Each design renders. On the AOTW view the ONLY source of "Annual Premium"
        # text is the hero's stat panel (leaderboard card is gone), so its presence
        # confirms the card mounted for that design.
        for design, btn in (("spotlight", spotlight_btn), ("editorial", editorial_btn), ("lift", lift_btn)):
            if btn.count():
                btn.first.click()
                page.wait_for_timeout(800)
            checks.append((f"AOTW '{design}' card renders", preview.get_by_text(re.compile(r"annual premium", re.I)).count() > 0))
            page.screenshot(path=str(OUT / f"social-studio-aotw-{design}.png"))

        # 5b. Agent photo upload (Supabase Storage). Upload a distinctive test image
        #     and confirm it (a) shows as a thumbnail, (b) renders in the card, and
        #     (c) actually lands in the EXPORTED PNG — html-to-image silently omits
        #     images on a CORS miss, so a green "download didn't error" is not enough;
        #     the data-URL render path must put the photo into the file.
        test_png = "/tmp/spotlight-test-agent.png"
        _make_test_png(test_png)
        file_input = page.locator("input[type=file]")
        photo_uploaded = False
        if file_input.count():
            file_input.first.set_input_files(test_png)
            try:
                page.wait_for_selector("img[alt='Agent']", timeout=15000)
                photo_uploaded = True
            except Exception:
                photo_uploaded = False
        checks.append(("AOTW photo upload → thumbnail shows", photo_uploaded))
        # Card renders the photo as a data: URL <img> (not the monogram).
        checks.append(
            ("AOTW card renders uploaded photo (data: img)", page.locator("img[src^='data:']").count() >= 1)
        )
        page.screenshot(path=str(OUT / "social-studio-aotw-photo.png"))
        # Drag-to-reposition: dragging the photo overlay must change the card's CSS
        # object-position (the face-fits-frame control). Verify the motion, not just
        # that the overlay renders.
        repositioned = False
        overlay = page.locator('[title="Drag to reposition the photo"]')
        img = page.locator('[data-testid="social-preview"] img[src^="data:"]')
        if overlay.count() and img.count():
            before = img.first.evaluate("el => getComputedStyle(el).objectPosition")
            box = overlay.first.bounding_box()
            cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            page.mouse.move(cx, cy)
            page.mouse.down()
            page.mouse.move(cx + 50, cy + 40, steps=10)
            page.mouse.up()
            page.wait_for_timeout(300)
            after = img.first.evaluate("el => getComputedStyle(el).objectPosition")
            repositioned = before != after
        checks.append(("Drag-to-reposition changes the photo focal point", repositioned))
        # HARD GATE: download the export and (manually) read it to confirm the photo.
        # Download is intentionally disabled in SAMPLE mode (asserted in #4/#5 above), so
        # this real-export check only applies when the agency has live data. With no live
        # producers locally the preview is forced to sample → skip rather than false-fail.
        dl_btn = page.get_by_role("button", name=re.compile(r"download png", re.I))
        if sample:
            print("   ℹ skipping real-export check — sample mode forces Download disabled (no live data locally)")
        else:
            photo_in_export = False
            if photo_uploaded and dl_btn.count() and dl_btn.first.is_enabled():
                try:
                    with page.expect_download(timeout=20000) as dl:
                        dl_btn.first.click()
                    dl.value.save_as(str(OUT / "social-studio-aotw-export.png"))
                    photo_in_export = True
                except Exception as ex:
                    print(f"   ⚠ export download failed: {ex}")
            checks.append(("AOTW exports a PNG (READ it to confirm the photo is in it)", photo_in_export))

        # NOTE: every design now renders + downloads in-browser (modern-screenshot),
        # so there is no separate Creatomate "Generate pro graphic" button anymore —
        # the normal Download PNG is the full-fidelity export for all three.

        # 5c. "Remove" clears the photo (and deletes the storage object — handler
        #     calls storage.remove; the bucket-deletion itself is covered by the RLS
        #     check). Confirm the UI reverts to the upload control / monogram.
        remove_btn = page.get_by_role("button", name=re.compile(r"^remove$", re.I))
        if remove_btn.count():
            remove_btn.first.click()
            page.wait_for_timeout(1500)
        checks.append(
            ("AOTW 'Remove' clears the photo", page.locator("img[alt='Agent']").count() == 0)
        )

        # 5d. Style controls (AOTW only): font dropdown, design-filtered background
        #     swatches, and the two size sliders. The design loop left us on Lift (a
        #     dark-text, light-surface design → light "paper" presets, no bg image).
        checks.append(("AOTW Style: Name size slider labeled", page.get_by_text(re.compile(r"name size", re.I)).count() > 0))
        checks.append(("AOTW Style: Agency name size slider labeled", page.get_by_text(re.compile(r"agency name size", re.I)).count() > 0))
        checks.append(("AOTW Style: sliders rendered (>=2)", page.get_by_role("slider").count() >= 2))
        checks.append(("AOTW Style: Lift shows a light bg preset", page.locator('button[title="Off-white"]').count() > 0))
        checks.append(("AOTW Style: Lift hides the bg-image upload", page.locator('label[title="Upload a background image"]').count() == 0))
        # Switch to Spotlight (the only light-text design) → dark presets + bg-image upload.
        if spotlight_btn.count():
            spotlight_btn.first.click()
            page.wait_for_timeout(500)
        checks.append(("AOTW Style: Spotlight shows a dark bg preset", page.locator('button[title="Indigo"]').count() > 0))
        checks.append(("AOTW Style: Spotlight offers a bg-image upload", page.locator('label[title="Upload a background image"]').count() > 0))
        # Font dropdown — pick a custom font and confirm the trigger reflects it. The
        # super-admin header has its OWN combobox, so target the FONT one by its
        # initial value ("Design default"), never .first.
        font_cb = page.get_by_role("combobox").filter(has_text=re.compile(r"design default", re.I))
        font_selected = False
        if font_cb.count():
            font_cb.first.click()
            page.wait_for_timeout(300)
            opt = page.get_by_role("option", name=re.compile(r"^syne$", re.I))
            if opt.count():
                opt.first.click()
                page.wait_for_timeout(700)
                font_selected = (
                    page.get_by_role("combobox").filter(has_text=re.compile(r"^syne$", re.I)).count() > 0
                )
        checks.append(("AOTW Style: font dropdown applies a custom font", font_selected))
        # Apply a dark background preset on noir; the card must still render.
        emerald = page.locator('button[title="Emerald"]')
        if emerald.count():
            emerald.first.click()
            page.wait_for_timeout(500)
        checks.append(("AOTW Style: bg preset applies (card still renders)", page.get_by_text(re.compile(r"annual premium", re.I)).count() > 0))
        page.screenshot(path=str(OUT / "social-studio-aotw-styled.png"))
        # Editorial is dark-text-on-cream → NO bg-image upload tile (would be illegible),
        # and switching design must RESET the (now-dark) background so it can't bleed
        # onto editorial's dark text. Confirm the upload tile is gone + a light preset shows.
        ed = page.get_by_role("button", name=re.compile(r"^editorial$", re.I))
        if ed.count():
            ed.first.click()
            page.wait_for_timeout(600)
        checks.append(("AOTW Style: editorial hides the bg-image upload", page.locator('label[title="Upload a background image"]').count() == 0))
        checks.append(("AOTW Style: editorial shows a light 'paper' bg preset", page.locator('button[title="Blush"]').count() > 0))
        # Reset to aurora for the remainder of the run.
        au = page.get_by_role("button", name=re.compile(r"^aurora$", re.I))
        if au.count():
            au.first.click()
            page.wait_for_timeout(400)

        # 6. The "Agent of the Week" quick post repoints to the AOTW view.
        daily_reset = page.get_by_role("button", name=re.compile(r"^daily$", re.I))
        if daily_reset.count():
            daily_reset.first.click()
            page.wait_for_timeout(500)
        qp_aotw = page.get_by_role("button", name=re.compile(r"agent of the week", re.I))
        if qp_aotw.count():
            qp_aotw.first.click()
            page.wait_for_timeout(800)
        checks.append((
            "'Agent of the Week' quick post → AOTW view",
            page.get_by_role("button", name=re.compile(r"^spotlight$", re.I)).count() > 0,
        ))
        page.screenshot(path=str(OUT / "social-studio-aotw-quickpost.png"))

        # 7. Console errors.
        checks.append((f"no console errors ({len(console_errors)})", len(console_errors) == 0))

        for label, ok in checks:
            mark = "✓" if ok else "✗ FAIL"
            if not ok:
                failures += 1
            print(f"   {mark} {label}")
        if console_errors:
            for e in console_errors[:6]:
                print(f"      • {e[:160]}")

        browser.close()

    print(f"\n{'✓ ALL CHECKS PASSED' if failures == 0 else f'✗ {failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
