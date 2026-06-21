# Canva Integration — Findings & Options (Jun 20 2026)

Goal: let agency owners turn real Standard HQ sales data into on-brand Instagram
content (posts/stories/reels) for daily / weekly / monthly reporting — for Nick
personally first, then for other agency owners (multi-tenant).

Theme to match (pulled from `src/index.css` `.theme-v2` + `src/components/board/tokens.ts`):
- Dark "Standard HQ": bg `#171717`, card `#252525`, tile `#2c2c2c`, blue `#5b9bff`,
  cyan `#46d8f5`, green `#5fd08a`, amber `#f4b43a`, red `#ff6a5d`, violet `#b69bff`,
  ink `#f3f3f4`.
- Light: bg `#eef0f3`, card `#fff`/`#f8f9fb`, blue `#3b82f6`, ink `#0f172a`,
  green `#059669`, amber `#f59e0b`, red `#b91c1c`.
- Fonts: Archivo (display), Hanken Grotesk (body/numbers), Space Mono (labels).

═══════════════════════════════════════════════════════════════════════
THE DECISIVE CONSTRAINT — Canva plan gating
═══════════════════════════════════════════════════════════════════════
Verified against canva.dev official docs (Jun 2026) + Canva help service:

- **Autofill API** (POST /v1/autofills — programmatic "data → branded design"):
  REQUIRES **Canva Enterprise** for BOTH the integration developer AND every
  end-user. Pro / Teams / **Business do NOT unlock it.** (Dev-only trial bypass
  available via Developer Portal for prototyping, not production.)
- **Bulk Create** (the in-editor UI feature, CSV → many designs): INCLUDED in
  Canva **Business (Teams)**, Pro, Enterprise, Edu, Nonprofit. NOT on Free.
- **Export API** (design → PNG/JPG/PDF): no Enterprise gate (Pro for transparent
  PNG / pro-quality).
- **Brand Template listing/dataset read**: Pro/Teams/Enterprise.

⚠️ FLAG: The Canva help service reported the *currently connected* account as
**Canva Free** ("Since you're currently on Canva Free..."). Nick says he signed up
for Business — the MCP connector may be linked to a different/free account. VERIFY
the connector points at the Business account before relying on Bulk Create.

═══════════════════════════════════════════════════════════════════════
THREE PATHS
═══════════════════════════════════════════════════════════════════════

## Path A — Bulk Create (no code, works on Business TODAY)  ◀ recommended start
- Build ONE brand template per format (post/story/reel) in the chosen theme.
- App exports a CSV shaped for Bulk Create (one row per agent: name, premium,
  policies, rank, date, period).
- In Canva: open template → Apps → Bulk Create → connect CSV → map fields →
  generate N posts in one pass.
- Pros: zero engineering, available now, owner stays in control of design.
- Cons: manual trigger; not embedded in the app; each owner does it themselves.
- App work needed: a "Download Canva Bulk-Create CSV" button on the
  leaderboard/reporting views (daily/weekly/monthly presets).

## Path B — In-app rendering (best product, NO Canva plan gate)  ◀ recommended build
- Render the social images INSIDE Standard HQ from real data using the theme
  tokens the app already has. Server function (HTML/CSS or SVG → PNG, e.g.
  satori/resvg or a headless-Chrome edge fn) produces 1080×1080 / 1080×1920.
- "Generate social post" button on leaderboard → preview → download / schedule.
- Multi-tenant native (uses existing `imo_id` scoping + existing data + theme).
- Optional Canva hand-off: push the PNG to Canva via `import-design-from-url`
  (or upload-asset) so owners can tweak — no Enterprise needed.
- Pros: full automation, no per-owner Canva plan dependency, scales to all agency
  owners, pixel-matches the app brand. Cons: real engineering; we own rendering.

## Path C — Canva Connect API + Autofill (the "dream", Enterprise-gated)
- True in-app: owner clicks → app calls Autofill with their data + brand template
  → design appears in their Canva → Return Navigation brings them back.
- BLOCKED unless Nick AND each agency owner are on **Canva Enterprise**.
- Keep as an optional "Connect your Canva" power-feature for Enterprise customers
  later; do NOT make it the foundation.

