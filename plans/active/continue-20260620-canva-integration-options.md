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
RECOMMENDATION
═══════════════════════════════════════════════════════════════════════
1. NOW: confirm connector → Business account. Lock a sample design (dark vs light).
2. SHORT-TERM: Path A — ship a "Bulk-Create CSV" export so daily/weekly/monthly
   works this week with the templates we build in Canva.
3. PRODUCT BUILD: Path B — native in-app social rendering (no Canva plan gate,
   scales to all agency owners). This is the real differentiator.
4. LATER/OPTIONAL: Path C for Enterprise customers only.

## Sample designs created in Nick's Canva (Jun 20 2026)
- Dark: design `DAHNI5fMZD0` — edit https://www.canva.com/d/8A14yhbH-9X0AoB
- Light: design `DAHNIydLh-U` (5 layout variants) — edit https://www.canva.com/d/zEA5qg_aQlSZB_S
- 6 more unsaved candidates available (3 dark / 3 light) from generate-design jobs
  `885ac35d-...` (dark) and `0fb5a1df-...` (light).

NEXT STEP when resuming: (a) which theme + sample, (b) confirm Business plan on the
connected account, (c) pick Path A and/or B to start building.
