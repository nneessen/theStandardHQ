#!/usr/bin/env python3
"""
Smoke test for the Sales Scripts library (call-reviews/scripts).

Logs in as a DEMO agent (default agent1@epiclife-demo.test / DemoPass123!, in the
demo IMO where seed-call-scripts-content.sql + a generated Cash Out script live),
renders the library AND the generated-script detail, and reports every console
error / uncaught exception / failed request. As a plain agent the Generate button
must be ABSENT and the generated script must still render (view-only).

Prereqs:
  - dev server running (npx vite); set CALL_SCRIPTS_BASE to its URL.
  - scripts/seed-call-scripts-content.sql applied + a Cash Out script generated.

Usage:
    CALL_SCRIPTS_BASE=http://localhost:5173 python3 scripts/smoke-call-scripts.py
"""

import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("CALL_SCRIPTS_BASE", "http://localhost:5173")
EMAIL = os.environ.get("CALL_SCRIPTS_EMAIL", "agent1@epiclife-demo.test")
PASSWORD = os.environ.get("CALL_SCRIPTS_PASSWORD", "DemoPass123!")
CASH_OUT = "91cae9ee-e7b5-495f-b7b3-79aae721b5e8"
OUT = pathlib.Path("/tmp/call-scripts")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    console_errs: list[str] = []
    page_errs: list[str] = []
    failed_reqs: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1680, "height": 1050})
        page.on("console", lambda m: console_errs.append(m.text)
                if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errs.append(str(e)))
        page.on("requestfailed", lambda r: failed_reqs.append(
            f"{r.method} {r.url} — {r.failure}"))

        print(f"→ logging in at {BASE}/login as {EMAIL}")
        page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30_000)
        page.locator("input[type=email]").first.fill(EMAIL)
        page.locator("input[type=password]").first.fill(PASSWORD)
        page.get_by_role("button", name="Sign in", exact=False).first.click()
        page.wait_for_timeout(3500)
        if page.url.rstrip("/").endswith("/login"):
            print("✗ login failed (still on /login). Aborting.")
            browser.close()
            return 3

        # 1. Library
        print("→ /call-reviews/scripts (library)")
        page.goto(f"{BASE}/call-reviews/scripts",
                  wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(2500)
        page.screenshot(path=str(OUT / "library.png"), full_page=True)
        lib = page.locator("body").inner_text()
        has_cashout = "Cash Out" in lib
        has_ready = "Ready" in lib
        # Plain agent must NOT see a Generate/Regenerate control.
        has_generate = ("Generate" in lib) or ("Regenerate" in lib)
        print(f"   Cash Out listed: {has_cashout} | Ready: {has_ready} | "
              f"Generate visible (should be False for agent): {has_generate}")

        # 2. Detail (generated script render)
        print("→ /call-reviews/scripts/$callTypeId (detail)")
        page.goto(f"{BASE}/call-reviews/scripts/{CASH_OUT}",
                  wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(2500)
        page.screenshot(path=str(OUT / "detail.png"), full_page=True)
        detail = page.locator("body").inner_text()
        # GeneratedScriptView markers: phase ordering + step kind labels.
        markers = [m for m in ("Opening", "Discovery", "Objection", "Close",
                               "SAY", "Say", "Key principles", "Why it works")
                   if m.lower() in detail.lower()]
        print(f"   detail url: {page.url}")
        print(f"   rendered markers: {markers}")
        print(f"   visible text (first 500 chars):\n{detail[:500]!r}")

        # 3. Download PDF — must produce a real .pdf file (no print dialog, no
        #    sidebar). Confirms @react-pdf/renderer renders the structured script.
        print("→ Download PDF")
        pdf_ok = False
        pdf_bytes = 0
        try:
            btn = page.get_by_role("button", name="Download PDF", exact=False).first
            with page.expect_download(timeout=30_000) as dl_info:
                btn.click()
            dl = dl_info.value
            pdf_path = OUT / "script.pdf"
            dl.save_as(str(pdf_path))
            pdf_bytes = pdf_path.stat().st_size
            head = pdf_path.read_bytes()[:5]
            pdf_ok = head.startswith(b"%PDF") and pdf_bytes > 1000
            print(f"   saved {dl.suggested_filename} → {pdf_bytes} bytes | "
                  f"valid PDF header: {head == b'%PDF-'} | ok: {pdf_ok}")
        except Exception as exc:  # noqa: BLE001
            print(f"   ✗ download failed: {exc}")

        browser.close()

    print("=" * 60)
    print(f"PAGE ERRORS (uncaught): {len(page_errs)}")
    for e in page_errs:
        print(f"  ✗ {e}")
    print(f"CONSOLE ERRORS: {len(console_errs)}")
    for e in console_errs[:20]:
        print(f"  • {e}")
    print(f"FAILED REQUESTS: {len(failed_reqs)}")
    for e in failed_reqs[:20]:
        print(f"  • {e}")
    print("=" * 60)

    ok = (not page_errs) and has_cashout and len(markers) >= 2 \
        and not has_generate and pdf_ok
    print("RESULT:", "✅ PASS" if ok else "⚠️  CHECK ABOVE")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
