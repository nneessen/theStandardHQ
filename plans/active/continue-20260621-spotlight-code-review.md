# Spotlight / Social Studio — max-effort code review (Jun 21 2026)

═══════════════════════════════════════════════════════════════════════════
✅ RESOLUTION (Jun 21 2026) — ALL 15 findings actioned, verified, UNCOMMITTED
═══════════════════════════════════════════════════════════════════════════
Every finding below is fixed EXCEPT #7 (dropped — see note). Verification (all green):
tsc 0 · `eslint .` **0 errors** (was 5 in the feature — push-blocker cleared) · vitest
**1806 passed** (incl. 33 new unit tests) · `npm run build` 0 · render harness 15 PNGs +
visual check · `social-studio-smoke.py` ALL PASS + new #4/#5 gate assertion + 0 console
errors · `social-library-smoke.py` ALL PASS + 0 console errors.

- **#1/#4/#6(bleed)/#8 — state machine.** Extracted a pure, tested `previewModel.ts`
  (`resolveSampleState` + `buildPreviewData`). One invariant — **sample is FORCED when
  there are zero producers, for EVERY view** — makes `!isSample ⇒ producers exist`
  (monthly crash impossible), blocks the empty-card export, and generalizes the old
  AOTW-only guard. `sampleOverride` resets on view change; the toggle is disabled when
  forced; defensive `producers[0]` guard. Red-then-green tests.
- **#2 — premium vs count.** Owner chose the additive RPC. New `get_agency_ap_leaderboard`
  (migration `20260621124027`, **applied local + prod**) returns the SUBMITTED count that
  matches AP, mirroring `get_leaderboard_data`'s `ap_data` CTE verbatim. **Proven: 0 AP
  mismatches, total AP byte-identical ($1,213,704), all 40 agents had submitted≠approved.**
  `get_leaderboard_data` left untouched (zero blast radius). Types regenerated; service
  merges it (parallel call, graceful fallback to legacy count).
- **#3 — barrel/ESLint push-blocker.** Cards relocated `leaderboard/social/` →
  **`src/features/social-cards/`** with a clean root barrel. ALSO fixed the deeper feature
  lint debt that blocked push: extracted Supabase storage/edge-fn calls into
  `src/services/social-studio/{spotlightAssetService,socialCaptionService}` behind a
  `useSpotlightActions` hook (features→hooks→services); `useAiAccess` via barrel;
  `TEMPLATE_OMIT_KEYS` now used at runtime. `eslint .` is 0 errors.
- **#5** caption gated on `isSample` (handler + button). **#9** real missing-tenant notice
  via `useImo().loading`. **#10** `id="card"` dropped from all 5 cards → harness wrapper.
  **#11** AOTW exhaustiveness `never`. **#12** `SocialCardSwitch` shared by preview +
  thumbnails. **#13** sampleData kept (legit display-fallback, unenforced rule; the #4/#5
  guards now make it un-postable). **#14** `deleteTemplate` `.select()`+owner_id+0-row
  throw (tested). **#15** export width from `FORMAT_DIMS`. Cheap dedups: shared `initials`,
  `usd`, `readFileAsDataUrl`.
