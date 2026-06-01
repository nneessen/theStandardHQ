#!/usr/bin/env python3
"""
Manual-assist probe — gathers evidence for the WCAG criteria axe can't fully
automate: skip-link presence, image alt inventory, label association, keyboard
focus reachability + visible focus indicator.

Run alongside audit_pages.py. Prereq: dev server on http://localhost:3000.
    python3 scripts/a11y/manual_probe.py
"""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
INVITE_TOKEN = os.environ.get("INVITE_TOKEN", "62f90d36-031a-4c15-a602-db84ecbbd1bd")
RECRUITER_SLUG = os.environ.get("RECRUITER_SLUG", "the-standard")

PAGES = [
    ("landing", "/landing"),
    ("login", "/login"),
    ("join-recruiter", f"/join/{RECRUITER_SLUG}"),
    ("register-apply-form", f"/register/{INVITE_TOKEN}"),
    ("terms", "/terms"),
]

PROBE_JS = r"""
() => {
  const out = {};
  // Skip-to-content link (first focusable anchor to #main / contains "skip")
  const anchors = [...document.querySelectorAll('a')];
  out.skipLink = anchors.slice(0, 3).some(a =>
    /skip/i.test(a.textContent || '') || /skip/i.test(a.getAttribute('href') || ''));
  // Image alt inventory
  const imgs = [...document.querySelectorAll('img')];
  out.imgTotal = imgs.length;
  out.imgMissingAlt = imgs.filter(i => !i.hasAttribute('alt')).length;
  out.imgEmptyAltDecorative = imgs.filter(i => i.getAttribute('alt') === '').length;
  // SVGs used as icons without role/title (potential unlabeled graphics)
  const svgs = [...document.querySelectorAll('svg')];
  out.svgTotal = svgs.length;
  out.svgUnlabeled = svgs.filter(s =>
    !s.getAttribute('aria-label') && !s.getAttribute('aria-hidden') &&
    !s.querySelector('title') && s.getAttribute('role') !== 'img').length;
  // Inputs without an associated label/aria-label
  const fields = [...document.querySelectorAll('input,select,textarea')]
    .filter(e => e.type !== 'hidden');
  out.fieldTotal = fields.length;
  out.fieldsUnlabeled = fields.filter(e => {
    if (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby')) return false;
    if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) return false;
    if (e.closest('label')) return false;
    return true;
  }).map(e => e.id || e.name || e.outerHTML.slice(0, 60));
  // Landmark/structure quick counts
  out.mainCount = document.querySelectorAll('main,[role="main"]').length;
  out.h1Count = document.querySelectorAll('h1').length;
  out.langAttr = document.documentElement.getAttribute('lang');
  return out;
}
"""


def focus_probe(page):
    """Tab through up to N stops; record reachable controls + whether a visible
    focus indicator (outline / box-shadow / ring) is present on the focused el."""
    results = []
    seen = set()
    for _ in range(40):
        page.keyboard.press("Tab")
        info = page.evaluate(
            r"""() => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              const cs = getComputedStyle(el);
              const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
                || (cs.boxShadow && cs.boxShadow !== 'none');
              return {
                tag: el.tagName.toLowerCase(),
                type: el.getAttribute('type') || '',
                name: (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().slice(0,40),
                visibleFocus: !!ring,
              };
            }"""
        )
        if not info:
            continue
        key = f"{info['tag']}|{info['name']}|{info['type']}"
        if key in seen:
            break  # likely cycled
        seen.add(key)
        results.append(info)
    return results


def main():
    report = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, path in PAGES:
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            page = ctx.new_page()
            try:
                page.goto(BASE_URL + path, wait_until="networkidle", timeout=45000)
            except Exception:
                page.goto(BASE_URL + path, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2500)
            structure = page.evaluate(PROBE_JS)
            focus = focus_probe(page)
            no_focus = [f for f in focus if not f["visibleFocus"]]
            report[name] = {
                "structure": structure,
                "focusStops": len(focus),
                "focusStopsNoVisibleIndicator": len(no_focus),
                "sampleNoFocusIndicator": no_focus[:6],
            }
            print(f"\n### {name} ({path})")
            print("  ", json.dumps(structure))
            print(f"   focus stops: {len(focus)}, without visible indicator: {len(no_focus)}")
            ctx.close()
        browser.close()
    out = Path(__file__).resolve().parent / "results" / "_manual-probe.json"
    out.write_text(json.dumps(report, indent=2))
    print(f"\nWritten to {out}")


if __name__ == "__main__":
    main()
