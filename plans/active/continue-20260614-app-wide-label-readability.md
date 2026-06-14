# App-wide label readability — kill the "barely-visible" dim labels

**Date filed:** Jun 14 2026 · **Branch:** main · **Status:** PLANNED (separate session — do NOT start mid-other-work)
**Filed by owner feedback:** "labels for everything on all pages and all sections, cards, etc, across the entire
app are following that barely visible pattern… quit making them small and hardly visible."

## Problem
Labels / eyebrows / captions across the **entire app** render in `T.mut2` = `rgba(236,226,205,0.36)` (36% opacity)
at small mono sizes (11–13px). The owner (blunt + visually picky — see [[feedback_plain_english_no_jargon_ui]])
finds them too dark, too small, hard to read. This is a design-system-wide pattern, not one panel. (It first
surfaced on the Analytics Trend Comparison metric labels, which were fixed in-place that session to `T.ink` 13px;
this plan generalizes that fix everywhere.)

## Scope (measured Jun 14 2026)
- **`T.mut2` token** (`src/components/board/tokens.ts:24` = `rgba(236,226,205,0.36)`) — **102 occurrences / 41 files**.
- **`--mut2` CSS var** (`src/index.css` `.theme-v2`, line 235 = `rgba(236,226,205,0.36)`) — **18 `var(--mut2)` uses**.
- **`<Cap>`** — the shared Space-Mono uppercase eyebrow primitive (`src/components/board/Cap.tsx`), default
  `700 12px mono / .18em / T.mut2` — used in **70 files**. ← single highest-leverage lever.
- Other label carriers also defaulting dim/small: `FlapTile` key (`700 11px mono T.mut2`), table `<thead>` headers
  (`~11.5px mono T.mut2`), `BoardListHeader`, `Pill`, `Num`'s `lbl`-style sublabels, and many inline
  `font: 700 11–12px mono … color: T.mut2` label spans.
- Top affected areas: `features/analytics/board` (+inbound), `features/contracting/components/hub`,
  `features/kpi/components/dashboard`, `features/dashboard`, `components/board`, AgentDetail, policies, targets,
  recruiting. **Every Board-styled page is affected.**

## Levers (pick a combination — see Decisions)
1. **`Cap` default** (70 files, one edit): bump color `T.mut2 → T.mut` (or brighter) and size `12 → 13px`. Instantly
   lifts most eyebrows app-wide. LOW risk, HIGH leverage.
2. **Token bump** (`T.mut2` + `--mut2` in lockstep): raise opacity `0.36 → ~0.50`. Ripples to ALL mut2 usages at once
   (labels AND any genuinely-tertiary text). Fast + consistent, BUT also brightens intentionally-dim metadata.
3. **Component sweep**: `FlapTile` key, table headers, `BoardListHeader` → brighter color and/or +1–2px.
4. **Inline sweep**: the remaining inline `T.mut2` label spans (102 total minus component-covered) — review each:
   is it a *label* (brighten) or *tertiary metadata* (may stay dim).

## Recommended approach
- Do **(1) Cap** + **(3) component** edits first — they cover the bulk with precise, intentional changes.
- For **(2) token**: a *modest* bump (`0.36 → ~0.48`) is reasonable so stragglers improve too, but keep `T.mut`
  (0.55) clearly brighter than `T.mut2` so the two-tier hierarchy survives. Don't collapse mut/mut2 into one.
- Then **(4) inline sweep** the still-too-dim label spans. Classify by usage so deliberate de-emphasis (e.g. footnotes,
  "30d ago" captions) isn't over-brightened.
- This is a strong **Workflow** candidate: fan out one agent per feature dir (analytics, contracting, kpi, dashboard,
  recruiting, …) to sweep inline label spans against an agreed target spec; do the shared primitives serially first.

## Decisions to confirm with owner before building
- Target label color: `T.mut` (55%) vs `T.ink` (full). Likely **`T.mut` for eyebrows/captions** (still secondary)
  and **`T.ink` for primary metric/section labels** — i.e. a tiered target, not one global value.
- Target sizes: eyebrows 12→13px? table headers 11.5→12.5px? flap keys 11→12px?
- Whether to also nudge the `T.mut2` token globally, or leave the token and fix only label components/usages.
- Confirm which usages are *intentionally* dim and must stay (footnotes, disclaimers, "30d ago" captions, etc.).

## Verification
- `npm run build` + tsc + eslint.
- **Visual sweep of key pages** (Dashboard, Analytics, AgentDetail, Policies, Targets, Contracting hub, KPI, Recruiting).
  ⚠️ Authed local screenshots are BLOCKED (E2E creds vs local DB — see
  [[feedback_never_touch_real_accounts_use_env_local]]); plan for owner visual sign-off or a viable screenshot path.

## Files (starting points)
- `src/components/board/tokens.ts` (mut/mut2) · `src/index.css` (`.theme-v2` `--mut2`, line 235)
- `src/components/board/Cap.tsx` · `FlapTile.tsx` · `BoardListHeader.tsx` · `Pill.tsx` · `Num.tsx`
- Inline sweep: the 41 files referencing `T.mut2` (grep `grep -rn "T\.mut2" src`).

## Related
[[project_analytics_handoff_redesign_20260614]] (where this was first observed + the ComparisonCard label was fixed),
[[feedback_plain_english_no_jargon_ui]].
