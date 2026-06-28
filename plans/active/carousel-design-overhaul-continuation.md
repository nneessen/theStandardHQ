# CONTINUATION PROMPT — Carousel Builder: Real Design Overhaul + IG Fidelity + Sample-Data Fix

> Paste this whole file as the next session's prompt. It is self-contained.

## Read this first — honest status

A prior session rebuilt the Carousel Builder **architecture** and shipped it to prod
(main `2b94904e`, edge fn `social-carousel-compose` **v6**). It added 9 layout archetypes
(`hook/list/checklist/stat/compare` + legacy `quote/tip/cta/custom`), Opus generation, a
real-KPI `facts` payload, a Dialog composer, and a structured editor. **It verified the
PLUMBING but FAILED the actual goal.** The owner's verdict was blunt and correct:

1. **The designs are NOT marketable.** They are clean/minimal "editorial" layouts — a shared
   masthead+footer frame, flat theme background, type-only hierarchy. That is *not* the
   "flashy, marketable, styled, unique" carousel design that was asked for. This is the #1 job.
2. **Sample data appeared in a REAL carousel.** A correctness bug — fake numbers/agents reached
   a real post.
3. **The posted-to-Instagram result was never validated.** "It needs to translate/format
   properly when posting to IG" — the live IG output must be verified, not just local PNGs.

Plus a code review found **real rendering bugs** that make slides look broken (below).

**Your mandate this session:** make the layouts genuinely beautiful and marketing-grade, fix
the sample-data leak, fix the rendering bugs, and prove the IG-posted output is correct. The
architecture exists — this is a DESIGN + CORRECTNESS pass, iterated against rendered PNGs and a
real IG post. Do NOT declare done off a typecheck. Screenshot-verify everything.

## Where everything lives

| Area | Path |
|---|---|
| Card renderer (all 9 archetypes) | `src/features/social-cards/MarketingCard.tsx` |
| Brand themes/tokens (indigo) | `src/features/social-cards/themes.ts` |
| Format dims + `fitFontPx` | `src/features/social-cards/socialFormat.ts` |
| Photo frame (pan/zoom) | `src/features/social-cards/PhotoFrame.tsx` |
| PNG export (`modern-screenshot`) + font preload | `src/features/social-cards/exportCard.ts` |
| **PNG render harness (USE THIS to iterate)** | `scripts/social-studio-export-render/` (`run.mjs`, `entry.tsx`) |
| Builder UI (facts, editor, dialog, mappers) | `src/features/social-studio/components/CarouselBuilder.tsx` |
| Preview dispatch + `PreviewData` | `src/features/social-studio/components/SocialPreview.tsx` |
| Export host (off-screen 1080px) | `src/features/social-studio/components/CardExportHost.tsx` |
| Edge fn (prompt/schema/facts) | `supabase/functions/social-carousel-compose/index.ts` |
| Shared caps | `supabase/functions/_shared/social-copy.ts` + `src/features/social-studio/marketingCopyCaps.ts` |
| IG publish path | `src/features/social-studio/hooks/useSpotlightActions.ts` → `uploadCarouselSlides` / `publishToInstagram` |
| Prior-session memory | `project_social_studio_carousel_builder_rebuild_20260627` |

**Hard rendering constraint (do not forget):** PNGs are produced by `modern-screenshot`
`domToPng()` at 1080×1350 (4:5). It **under-measures multi-line DISPLAY-font height** → wrapped
display text overlaps/clips on the exported PNG even when the browser preview looks fine. Rule:
multi-line copy uses heavy **SANS**; the **display** face only for guaranteed single-line text,
sized with `fitFontPx`. Any new font/weight you use MUST be registered in `exportCard.ts` or the
PNG renders blank glyphs. **overflow:hidden HIDES clips** — a correct-dimension PNG can still be
clipped; you must READ each PNG.

---

## P0 — Visual design overhaul (the main job)

Target: each archetype is a **distinct, bold, marketing-grade design** that looks like a premium
IG carousel from a top creator / Canva premium template — adapted to the agency brand. Not a
shared frame with swapped text. Build a cohesive **template family**: variety *within* one design
system (shared palette, type scale, margins, motifs) so the deck reads as ONE designed set.

Concrete creative direction (use as a starting brief; push further):
- **Cover / `hook`** — magazine-cover energy. Full-bleed. Optional background photo or rich
  gradient mesh with a strong branded scrim. Oversized condensed headline; an accent color block
  or geometric shape behind a key phrase; small brand mark; a "swipe →" cue and slide-count chip.
  This is the scroll-stopper — make it dramatic, not centered editorial text.
- **`stat`** — the number IS the design: hero numeral filling the canvas, gradient or outlined
  treatment, a supporting graphic/shape, label as a tight uppercase tag. (Also fix the fit/clip
  bug below.)
- **`compare`** — two strong panels with real color contrast (muted "them" vs brand-accent "us"),
  ✗/✓ iconography, a divider motif. Add a `highlightSide` so either side can be the hero.
- **`list`** — big editorial numerals as graphic anchors, alternating row tints or an accent
  rail, generous rhythm.
