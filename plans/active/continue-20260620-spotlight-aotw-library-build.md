# CONTINUATION — Spotlight: Agent-of-the-Week view + Template Library + customization controls

**Created Jun 20 2026. Resume target. The Spotlight ("/social-studio") page is
LIVE and STABLE (Phase 1). This doc is the next build: wire the bespoke Agent of
the Week into the page, add a template LIBRARY, and the font/background/size
controls the owner asked for.** Everything is UNCOMMITTED on the current branch.

───────────────────────────────────────────────────────────────────────
✅ STEP 1 DONE — Jun 20 2026 (UNCOMMITTED; owner visual sign-off pending). NEXT = STEP 2.
───────────────────────────────────────────────────────────────────────
AOTW wired in as the 4th cadence view + design picker. Files changed:
- `types.ts` — `SocialView` += "aotw"; `aowDesign: AowDesign` (default "aurora");
  `VIEW_META.aotw` (period "weekly"). (Kept the field name `aowDesign` to match the
  card's existing exported `AowDesign` type — do NOT rename; it ripples into the
  approved card + render harness.)
- `SocialStudioPage.tsx` — "Agent of Week" pill; `aotw` branch in `previewData`
  (live = `producers[0]`, guarded; sample = `SAMPLE_AOTW`); per-view sample gate;
  caption body for aotw (sends agent AP+policies).
- `SocialPreview.tsx` — `aotw` variant in `PreviewData` union + 3-way render of
  `AgentOfWeekCard`.
- `SocialCustomizer.tsx` — Design picker (aotw-only); Top-N/Headline/Show-policy AND
  the dead Theme toggle hidden on aotw.
- `QuickPostsPanel.tsx` — "Agent of the Week" preset → `{view:"aotw"}` (was the old
  `{view:"weekly",topN:1}` fake).
- `sampleData.ts` — `SAMPLE_AOTW` (= weekly sample's #1, DRY).
- `supabase/functions/generate-social-caption/index.ts` — accepts `view:"aotw"`;
  kind phrase "Agent of the Week spotlight"; labels agent AP as the agent's (not
  agency total); system prompt mentions the spotlight. (Edge fn still DEPLOY-PENDING.)

REVIEW-FIXED BUGS — DO NOT REINTRODUCE (adversarial workflow + advisor):
1. AOTW with 0 real producers must FORCE sample (badge + download blocked) — else it
   fabricated a canned "Marcus Webb" agent that rendered as LIVE and was downloadable
   (no-mock-data + sample-download-guard violation). Fix = `config.view==="aotw" &&
   !hasLive ? true : overridden`. ⚠️ Verified by INSPECTION only — the local agency
   has 1 producer so the 0-producer path never runs in the smoke.
2. Sample gate must be per-view: AOTW needs only 1 producer, not the leaderboard's
   `<5` floor (`minProducers = view==="aotw" ? 1 : 5`) — else a real 1–4-producer
   agency saw the sample agent and couldn't download their real #1.
3. AI caption: the edge-fn allowlist + kind phrase + AP label must handle aotw.
KNOWN MINOR (not fixed, by design): in the 0-producer AOTW state the "Preview with
sample data" switch is forced ON and can't be toggled off (can't go live with no
data) — acceptable, but could read as a stuck control.

VERIFY STATUS: `tsc` 0, `npm run build` 0, `deno check` (edge fn) 0, extended
`social-studio-smoke.py` 18/18 + 0 console errors, 3 designs visually confirmed
in-app (Aurora/Editorial/Noir). Did NOT regenerate database.types.ts (no schema).

═══════════════════════════════════════════════════════════════════════
WHAT ALREADY EXISTS (reuse — do NOT rebuild)
═══════════════════════════════════════════════════════════════════════
- `/social-studio` route + sidebar nav "Spotlight" (owner-only, superAdminOnly).
  `src/router.tsx` (socialStudioRoute), `src/components/layout/sidebar/sidebar-nav.config.ts`.
