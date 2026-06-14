#!/usr/bin/env python3
"""
Playwright smoke for the new HQ public landing page (.theme-hq).
Assumes a raw-vite dev server is reachable at SMOKE_BASE_URL (default :3001).
Writes a result summary + screenshots to /tmp so verification does not depend
on bash stdout (which has been flaky this session).

Checks:
  /        — renders .theme-hq, counts sections, captures console/page errors
  /login   — still renders (public isolation), captures errors
  /register/smoke-test-token — recruiting funnel still uses .theme-landing
"""
import json
import time
import urllib.request
from pathlib import Path

BASE = "http://localhost:3001"
OUT = Path("/tmp")
result = {"base": BASE, "ok": False, "steps": []}


def wait_for_server(timeout=90):
    for _ in range(timeout):
        try:
            urllib.request.urlopen(BASE, timeout=2)
            return True
        except Exception:
            time.sleep(1)
    return False


def main():
    from playwright.sync_api import sync_playwright

    if not wait_for_server():
        result["error"] = "server never came up"
        (OUT / "hq-smoke-result.json").write_text(json.dumps(result, indent=2))
        return

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---- landing ----
        page.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        # give lazy three.js + effects a beat
        time.sleep(4)
        has_theme = page.locator(".theme-hq").count()
        section_count = page.locator(".theme-hq section, .theme-hq header.hero").count()
        hero_title = (page.locator(".theme-hq .hero-title").first.inner_text() if page.locator(".theme-hq .hero-title").count() else "")
        # scroll through to trigger reveal/observers (catches runtime errors mid-page)
        for y in (0.2, 0.4, 0.6, 0.8, 1.0):
            page.evaluate(f"window.scrollTo(0, document.body.scrollHeight*{y})")
            time.sleep(0.5)
        page.evaluate("window.scrollTo(0,0)")
        time.sleep(0.5)
        page.screenshot(path=str(OUT / "hq-landing-full.png"), full_page=True)
        page.screenshot(path=str(OUT / "hq-landing-hero.png"))
        landing_errors = list(errors)
        result["steps"].append({
            "path": "/",
            "theme_hq_present": has_theme,
            "section_count": section_count,
            "hero_title": hero_title,
            "console_errors": landing_errors,
        })

        # ---- login (public isolation) ----
        errors.clear()
        page.goto(BASE + "/login", wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)
        page.screenshot(path=str(OUT / "hq-login.png"))
        # the new theme must NOT bleed onto /login
        login_theme_hq = page.locator(".theme-hq").count()
        result["steps"].append({
            "path": "/login",
            "theme_hq_present_should_be_0": login_theme_hq,
            "console_errors": list(errors),
        })

        # ---- recruiting funnel (still .theme-landing, untouched) ----
        errors.clear()
        page.goto(BASE + "/register/smoke-test-token", wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)
        page.screenshot(path=str(OUT / "hq-register.png"))
        reg_theme_landing = page.locator(".theme-landing").count()
        reg_theme_hq = page.locator(".theme-hq").count()
        result["steps"].append({
            "path": "/register/smoke-test-token",
            "theme_landing_present": reg_theme_landing,
            "theme_hq_present_should_be_0": reg_theme_hq,
            "console_errors": list(errors),
        })

        browser.close()

    # overall ok: landing rendered, no console errors on landing, no theme bleed
    landing = result["steps"][0]
    login = result["steps"][1]
    result["ok"] = (
        landing["theme_hq_present"] >= 1
        and landing["section_count"] >= 15
        and len(landing["console_errors"]) == 0
        and login["theme_hq_present_should_be_0"] == 0
    )
    (OUT / "hq-smoke-result.json").write_text(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        result["error"] = repr(e)
        (OUT / "hq-smoke-result.json").write_text(json.dumps(result, indent=2))
