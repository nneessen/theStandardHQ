"""Capture /join-the-standard hero at multiple viewports — no interaction.

Validates the page renders, doesn't scroll, and looks correct at each size.
"""

import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:3000/join-the-standard"

VIEWPORTS = [
    ("desktop", 1440, 900),
    ("laptop", 1280, 800),
    ("tablet", 768, 1024),
    ("mobile", 390, 844),
    ("mobile-small", 375, 667),
]


def check(name: str, w: int, h: int, browser) -> dict:
    ctx = browser.new_context(viewport={"width": w, "height": h})
    page = ctx.new_page()
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)  # let recruiter info + theme RPC + fonts settle

    # Dismiss cookie banner if present
    try:
        got_it = page.locator("button", has_text="Got it").first
        if got_it.is_visible(timeout=500):
            got_it.click()
            page.wait_for_timeout(300)
    except Exception:
        pass

    # Check page-level scroll
    body_scroll = page.evaluate("document.documentElement.scrollHeight")
    inner_h = page.evaluate("window.innerHeight")
    overflow = body_scroll - inner_h

    # Check critical elements (any visible match)
    badge_count = page.get_by_text("Recruiting Now").count()
    headline_count = page.locator("h1").count()
    cta_visible = page.get_by_role("button", name="Apply to Join").locator("visible=true").count()

    page.screenshot(path=f"/tmp/join-{name}.png", full_page=False)
    ctx.close()
    return {
        "name": name,
        "viewport": f"{w}x{h}",
        "overflow_px": overflow,
        "badge_count": badge_count,
        "headline_count": headline_count,
        "cta_visible_count": cta_visible,
        "console_errors": [e for e in console_errors if "DialogTitle" not in e][:3],
    }


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        results = [check(name, w, h, browser) for name, w, h in VIEWPORTS]
        browser.close()

    failed = False
    for r in results:
        marker = "OK" if r["overflow_px"] <= 4 and r["cta_visible_count"] >= 1 else "FAIL"
        print(f"\n[{marker}] {r['name']} ({r['viewport']})")
        print(f"  overflow_px: {r['overflow_px']}  CTA visible: {r['cta_visible_count']}  badge: {r['badge_count']}  h1: {r['headline_count']}")
        if r["console_errors"]:
            print(f"  console: {r['console_errors']}")
        if marker == "FAIL":
            failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
