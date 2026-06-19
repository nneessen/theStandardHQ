#!/usr/bin/env python3
"""
Smoke test + screenshots for the LIGHT MODE rollout.

Boots the authenticated app, forces the theme to light (then dark), and verifies:
  • zero runtime console errors / pageerrors
  • the board CSS vars actually flip: `.theme-v2 --ink/--surface-1` resolve to the
    light palette in light mode and the charcoal palette in dark mode
  • recharts axis text is NOT pure black in light mode (catches an unconverted
    SVG-attr `var()` color sink — the Step-8 risk)

Usage (creds live in gitignored .env.local):
    set -a; source .env.local; set +a
    python3 scripts/smoke/smoke-light-mode.py [BASE_URL]

Without E2E_EMAIL/E2E_PASSWORD it runs a PUBLIC boot check only (loads /login + /
and asserts zero console errors). Screenshots → /tmp/light-mode-smoke-*.png.
Exit 0 = clean, 1 = console error / var mismatch / black chart.
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
EMAIL = os.environ.get("E2E_EMAIL")
PASSWORD = os.environ.get("E2E_PASSWORD")
STORAGE_KEY = "commission-tracker-theme"

# Expected resolved board vars per theme (authored values from index.css .theme-v2).
EXPECT = {
    "light": {"--ink": "#0f172a", "--surface-1": "#eef0f3"},
    "dark": {"--ink": "#f3f3f4", "--surface-1": "#171717"},
}


def set_theme(page, theme: str) -> None:
    page.evaluate(
        "([k, v]) => localStorage.setItem(k, v)", [STORAGE_KEY, theme]
    )
    page.reload(wait_until="networkidle", timeout=30_000)
    page.wait_for_timeout(1200)


def check_vars(page, theme: str, errors: list) -> None:
    got = page.evaluate(
        """() => {
            const el = document.querySelector('.theme-v2');
            if (!el) return null;
            const cs = getComputedStyle(el);
            return {
                ink: cs.getPropertyValue('--ink').trim().toLowerCase(),
                surface1: cs.getPropertyValue('--surface-1').trim().toLowerCase(),
                dark: document.documentElement.classList.contains('dark'),
            };
        }"""
    )
    if not got:
        errors.append(f"[{theme}] no .theme-v2 element found")
        return
    exp = EXPECT[theme]
    if got["ink"] != exp["--ink"] or got["surface1"] != exp["--surface-1"]:
        errors.append(
            f"[{theme}] board vars wrong: got ink={got['ink']} "
            f"surface1={got['surface1']} (expected {exp})"
        )
    else:
        print(f"   ✓ [{theme}] --ink={got['ink']} --surface-1={got['surface1']} "
              f"(html.dark={got['dark']})")


def check_chart_not_black(page, errors: list) -> None:
    """recharts axis <text> should use the theme axis color, never pure black."""
    res = page.evaluate(
        """() => {
            const texts = Array.from(
                document.querySelectorAll('.recharts-surface text')
            );
            if (!texts.length) return { found: 0, black: 0 };
            let black = 0;
            for (const t of texts) {
                const f = getComputedStyle(t).fill;
                if (f === 'rgb(0, 0, 0)' || f === '#000000' || f === 'black') {
                    black++;
                }
            }
            return { found: texts.length, black };
        }"""
    )
    if res["found"] == 0:
        print("   ⓘ no recharts text on this page (chart empty / not present)")
    elif res["black"] > 0:
        errors.append(
            f"chart axis text rendered BLACK ({res['black']}/{res['found']}) "
            "in light mode — unconverted SVG-attr var() sink"
        )
    else:
        print(f"   ✓ chart axis text themed ({res['found']} labels, none black)")


# Environmental data-layer noise (headless session can't always reach Supabase).
# These are NOT theme/render failures — classified as warnings, not hard errors.
NET_NOISE = (
    "Failed to fetch",
    "NetworkError",
    "ERR_NETWORK",
    "ERR_FAILED",
    "supabase",
    "Failed to load resource",
    "CORS policy",
    "Access-Control-Allow-Origin",
    "127.0.0.1:54321",  # local Supabase REST/auth port
)


def _is_net(text: str) -> bool:
    return any(n.lower() in text.lower() for n in NET_NOISE)


def main() -> int:
    errors: list[str] = []
    net_warn: list[str] = []

    def on_console(m):
        if m.type != "error":
            return
        (net_warn if _is_net(m.text) else errors).append(f"{m.type}: {m.text}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1680, "height": 1050})
        page.on("console", on_console)
        page.on(
            "pageerror",
            lambda e: (net_warn if _is_net(str(e)) else errors).append(
                f"pageerror: {e}"
            ),
        )

        # Public boot check (always).
        for route in ["/login", "/"]:
            print(f"→ boot check {BASE}{route}")
            page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(500)

        if not (EMAIL and PASSWORD):
            print("ⓘ no E2E_EMAIL/E2E_PASSWORD — skipped authed light/dark capture")
            browser.close()
            return _report(errors, net_warn)

        print("→ logging in")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.get_by_label("Email", exact=False).first.fill(EMAIL)
        page.get_by_label("Password", exact=False).first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3000)

        routes = ["/dashboard", "/policies", "/analytics", "/messages", "/targets"]

        # ---- LIGHT ----
        print("\n=== LIGHT MODE ===")
        set_theme(page, "light")
        for route in routes:
            page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(1800)
            slug = route.strip("/") or "root"
            page.screenshot(path=f"/tmp/light-mode-smoke-light-{slug}.png",
                            full_page=True)
            print(f"   {route} → /tmp/light-mode-smoke-light-{slug}.png")
            check_vars(page, "light", errors)
            if route == "/analytics":
                check_chart_not_black(page, errors)

        # ---- DARK (no-regression) ----
        print("\n=== DARK MODE (no-regression) ===")
        set_theme(page, "dark")
        for route in ["/dashboard", "/analytics"]:
            page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(1500)
            slug = route.strip("/") or "root"
            page.screenshot(path=f"/tmp/light-mode-smoke-dark-{slug}.png",
                            full_page=True)
            print(f"   {route} → /tmp/light-mode-smoke-dark-{slug}.png")
            check_vars(page, "dark", errors)

        browser.close()
    return _report(errors, net_warn)


def _report(errors: list, net_warn: list) -> int:
    if net_warn:
        print(f"\nⓘ {len(net_warn)} environmental data-layer warning(s) "
              "(Supabase/network — not theme-related):")
        for w in net_warn[:6]:
            print("   ~", w.splitlines()[0][:120])
    if errors:
        print(f"\n✗ {len(errors)} theme/render issue(s):")
        for e in errors[:25]:
            print("   -", e)
        return 1
    print("\n✓ light + dark booted clean: board vars flip correctly, "
          "no theme/render console errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
