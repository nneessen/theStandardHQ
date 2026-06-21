# Social Studio — Implementation Plan (Jun 20 2026)

Source: 7-agent architecture workflow `wf_ead42c9e-dd5` (plan + adversarial review),
verified against the live repo. This is the build spec. Requirements live in
`continue-20260620-canva-integration-options.md` (BUILD REQUIREMENTS, locked).

## Decided (do not re-litigate)
- **Render**: productionize `scripts/leaderboard-card-render/` as a Vercel serverless
  fn (`@sparticuz/chromium` + `puppeteer-core`) — ONLY for download/worker. NOT on
  the Phase-1 critical path (see below). Deno Edge can't host Chromium; satori drops
  CSS custom-property tokens → colorless cards.
- **Live PREVIEW = client-side React** (mount the real card components in `.theme-v2`).
  Zero infra. This moves review items H2+H3 off Phase 1.
- **Phase-1 download = client-side `html-to-image`** (new dep), not the Chromium fn.
- **IG**: REUSE existing `instagram_integrations` (AES-256-GCM tokens, Instagram-Login
  path, daily `instagram-refresh-token` cron) + the SKIP-LOCKED job-queue RPCs +
  upload/`getPublicUrl` flow. The `/media`+`/media_publish` two-step is NET-NEW.
- **Data model**: `social_post_schedules` + `social_generated_posts` + enums; RLS via
  `get_my_imo_id()`; REVOKE anon/authenticated then scoped GRANT; public Storage
  bucket `social-studio-cards` (Meta + Canva fetch the URL unauthenticated).
- **Agency scope**: `useImo().agency?.id` → `get_leaderboard_data(p_scope:'agency',
  p_scope_id)`. NEVER hardcode the agency UUID. Re-sort by `ap_total` desc.
- **Nav/route**: `sidebar-nav.config.ts` "growth" group, `{ public:true,
  superAdminOnly:true }` (owner-only, like Marketing). Route in `src/router.tsx`
  `<RouteGuard superAdminOnly>`; add to `rootRoute.addChildren([...])` (line ~1254).

## Review fixes — fold into the RIGHT phase
- **H1 (P2)**: IG Graph API version = **v25.0** (NOT v21.0). Use one `IG_API_VERSION`.
- **H2 (P2 render fn)**: render endpoint MUST auth — Supabase JWT (client preview)
  + shared `VERCEL_RENDER_SECRET` header (worker). No open Chromium endpoint.
- **H3 (P2, SPIKE FIRST)**: prove `@sparticuz/chromium/min`+`puppeteer-core` on Vercel
  with a hello-world screenshot + bundle file-tracing (`outputFileTracingIncludes`)
  + Google-fonts-load-before-`__READY__` BEFORE building on it. 250MB fn limit.
- **H4 (P2 schema)**: resolve the IG account by `integration_id` FK (or owner_id+imo_id),
  NEVER `imo_id` alone — `instagram_integrations` is UNIQUE(user_id,imo_id) with
  documented stale multi-row IMO matches. → put `instagram_integration_id` on schedules.