- `src/features/social-studio/SocialStudioPage.tsx` — page: cadence PillNav
  (Daily/Weekly/Monthly), live preview (agency-scoped, producers-only, AP-sorted),
  **"Preview with sample data" toggle** (`sampleOverride`/`isSample`, auto-on when
  <5 producers), customizer, quick posts, automation placeholder, client `html-to-image`
  download (blocked while isSample).
- `src/features/social-studio/components/SocialPreview.tsx` — scales card to fit
  viewport (MAX_W 540 / MAX_H 560), `cardRef` for export.
- `src/features/social-studio/components/SocialCustomizer.tsx` — format/theme/topN/
  headline/showPolicies/caption(+tokens)/AI-generate/sample-toggle.
- `src/features/social-studio/components/QuickPostsPanel.tsx`, `types.ts`, `sampleData.ts`(20 rows).
- CARD COMPONENTS in `src/features/leaderboard/social/`:
  - `LeaderboardSocialCard.tsx` (top-N by AP; two-column when >10; `showPolicies`).
  - `MonthlyReportCard.tsx` (recap).
  - `AgentOfWeekCard.tsx` — **DONE**: 3 designs `aurora`|`editorial`|`noir`, props
    `{agencyName, network, periodLabel, agent:{name,ap,policies,photoUrl?}, format, design}`.
    Photo renders in a unique shape (arch/arch/circle) via `PhotoShape`, monogram fallback.
  - `socialFormat.ts` (`toLastInitial`, `usd`).
- Data: `leaderboardService.getAgencyAgentLeaderboard(filters, agencyId)` +
  `useAgencyAgentLeaderboard({filters, agencyId})` (p_scope:'agency', AP re-sort).
  Agency from `useImo().agency?.id`; network from `useImo().imo?.name`.
- AI caption edge fn `supabase/functions/generate-social-caption/` (deploy pending).
- RENDER HARNESS `scripts/leaderboard-card-render/` — Vite+Playwright; `entry.tsx`
  supports `?view=aotw&design=…`; fonts loaded in `index.html` (Unbounded, Syne,
  Space Grotesk, Instrument Serif + app fonts). `run.mjs` (RENDER_CADENCES env for
  cadence renders). Approved AOTW PNGs in `out/aotw-{aurora,editorial,noir}-post.png`.
- SMOKE `scripts/social-studio-smoke.py` (authed, owner; .env.local has E2E creds;
  dev server on :3000). All green.
- ⚠️ `playwright` is now a devDependency `^1.61.0` (was pruned once; browsers cached).

═══════════════════════════════════════════════════════════════════════
BUILD THIS (ordered; verify build+smoke after each step)
═══════════════════════════════════════════════════════════════════════

### STEP 1 — Agent of the Week as a studio view  ✅ DONE (Jun 20 2026 — see status block at top)
- Add `"aotw"` to `SocialView` in `types.ts` and a 4th item to the cadence PillNav
  ("Agent of Week"). VIEW_META entry (period: "weekly").
- In SocialStudioPage `previewData`: add an `aotw` branch returning a new
  PreviewData kind `{kind:"aotw", agent, periodLabel, design}`. Live: the week's #1
  producer = `producers[0]` (weekly range); sample fallback uses
  `toLastInitial("Marcus Webb")`, ap 52400, policies 31, photoUrl placeholder.
- `SocialPreview.tsx`: render `AgentOfWeekCard` for kind "aotw" (pass `design`).
- Add a **design picker** (Aurora/Editorial/Noir) to the customizer, shown only when
  view==="aotw". Store `aowDesign` in config (`types.ts`).
- AOTW has no top-N/showPolicies — hide those customizer fields when view==="aotw".

### STEP 2 — Agent photo upload (Supabase Storage)  ✅ DONE (Jun 20 2026 — see status block below)

