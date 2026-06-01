#!/usr/bin/env python3
"""
Accessibility audit harness — automated WCAG 2.1 AA pass via axe-core.

Drives a headless Chromium (Playwright) over each configured page, injects
axe-core, runs the WCAG 2.0/2.1 A + AA rule set, and writes per-page JSON +
a combined summary to scripts/a11y/results/.

IMPORTANT: automated scanners catch only ~30-40% of WCAG criteria. A clean axe
run is NOT proof of WCAG 2.1 AA conformance. Keyboard operability, focus order,
meaningful alt text, and error association still require a manual pass.

Prereq: the app dev server must be running on http://localhost:3000
    npm run dev          (targets local Supabase per .env)

Usage:
    python3 scripts/a11y/audit_pages.py                 # public set (default)
    python3 scripts/a11y/audit_pages.py --set authed    # authed baseline
    BASE_URL=http://localhost:3000 python3 scripts/a11y/audit_pages.py
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
AXE_SRC = (HERE / "axe.min.js").read_text()
OUT_DIR = HERE / "results"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Live local test data (created for this audit; see audit report).
INVITE_TOKEN = os.environ.get("INVITE_TOKEN", "62f90d36-031a-4c15-a602-db84ecbbd1bd")
RECRUITER_SLUG = os.environ.get("RECRUITER_SLUG", "the-standard")

# name, path, reducedMotion ("reduce" | "no-preference")
SETS = {
    "public": [
        ("landing-reduced-motion", "/landing", "reduce"),
        ("landing-motion", "/landing", "no-preference"),
        ("login", "/login", "reduce"),
        ("terms", "/terms", "reduce"),
        ("privacy", "/privacy", "reduce"),
        ("accessibility", "/accessibility", "reduce"),
        ("auth-reset-password", "/auth/reset-password", "reduce"),
        ("auth-verify-email", "/auth/verify-email", "reduce"),
        ("auth-pending", "/auth/pending", "reduce"),
        ("auth-denied", "/auth/denied", "reduce"),
        ("join-recruiter", f"/join/{RECRUITER_SLUG}", "reduce"),
        ("register-apply-form", f"/register/{INVITE_TOKEN}", "reduce"),
    ],
    "authed": [
        ("dashboard", "/", "reduce"),
        ("policies", "/policies", "reduce"),
        ("recruiting", "/recruiting", "reduce"),
        ("settings", "/settings", "reduce"),
    ],
}

AXE_OPTIONS = {
    "runOnly": {
        "type": "tag",
        "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
    },
    "resultTypes": ["violations", "incomplete"],
}

SEVERITY_ORDER = {"critical": 0, "serious": 1, "moderate": 2, "minor": 3}


def audit_page(browser, name, path, reduced_motion):
    context = browser.new_context(
        reduced_motion=reduced_motion,
        viewport={"width": 1280, "height": 900},
    )
    page = context.new_page()
    console_errors, page_errors = [], []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    url = BASE_URL + path
    load_error = None
    try:
        page.goto(url, wait_until="networkidle", timeout=45000)
    except Exception:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e2:
            load_error = str(e2)
    page.wait_for_timeout(2500)  # let SPA settle (guards, fetch, animation mount)

    page.evaluate(AXE_SRC)
    result = page.evaluate("async (opts) => await window.axe.run(document, opts)", AXE_OPTIONS)

    violations = sorted(
        result.get("violations", []),
        key=lambda v: SEVERITY_ORDER.get(v.get("impact"), 9),
    )
    by_sev = {}
    for v in violations:
        by_sev[v.get("impact")] = by_sev.get(v.get("impact"), 0) + 1

    record = {
        "name": name,
        "url": url,
        "reducedMotion": reduced_motion,
        "title": page.title(),
        "violationCount": len(violations),
        "incompleteCount": len(result.get("incomplete", [])),
        "bySeverity": by_sev,
        "violations": [
            {
                "id": v["id"],
                "impact": v.get("impact"),
                "help": v.get("help"),
                "helpUrl": v.get("helpUrl"),
                "tags": v.get("tags"),
                "nodeCount": len(v.get("nodes", [])),
                "sampleTargets": [
                    {
                        "target": n.get("target"),
                        "html": (n.get("html") or "")[:200],
                        "failureSummary": n.get("failureSummary"),
                    }
                    for n in v.get("nodes", [])[:5]
                ],
            }
            for v in violations
        ],
        "incomplete": [
            {"id": v["id"], "impact": v.get("impact"), "help": v.get("help"), "nodeCount": len(v.get("nodes", []))}
            for v in result.get("incomplete", [])
        ],
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "loadError": load_error,
    }
    (OUT_DIR / f"{name}.json").write_text(json.dumps(record, indent=2))
    context.close()
    return record


def main():
    set_name = "public"
    if "--set" in sys.argv:
        set_name = sys.argv[sys.argv.index("--set") + 1]
    pages = SETS.get(set_name)
    if not pages:
        print(f"Unknown set '{set_name}'. Options: {', '.join(SETS)}")
        sys.exit(1)

    summary = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, path, rm in pages:
            sys.stdout.write(f"Auditing {name} ({path}) … ")
            sys.stdout.flush()
            try:
                r = audit_page(browser, name, path, rm)
                sev = " ".join(f"{k}:{v}" for k, v in r["bySeverity"].items()) or "none"
                extra = ""
                if r["pageErrors"]:
                    extra += f", {len(r['pageErrors'])} JS errors"
                if r["loadError"]:
                    extra += " (LOAD ERROR)"
                print(f"{r['violationCount']} violations [{sev}], {r['incompleteCount']} incomplete{extra}")
                summary.append(r)
            except Exception as e:
                print(f"FAILED: {e}")
                summary.append({"name": name, "url": BASE_URL + path, "fatal": str(e)})
        browser.close()

    (OUT_DIR / f"_summary-{set_name}.json").write_text(
        json.dumps(
            {
                "generatedFor": set_name,
                "baseUrl": BASE_URL,
                "pages": [
                    {
                        "name": s["name"],
                        "url": s.get("url"),
                        "violationCount": s.get("violationCount"),
                        "bySeverity": s.get("bySeverity"),
                        "incompleteCount": s.get("incompleteCount"),
                        "pageErrors": len(s.get("pageErrors", [])) if "pageErrors" in s else None,
                        "fatal": s.get("fatal"),
                    }
                    for s in summary
                ],
            },
            indent=2,
        )
    )

    # Aggregate unique rule violations across pages.
    rule_totals = {}
    for s in summary:
        for v in s.get("violations", []):
            rt = rule_totals.setdefault(
                v["id"], {"id": v["id"], "impact": v.get("impact"), "pages": set(), "nodeCount": 0}
            )
            rt["pages"].add(s["name"])
            rt["nodeCount"] += v["nodeCount"]

    print("\n=== Aggregate by rule (across pages) ===")
    for r in sorted(rule_totals.values(), key=lambda r: SEVERITY_ORDER.get(r["impact"], 9)):
        print(f"[{r['impact']}] {r['id']} — {r['nodeCount']} nodes on {len(r['pages'])} page(s): {', '.join(sorted(r['pages']))}")
    print(f"\nResults written to {OUT_DIR}")


if __name__ == "__main__":
    main()
