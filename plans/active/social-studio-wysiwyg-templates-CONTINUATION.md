# CONTINUATION — Social Studio: universal photo move/zoom + real new recruiting templates

> ✅ **DONE — Jun 27 (local commits, NOT pushed).** Both jobs built + render-verified
> against the real exported PNGs (not claims), then committed locally:
> - `ee9e19c4` — universal photo **move + zoom** on every photo card. Shared `PhotoFrame`
>   (objectPosition pan + transform-scale zoom anchored at the focal point); config now
>   carries a per-card `photoTransforms` map (keyed `"aotw"` + agent-id, so multi-agent
>   welcome posts each frame independently — no cross-view bleed); `SocialPreview` drag +
>   zoom slider + scroll-to-zoom generalized to AOTW **and** new-agent. Verified: AOTW +
>   newagent, portrait + story, centered/1× baseline vs panned + 1.8× and centered + 2.2×
>   (marker visibly relocates + enlarges).
> - `9babcbc1` — **all 13 recruiting variants real + selectable.** Added bigstat/ticket/
>   checklist/poster/neon/clock to the picker; implemented poster/neon/clock render; fixed
>   the ticket void + clip; added 2 NEW genres: **highway** (interstate exit sign) + **memo**
>   (out-of-office card). Every changed/new variant render-verified portrait + story; original
>   5 regression-rendered. tsc clean · 47 tests · full build green.
>
> ⚠️ HEAD is **3 ahead of origin/main** (`01018811` pre-existing + these two) — NOT pushed
> (Vercel deploys on push). Owner should decide on push + do PROD E2E in the live studio.
> The original handoff below is kept for context.

---


Resuming an intense Social Studio session in **commissionTracker** (theStandardHQ; React 19 + TS + Supabase).
The user is the owner / super-admin of **The Standard** (network **Epic Life**), testing in PROD. They are
(justifiably) frustrated: across the last sessions I CLAIMED two things were done that are NOT. Do not repeat
that. **Build them, render-verify the real PNG, then say it's done — never before.**

## The two things that are NOT done (this is the whole job)

### 1. Move + zoom an avatar photo on EVERY template that has a photo
The user has said repeatedly: "I need the capability of doing this for any template, period." Right now:
- **Drag-to-reposition** is wired for **AOTW only.** `SocialPreview.tsx` gates the live drag override on
  `data.kind === "aotw"` (line ~288) and `SocialStudioPage.tsx` only sets `repositionable` for the aotw view
  (line ~938). New-agent / welcome card photo is HARDCODED `objectPosition: "50% 50%"` (`NewAgentCard.tsx:142`).
- **Zoom / resize-to-fit does NOT exist at all.** There is no `photoScale`/`photoZoom` field anywhere, no
  slider, no scroll-to-zoom. The user wants to make a photo *fit* — that requires zoom, not just pan.

**Build a shared photo-transform that works on every card with a photo (AOTW, new-agent/welcome, any
recruiting card with a photo):**
- Model = `{ position: string /* "x% y%" */, scale: number /* 1.0–3.0 */ }`. Both are deterministic CSS, so
  the existing modern-screenshot export captures them with NO new export work (cards stay pure — see WYSIWYG
  rules below). Keep the photo→data-URL step (`fetchImageAsDataUrl`) that already exists.
- CSS on the `<img>` (inside its existing `overflow:hidden` clip box): `objectFit:"cover"`,
  `objectPosition: position`, `transform: scale(scale)`, `transformOrigin: position`. Zoom focuses on the
  same focal point you panned to; overflow is clipped by the container. This is the cleanest single mechanism.
  Strongly consider extracting a tiny `PhotoFrame` component (props: `src, position, scale, className`) and
  using it in AOTW + NewAgentCard + recruiting photo cards so there is ONE photo renderer, not three.
- `SocialPreview.tsx`: generalize, don't special-case. The drag overlay + live `liveData` override must apply
  to **any `data.kind` that carries a photo** (currently the override is `data.kind === "aotw"` only — change
  it to "card has a photo position field"). Add a **zoom control**: a small slider (and/or wheel-to-zoom over
  the photo) wired to a new `onPhotoScaleChange`. The drag math already in `endDrag`/`onPointerMove` is correct
  — reuse it; just stop gating it to aotw.
- `SocialStudioPage.tsx` + `types.ts`: today there's only `aowPhotoPosition`. Add `scale` for AOTW and add
  position+scale for the new-agent view (and for recruiting photo cards if any). Either a generic
  `photoTransform` keyed by view, or per-view fields mirroring `aowPhotoPosition` — pick the smaller diff.
  Default `{ position:"50% 50%", scale:1 }`. Make sure the template-save excludes these (see `types.test.ts`,
  which asserts `aowPhotoPosition` is stripped from saved templates — do the same for the new fields).
- Wire `photoScale` through `previewModel.ts` (it already passes `photoPosition: config.aowPhotoPosition` at
  ~line 292) into the card props.
- **Render-verify**: harness-render AOTW + new-agent in portrait AND story with a non-center position and
  scale≠1, Read the PNGs, confirm the focal point + zoom match the preview. THEN tell the user.

### 2. Real, selectable, new recruiting templates (the picker only shows 5)
The picker `RECRUITING_VARIANTS` in `SocialCustomizer.tsx` lists exactly 5 (manifesto, hours, seal, lifeback,
compare). The `RecruitingVariant` union (`RecruitingCard.tsx:29`) declares **11**. Real state of the other 6:
- `bigstat` (line ~774), `ticket` (~849), `checklist` (~1046): **render code EXISTS but they are NOT in the
  picker** → the user literally cannot pick them. → render-verify them (portrait + story + long `COPY_JSON`),
  fix overflow, then **add them to `RECRUITING_VARIANTS`.**