- **#7 — DROPPED (false positive).** `recordAiTokens`→`checkRateLimit` swallows errors
  (fail-open) and the result is ignored; it cannot throw. The "best-effort" comment is
  accurate. (The recovery verifier CONFIRMED it without reading `rate-limit.ts`; primary
  source corrected it — adversarial verification isn't infallible.)

Scope: the Social Studio / "Agent of the Week" changeset (the §4 co-commit set in
`continue-20260621-spotlight-resume-prompt.md`). Method: 10 finder angles (5 correctness +
3 cleanup + altitude + conventions) → 1-vote adversarial verify → gap sweep. Two workflow
runs (`wf_344f9eb3`, `wf_f28833fc`); 71 agents total. Nothing here is committed yet — fix
before owner sign-off / commit where noted.

Verdicts: **CONFIRMED** = trigger + wrong output named & quoted. **PLAUSIBLE** = mechanism
real, trigger conditional.

────────────────────────────────────────────────────────────────────────
TOP 15 (ranked; correctness first, then severity)
────────────────────────────────────────────────────────────────────────

## 1. HIGH · CONFIRMED — Monthly live card crashes on a zero-producer agency
`SocialStudioPage.tsx` — `previewData` memo, monthly branch (`const tp = producers[0]; …toLastInitial(tp.agentName)`).
No length/empty guard. Daily/weekly use empty-safe slices; AOTW falls back to SAMPLE_AOTW;
only **monthly** derefs `producers[0]` blind. Reachable in two clicks from default: toggle
"Preview with sample data" OFF on a zero-producer agency → `isSample=false` → `tp` undefined
→ `TypeError` white-screens the route. **Your agency is brand-new (zero producers) right now,
so this is live.** Fix: guard `tp`/fall back to sample exactly like the AOTW branch does.

## 2. HIGH · CONFIRMED — Premium and policy-count describe different policy sets
`SocialStudioPage.tsx` — AOTW/leaderboard/monthly mapping (`ap: top.apTotal`, `policies: top.policyCount`).
`get_leaderboard_data` defines `ap_total` = SUM over **all submitted** policies by `submit_date`,
but `policy_count` = **approved-only** by `effective_date` (two separate CTEs). The matching
submitted-count (`ap_data.submitted_policies`) is computed in SQL but **dropped from the RETURNS
table**, so the client literally can't show the count that matches the premium it ranks on. A
posted card can read "$52,400 · 1 POLICY" where the two numbers count different policies. Fix:
add `submitted_policies` to the RPC RETURNS and display that, or stop showing a count next to AP.

## 3. HIGH · CONFIRMED — Deep imports with no barrel → ESLint `no-restricted-imports` blocks push
`SocialLibrary.tsx:13-16`, `SocialPreview.tsx:10/14/20-21`, `SocialStudioPage.tsx:17`, `sampleData.ts:6-9`.
`eslint.config.js` bans `@/features/*/**` deep imports; `src/features/leaderboard/social/` has
no `index.ts` barrel. `npm run build` (tsc+vite) passes, but the husky/lint-staged lint step
fails → **the commit/push is blocked**. (The resume-prompt §3 already flagged this as a
push-time concern.) Fix: add `src/features/leaderboard/social/index.ts` re-exporting
AgentOfWeekCard / LeaderboardSocialCard / MonthlyReportCard / socialFormat symbols, and import
from the barrel.

## 4. MEDIUM · CONFIRMED — Empty card is exportable on a zero-producer agency
`SocialStudioPage.tsx` — `handleDownload` guard `if (isSample)` + Download button `disabled={isSample}`.
Gated on `isSample`, not `hasLive`. Zero-producer daily/weekly/monthly + sample toggled off →
`isSample=false` → guard passes → exports "TOP 0 AGENTS / $0". The AOTW view got a
`config.view==='aotw' && !hasLive` force-sample guard; the other three didn't. Fix: extend the
force-sample (or block download) to all views when `!hasLive`.

## 5. MEDIUM · CONFIRMED — AI caption leaks fabricated SAMPLE data
`SocialStudioPage.tsx` — `handleGenerateCaption` guards only `!hasAiAccess`, never `isSample`.
On a forced-sample AOTW (zero producers), `previewData.agent` = SAMPLE ("Marcus W.", $52,400);
those invented figures are POSTed to `generate-social-caption` and the result is copyable —
while `handleDownload` explicitly blocks sample. Asymmetric; defeats the no-fake-data guard.
Fix: add the same `if (isSample) return` (with toast) to `handleGenerateCaption`.

## 6. MEDIUM · CONFIRMED — Local-time card label vs UTC data window (off-by-a-day)
`SocialStudioPage.tsx` — `dateLabel`/`monthLabel`/`weekRange` use local `toLocaleDateString`/`getDate`,
but `leaderboardService.calculateDateRange` builds the query window from `now.toISOString()` (UTC).
A US owner posting in the evening gets a card stamped "DAILY · JUN 20" fed the JUN 21 UTC window
(often empty/partial) — the public graphic's date and its numbers disagree, and it still passes
the `hasLive` gate. Fix: derive the data window and the label from the same timezone basis.

## 7. MEDIUM · CONFIRMED — Edge fn: successful, billed caption turns into a 500 + double-bill
`supabase/functions/generate-social-caption/index.ts:~162` — `await recordAiTokens(...)` runs
**outside** any try/catch (the comment says "best-effort"; the code isn't). `recordAiTokens`
→ `checkRateLimit` can reject; a transient `rate_limits` write error after a successful, billed
Anthropic call bubbles out of `serve()` → bodyless 500 → UI says "try again" → user retries →
double bill. Fix: wrap line 162 in try/catch (log-and-continue) before returning the caption.

## 8. MEDIUM · CONFIRMED — "Preview with sample data" can never return to auto
`SocialStudioPage.tsx` (`onSamplePreviewChange: (v: boolean) => void` ← `setSampleOverride`,
state `boolean | null`). The Switch only emits true/false, so once touched, `sampleOverride`
is permanently non-null and the `autoSample` heuristic is bypassed for the session — no UI path
back to `null`. Combined with #1/#4: flip off to see live, then producers roll off the day
boundary → live-but-empty card with download unblocked. Fix: reset to `null` on view change,
or add a "Reset to auto" affordance.

## 9. MEDIUM · CONFIRMED — Page hard-couples to `useImo().agency?.id` / `imo?.id`
`SocialStudioPage.tsx` (`agencyId = agency?.id ?? null`, `imoId = imo?.id ?? null`). If either
is null (a partial `ImoContext` fetch failure, or a super-admin acting cross-IMO — the exact
fragility the `spotlight-assets` bucket migration scoped *around* by using `auth.uid()`), the
live query is disabled (`enabled: !!agencyId`) → sample-only, and "Save template" is permanently
disabled with a misleading "Loading your agency…" tooltip that never resolves. Degrades silently.
Fix: surface a missing-tenant state; don't re-couple to `imo_id` for the owner-only page.

## 10. MEDIUM · CONFIRMED — `id="card"` collides across designs + library thumbnails
`AgentOfWeekCard.tsx` (all three design branches), `LeaderboardSocialCard.tsx`, `MonthlyReportCard.tsx`
all emit `id="card"`. `SocialLibrary` mounts 6 starters + every saved tile simultaneously → many
same-id nodes (invalid HTML). The render harness `scripts/leaderboard-card-render/run.mjs`
`page.$("#card")` silently grabs the first → wrong screenshot target, no error. Fix: use a
`data-export-root` ref/attr instead of a shared `id`.

## 11. MEDIUM · CONFIRMED — AOTW render branches have no exhaustiveness check
`AgentOfWeekCard.tsx` — `if (design==='editorial'){} if (design==='noir'){} // default aurora`.
The `Record<AowDesign,…>` maps (SIGNATURE_FONT/DESIGN_BG) give compile-time false confidence,
but a 4th design silently renders aurora. Fix: a `const _exhaustive: never = design` in the
default branch, or one per-design object `{bg, font, render}`.

## 12. MEDIUM · CONFIRMED — TemplateThumb re-implements SocialPreview's card dispatch
`SocialLibrary.tsx` — duplicates the aotw/monthly/leaderboard if/else (imports all three cards)
that `SocialPreview` already encapsulates. A future 4th view added to SocialPreview silently
renders the leaderboard card in the library. Fix: have TemplateThumb build a `PreviewData` and
delegate to `<SocialPreview isSample … />`.

## 13. LOW · CONFIRMED — Mock data shipped in `src/` without `DEV_FEATURE_MODE`
`src/features/social-studio/sampleData.ts` (SAMPLE_DAILY/WEEKLY/MONTHLY/AOTW) is imported
unconditionally by SocialStudioPage/SocialLibrary. CLAUDE.md: *"No Mock Data in Production Code.
Dev-only mocks allowed only behind DEV_FEATURE_MODE flag. CI must fail if mock imports appear
in src/**."* Judgment call — it's intended display-fallback/library-thumbnail data, not mocked
DB responses — but it is a literal rule violation and the safety depends entirely on the
`isSample` guards (#1/#4/#5/#8 show those are leaky). Decide: gate behind the flag, rename out
of "sample/mock" lint patterns, or accept with an explicit lint-disable + comment.

## 14. LOW · CONFIRMED — `deleteTemplate` reports success on a 0-row delete
`socialTemplateService.ts:71` — `.delete().eq("id", id)` with no `.select()`. PostgREST returns
`error: null` for a 0-row delete (RLS-blocked / stale id), so `useDeleteSocialTemplate.onSuccess`
fires "Template deleted." + invalidates, then the row reappears on refetch (reads as flaky).
Also: unlike `getMyTemplates`/`createTemplate`, delete carries no `.eq("owner_id", user.id)`
app-layer filter (defense-in-depth; RLS is the only gate). Fix: `.select("id")` and assert a row
came back; add the owner_id filter for symmetry.

## 15. LOW · PLAUSIBLE — Export node hardcodes `width: 1080`
`SocialPreview.tsx` — the captured/export div uses `style={{ width: 1080 }}` while the preview
wrapper scales from `FORMAT_DIMS[format].w`. Correct today (all formats are 1080-wide; socialFormat
documents the invariant) but breaks the single-source-of-truth contract if a non-1080-wide format
is ever added. Fix: read `FORMAT_DIMS[format].w`.

────────────────────────────────────────────────────────────────────────
ALSO NOTED (verified, below the top-15 cut — low-severity cleanup)
────────────────────────────────────────────────────────────────────────
- `sampleOverride` is one global bool across all 4 views, never reset on view change → per-view
  choice bleeds (the trigger that reaches #1). [LOW, CONFIRMED] — same root as #8.
- Per-render allocation churn (CONFIRMED): `sz` rebuilt in LeaderboardSocialCard + MonthlyReportCard;
  `initialsOf`/`renderRow` recreated in render body; date labels recomputed every slider tick;
  `filters` object inline per render. Hoist to module scope / `useMemo`. Low impact (owner-only page).
- Duplication (Reuse/Simplify): `usd()` re-implements `src/lib/format.ts formatCurrency` (already
  diverges on negatives); `initialsOf`≡`initials` across two cards; `handleUploadPhoto`/`handleUploadBgImage`
  share a verbatim MIME/size/try-finally frame; two upload `<label>`s nearly identical;
  `readFileAsDataUrl` ~parallels DesignStep's reader. Extract shared helpers.
- `html-to-image` dynamic-imported on every Download click (twice in-file) — no splitting benefit
  since the page is already lazy/super-admin-only. Static import.
- `imoId`/`agencyId` threaded as props to SocialLibrary though `useImo()` is available in-component.

────────────────────────────────────────────────────────────────────────
RECOMMENDED FIX ORDER (before commit / owner sign-off)
────────────────────────────────────────────────────────────────────────
1. #1 monthly crash (live on the zero-producer agency) + #4/#5/#8 sample-guard gaps — one coherent
   fix to the `isSample`/`hasLive`/`sampleOverride` state machine (deeper fix per Altitude angle).
2. #3 barrel/ESLint — required to commit at all.
3. #2 premium/count RPC mismatch (needs the migration RETURNS change → regen types).
4. #6 timezone, #7 edge-fn try/catch, #10 id="card".
5. The rest as polish.
