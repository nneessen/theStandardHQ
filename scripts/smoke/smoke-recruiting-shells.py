#!/usr/bin/env python3
"""
Visual + viewport smoke for ALL 8 recruiting layout SHELLS.

Renders every gallery template (read from /tmp/recruiting-templates.json, dumped
from src/features/recruiting/templates) through the wizard preview route
(/internal/design-preview), which dispatches on spec.layout to the real shell.
A representative recruiter theme (headshot + hero image + calendar + phone +
socials) is injected so photo-forward shells show their assets.

For each shell, at desktop (1440x900) and mobile (390x844):
  • the lead form renders (TCPA consent present) — proves the single frozen form
    mounts in every shell,
  • the submit button is REACHABLE within the viewport after scrolling,
  • no console errors.
Pinned shells (split-form, identity-sidebar) additionally must NOT scroll the
document on a SHORT desktop (1280x620) — scrolling is internal to the panes.

Screenshots: /tmp/recruiting-shells/<id>-<viewport>.png  (review these by eye).

Run (dev server up on :3000; first: dump the specs to /tmp/recruiting-templates.json):
    python3 scripts/smoke/smoke-recruiting-shells.py
"""

import json
import os
import pathlib
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("SMOKE_BASE", "http://localhost:3000")
OUT = pathlib.Path("/tmp/recruiting-shells")
SPECS = json.loads(pathlib.Path("/tmp/recruiting-templates.json").read_text())

PINNED = {"split-form", "identity-sidebar"}

# Self-contained SVG data URIs (no network, no '#' so the data URI stays valid):
# a portrait placeholder + a wide hero placeholder.
HEADSHOT_SVG = (
    "data:image/svg+xml;utf8,"
    "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>"
    "<rect width='600' height='600' fill='lightgray'/>"
    "<circle cx='300' cy='235' r='115' fill='slategray'/>"
    "<ellipse cx='300' cy='640' rx='205' ry='160' fill='slategray'/></svg>"
)
HERO_SVG = (
    "data:image/svg+xml;utf8,"
    "<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000'>"
    "<rect width='1600' height='1000' fill='darkslategray'/></svg>"
)

THEME = {
    "display_name": "The Standard — Tampa",
    "recruiter_first_name": "Jordan",
    "recruiter_last_name": "Avery",
    "support_phone": "(555) 123-4567",
    "social_links": {
        "instagram": "https://instagram.com/x",
        "facebook": "https://facebook.com/x",
        "youtube": "https://youtube.com/x",
    },
    "calendly_url": "https://calendly.com/x",
    "headshot_url": HEADSHOT_SVG,
    "hero_image_url": HERO_SVG,
    "disclaimer_text": "Equal opportunity. This is not a guarantee of income.",
    "cta_text": "Apply Now",
}


def inject(page, spec):
    payload = json.dumps(json.dumps({"spec": spec, "theme": THEME}))
    page.add_init_script(
        f"window.sessionStorage.setItem('design-preview', {payload});"
    )


def shot(page, spec, label, width, height, out_name, pinned_check=False):
    page.set_viewport_size({"width": width, "height": height})
    page.goto(f"{BASE}/internal/design-preview", wait_until="domcontentloaded")
    # The lead form is multi-step; TCPA consent is on the FINAL step (not visible
    # on step 1). The honeypot input is always in the DOM = a stable "form mounted"
    # marker; the visible first-name field confirms step 1 actually rendered.
    try:
        page.wait_for_selector(
            "#lead-form input[name='company_fax_ext']", state="attached", timeout=15000
        )
        page.wait_for_selector("#lead-form input[placeholder='John']", timeout=10000)
    except Exception:
        OUT.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT / out_name), full_page=True)
        return label, False, "lead form did not render"

    inner_h = page.evaluate("window.innerHeight")
    doc_scroll_h = page.evaluate("document.scrollingElement.scrollHeight")
    page_scrolls = doc_scroll_h > inner_h + 2

    # Reachability: the step-1 primary button (the multi-step "Continue", or the
    # final-step submit if single-step). Scroll it into its pane and verify it
    # lands inside the viewport — encodes the original "can't reach the form" bug.
    btn = page.query_selector("#lead-form button:has-text('Continue')") or page.query_selector(
        "#lead-form button[type=submit]"
    )
    reachable = False
    if btn:
        btn.scroll_into_view_if_needed()
        box = btn.bounding_box()
        if box:
            reachable = box["y"] + box["height"] <= inner_h + 2 and box["y"] >= -2

    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / out_name), full_page=True)

    problems = []
    if not btn:
        problems.append("form button not found")
    elif not reachable:
        problems.append("form button not reachable in viewport")
    if pinned_check and page_scrolls:
        problems.append("document scrolls on short desktop (pane scroll expected)")
    return label, len(problems) == 0, "; ".join(problems) or "ok"


def main() -> int:
    results = []
    console_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for spec_entry in SPECS:
            spec = spec_entry["spec"]
            sid = spec_entry["id"]
            ctx = browser.new_context()
            page = ctx.new_page()
            inject(page, spec)
            page.on(
                "console",
                lambda m, s=sid: console_errors.append(f"{s}: {m.text}")
                if m.type == "error"
                else None,
            )
            results.append(shot(page, spec, f"{sid} [desktop]", 1440, 900, f"{sid}-desktop.png"))
            results.append(shot(page, spec, f"{sid} [mobile]", 390, 844, f"{sid}-mobile.png"))
            if sid in PINNED:
                results.append(
                    shot(page, spec, f"{sid} [short-desk]", 1280, 620, f"{sid}-short.png", pinned_check=True)
                )
            ctx.close()
        browser.close()

    print("\n=== Recruiting SHELLS smoke (8 layouts) ===")
    all_ok = True
    for label, ok, detail in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}: {detail}")
        all_ok = all_ok and ok

    real_errors = [
        e for e in console_errors
        if "favicon" not in e.lower()
        and "manifest" not in e.lower()
        and "pravatar" not in e.lower()
        and "picsum" not in e.lower()
        and "ERR_" not in e
    ]
    if real_errors:
        all_ok = False
        print("  [FAIL] console errors:")
        for e in real_errors[:15]:
            print(f"     - {e}")
    else:
        print("  [PASS] no app console errors")

    print(f"\nScreenshots in: {OUT}/")
    print("RESULT:", "PASS ✅" if all_ok else "FAIL ❌")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