- `poster`, `neon`, `clock`: declared in the union + have `RECRUITING_COPY` schemas, but **NO render branch** →
  they silently fall through to the `compare` default. → **implement the three render branches**, verify, add
  to the picker.
- After those 11 are all real + selectable, the user wants **MORE and "way more creative"** — keep adding
  distinct genres (testimonial/quote, passport-stamp, magazine-cover, gradient-mesh, split-diagonal, retro,
  etc.). Each new one = `RecruitingVariant` key + `RECRUITING_COPY` schema + render branch + picker entry +
  render-verify. The recruiting message is fixed: **inbound-only, no outbound dialing, no shared/aged/
  over-called leads, M–F 10–5 ET, no weekends, quality-of-life / "get your life back."**
- Every recruiting variant must (a) use `fitFontPx` for any editable single-line text (no silent clipping),
  (b) honor the Story safe-area (`padBox`/`padY` pattern already in the file), (c) have editable copy via the
  "Wording — edit any line" panel, (d) support "Generate with AI" caption.

## WYSIWYG model (do NOT break — this is why "looks right in app, wrong on IG" kept happening)
- Cards are pure/deterministic: NO `Math.random`, NO DOM measuring. Preview == export.
- Preview = `SocialPreview` (scaled live DOM). Export = `CardExportHost` off-screen full-size node →
  `renderCardToPng` (`exportCard.ts`, modern-screenshot). The posted PNG IS the export. Photo move/zoom is
  pure CSS on the card, so it exports correctly with zero extra work — keep it that way.
- `fitFontPx(text, base, availWidth, charWidthEm)` (`socialFormat.ts`) shrinks editable text to one line.
- Story safe-area: IG Stories cover top/bottom ~13%; recruiting + welcome cards inset story content via
  `padBox`/`insetBox`/`padY` (`format === "story" ? pad + ~160 : pad`). Feed (4:5/1:1) stays edge-to-edge.
- Harness = `scripts/social-studio-export-render` (uses the REAL export path). It WIPES `out/` each run —
  render ONE thing, then Read the PNG. Example:
  `RENDER_VIEWS=recruiting RENDER_FORMATS=story VARIANTS=bigstat node scripts/social-studio-export-render/run.mjs`
  Env: `VARIANTS`, `COPY_JSON` (url-encoded templateCopy JSON to test long custom copy), `AOW_BG`, `THEME`
  (spotlight/editorial/lift), `N`, `TOPN`, `RENDER_FORMATS` (portrait/square/story). Add a photo-position/scale
  env if you need to harness-verify the move/zoom.

## Lower-priority open items (only after the two above)
- **Story safe-area for the DATA cards** (leaderboard / AOTW / monthly): only recruiting + welcome got it.
  Leaderboard/monthly are data-dense — insetting reduces vertical space, so ALSO reduce `ROWS_PER_PAGE.story` /
  `MONTHLY_PAGE1_ROWS.story` in `previewModel.ts` or rows clip. Verify each as a story render.
- **Editorial AOTW stat overlap** (pre-existing): in the `editorial` AOTW design the AP "$18,600" and policies
  "15" overlap ("$18,6005"). `flex:none`+`nowrap` did NOT fix it. Give the stat columns explicit widths or fit
  the numbers with `fitFontPx`.

## Git / deploy state (verify first)
- Branch `main`. Last LOCAL commit = **`01018811`** "IG Story safe-area + force-load fonts before export" —
  **committed but NOT pushed** (HEAD 1 ahead of origin/main); the user interrupted the push. ASK before pushing.
- Uncommitted in the tree: `supabase/functions/instagram-oauth-callback/index.ts` (a PARALLEL effort — NOT
  yours, leave it) and this plan file. Stage ONLY your own files.
- Migrations applied LOCAL+PROD already this arc: `20260627074520_agent_photos_rotation`,
  `20260627083036_seed_app_url_config`, `20260627103709_reorder_agent_photos_rpc`.
- Edge fns deployed: `remind-missing-profile-photos` (de-hardcoded URL), `generate-social-caption` (accepts
  newagent+recruiting). ⚠️ Anthropic monthly spend limit was hit during a `/code-review` — do NOT run heavy
  Workflows; build in the main loop. AI-caption 500 with no code change = check the Anthropic key/credits FIRST.

## Conventions / gotchas (do not violate)
- Migrations ONLY via `./scripts/migrations/run-migration.sh` (local 127.0.0.1:54322 first, then
  `DATABASE_URL=$REMOTE_DATABASE_URL` for prod). NEVER raw psql. Do NOT regen `database.types.ts` — use
  `(supabase as any)` bridges.
- Components import via hooks, never `@/services/**` directly. Don't leave old files when refactoring.
- Verify with `npm run build` (0 errors) + `npx vitest run src/features/social-studio` (34 pass) + HARNESS
  render. typecheck/tests are NOT enough — eyeball the PNG before claiming done.
- Commit msgs end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Push ONLY
  `main` (Vercel deploys any push). Edge fns deploy via `supabase functions deploy <name> --project-ref
  pcyaqwodnyrpkaiojnpz`.

## First actions on resume
1. Read memory `project_social_studio_new_agents_rotation_20260627.md` + this file.
2. Build #1 (universal photo move+zoom). Render-verify AOTW + new-agent, portrait + story, off-center + zoomed.
3. Build #2 (add bigstat/ticket/checklist to picker after verifying; implement poster/neon/clock; then more).
4. Only claim something works AFTER reading its exported PNG. Then ask about pushing `01018811` + the new work.