═══════════════════════════════════════════════════════════════════════
Connect API specifics (verified, for Path C / future)
═══════════════════════════════════════════════════════════════════════
- Base: `https://api.canva.com/rest/v1/`. Auth: OAuth 2.0 Authorization Code +
  PKCE (SHA-256), **per-user** tokens (correct for multi-tenant — one token pair
  per agency owner). Token exchange MUST be server-side (CORS blocks browser).
  Refresh tokens are single-use (store the new one each refresh).
- Autofill: `POST /v1/autofills` (scope `design:content:write`), body
  `{type:"create_from_brand_template", brand_template_id, data:{field:{type,...}}}`,
  async job → poll `GET /v1/autofills/{id}` (scope `design:meta:read`). Images
  must be uploaded as assets first (no external URLs). 60 req/min.
- Brand templates: `GET /v1/brand-templates` (`brandtemplate:meta:read`),
  dataset `GET /v1/brand-templates/{id}/dataset` (`brandtemplate:content:read`).
- Export: `POST /v1/exports` (`design:content:read`), async, download URLs expire
  24h. 20 req/min create, 750/5min + 5000/24h integration-level.
- Return Navigation: append `correlation_state` (≤50 chars) to `edit_url`; Canva
  returns signed `correlation_jwt` (validate vs Canva Keys API) with `design_id`.
- Scopes are NOT hierarchical; pre-configure each in Developer Portal.
- Private integration: usable only by Enterprise members, no review. Public
  integration (distribute to other orgs): Canva review queue. B2B-private-to-many-
  external-orgs is a gray area — likely needs public integration or partnership.

Full sourced report: research agent run on Jun 20 2026 (canva.dev docs).

═══════════════════════════════════════════════════════════════════════
PIVOT (Jun 20 2026) — the real ask + the right tool
═══════════════════════════════════════════════════════════════════════
Owner clarified: he wants REPORTING templates = a ranked LIST of the TOP-N
agents sorted by AP (high→low), for day / week / month, scoped to HIS AGENCY
ONLY (not the whole Epic Life IMO), and looking like the actual app.

- Canva `generate-design` (AI) CANNOT reproduce "The Board" — abandoned after 2
  misses. Confirmed dead end for fidelity.
- RIGHT APPROACH = render the leaderboard from the app's OWN components to PNG.
  Built `src/features/leaderboard/social/LeaderboardSocialCard.tsx` (pure,
  presentational; reuses Board/Cap/Num/T tokens) + headless render harness
  `scripts/leaderboard-card-render/` (vite+playwright, mirrors pdf-render-check).
  Renders dark/light × post(1080²)/story(1080×1920) → `out/*.png`. All 4 green,
  0 page errors. THIS looks like the app; awaiting owner look sign-off.

DATA WIRING (confirmed feasible, not yet built):
- `get_leaderboard_data(p_start_date,p_end_date,p_scope,p_scope_id,...)` — the
  `p_scope`/`p_scope_id` params allow AGENCY scoping (page currently hardcodes
  "all" = whole IMO). Returns ip_total + ap_total per agent.
- Rank by AP: re-sort entries by ap_total DESC, take top-N, re-number (the "all"
  scope's rank_overall leads on IP; the `submit` scope is AP-native but IMO-wide
  & unscopable). So: agency-scoped get_leaderboard_data → sort by AP client-side.
- Periods: calculateDateRange already supports daily / weekly / mtd → day/week/
  month. (Confirm exact "week" definition with owner later.)

OUTPUT FORMAT FORK (ask AFTER look sign-off):
- A) auto-generated PNGs from the app (real data, daily/weekly/monthly, zero
  manual work) — recommended. B) editable-in-Canva files (tweakable but fidelity
  drifts + manual data). Canva = optional editable export later, NOT the engine.

═══════════════════════════════════════════════════════════════════════
BUILD REQUIREMENTS — "SOCIAL STUDIO" PAGE (LOCKED Jun 20 2026, owner sign-off)
═══════════════════════════════════════════════════════════════════════
Owner approved the rendered cards (daily/weekly leaderboard + monthly report,
dark+light, post+story; branding THE STANDARD / EPIC LIFE; last-initial names).
Now build the actual page. MUST be comprehensive, NOT cookie-cutter/basic.

