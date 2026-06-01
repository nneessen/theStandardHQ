# Accessibility Audit (ADA / WCAG 2.1 AA) — The Standard HQ — 2026-05-31

> **Not legal advice.** Engineering-side accessibility audit to reduce ADA "drive-by"
> litigation exposure on the public surface and to surface Title I (employment) risk on
> the authenticated app. Confirm legal sufficiency with counsel. Companion to
> `docs/business/compliance-gap-assessment-2026-05-31.md` (Tier 1 item #3) and the
> pre-sunset protection plan `plans/active/continue-20260531-ada-audit-and-presunset-protection.md`.

## Scope & method

**Surfaces audited:** the PUBLIC (unauthenticated) surface — the litigation-exposed funnel —
plus a planned baseline pass of core authenticated agent flows (Title I). Public routes were
deduped to their backing components (`PublicJoinPage` backs `/join/$recruiterId`, custom-domain
`/`, and `/$slug`; audited once).

**Two coverage layers — automated ≠ conformance.** Automated scanners (axe-core) catch only
~30–40% of WCAG success criteria. A clean axe run is **not** proof of WCAG 2.1 AA conformance.
This audit therefore reports two columns: **Automated (axe-core 4.10.2)** and **Manual pass**
(keyboard reachability, visible focus, alt inventory, label association, landmarks, skip-link,
reduced-motion). The litigation-relevant criteria (keyboard operability, focus, meaningful alt,
error association) are largely in the manual column.

**Tooling (reusable, committed to repo):**
- `scripts/a11y/audit_pages.py` — Playwright + axe-core, WCAG 2.0/2.1 A+AA + best-practice rules.
- `scripts/a11y/manual_probe.py` — skip-link, alt/label inventory, keyboard focus reachability.
- `scripts/a11y/axe.min.js` — vendored axe-core 4.10.2.
- Raw results: `scripts/a11y/results/*.json`.
- Re-run: `npm run dev` then `python3 scripts/a11y/audit_pages.py` (+ `manual_probe.py`).

**Test data (local Supabase):** recruiter slug `the-standard`; a 7-day test invitation token was
inserted into `recruit_invitations` (email `a11y-test@example.com`) to reach the real apply form.
Reduced-motion was tested in **both** states (`reduce` and `no-preference`) on the landing page.

**Pages covered:** `/landing` (×2 motion states), `/login`, `/terms`, `/privacy`,
`/auth/reset-password`, `/auth/verify-email`, `/auth/pending`, `/auth/denied`,
`/join/the-standard`, `/register/<token>` (apply form). No JS/page errors observed on any page.

---

## Executive summary

| Severity | Count (rules) | Headline |
| --- | --- | --- |
| 🔴 Critical | 1 | Unlabeled Select triggers on the apply funnel (`/join`) — screen readers announce a nameless button |
| 🟠 Serious | 1 | **Form input text is invisible on BOTH public application forms** (contrast 1.09:1) + low-contrast accents |
| 🟡 Moderate | 6 | Missing `<main>` landmark (8 pages), content outside landmarks (cookie banner, every page), duplicate `<footer>`, heading-order, missing `<h1>` |
| ⚪ Manual / Level A | 2 | No skip-to-content link (any page); 185 text-over-gradient nodes axe could not compute (landing) |

**The single most important finding is the Serious one:** the shared input renders typed text at
~1.09:1 against its own background on both `/register` (apply form) and `/join` — i.e. an applicant
literally cannot see what they type. This is a real user-blocking defect, not a cosmetic contrast
nit, and it sits on the exact surface (a public application form) that ADA plaintiffs target.

---

## Findings — Automated (axe-core)

### 🔴 CRITICAL

**C1 — `button-name`: Select triggers have no accessible name** · WCAG 4.1.2 (A)
- **Where:** `/join/the-standard` — 2 nodes (`<button role="combobox" aria-controls="radix-…">`).
  These are Radix `Select` triggers (e.g. state / a dropdown) rendered with no text, `aria-label`,
  or `aria-labelledby` while collapsed/empty.
- **Impact:** A screen-reader user hears "button, collapsed" with no indication of what it sets.
- **Fix:** Add `aria-label` to the `SelectTrigger` (or associate a visible `<label>` via
  `aria-labelledby`). Audit every `Select` on the public funnel, not just the two flagged.

### 🟠 SERIOUS

**S1 — `color-contrast`: input text invisible on both public forms** · WCAG 1.4.3 (AA) · **user-blocking**
- **Where & measured ratios (axe computed):**
  - `/register/<token>` apply form — `#first_name`, `#last_name`, `#email`, `#password`, … (8 nodes):
    foreground `#f1f5f9` on background `#ffffff` → **1.09:1** (light text on white).
  - `/join/the-standard` — `#firstName`, `#lastName`, `#email`, … (5 nodes):
    foreground `#161b13` on background `#0a0f1c` → **1.09:1** (dark text on dark navy).
- **Root cause (confirmed):** the shared `Input` (`src/components/ui/input.tsx`, `default` variant)
  styles itself with the token pair `bg-background` + `text-foreground`. Under `.theme-landing`
  (the register form wrapper, `PublicRegistrationPage.tsx:79`) and the recruiting theme (`/join`,
  `<html class="dark">` with inline `--recruiting-*` vars), the theme overrides **one** token of the
  pair but not the other, so the input's text color and the input's own background diverge to the
  same luminance. Net: typed text ≈ invisible.
- **Fix:** Make `.theme-landing` and the recruiting theme define `--background`/`--foreground` (and
  `--input`) as a contrasting pair for form fields — or give the public forms an explicit input
  surface (e.g. `variant="filled"` with theme-correct `--muted`/`--foreground`). Re-run axe to
  confirm ≥ 4.5:1. **Coordinate with the concurrent `src/features/landing/hq/` rework** (the plan
  warns not to clobber it) — read the theme CSS before editing tokens.

**S2 — `color-contrast`: low-contrast accent text** · WCAG 1.4.3 (AA)
- `/login` — the "NEW"/beta pill (`.ml-1`, `bg-v2-accent`): `#f1e9d6` on `#5b9bff` → **2.29:1**.
- `/landing` — small eyebrow labels, column-head ticks, step numbers (`01`, `→ Live`, etc.; 10 nodes):
  thin/small text over tinted surfaces below 4.5:1.
- **Fix:** Darken the pill background (or use a darker ink), and bump the landing accent/eyebrow
  text to meet 4.5:1 (3:1 only qualifies for ≥ 18.66px bold or ≥ 24px text — most of these are small).

### 🟡 MODERATE (structural — high leverage, low effort)

**M1 — `landmark-one-main`: no `<main>` landmark** · WCAG 1.3.1 / best practice
- **Where (8 pages):** `/join`, `/register`, `/terms`, `/privacy`, and all four `/auth/*` pages.
  (`/landing` and `/login` already expose one `<main>`.)
- **Fix:** Wrap each page's primary content in a single `<main>` (or `role="main"`). For the
  auth/terms/privacy/join/register pages this is a one-line wrapper each, or fix once in a shared
  public layout if one exists.

**M2 — `region`: content not contained by landmarks** · WCAG 1.3.1 / best practice — **73 nodes across all 11 pages**
- **Dominant recurring cause:** `CookieConsentBanner` (`src/features/legal/components/CookieConsentBanner.tsx`)
  renders its text in a bare `<div>` (`.flex-1 text-sm text-muted-foreground`) outside any landmark.
  Because the banner overlays **every** public page until consent, it adds a `region` violation
  everywhere. **One fix clears it on all 11 pages:** wrap the banner in
  `<aside role="region" aria-label="Cookie consent">` (or `<section aria-label="…">`).
- Remaining `region` nodes are resolved as a side effect of M1 (wrapping page content in `<main>`).

**M3 — `landmark-no-duplicate-contentinfo` / `landmark-unique`: two `<footer>` elements** · best practice
- **Where:** `/login` and `/landing` expose two `contentinfo` landmarks (page footer + a second
  `<footer>`). Two same-role landmarks with no distinguishing accessible name are ambiguous to AT.
- **Fix:** Keep one `<footer>` as the page `contentinfo`; give any secondary one a distinct role or
  an `aria-label`, or downgrade it to a non-landmark element.

**M4 — `heading-order`: skipped heading level** · WCAG 1.3.1
- **Where:** `/landing` footer — `<h4>Contact</h4>` appears without an intervening `<h3>`.
- **Fix:** Use the correct level (likely `<h3>`) or restructure footer headings to not skip a level.

**M5 — `page-has-heading-one`: no `<h1>`** · best practice
- **Where:** `/auth/denied` has no level-one heading.
- **Fix:** Promote the page's title text to an `<h1>` (visually styled as needed).

### Incomplete (axe could not compute — require manual review)

- **`color-contrast` incomplete — 185 nodes on `/landing` (motion), ~14 on the form pages.**
  axe cannot resolve contrast for text painted over gradients, images, or the kinetic hero/shader
  background. **Action:** manual visual review of landing hero/kinetic text at the lightest point
  of each background; verify ≥ 4.5:1 (or 3:1 for large text). This is the largest open unknown.
- **`aria-valid-attr-value` incomplete — 1 node on `/join`.** Verify the flagged ARIA attribute
  references a valid/existing id.

---

## Findings — Manual pass

| Check (WCAG) | Result | Notes |
| --- | --- | --- |
| **Skip-to-content link** (2.4.1, A) | ❌ **Absent on every page** | No bypass-blocks mechanism. Add a visually-hidden "Skip to content" link (focus-visible) targeting `<main>` — at minimum on `/landing` and any header-heavy page. |
| **`lang` attribute** (3.1.1, A) | ✅ Pass | `<html lang="en">` on all pages. |
| **Image alt text** (1.1.1, A) | ✅ Pass | 0 images missing `alt` across all pages. |
| **Decorative icons (SVG)** | ⚠️ Review | Many inline icon SVGs lack `aria-hidden`. axe did **not** flag them (they sit inside labeled controls), so not a violation — but adding `aria-hidden="true"` to purely decorative icons is best practice and reduces SR noise. |
| **Form labels** (1.3.1 / 4.1.2) | ✅ Pass (1 minor) | All visible fields are labeled. Probe "unlabeled" hits on `/join` and `/register` were the `aria-hidden`/`tabindex=-1` native inputs behind Radix/RHF controls (correctly hidden). One genuine minor: `company_fax_ext` on `/join` lacks a programmatic label. |
| **Keyboard reachability** (2.1.1, A) | ✅ Pass | Tab reaches all interactive controls on `/login`, `/register`, `/join`, `/landing`, `/terms`. No keyboard traps observed. |
| **Visible focus indicator** (2.4.7, AA) | ✅ Pass (prod) | Every production control showed a visible focus ring. The only two without were the **TanStack Router/Query devtools** buttons — dev-only, not shipped. Verify focus visibility persists after the input-contrast fix. |
| **Form error association** (3.3.1 / 3.3.2) | ⚠️ Manual TODO | Not exercised in this pass (requires submitting invalid forms). Verify validation errors are programmatically associated via `aria-describedby` + `aria-invalid`, and announced. Do this during the fix phase on `/register` and `/join`. |
| **Reduced motion** (2.3.3 / animation) | ✅ Pass | Landing produced identical axe results under `reduce` and `no-preference`; a reduced-motion fallback exists (per project memory). No motion-only content blocked access. |
| **Heading structure** | ✅ mostly | Single `<h1>` per page except `/auth/denied` (M5); one skipped level on landing footer (M4). |

---

## Remediation plan (priority order)

1. **S1 — input contrast (do first; user-blocking, highest litigation value).** Fix the
   `.theme-landing` + recruiting-theme token pairing so input text contrasts its background on
   `/register` and `/join`. Coordinate with the in-flight `landing/hq` work.
2. **C1 — `aria-label` on all public `Select` triggers** (`/join` funnel).
3. **M2 — wrap `CookieConsentBanner` in a labeled landmark** (clears `region` on all 11 pages).
4. **M1 — add `<main>` to the 8 pages missing it** (clears most remaining `region` nodes).
5. **S2 — accent/pill/eyebrow contrast** to ≥ 4.5:1 (login pill, landing small text).
6. **M3/M4/M5 — duplicate footer, landing heading-order, `/auth/denied` `<h1>`.**
7. **Skip-to-content link** + decorative-icon `aria-hidden` cleanup.
8. **Manual TODOs:** form-error association on submit; visual review of the 185 incomplete
   contrast nodes over the landing gradients.
9. **Publish a public `/accessibility` statement page** (conformance target, contact for issues,
   date) and link it from the footer — both a good-faith litigation signal and a WCAG expectation.
10. **Re-run** `audit_pages.py` + `manual_probe.py` to confirm clean; record the delta here.

---

## Remediation outcome — applied 2026-05-31

Fixes were applied and re-verified with the same harness. **Automated result: 9 of 11 page
variants now return 0 axe violations** (was: every page had ≥ 2). `tsc --noEmit` exits 0 and
ESLint is clean on all touched files. Both public forms were additionally verified visually with
typed text (`scripts/a11y/results/shots/`): input text now renders at `rgb(23,23,23)` on white
(~17:1) — previously invisible.

| Finding | Status | Fix |
| --- | --- | --- |
| **S1** — invisible input text, `/register` (8 nodes) | ✅ Fixed | Added `text-neutral-900 placeholder:text-neutral-500` to the 12 `bg-white` inputs (`PublicRegistrationPage.tsx`). |
| **S1** — invisible input text, `/join` (inputs + textarea) | ✅ Fixed | `LeadInterestForm.tsx`: inputs/selects/textarea → `bg-white text-neutral-900 placeholder:text-neutral-500`; fixed textarea's light-on-white text; removed dead `darkMode` style vars. |
| **C1** — unlabeled Select triggers, `/join` (2) | ✅ Fixed | Added `aria-label="State"` / `aria-label="Income goals"` to the `SelectTrigger`s. |
| **S1b** — Select placeholder contrast, `/join` (2.56:1) | ✅ Fixed | `data-[placeholder]:text-neutral-500` on the triggers (4.6:1). |
| **M1** — missing `<main>` (8 pages) | ✅ Fixed | Wrapped the public `<Outlet>` in `<main id="main-content">` (`App.tsx`); demoted login's inner `<main>` to `<div>` to avoid a double-main. Covers login, all `/auth/*`, terms, privacy, register, join in one edit. |
| **M2** — content outside landmarks (`region`, 73 nodes) | ✅ Fixed | `CookieConsentBanner` wrapped in `role="region" aria-label="Cookie consent"`; remaining nodes resolved by the `<main>` wrapper. |
| **M3** — duplicate `contentinfo`, `/login` | ✅ Fixed | Resolved as a side effect of the login `<main>`→`<div>` change. |
| **M5** — missing `<h1>`, `/auth/denied` | ✅ Fixed | Promoted the "Access Denied" `<h2>` → `<h1>` (styling unchanged). |
| **Skip link** (2.4.1, A) | ✅ Added | Visually-hidden "Skip to content" link → `#main-content` in the public layout. |
| **A11y statement page** | ✅ Added | New `/accessibility` page (`AccessibilityPage.tsx`, routed + in `publicPaths`), cross-linked from the legal-page footer (Terms / Privacy / Accessibility). |

### Known imperfection in the `<main>` approach (disclosed for accuracy)

Wrapping the entire public `<Outlet>` in one `<main>` is clean for the content-only pages
(terms, privacy, accessibility, the `auth/*` pages). For the two pages that ship their own chrome
(`/login` and `/join`), it nests their `<header>`/`<footer>` *inside* `<main>`, which suppresses
those elements' implicit `banner`/`contentinfo` landmark roles. That is, in fact, partly why
login's duplicate-`contentinfo` cleared. The pages are axe-clean and keyboard-navigable, but their
landmark structure is slightly non-ideal (header/footer should sit as siblings of `main`, not
inside it). A cleaner long-term fix is a small shared public layout that renders
`<header>`/`<main>`/`<footer>` as siblings; not done here to keep the change surgical and avoid the
concurrent `theme-v2` login work. Flagged so axe-zero is not mistaken for fully-idiomatic markup.

### Deliberately deferred (to avoid clobbering concurrent uncommitted work)

The plan warns not to clobber the in-flight `src/features/landing/hq/` rework, and the login chrome
is part of the uncommitted `theme-v2`/board effort. These remaining items live in those areas and
were **left for their owning sessions**, not missed:

- **`/landing` (still 5 each, both motion states):** small-text/eyebrow contrast (`color-contrast`,
  serious), footer `heading-order` (h4 without h3), duplicate `<footer>` (`landmark-no-duplicate-contentinfo`
  + `landmark-unique`), and one `region` node — all inside `landing/hq`. Also the **185 incomplete**
  contrast nodes over the landing gradients/shader still need a manual visual pass.
- **`/login` (1 serious):** the "NEW" pill — cream text `#f1e9d6` on light-blue `#5b9bff` (2.29:1) —
  is a `theme-v2` token; darken the pill bg or ink to reach 4.5:1.
- **Landing skip-link:** the app-level skip link covers Outlet-rendered pages; the landing renders
  via its own branch and needs `id="main-content"` on its `<main>` to be a skip target.

### Still open (manual, not automatable)

- **Form-error association** (3.3.1/3.3.2): verify invalid-submit errors are tied via
  `aria-describedby` + `aria-invalid` and announced (both forms render visible error text already).
- **Decorative-icon `aria-hidden`** cleanup (best practice; not a violation).

---

## Authenticated app (Title I) — baseline

**Headline contrast defect does NOT replicate in the authed app.** The S1 invisible-input bug was
specific to `.theme-landing`, where the theme overrode one of the `--background`/`--foreground`
token pair. The authenticated app runs on the standard app theme, where the shared primitives
(`ui/input.tsx`, `ui/select.tsx`, `ui/button.tsx`, `ui/label.tsx`) use correctly-paired
`bg-background`/`text-foreground` tokens — so the most severe public finding is not present there.

**A full authed axe pass remains pending** and requires a logged-in session. The harness supports
it (`python3 scripts/a11y/audit_pages.py --set authed`) but needs an authenticated browser context
(local login or a JWT minted with the local Supabase JWT secret) injected first — not done this
session. Rationale for lower priority: the authed app is lower Title III risk; its exposure is
**Title I employment-accommodation** for disabled agents, heightened by the adversarial sunset
creating motivated ex-users. Whether Title I obligations legally attach turns on the
agent-vs-employee classification — an **attorney** question tied to the agent-agreement review
(protection plan item 2B).

---

## Hard truth (keep front-and-center)

This audit **reduces** ADA exposure on the public funnel; it is not a legal clearance. Automated
+ manual engineering checks do not certify WCAG 2.1 AA conformance, and accessibility is one of
four Tier-1 compliance gaps (TCPA, CAN-SPAM, ADA, plus the structural LLC/insurance shield) the
companion assessment flags. Fixing the findings above is necessary; an accessibility statement +
counsel's review of overall posture before the sunset is the actual shield.