> **✅ STEP 2 DONE (Jun 20 2026, UNCOMMITTED, owner sign-off pending). NEXT = STEP 3.**
> Migration `20260620192348_spotlight_assets_bucket.sql` applied **local + prod** (public
> bucket, 10MB, image mimes; 4 RLS policies). **Deviations from this spec (deliberate):**
> (1) write-scoping by `auth.uid()` folder NOT `<imo_id>` (super-admin imo_id unreliable;
> public bucket = no read-isolation loss). (2) The card renders the photo from a **data URL**
> (read from the File) NOT the remote storage URL — html-to-image silently drops remote
> images on a CORS miss; the file is ALSO uploaded to Storage for the public URL (P2/P3 IG).
> (3) `crossOrigin` was NOT re-added to PhotoShape (the render harness feeds a non-CORS
> pravatar; re-adding it breaks `run.mjs`). Files: `types.ts` (aowPhotoUrl + aowPhotoStorageUrl),
> `SocialStudioPage.tsx` (handleUploadPhoto atomic dataURL+upload, handleRemovePhoto delete,
> photoUrl threading, ALLOWED_PHOTO_TYPES), `SocialCustomizer.tsx` (uploader UI),
> `generate-social-caption` unchanged. New `scripts/spotlight-assets-rls-check.sql`.
>
> **REVIEW-FIXED (adversarial workflow `wf_3a54d57f-97f` + advisor) — DO NOT REGRESS:**
> (A) client MIME gate must whitelist jpeg/png/webp/gif (was `startsWith("image/")` → HEIC
> dead-ended). (B) stable per-user key `${uid}/aotw-photo` + `upsert:true` so re-uploads
> never orphan; handleRemovePhoto calls `storage.remove` (actually deletes — was config-null
> only). (C) read policy `TO authenticated` (was PUBLIC → anon could `list()`/harvest faces;
> public-URL fetch unaffected). (D) write-open-to-any-authenticated accepted (mirror-consistent
> w/ recruiting-assets; bounded to 1 object/user by the stable key).
>
> **VERIFY:** tsc 0, build 0, deno-check (caption fn) 0, `social-studio-smoke.py` 22/22 + 0
> console errors (uploads a real image → renders → exports; READ export PNG = photo + fonts
> correct), RLS check 4/4 local+prod (incl. anon-enumeration-denied), HTTP: public GET 200 +
> anon list `[]`. **database.types.ts unchanged** (storage-only).
>
> ⚠️ **LOCAL LIMITATION (env, not code):** the local storage emulator ships `storage.prefixes`
> with RLS-enabled/no-policy → object DELETEs 400 for EVERY bucket locally (verified on
> instagram-media too). **Prod has no prefixes table → `storage.remove()` works.** So the
> "Remove" delete is verified by mechanism + prod, NOT locally; confirm on prod with a real
> upload+remove. The smoke filters this local-only storage 400.
- New PUBLIC bucket `spotlight-assets` (migration, mirror
  `supabase/migrations/20260106_001_instagram_storage_bucket.sql`): public read,
  service_role all; also allow authenticated INSERT scoped by path
  `spotlight-assets/<imo_id>/...`. Set bucket CORS to allow the app origin (needed
  so `html-to-image` can read the photo for PNG export without canvas-taint —
  re-add `crossOrigin="anonymous"` to PhotoShape's `<img>` ONCE the bucket sends
  CORS; it was removed for the no-CORS pravatar placeholder).
- Uploader UI in the customizer (view==="aotw"): `<input type=file accept=image/*>`
  → `supabase.storage.from('spotlight-assets').upload(path, file, {upsert:true})`
  → `getPublicUrl` → set config.photoUrl. Show thumbnail + remove. Copy the
  upload+getPublicUrl flow from `supabase/functions/instagram-process-jobs/index.ts`.
- Pass photoUrl into the AOTW agent. Monogram fallback already handled.
- ⚠️ html-to-image + cross-origin image: verify the downloaded PNG includes the
  photo (needs bucket CORS + crossOrigin). If it taints, fetch the image as a blob
  and pass a data URL to the card for export.