HARD REQUIREMENTS:
1. NEW owner-gated route + SIDEBAR NAV ITEM — visible to NICK ONLY for now
   (reuse existing super-admin / specific-user nav gating). 
2. Full editing capabilities — edit everything (title, top-N, metrics shown,
   theme, format, post time/timezone, caption) as schedule DEFAULTS and per a
   single queued post before it goes out.
3. On/off toggles — per cadence: a generation toggle AND a SEPARATE auto-post-to-
   Instagram toggle.
4. Fully automated daily posting when enabled (cron worker).
5. DEFAULT EVERYTHING OFF — agency just started, NO metrics/data yet. Nothing
   auto-generates or posts until the owner explicitly turns it on.
6. NO-METRICS EMPTY STATE — until real agency data exists, preview uses CLEARLY
   LABELED sample data ("Sample preview"); NEVER auto-post empty/garbage. Worker
   must skip/raise when a period has no real data.
7. AI ONE-OFFS — an ad-hoc generator for arbitrary posts beyond the 3 cadences:
   recruiting / "we're hiring", highlights, AGENT OF THE WEEK, new-recruit
   welcome, policy/production milestones, streaks, anniversaries, motivational.
   Reuse existing app AI infra (ANTHROPIC_API_KEY + edge fns, same as workflow
   email-template gen) to draft caption + pick template + fill copy; owner edits
   before posting. THINK OUTSIDE THE BOX on post types.
8. Scalable + ZERO security vulnerabilities — multi-tenant RLS by imo_id/agency_id
   on every table; IG tokens stored ENCRYPTED (never client-readable); idempotent
   worker w/ retries; IG 25/day rate-limit aware; least-privilege; no cross-agency
   leakage; secdef RPCs + REVOKE anon/authenticated where writes go through RPCs.
9. Canva = OPTIONAL "open in Canva to edit" export (import-from-url); not the
   engine (Autofill is Enterprise-gated; owner is Business).

PHASING (each shippable; Phase 1 needs NO Instagram App Review):
- P1: owner-gated page + live preview (real data w/ sample fallback) + full
  customization editor + manual "Generate now" + download. All toggles default
  OFF. No external posting, no tokens yet.
- P2: persistence (schedules + generated_posts tables, RLS) + render+upload-to-
  Storage pipeline + cron worker generating (NOT posting) into a review queue.
- P3: Instagram connect (encrypted tokens) + auto-post toggle + publish flow +
  rate-limit/retry/idempotency. (App Review / Business Verification as needed.)
- P4: AI one-offs generator (post types above) + caption tokens.

STATUS: 7-agent architecture workflow running (run wf_ead42c9e-dd5) → produces
build-ready plan + adversarial security review. AI-one-offs design to be added on
top of that output before building. BUILD STARTS once plan + review land.

═══════════════════════════════════════════════════════════════════════
RECOMMENDATION
═══════════════════════════════════════════════════════════════════════
1. NOW: confirm connector → Business account. Lock a sample design (dark vs light).
2. SHORT-TERM: Path A — ship a "Bulk-Create CSV" export so daily/weekly/monthly
   works this week with the templates we build in Canva.
3. PRODUCT BUILD: Path B — native in-app social rendering (no Canva plan gate,
   scales to all agency owners). This is the real differentiator.
4. LATER/OPTIONAL: Path C for Enterprise customers only.

## Canva account
- Connector reconnected Jun 20 2026 → now on **Canva Business (Teams)** (was Free).
- Existing Brand Kit on account: `kAHNI9X4ky4` (empty — paste palettes above; API
  cannot write colors). Bulk Create + Brand Kit confirmed available.

## Sample designs (in the Business account, Jun 20 2026)
- Dark: design `DAHNJKo-OOA` — edit https://www.canva.com/d/BkWG9NTsUY9fG-z
- Light: design `DAHNJL6xP88` — edit https://www.canva.com/d/Emlk1m9iZnmjeya
- NOTE: earlier samples `DAHNI5fMZD0` / `DAHNIydLh-U` are stranded on the old Free
  account — ignore them. More unsaved candidates from jobs `4b98ee01` (dark) /
  `cc4e3321` (light) if more variety is wanted.

NEXT STEP when resuming: (a) which theme + sample, (b) confirm Business plan on the
connected account, (c) pick Path A and/or B to start building.
