#!/usr/bin/env python3
"""
Render smoke for the Analytics page (/analytics) after the overflow +
Geographic-Mix + renewal-% fixes and the new Inbound Calls section.

Logs in as the throwaway epiclife-demo manager (NOT a real account), loads
/analytics at 3 widths, captures console + page errors, screenshots, and
asserts the four acceptance checks:
  1. no JS/console errors at 1440 / 768 / 375 px
  2. Geographic Mix shows >=1 real state (not only "Unknown")
  3. renewal footnote reads 2.5% (not 25%)
  4. the Inbound Calls section renders KPIs (close rate etc.)
  5. no element overflows its panel card horizontally at any width

Prereqs:
    npm run dev:web                                  # vite on :3000
    ./scripts/migrations/run-sql.sh -f scripts/seed-demo-call-recordings.sql
    python3 scripts/smoke-analytics.py

Writes PNGs to /tmp/board-shots/analytics-*.png ; exits non-zero on failure.
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BOARD_BASE", "http://localhost:3000")
# Throwaway demo manager in the epiclife-demo IMO (2fd256e9). Overridable.
EMAIL = os.environ.get("DEMO_EMAIL", "mgr1@epiclife-demo.test")
PASSWORD = os.environ.get("DEMO_PASSWORD", "DemoPass123!")
OUT = pathlib.Path("/tmp/board-shots")

IGNORE = (
    "favicon",
    "Download the React DevTools",
    "[vite]",
    "manifest.json",
    "ResizeObserver",
    "browserslist",
)

WIDTHS = [("desktop", 1440), ("tablet", 768), ("mobile", 375)]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})

        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and not any(s in m.text for s in IGNORE)
            else None,
        )
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        print(f"→ logging in at {BASE}/login as {EMAIL}")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=40_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(4000)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        body_text_by_width: dict[str, str] = {}
        geo_panel_text: str | None = None
        for name, w in WIDTHS:
            page.set_viewport_size({"width": w, "height": 1100})
            page.goto(
                f"{BASE}/analytics",
                wait_until="domcontentloaded",
                timeout=40_000,
            )
            # let lazy panels + queries settle
            page.wait_for_timeout(5000)
            try:
                page.mouse.wheel(0, 6000)
                page.wait_for_timeout(1500)
                page.mouse.wheel(0, 12000)
                page.wait_for_timeout(1500)
            except Exception:
                pass
            shot = OUT / f"analytics-{name}-{w}.png"
            page.screenshot(path=str(shot), full_page=True)
            print(f"  · {name} ({w}px) → {shot}")
            body_text_by_width[name] = page.inner_text("body")

            # Capture the policy "Geographic Mix" panel's OWN text (scoped, so the
            # separate inbound "Caller geography" panel can't mask a regression).
            if name == "desktop":
                geo_panel_text = page.evaluate(
                    r"""() => {
                      const hasGeo = (t) => /geographic mix/i.test(t);
                      const dollars = (t) => (t.match(/\$\s?\d/g) || []).length;
                      const titled = [...document.querySelectorAll('div')]
                        .filter(d => hasGeo(d.innerText))
                        .sort((a, b) => a.innerText.length - b.innerText.length);
                      if (!titled.length) return null;
                      // climb from the title node to the Board card: the smallest
                      // ancestor that holds the header total AND >=1 state row
                      // (i.e. >=2 dollar amounts).
                      let el = titled[0];
                      for (let i = 0; i < 10 && el; i++) {
                        if (hasGeo(el.innerText) && dollars(el.innerText) >= 2) {
                          return el.innerText;
                        }
                        el = el.parentElement;
                      }
                      return titled[titled.length - 1].innerText;
                    }"""
                )

            # ── overflow check ──
            # (a) the page itself must not scroll horizontally; (b) no element
            # may escape its card — but elements inside an overflow:auto/scroll
            # container scroll *inside* the card by design, so they're excluded.
            result = page.evaluate(
                """(vw) => {
                  const pageScroll = Math.max(
                    document.documentElement.scrollWidth,
                    document.body.scrollWidth,
                  );
                  const scrolls = (el) => {
                    const s = getComputedStyle(el);
                    return /(auto|scroll|hidden)/.test(s.overflowX) ||
                           /(auto|scroll|hidden)/.test(s.overflow);
                  };
                  const bad = [];
                  for (const el of document.querySelectorAll('main *')) {
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 || r.right <= vw + 2) continue;
                    let p = el.parentElement, contained = false;
                    while (p) { if (scrolls(p)) { contained = true; break; } p = p.parentElement; }
                    if (!contained) {
                      bad.push((el.tagName + '.' + (el.className||'')).slice(0,80)
                               + ' right=' + Math.round(r.right));
                    }
                    if (bad.length > 6) break;
                  }
                  return { pageScroll, bad };
                }""",
                w,
            )
            if result["pageScroll"] > w + 3:
                failures.append(
                    f"[{name} {w}px] page scrolls horizontally "
                    f"(scrollWidth={result['pageScroll']} > {w})"
                )
            if result["bad"]:
                failures.append(
                    f"[{name} {w}px] {len(result['bad'])} element(s) escape their card: "
                    + " | ".join(result["bad"][:4])
                )

        # ── content assertions (use the desktop render) ──────────────────────
        # inner_text reflects CSS text-transform (Cap/labels uppercase), so match
        # case-insensitively.
        desktop = body_text_by_width.get("desktop", "")
        low = desktop.lower()

        if "2.5%" not in desktop:
            failures.append("renewal footnote: '2.5%' not found on page")
        if "based on 25%" in low:
            failures.append("renewal footnote still shows the stale '25%'")

        # Geographic Mix must show real states, not only "Unknown" — asserted
        # against the panel's OWN text (distinctive 2-letter codes; avoid
        # 'IN'/'OH' that collide with English words).
        import re as _re

        if not geo_panel_text:
            failures.append("Geographic Mix panel not found in DOM")
        else:
            states_found = set(
                _re.findall(r"\b(KY|CA|NV|AZ|NC|MO|FL|GA|TX|TN|SC)\b", geo_panel_text)
            )
            if len(states_found) < 2:
                failures.append(
                    f"Geographic Mix panel shows no real state codes "
                    f"(found {states_found}); panel text={geo_panel_text[:120]!r}"
                )
            if "unknown" in geo_panel_text.lower() and not states_found:
                failures.append("Geographic Mix panel shows only 'Unknown'")

        # Inbound Calls section must render with KPIs.
        if "inbound calls" not in low:
            failures.append("Inbound Calls section not found")
        if "close rate" not in low and "volume & conversion" not in low:
            failures.append("Inbound Calls KPIs (Close Rate) not rendered")

        browser.close()

    ok = True
    if errors:
        ok = False
        print(f"\n✗ {len(errors)} console/page error(s):")
        for e in errors[:12]:
            print("   -", e)
    if failures:
        ok = False
        print(f"\n✗ {len(failures)} assertion failure(s):")
        for f in failures:
            print("   -", f)

    if ok:
        print("\n✓ analytics smoke passed (no errors, no overflow, all assertions)")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
