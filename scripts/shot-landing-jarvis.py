#!/usr/bin/env python3
"""
One-off visual check: screenshot the public HQ landing page's Jarvis section
(now showing the real Command Center screenshot instead of the CSS orb).
Assumes the dev server is already running on http://localhost:3000.
"""
from playwright.sync_api import sync_playwright

URL = "http://localhost:3000/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        device_scale_factor=2,
        reduced_motion="no-preference",  # else reveal/tilt stay in static fallback
        color_scheme="dark",
    )
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(1000)

    # Jarvis section
    page.eval_on_selector("#jarvis", "el => el.scrollIntoView({block:'center'})")
    page.wait_for_timeout(1500)
    el = page.query_selector("#jarvis")
    (el or page).screenshot(path="/tmp/jarvis_section.png")

    # Gallery section (slowed flythrough) — grab a frame for reference
    gal = page.query_selector("#gallery") or page.query_selector(".gallery")
    if gal:
        gal.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        gal.screenshot(path="/tmp/gallery_section.png")

    browser.close()
print("ok: /tmp/jarvis_section.png")