### STEP 3 — Customization controls (font / background / sizes / agency-name)  ✅ DONE (Jun 21 2026 — see status block below)

> **✅ STEP 3 DONE (Jun 21 2026, UNCOMMITTED, owner sign-off pending). NEXT = STEP 4.**
> AOTW now has a full **Style** panel: font dropdown, design-filtered background swatches
> (+ image upload), and Name-size / Agency-name sliders.
>
> **CRITICAL GATE (advisor) — html-to-image is a DIFFERENT renderer than the harness.**
> The render harness (`run.mjs`) uses Playwright's NATIVE `element.screenshot()` (flawless);
> the real "Download PNG" uses client `html-to-image` toPng (SVG→canvas, LOSSY on
> backdrop-blur / gradients / cross-origin fonts). So a great harness PNG proves NOTHING
> about the download. New probe `scripts/aotw-export-probe.py` drives the REAL in-app
> download and saves the PNG to READ. Verified through the real export:
> (1) Google fonts (Unbounded) EMBED; (2) Fontshare fonts (Clash Display) EMBED;
> (3) aurora glass backdrop-blur survives; (4) bg-image + dark scrim stays legible;
> (5) data-URL agent photo embeds. **→ parametrize-the-DOM + html-to-image is VIABLE;
> the deferred Vercel @sparticuz/chromium render fn is NOT needed.**
>
> **LATENT BUG FIXED:** `index.html` did NOT load Unbounded/Syne/Space Grotesk/Instrument
> Serif (only the harness did) → the in-app preview AND the production download were
> rendering FALLBACK fonts. Added them + the new dropdown fonts (Bricolage via Google;
> Clash Display/Satoshi/General Sans via Fontshare CDN).
>
> **FILES:** `AgentOfWeekCard.tsx` (optional `AowStyle` prop { fontDisplay?, background?,
> backgroundImageUrl?, titleScale?, agencyScale? }, threaded through all 3 designs; per-design
> SIGNATURE_FONT/DESIGN_BG fallbacks so defaults are byte-identical; dark scrim as first child
> for bg images; header rows `flexWrap` for big agencyScale). `types.ts` (+5 config fields +
> defaults). `SocialCustomizer.tsx` (Style panel; font `<Select>` w/ "__default__" sentinel;
> design-filtered swatches — dark/saturated for aurora+noir, light "paper" for editorial;
> bg-image upload tile ONLY on light-text designs; two `<Slider>`s; **Design switch RESETS bg**
> — a dark bg can't bleed onto editorial's dark text — but KEEPS font+scales, which are
> regime-agnostic). `SocialStudioPage.tsx` (style object in previewData aotw branch + deps;
> `readFileAsDataUrl` DRY helper; `handleUploadBgImage` data-URL-ONLY — bg is baked into the
> export so it needs NO Storage round-trip, unlike the agent photo; hardened `handleDownload`
> with `await document.fonts.ready` before toPng to beat a select-then-download font race).
> `SocialPreview.tsx` (threads style). `index.html` + harness `index.html`/`entry.tsx` (fonts +
> style query params).
>
> **ADVERSARIAL REVIEW (workflow `wf_5ada65c1-5a2`, 20 agents) — 11 findings confirmed & ALL
> FIXED; 5 rejected (verifiers caught a fabricated "blur-absent" finding citing a nonexistent
> file + misread stacking-order + 3 non-bugs). Fixes:** (MED) editorial subtitle `fontStyle:
> 'italic'` was silently reset by the later `font` shorthand → embedded `italic` IN the shorthand
> (now follows dispFont too, so the picked font reaches the caption; default = italic serif as
> intended). (MED) editorial portrait/masthead collision at high agencyScale → capped the agency
> slider at **2× (was 3×)** + nowrap/ellipsis/maxWidth:60% on the editorial agency span (+ nowrap
> on noir's). (LOW) `toPng` now `pixelRatio:1` (retina was exporting 2160px vs the "1080px" copy);
> remove-bg-image button also clears `aowBackground`; `handleDownload` captures the filename
> BEFORE the awaits (view/format switch race); `bgImage` is design-guarded (`!== editorial`) so a
> future template can't darken editorial into illegibility; Fontshare `preconnect`; AowStyle
> JSDoc corrected (aurora wordmark DOES follow dispFont).
>
> **VERIFY (post-fix):** tsc 0, `npm run build` 0, **vitest `test:run` 1767 passed / 0 failed**,
> harness 3 designs + editorial-agency-2× (italic subtitle confirmed, no collision),
> `social-studio-smoke.py` 31/31 + 0 console errors (incl. all new Style controls + design-switch
> bg reset), 5 real html-to-image exports READ + confirmed (Unbounded + Clash-Display fonts embed,
> aurora blur survives, bg-image+scrim legible). database.types.ts UNCHANGED (no schema).
>
> **OWNER FEEDBACK (Jun 21 2026, post-showcase) — 2 changes applied:**
> (1) **Removed the initials/monogram placeholder** entirely ("icon circle to the left of the name —
> irrelevant, takes too much space"). `PhotoShape` now renders ONLY a real uploaded photo; when none,
> the card renders clean (name takes the space). All 3 designs conditionally render the photo block
> (`{agent.photoUrl && …}`); dropped `initialsOf`, the monogram fallback, and the `initials/bg/fg/
> initialsFont` props. NOTE: the leaderboard cards' small per-row avatars are a DIFFERENT element and
> were left as-is (a ranked list wants row identifiers). (2) **Instagram dimensions updated to 2026
> specs** (square is no longer the feed default). New `SocialFormat = "portrait" | "square" | "story"`
> + `FORMAT_DIMS` in `socialFormat.ts` (single source of truth): portrait **1080×1350 (4:5, the new
> DEFAULT)**, square 1080×1080, story/reel 1080×1920 (Stories & Reels share the canvas; landscape
> 1.91:1 omitted — too short for these dense cards). Threaded through all 3 cards (only `H` changes;
> `isStory` still governs the type SCALE so portrait+square share the compact scale), `types.ts`
> (DEFAULT_CONFIG.format="portrait"), `SocialCustomizer` (3 full-width format pills), `SocialPreview`
> (FORMAT_DIMS scaling), harness `entry.tsx`/`run.mjs`. **MonthlyReportCard fix:** its bottom-anchored
> top-5 left a middle void at the taller portrait height → wrapped the rows in a `space-between` filler
> (like the leaderboard) so they distribute evenly; verified at portrait AND square. Re-verified: tsc 0,
> build 0, harness all designs + cadences in portrait (monogram-free, no void), smoke 31/31 + 0 errors,
> real export now **1080×1350**.
>
> **DEFERRED to STEP 4 / future (not built):** persisting style in a template (note: `aowBgImageUrl`
> is a data URL — strip/re-upload before saving a template); per-design font *recommendations*;
> the broader restyle of daily/weekly/monthly cadence cards into the standout directions (they now
> render correctly in portrait, but a deeper portrait-optimized restyle is still deferred). Owner
> visual sign-off pending; **edge fn `generate-social-caption` STILL deploy-pending** (unchanged).

ORIGINAL STEP-3 SPEC (kept for reference):
This REQUIRES parametrizing the card components (currently fonts/bg/sizes are
hardcoded). Add an optional `style` config object to the card props:
`{ fontDisplay?, fontBody?, background?, titleScale?, agencyScale? }` and thread it
through LeaderboardSocialCard / MonthlyReportCard / AgentOfWeekCard with sensible
defaults (so nothing breaks). Then:
- **Font dropdown**: curated modern fonts (Clash Display, Unbounded, Space Grotesk,
  Syne, Bricolage Grotesque, Instrument Serif, Satoshi/General Sans). LOAD THEM IN
  THE APP: add to `index.html` Google-Fonts `<link>` (Fontshare ones via their CDN
  `<link>`), mirroring the harness `index.html`. Map dropdown → fontDisplay.
- **Background picker**: solid / gradient presets / **image upload** (reuse Step 2
  uploader → background image with a dark legibility overlay). Applies to card bg.
- **Font-size + agency-name sliders** → titleScale / agencyScale multipliers.
- Make agency name a hero option (the owner wants it "a lot larger").

### STEP 4 — Template library (save + pick)  ✅ DONE (Jun 21 2026 — see status block below)

> **✅ STEP 4 DONE (Jun 21 2026, UNCOMMITTED, owner sign-off pending). Spotlight AOTW build COMPLETE.**
> Save the current card STYLE + pick from starters or saved templates.
>
> **MIGRATION `20260621095010_social_templates.sql` — APPLIED LOCAL + PROD.** Table {id, imo_id NOT NULL→
> imos, agency_id→agencies, owner_id NOT NULL→user_profiles ON DELETE CASCADE, name, **config jsonb (STYLE
> ONLY — no per-post photo/bg-image)**, created_at/updated_at} + updated_at trigger. RLS MIRRORS
> `public.prospects` (the canonical recent pattern): owner-scoped SELECT/INSERT/UPDATE/DELETE via
> `get_effective_imo_id()` + `super_admin_in_scope(imo_id)` + `revocation_deny` RESTRICTIVE. **Grant
> hardening** (security lesson): `REVOKE ALL FROM anon, authenticated; GRANT SELECT,INSERT,UPDATE,DELETE TO
> authenticated` (anon = nothing; authenticated = RLS-gated DML, NO TRUNCATE). NO view/design columns or
> CHECK-on-enum (config jsonb is the single source; enforce via TS). database.types.ts REGENERATED (+112,
> additive). Decided AGAINST a stored thumbnail_url — gallery tiles mount the REAL scaled card instead.
>
> **DECISION — a template = reusable STYLE, NOT per-post content.** `toTemplateConfig()` (types.ts) strips
> `aowPhotoUrl`/`aowPhotoStorageUrl`/`aowBgImageUrl` (the latter is a big data URL) before save →
> `SocialTemplateConfig`. Applying a template (`onApply={(c)=>patch({aowBgImageUrl:null, ...c})}`) restores
> the style, CLEARS any per-post bg image, and PRESERVES the uploaded agent photo.
>
> **FILES:** `socialTemplateService.ts` (+index) (owner_id from `auth.getUser()`, imo_id/agency_id from
> `useImo()`; throw-on-error — mirrors prospects), `hooks/useSocialTemplates.ts` (useQuery + create/delete
> useMutation, root-key invalidation, sonner), `types.ts` (toTemplateConfig + SocialTemplateConfig),
> `components/SocialLibrary.tsx` (Save-current input + 6 hardcoded BUILTIN_PRESETS starters + saved grid;
> `TemplateThumb` mounts the real card scaled w/ sample data + theme wrapper; per-tile delete spinner),
> `SocialStudioPage.tsx` (wires the Library board, imoId, applyTemplate wrapper), `SocialPreview.tsx`
> (`data-testid="social-preview"`).
>
> **ADVERSARIAL REVIEW (workflow `wf_fc8b82fb-12d`, 12 agents) — security-RLS dimension found ZERO issues
> (migration clean); 5 findings confirmed & FIXED, 3 rejected** (verifiers tossed a self-labeled-intentional
> perf note, a delete no-op matching the prospects mirror, a self-refuted smoke claim). FIXES: (MED, flagged
> by 3 reviewers) **caption was persisted in templates** → applying clobbered the working caption; added
> `caption` to `TEMPLATE_OMIT_KEYS` so it's stripped (per-post content, like the photo). (LOW) `useSocialTemplates`
> `isError` unhandled → a load failure showed "No saved templates" → render an error note. (LOW) a no-title
> template left a stale leaderboard headline → `onApply` pre-clears `title` (mirrors the `aowBgImageUrl` pattern).
>
> **VERIFY (post-fix):** tsc 0, build 0, vitest 1773 pass, `scripts/social-library-smoke.py` **8/8** (save→
> appears→apply switches preview→**caption preserved**→delete, 0 console errors), `social-studio-smoke.py`
> re-scoped to the preview pane (Library thumbnails render real cards incl. "BY ANNUAL PREMIUM" → assertions
> scope to `[data-testid=social-preview]`) + green, SECURITY: anon SELECT/INSERT = permission denied,
> authenticated (no JWT) = 0 rows. Owner sign-off pending.

ORIGINAL STEP-4 SPEC (kept for reference):
- Migration: `social_templates` table — `id, imo_id, agency_id, owner_id, name,
  view (social_view), design, config jsonb (the full SocialStudioConfig + style),
  thumbnail_url?, created_at`. RLS by `get_my_imo_id()`; REVOKE anon/authenticated
  then scoped GRANT (project audit lesson). Regenerate database.types.ts.
- UI: a "Library" section/tab — a gallery of (a) BUILT-IN presets (the 3 AOTW
  designs + the cadence card styles, seeded as read-only entries or hardcoded) and
  (b) the owner's SAVED templates. Click a template → applies its config to the
  studio. "Save current as template" (name it) → inserts a row. Optional: render a
  thumbnail via the (future) prod render fn or html-to-image and store it.
- Hook + service for templates (TanStack Query), mirroring leaderboard hooks.

═══════════════════════════════════════════════════════════════════════
GOTCHAS / DECISIONS
═══════════════════════════════════════════════════════════════════════
- App font loading: the experimental fonts are ONLY in the harness index.html; they
  must be added to the APP `index.html` (or @font-face) or the in-app preview shows
  fallback fonts. (The harness renders correctly because it loads them.)
- html-to-image fidelity with custom fonts/gradients/blur: backdrop-blur (aurora
  glass) may NOT capture in html-to-image → the downloaded PNG could differ from the
  preview. If so, this is where the deferred Vercel `@sparticuz/chromium` render fn
  (P2 in `continue-20260620-social-studio-implementation.md`) earns its place — use
  it for downloads/exports. Test aurora download specifically.
- Keep `isSample`/sample-toggle behavior for AOTW too (thin data → sample agent).
- AOTW "view" vs cadences: AOTW is weekly-scoped; reuse the weekly range label.
- Don't reintroduce the review-fixed bugs (producers filter, weekRange cross-month,
  download blocked on sample). See `continue-20260620-social-studio-implementation.md`
  SESSION-2 UPDATES for the full fixed/deferred list (deferred: POL-vs-AP count
  semantics, caption-token resolution, owner-with-null-agency fallback).

═══════════════════════════════════════════════════════════════════════
VERIFY (every step)
═══════════════════════════════════════════════════════════════════════
- `npx tsc --noEmit` clean for the touched files + `npm run build` zero errors.
- Extend + run `scripts/social-studio-smoke.py` (assert: AOTW view renders each
  design; photo upload control present; library gallery present; download works on a
  real/sample card; 0 console errors). Dev server already on :3000; `.env.local` has
  E2E_EMAIL/E2E_PASSWORD (owner/super-admin).
- For card visuals, render via `scripts/leaderboard-card-render/run.mjs` and READ the
  PNGs to self-verify before showing the owner.
- After any migration: regenerate `database.types.ts` (use `node scripts/dbtype.mjs
  <name>` to inspect; NEVER read database.types.ts whole).

═══════════════════════════════════════════════════════════════════════
DEFERRED (not this build): AI image enhancement (owner chose SKIP — needs a paid
image-gen model, Claude can't generate images); P2 scheduling/auto-post/Instagram;
restyle daily/weekly/monthly into the new standout directions (after Step 3 makes
cards parametrizable). Memory: [[social-studio-build]].