- **M1 (P2)**: flipping `auto_publish`→false must downgrade future `queued`→`draft`.
- **M2 (P2)**: ONE `* * * * *` heartbeat cron driving `next_run_at`; DROP per-cadence
  UTC cron entries (they can't honor per-schedule IANA tz).
- **M3 (P2)**: Stories (`media_type=STORIES`) don't surface a caption → burn caption
  into the story image, or label the editor "captions = feed posts only".
- **M4 (P3)**: route post customize/hold/reschedule through a SECURITY DEFINER RPC
  (whitelist columns + legal status transitions); revoke direct client UPDATE.
- **N1**: `day_of_month` 1..28 blocks true end-of-month; add sentinel (0=last day) if needed.
- **N2/N3**: prose/comment fixes (refresh fires at "expiring within 14d"; stale
  scope comment in `instagram-oauth-init`).

## Phasing (each shippable; P1+P2 need NO Instagram App Review for the owner)
- **P1 — owner-only manual studio (THIS build)**: nav + route + `SocialStudioPage`
  + agency-scoped live preview (real data + labeled sample fallback) + customization
  editor (drives preview) + client `html-to-image` download + AI one-offs panel (UI)
  + the two tables (so toggles/history persist, defaults OFF) with H4+M1 baked in.
  NO Chromium fn, NO IG calls, NO cron.
- **P2 — scheduling + auto-post (owner acct, Dev/Standard, no review)**: Chromium
  render fn (H2/H3) + `process-social-studio` 3-pass worker (gen/publish/reaper,
  SKIP-LOCKED) + `invoke_social_studio_worker()` SECDEF + 1-min cron + the new
  `/media`+`/media_publish` publish path (H1, 100/24h cap, retry/backoff, feed JPEG /
  Stories split) + IG connect card (reuse existing OAuth + refresh cron).
- **P3 — AI one-offs backend + multi-agency** (App Review + Business Verification;
  M4 secdef RPC; per-agency `instagram_integrations.agency_id` if needed).

## AI one-offs (owner asked: "think outside the box")
Ad-hoc post types beyond the 3 cadences — Agent of the Week, new-recruit welcome,
"we're hiring"/recruiting, policy/production milestone, win streak, work anniversary,
top rookie, fastest start, monthly motivational/quote, carrier shoutout, team vs team.
AI (reuse ANTHROPIC_API_KEY + the workflow email-template edge-fn pattern) drafts
caption + copy; owner edits before post. P1 = the panel UI + post-type catalog;
P3 = the generation backend.

## Files
P1: `sidebar-nav.config.ts` (+nav), `src/router.tsx` (+route), `src/features/social-studio/*`
(page + components + hooks), `src/services/leaderboard/leaderboardService.ts`
(+getAgencyAgentLeaderboard), `src/hooks/leaderboard/useLeaderboard.ts` (+hook),
`supabase/migrations/<ts>_social_studio_schema.sql` + `_bucket.sql`, regen
`database.types.ts`, smoke script (mirror `scripts/policy-dialog-smoke.py`).
P2: `api/render-social-card.ts`, `scripts/build-render-bundle.mjs`,
`supabase/functions/process-social-studio/`, `_cron.sql`.

═══════════════════════════════════════════════════════════════════════
SESSION-2 UPDATES (Jun 20 2026) — shipped + review + NEW design vision
═══════════════════════════════════════════════════════════════════════
SHIPPED on top of P1 (all tsc/build/smoke green):
- AI CAPTION GEN: edge fn `generate-social-caption` + "Generate with AI" button
  (gated by useAiAccess). ⚠️ deploy `supabase functions deploy generate-social-caption`.
- Two-column layout for Top 20 (card splits >10 rows; compact rows drop avatar/POL).
  Removed the 10/15 rowCap; sample roster expanded to 20.
- Bigger preview (PREVIEW_W 460→600).
- Renamed nav+page "Social Studio" → "Spotlight" (the old label didn't fit the
  sidebar). Route path stays /social-studio.

CODE REVIEW (max effort, 94 agents, 73 findings, top 15). FIXED the confirmed
cluster: (#1/#3/#4) get_leaderboard_data returns ALL approved agents COALESCEd to
$0 → added `producers = entries.filter(apTotal>0)`; hasLive/rows/monthly-stats now
use producers (fixes the owner's "new agency shows $0 rows" reality); monthly stat
"AGENTS"→"PRODUCERS". (#5/#9) weekRange cross-month ("JUN 30–3") → format end with
month when months differ. (#12) footer "{n} AGENTS"→"TOP {n}". (#11) avatar bg
hardcoded white → `T.surface4` (light-mode visible). (#7) sample downloads blocked
(can't export fabricated data). (#10) removed sample-only growthLabel. (#8) smoke
asserted on QuickPosts label → now "agent of the month". (#6) narrowed useMemo deps.
DEFERRED (noted): (#2) POL column = IP count but AP = submit-date-any-status → for
daily/weekly they diverge (big AP, 0 POL); needs a new RPC "submitted count" field.
(#14) caption tokens insert literal text, unresolved in P1 (resolve on copy later).
(#15) owner with NULL agency_id → live never activates (super-admin not tied to one
agency); needs agency-picker or IMO fallback.

🎨 NEW DESIGN VISION (owner, Jun 20 — "make it awesome, not cookie-cutter"):
- MULTIPLE standout TEMPLATES per cadence (daily/weekly/monthly) — distinct
  layouts/styles, NOT the single Board look. Editorial/magazine, brutalist/
  statement, gradient/aurora glass, minimal-luxe, refined neo-board, etc.
- UNIQUE MODERN FONTS via a DROPDOWN (experimental, not limited to app fonts —
  e.g. Clash Display, Unbounded, Space Grotesk, Sora, Syne, Bricolage Grotesque,
  Instrument Serif, Satoshi/General Sans via Fontshare).
- AGENCY NAME much LARGER (hero-scale in templates).
- BACKGROUNDS: solid / gradient presets / UPLOADED IMAGE (with legibility overlay).
- Adjustable FONT SIZES (controls).
- Bespoke AGENT OF THE WEEK — completely different from the leaderboard table;
  single-agent editorial hero, real design principles, "make it awesome" (owner
  referenced "how we did Claude"; confirm exact ref).
- TEMPLATE LIBRARY — save customized designs as reusable templates ("build a
  library like these").
- AI IMAGE ENHANCEMENT — "generate/enhance the entire image from the existing one."
  ⚠️ REQUIRES an image-gen model; Claude/Anthropic CANNOT generate images. Needs a
  paid image API (fal.ai Flux / Replicate / OpenAI gpt-image-1) — OWNER DECISION
  pending. Independent of the design system; do design system first.
NEXT BUILD: design-template system (template config + N standout templates +
font/background/size controls + bespoke AOTW) → render+show → then library, then
(pending decision) AI image enhancement.