- **`checklist`** — icon chips / card rows, not plain check + text. (Also fix wrap bug below.)
- **`quote`** — real pull-quote treatment (oversized quotation mark as a graphic, accent rule,
  attribution as a designed credit line). (Also fix the display-font wrap bug below.)
- **`tip` / `cta`** — `cta` is the closing money slide: bold action, high-contrast button/chip,
  comment/DM keyword, brand mark, swipe-back cue.

Design-system work to enable the above (do this deliberately, don't hardcode per slide):
- **Extend the design tokens** in `themes.ts`: add gradient definitions, accent-block / shape
  tokens, an optional bold-accent ramp, panel/scrim treatments — a *designed* palette, NOT random
  per-slide colors. Respect `feedback_no_rainbow_cards` (no rainbow/cookie-cutter) — variety comes
  from composition + hierarchy + a controlled palette, not from recoloring each slide.
- **Background treatments**: support photo backgrounds (reuse `PhotoFrame` + a branded gradient
  scrim) and gradient-mesh backgrounds as first-class, not just the subtle Spotlight atmosphere.
- **Per-archetype identity**: vary composition and which chrome appears (don't stamp the identical
  masthead+footer on every slide — that's what makes the current deck feel samey). Consider brand
  mark prominent only on cover + CTA, minimal elsewhere.
- **Progress / swipe affordances** as design elements (dots or "n/N", swipe cue on cover).
- Keep all three themes (Spotlight/Editorial/Lift) genuinely beautiful — don't only style the dark
  one.

**Iteration loop (mandatory):** edit `MarketingCard.tsx` → render via the harness → **READ the
PNGs** → refine. Repeat many times. Render BOTH normal and STRESS (max-cap) length, BOTH a dark
and a light theme:
```
RENDER_VIEWS=daily RENDER_FORMATS=portrait DECK=1 THEME=spotlight node scripts/social-studio-export-render/run.mjs
RENDER_VIEWS=daily RENDER_FORMATS=portrait DECK=1 STRESS=1 THEME=lift  node scripts/social-studio-export-render/run.mjs
```
Then `Read` every `scripts/social-studio-export-render/out/*.png` (slides 6–10 are the new
archetypes hook/list/checklist/stat/compare). The bar: they must look like premium marketing
carousels, and they must NOT clip at STRESS length.

---

## P0 — Sample data reached a real carousel (bug — find repro, then fix)

Symptom: fake numbers/agents in a real carousel. Investigate end-to-end and make it impossible
for sample/fabricated data to appear in a posted carousel. Leads (in `CarouselBuilder.tsx` unless
noted):
- `isSample` / `sampleForced` flow from `SocialStudioPage` → `CarouselBuilder`. Data slides
  (`buildDataLead` → `buildPreviewPages` in `previewModel.ts`) render **sample numbers when
  `isSample`**. `deckPages` re-derives live from current `isSample`, so a deck exported while
  `isSample` is true carries sample numbers.
- `sampleBlocksPost = isSample && deckHasData` (line ~272) gates posting — verify it actually
  blocks BOTH post and schedule for any deck containing a data slide, and confirm the gate can't
  be bypassed. Consider blocking **export/download** of sample too, and showing a hard banner.
- The empty-deck **auto-seed** effect (`autoSeededRef`, line ~296) injects a sample leaderboard
  slide in sample mode — ensure a seeded sample slide can never end up posted.
- `buildFacts()` gates on `!isSample` (so the AI gets no facts in sample mode) — verify the gate
  holds and that facts NEVER carry sample numbers.
- Determine the actual repro: is the account real-data but `isSample` wrongly true? Or is it a
  sample/seed account and the UX let sample content into a "real" post? Either way: a REAL
  carousel must never contain sample numbers — force real data, exclude data slides when sample,
  or hard-block. Add a test.

---

## P0 — Instagram formatting / translation fidelity

The posted IG result must be correct — verify the REAL post, not just the local PNG.
- Confirm dims/format: feed carousel is 4:5 = **1080×1350**; ≤10 slides; order preserved.
  (`FORMAT_DIMS`, `CardExportHost`, `uploadCarouselSlides`/`publishToInstagram`.)
- **IG safe zones**: in-feed, the bottom band and edges can be covered by IG UI (username row,
  caption, action buttons) and the carousel dots overlay. Pull headlines/CTAs/key content inward
  away from the bottom ~12–15% and the extreme edges. Add safe-zone guides to the design.
- Verify `PostConfirmDialog` preview matches the real post.
- End-to-end test: generate → export → post to a test IG account → **screenshot the live IG
  post** → compare against the local PNG. Fix any cropping, scaling, or layout drift.

---

## P1 — Rendering bugs found in code review (fix during the design pass; several cause "broken" slides)

In `src/features/social-cards/MarketingCard.tsx`:
- **checklist bullet text can't wrap → overflows the card edge.** The bullet text `div` lacks
  `flex:1` / `minWidth:0` / `width:100%`; long bullets (up to the 72-char cap) overflow right.
  (The `list` label column sets `width:100%`; checklist doesn't.) This was never visually verified
  at stress length. FIX + render checklist STRESS and READ it.
- **`stat` value can clip.** `fitFontPx` has a hard floor (`basePx*0.38` ≈114px for stat=300) that
  bypasses the width fit for long strings → overflow under `overflow:hidden`; also `charWidthEm`
  for the condensed display digits should be validated against the real glyph width. Make the stat
  value provably fit innerWidth (shrink with no floor, or measure), and render a long stat in
  STRESS.
- **`quote` body uses the DISPLAY font for multi-line text** — violates the export rule; a 2+ line
  quote can overlap the attribution/footer on PNG. Move multi-line quote text to heavy SANS (or
  guarantee single line).
- **`compare` renders two empty styled boxes when `compare` is undefined**; **`hook` headline div
  and `stat` value div emit a full empty line-box when the field is undefined** (off-centers the
  slide). Guard empty states (render null / placeholder), especially for freshly-added editor
  slides that start blank.

In `CarouselBuilder.tsx`:
- **Structured editor can drop rapid edits.** `patchCol` / item / bullet helpers build the patch
  from the current-render `data` snapshot and `patchMarketing` does `{...s.data, ...patch}`; two
  fast onChange events in the same tick can overwrite each other (lose a column/item). Use
  functional/local-state editing (cf. the `useDebouncedField` + optimistic pattern in memory) so
  structured edits don't clobber.
- **`buildCaption` drops `statLabel` and the compare right column** from the caption descriptor →
  weaker captions. Add them to the fallback chain.
- Minor: `aiCount` onChange allows 0/1 (below min 2); `clampSlideCount` fallback is 5 while the
  initial `aiCount` is 7 (clearing the field silently requests 5). Make consistent.

In `src/services/social-studio/socialDeckService.ts` (persistence — one is a crash):
- **`validateDeckSpec` doesn't validate the new array field SHAPES → crash on load.** It checks
  the `variant` string but not that `items`/`bullets`/`compare` are well-formed. A corrupt/edited
  deck with e.g. `items` as a string or object passes validation, then `MarketingCard` runs
  `(items ?? []).filter(...)` → `??` only guards null/undefined, so a string/object throws an
  unhandled `TypeError` and crashes the carousel page on open. The validator's stated purpose is
  "throw a clear error instead of loading garbage" — extend it to structurally check the new
  array/object fields (and/or make the renderer defensive: `Array.isArray(items) ? items : []`).
- **3-way variant drift risk.** `MarketingVariant` (MarketingCard.tsx) / `MARKETING_VARIANTS`
  (socialDeckService.ts) / `VARIANTS` (edge fn) are three hand-maintained copies with no
  compile-time link; adding a variant to one but not the others makes saved decks unreadable.
  Consider deriving the validator list from the union or a single shared source.

In `supabase/functions/social-carousel-compose/index.ts`:
- **`readFacts` honesty gap.** `hasAggregate` is true via `!!f.topAgent` even when `factsBlock`
  emits nothing (e.g. `topAgent` with no `name` and no aggregate number) → AI is told facts exist
  and is allowed a `stat` slide with an EMPTY facts block → it can invent a number. Tie `hasFacts`
  to a **non-empty** facts block (or require a real aggregate number). This is the honesty
  guarantee for the "real numbers only" promise.
- `cleanCompareCol` lets a column through with an empty title → blank column header. Require both
  titles. Minor: `capLine` is called twice on the hook subheadline (compute once); `capWords` can
  shorten a long no-space `stat` value.

---

## Verification (do ALL before declaring done)
1. **PNG harness reads** for every archetype, both a dark + light theme, normal + STRESS — after
   each design change. Designs must look premium AND not clip.
2. **Live app E2E**: Social Studio → builder → generate. Confirm new designs render, real numbers
   only (no sample), Enhance works, structured editing works.
3. **Real IG post** to a test account → screenshot → compare to local PNG.
4. `npm run build` (0 TS errors), `npx vitest run src/features/social-studio src/features/social-cards`,
   `deno check supabase/functions/social-carousel-compose/index.ts`.
5. Add/extend tests for: sample-data-never-posted, checklist/stat overflow at cap, readFacts
   honesty gate.

## Deploy (coupled — same ordering as before)
Frontend and edge fn must ship together: **push frontend to main → wait for Vercel live → THEN**
`npx supabase functions deploy social-carousel-compose --project-ref pcyaqwodnyrpkaiojnpz`
(`verify_jwt` stays true). The old frontend can't render new archetypes (blank slides), so edge
goes last. (Detail in memory `project_social_studio_carousel_builder_rebuild_20260627`.)

## Branch
Base off **main** (has the shipped carousel). New branch `feat/carousel-design-overhaul`. Do NOT
work on `feat/analytics-team-scope-mtd-exports` (unrelated in-flight analytics work).

## Optional: roll back prod first?
The current (minimal) design + sample-data bug is live in prod. If the owner wants prod clean
while this is redone, offer to revert: `git revert 2b94904e` on main + push, then redeploy the
prior edge fn — OR leave it and ship the overhaul forward. Ask the owner.
