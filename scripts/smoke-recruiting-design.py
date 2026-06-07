#!/usr/bin/env python3
"""
Smoke test for the AI-composed recruiting landing page (AiComposedLayout).

This is the ONE test that proves the original complaint is fixed: the lead form
must FIT THE VIEWPORT — reachable + scrollable, never clipped top/bottom. jsdom
has no layout engine, so the unit tests can't verify this; only a real browser
can. We render the actual AiComposedLayout via the wizard's preview route
(/internal/design-preview), injecting a deliberately TALL spec via sessionStorage
so no backend or auth is required.

Run (dev server must be up on :3000):
    python3 scripts/smoke-recruiting-design.py

Asserts, on a deliberately SHORT desktop viewport (1280x620):
  1. The page (document) does NOT scroll — scrolling is internal to the panes.
  2. The form's submit button is REACHABLE within the viewport after scrolling
     its pane (the "can't reach the bottom" bug, encoded).
  3. The legally-required TCPA consent text is present.
  4. No console errors.
Then repeats the reachability check at mobile width (390x740) where the page
scrolls naturally.

Writes screenshots to /tmp/recruiting-design/.
"""

import json
import os
import pathlib
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("SMOKE_BASE", "http://localhost:3000")
OUT = pathlib.Path("/tmp/recruiting-design")

# A deliberately tall spec: hero + stats + 6-item value grid + about + testimonial
# + form + contact + footer. The right-hand form panel is the tall element.
SPEC = {
    "version": 1,
    "theme": {
        "palette": {"primary": "#1d4ed8", "accent": "#f59e0b"},
        "mode": "light",
        "font_pairing": "editorial",
        "radius": "sharp",
        "background_style": "topo-grid",
    },
    "blocks": [
        {"id": "h", "type": "hero", "variant": "split", "eyebrow": "Recruiting Now",
         "headline": "Build a career in insurance",
         "subhead": "AI-scored leads, full training, and uncapped earnings. We give you the tools and the team to win.",
         "primary_cta": "Apply Now", "secondary_cta": "none"},
        {"id": "s", "type": "stats", "style": "lattice", "items": [
            {"icon": "dollar-sign", "value": "$20K+", "label": "Avg. monthly"},
            {"icon": "network", "value": "30+", "label": "Carriers"},
            {"icon": "shield", "value": "100%", "label": "In-house"}]},
        {"id": "v", "type": "value_grid", "heading": "Why join us", "items": [
            {"icon": "dollar-sign", "title": "Uncapped earnings"},
            {"icon": "zap", "title": "Latest tech"},
            {"icon": "book-open", "title": "Full training"},
            {"icon": "clock", "title": "Flexible schedule"},
            {"icon": "rocket", "title": "Build a business"},
            {"icon": "users", "title": "Mentorship"}]},
        {"id": "a", "type": "about", "heading": "About",
         "body": "Founded by agents, for agents. We built the operating system we always wished we had."},
        {"id": "t", "type": "testimonial",
         "quote": "I tripled my income in my first year here.", "attribution": "A real agent"},
        {"id": "f", "type": "form", "eyebrow": "Apply", "heading": "Express Your Interest",
         "subcopy": "Fill out the form and we'll be in touch within 24-48 hours.", "cta_text": "Apply Now"},
        {"id": "c", "type": "contact", "show_phone": True, "show_socials": True},
        {"id": "ft", "type": "footer", "show_copyright": True},
    ],
}

THEME = {
    "display_name": "The Standard",
    "primary_color": "#1d4ed8",
    "accent_color": "#f59e0b",
    "support_phone": "(555) 123-4567",
    "social_links": {"instagram": "https://instagram.com/x"},
    "calendly_url": None,
    "disclaimer_text": "Equal opportunity. Not a guarantee of income.",
    "cta_text": "Apply Now",
}

INIT = (
    "window.sessionStorage.setItem('design-preview', %s);"
    % json.dumps(json.dumps({"spec": SPEC, "theme": THEME}))
)


def check(page, label, width, height, expect_no_page_scroll):
    page.set_viewport_size({"width": width, "height": height})
    page.goto(f"{BASE}/internal/design-preview", wait_until="networkidle")
    # Wait for the form (TCPA text is the stable anchor).
    page.wait_for_selector("text=prior express written consent", timeout=15000)

    inner_h = page.evaluate("window.innerHeight")
    doc_scroll_h = page.evaluate("document.scrollingElement.scrollHeight")
    page_scrolls = doc_scroll_h > inner_h + 2

    # Scroll the submit button into view within its pane, then measure.
    btn = page.query_selector("#lead-form button[type=submit]")
    if not btn:
        return label, False, "submit button not found"
    btn.scroll_into_view_if_needed()
    box = page.evaluate(
        """() => {
            const b = document.querySelector('#lead-form button[type=submit]');
            const r = b.getBoundingClientRect();
            return {top: r.top, bottom: r.bottom, ih: window.innerHeight};
        }"""
    )
    reachable = box["bottom"] <= box["ih"] + 1 and box["top"] >= -1

    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / f"{label}.png"))

    problems = []
    if not reachable:
        problems.append(
            f"submit button NOT reachable in viewport (top={box['top']:.0f} bottom={box['bottom']:.0f} ih={box['ih']})"
        )
    if expect_no_page_scroll and page_scrolls:
        problems.append(
            f"document scrolls on desktop (scrollH={doc_scroll_h} > innerH={inner_h}) — content clipped, not internal-pane scroll"
        )
    ok = len(problems) == 0
    detail = "ok" if ok else "; ".join(problems)
    return label, ok, detail


def main() -> int:
    results = []
    console_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.add_init_script(INIT)
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )

        # Desktop: deliberately SHORT so the tall form must scroll internally.
        results.append(check(page, "desktop-short", 1280, 620, expect_no_page_scroll=True))
        # Mobile: natural document scroll; form must still be reachable.
        results.append(check(page, "mobile", 390, 740, expect_no_page_scroll=False))

        browser.close()

    print("\n=== Recruiting design smoke ===")
    all_ok = True
    for label, ok, detail in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}: {detail}")
        all_ok = all_ok and ok

    # Filter benign noise (favicon/devtools); flag real app errors.
    real_errors = [
        e for e in console_errors
        if "favicon" not in e.lower() and "manifest" not in e.lower()
    ]
    if real_errors:
        all_ok = False
        print("  [FAIL] console errors:")
        for e in real_errors[:10]:
            print(f"     - {e}")
    else:
        print("  [PASS] no console errors")

    print(f"\nScreenshots: {OUT}/desktop-short.png, {OUT}/mobile.png")
    print("RESULT:", "PASS ✅" if all_ok else "FAIL ❌")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
