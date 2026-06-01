#!/usr/bin/env python3
"""
Side-by-side: my React HQ landing (:3001) vs the reference HTML (:8899),
BOTH with motion ON (reduced_motion='no-preference' — the default headless
'reduce' is what made earlier screenshots show the static fallback).

Captures, for each:
  - hero (top of page)
  - a scroll position partway into the pillars pin (to verify horizontal scroll)
  - full page height + section box metrics
Writes JSON metrics + screenshots to /tmp/cmp-*.
"""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

MINE = "http://localhost:3001/"
REF = "http://localhost:8899/The%20Standard%20HQ%20-%20Landing.html"
OUT = Path("/tmp")
report = {}


def capture(page, tag):
    info = {}
    page.goto(MINE if tag == "mine" else REF, wait_until="domcontentloaded", timeout=30000)
    time.sleep(4)  # fonts + three.js + first reveals
    info["scrollHeight"] = page.evaluate("document.body.scrollHeight")
    info["innerHeight"] = page.evaluate("window.innerHeight")
    # hero headline font + computed size (catches Anton load failure)
    sel = ".hero-title" if tag == "ref" else ".theme-hq .hero-title"
    if page.locator(sel).count():
        info["heroFont"] = page.evaluate(
            f"getComputedStyle(document.querySelector('{sel}')).fontFamily"
        )
        info["heroSize"] = page.evaluate(
            f"getComputedStyle(document.querySelector('{sel}')).fontSize"
        )
    page.evaluate("window.scrollTo(0,0)")
    time.sleep(0.5)
    page.screenshot(path=str(OUT / f"cmp-{tag}-hero.png"))

    # pillars: scroll to the pillars section, then ~55% into its pin, check track translateX
    pill_sel = ".pillars"
    if page.locator(pill_sel).count():
        box = page.evaluate(
            f"""() => {{
              const el = document.querySelector('{pill_sel}');
              const r = el.getBoundingClientRect();
              return {{ top: r.top + window.scrollY, height: el.offsetHeight }};
            }}"""
        )
        info["pillarsHeight"] = box["height"]
        # scroll to middle of the pinned region
        target = box["top"] + box["height"] * 0.5
        page.evaluate(f"window.scrollTo(0, {target})")
        time.sleep(1.0)
        track_sel = "[data-htrack]"
        if page.locator(track_sel).count():
            info["trackTransform"] = page.evaluate(
                f"getComputedStyle(document.querySelector('{track_sel}')).transform"
            )
            info["trackScrollWidth"] = page.evaluate(
                f"document.querySelector('{track_sel}').scrollWidth"
            )
        page.screenshot(path=str(OUT / f"cmp-{tag}-pillars.png"))

    return info


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # motion ON — this is the whole point
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            reduced_motion="no-preference",
        )
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        report["mine"] = capture(page, "mine")
        report["mine"]["pageErrors"] = list(errs)
        errs.clear()
        report["ref"] = capture(page, "ref")
        browser.close()
    (OUT / "cmp-report.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        report["error"] = repr(e)
        (OUT / "cmp-report.json").write_text(json.dumps(report, indent=2))
