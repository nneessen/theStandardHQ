# Analytics Page — `design_handoff_analytics` reconciliation

**Date:** Jun 14 2026 · **Branch:** main · **Status:** ✅ BUILT (uncommitted, awaiting owner go-ahead + visual verify)

## ✅ OUTCOME (Jun 14 2026)
All phases applied. **tsc 0 errors · eslint 0 · vitest 42/42 · `npm run build` ✓ (32.8s).** Uncommitted.
- Phase 0 primitives (Board radius 14 + rivet 9, Bar +cyan +h9, FlapTile key 11, Pill 12/.12em, Num lit-glow 22,
  useCountUp snap-fallback, **new ComparisonCard**) + index export. Fixed fallout: `BoardPersistency.tsx` TONE_HEX
  needed a `cyan` key (the only break from widening `BarTone`).
- Phase 1 (8 panels, parallel agents): Hero (ring→pctMonth, "PROJECTED·%" pill, "DEPARTURE STATUS", "Behind the
  board's pace"), Growth (+$34K ReferenceLine, hollow dots, copy, linear growth%), ActionFeed (flat rows + copy),
  AgentTable (24px name, muted subtitle, IMO total), Funnel (removed invented badges/header stat, 1-dec close),
  Segments (full $3,392 Avg AP, 1-dec K Total AP), ProductMix (fixed colors + cyan Whole Life), PremiumByState.
- Phase 2 (me, serial): TrendChart → dual-series Active/Lapsed via getMonthlyTrendData; TrendComparison → 6
  ComparisonCards (both prior+now); Pipeline → quarterly-projection line + honest plain-text health note; page
  header (TrendingUp eyebrow, 18px subtitle) + 24px grid rhythm (gap-6/mb-6).

### ⚑ KEY CORRECTNESS CATCH (GrowthChartPanel)
The panel plotted `projectedCommission` while LABELING it "Projected AP", and the new $34K AP-goal ReferenceLine
would have sat on a commission axis (metric mismatch). VERIFIED in forecastService that `projectedRevenue` =
sum of `annualPremium` = projected AP. Fix: switched the series + growth% to `projectedRevenue` → the chart is now
truly "Projected AP", the AP-goal line is correct, and a pre-existing mislabel bug is fixed.

### Owner-decision flags (from agents — surface, don't block)
- Hero ring FILL = pctMonth (written %), ring COLOR threshold = pctProjected (projection health). Confirm semantics.
- AgentTable "{N} agents" uses leaderboard `totalEntries` (period-scoped, not all-time IMO headcount).
- Kept (handoff omits, we keep as real features): CarriersPanel, Inbound Calls section, upgrade banner, split CSV/PDF
  export, the "Custom" period option.
- "On track / ahead" Hero verdict copy unchanged (handoff only specced the "behind" variant).

### OPEN LOOP — visual verification
Authed local screenshots are BLOCKED (E2E creds vs local DB). Owner to visually verify `/analytics` on the
deployed/local authed site. Build + tsc + lint + units are the automated gate that passed.

---
**(original plan below)**

**Date:** Jun 14 2026 · **Branch:** main · **Status:** delta map complete, build in progress (uncommitted)
**Spec source:** `/Users/nickneessen/Downloads/design_handoff_analytics/` (README.md = authoritative;
`analytics-panels.js` = markup/copy truth; `analytics-charts.js` = CSS/engine; `analytics-data.js` = sample shape)

---

## TL;DR — this is a RECONCILIATION, not a rebuild

The `/analytics` page was **already** rebuilt into the verdict-first "Board" design (shipped `fa9dba3d`,
from a *sibling* handoff `design_handoff_the_board`). All 12 panels exist in `src/features/analytics/board/`,
wired to real data via `useAnalyticsData`. The new `design_handoff_analytics` is an **iteration** of that
same design language. A 15-agent read-only gap analysis (run Jun 14) found the page is **~85% there**.

**DO NOT rebuild panels from scratch** — they are shipped, money-adjacent (commission pipeline, segments).
Delta-apply via targeted `Edit` on the existing files.

## Locked decisions (do not relitigate)

1. **Palette = keep shipped warm-cream tokens** (`src/components/board/tokens.ts` `T`). The README §2 ⚠️
   warns against *warm brown surfaces* (`#120f08`) — but shipped surfaces are already cool charcoal
   (`#0d0d0e`). Only barely-perceptible warm-cream vs cool-white **text** differs, and `T` powers the
   ENTIRE Board app. Forking would make analytics text ≠ dashboard text (owner would catch it). Advisor-confirmed.
2. **Page width = keep `max-w-[2400px]`** (NOT the spec's 1820px). The app-wide width standard explicitly
   REPLACED 1820px (see memory `project_fullwidth_readability_rollout_20260613`). App = infra authority.
3. **Keep extra real features** the handoff omits: **CarriersPanel**, the **Inbound Calls** section, the
   **upgrade banner**. The handoff is an analytics-design ref, not a mandate to delete gated product surfaces.
   (Grid-gap/spacing fixes still apply to those rows.)
4. **Skip the AnimatedNumber viewport-trigger change** (app-wide behavior risk for marginal benefit). Instead
   just add the **throttle/snap fallback** to `useCountUp` (pure robustness — "never show 0" per §7).
5. **TrendChart data = `getMonthlyTrendData`** (active+lapsed dual series). It was swapped to
   `getMonthlyPoliciesWritten` for an "honest histogram," but the new spec explicitly wants the
   active-vs-lapsed RETENTION trend → `getMonthlyTrendData` is correct here.

---

## The work — by priority

### Phase 0 — shared primitives (SERIAL, do first; `src/components/board/`)
Small app-wide polish (design system catching up to the newer handoff — `tokens.ts` says these were
"ported verbatim from the design handoff"):
- **Board.tsx**: border-radius `12 → 14`; rivet inset `8 → 9`.
- **FlapTile.tsx**: key font `12 → 11px`.
- **Pill.tsx**: letter-spacing `0.08 → 0.12em`; font `12.5 → 12px`.
- **Bar.tsx**: default height `8 → 9px`; **ADD `cyan` tone** (needed by Product Mix / Whole Life).
- **Num.tsx**: `lit` text-shadow glow radius `14px → 22px`.
- **useCountUp** (`src/features/landing/hooks/useCountUp.ts`): add `setTimeout(dur+150ms)` snap-to-final fallback.
- **NEW `ComparisonCard.tsx`** + export in `index.ts` — paired-bar card for §5.8: tile bg, 11px tracks
  (`30d ago` = `--mut2` neutral fill, `now` = accent + glow), 3-col `[58px|1fr|auto]` grid, two rows
  (mono caps + values), bar widths scaled to `max(prior,now)` (min 3% sliver), animate width 0→target ~1s,
  delta pill ▲/▼/NEW (compact 5/9 padding, 11px). Props: `(label, accent, priorNum, nowNum, priorFmt, nowFmt, delta, dir)`.

### Phase 1 — the 10 "minor-edit" panels (PARALLELIZE via Workflow; each agent edits ONLY its own file)
Each has a concrete gap list (see the gap-analysis JSON saved in the run output). Focus HIGH+MEDIUM:
typography scale-UP (shipped shrank text below spec — labels 12→15px, mono fonts, weights), copy strings,
remove invented extras, fix number formats. Per panel:
- **Header / AnalyticsDashboard header**: eyebrow icon BarChart3→TrendingUp; subtitle 14→18px; one **Export**
  button (currently split CSV+PDF — keep both actions but style as the spec Export tray, OR keep split — low);
  segmented-control tray styling (radius 13, mono 13px, padding 9/14); H1 keep responsive clamp (don't hard-pin 60px).
- **AnalyticsHero**: ⚑ ring drives `pctMonth` (58% goal-WRITTEN) not `pctProjected`; sub-label "of monthly goal";
  amber pill "PROJECTED · {pctProjected}%"; eyebrow "DEPARTURE STATUS · {MONTH}"; sentence "Behind the board's pace —".
- **GrowthChartPanel**: ⚑ ADD dashed blue **ReferenceLine y=34000** ($34K goal) + legend "$34K goal" entry;
  eyebrow "Predictive Analytics" / "Growth forecast & renewals"; confidence dots hollow (fill `#161617` + accent stroke);
  grid dash `4 10`; footnote "...25% of first-year commission **rates**..."; sanity-check the header growth %
  (compounded annual produces ~+149% — use a sensible projected-growth figure, label "projected growth").
- **ActionFeedPanel**: eyebrow "Smart Moves · Flags" / "What to do about it"; rows FLAT (17px 0, hairline,
  no card box); title Archivo 800 16px; What-If scenario cell ink+700, cells 15.5px.
- **AgentTablePanel**: top-performer name Archivo 800 24px; subtitle muted 500; agent count = IMO-wide total
  (not rows.length); row padding 14px; last row no bottom border.
- **FunnelPanel**: stage label 15px ink 600; remove invented per-stage conversion badges + header-right stat
  (spec funnel is label+count+bar only); Avg Close keep 1 decimal (`9.4d` not `9d`).
- **ClientSegmentsPanel**: ⚑ Avg AP = full `$3,392` (NOT compact `$3K`); Total AP = `$128.9K` (1 decimal, K());
  tier cell Archivo 800; subtitle "Value tiers & mix"; last row no border.
- **PipelinePanel**: ⚑ ADD "Quarterly projection · $X" meta line; health note = plain green text
  "Healthy pipeline · {round(pending/quarterly*100)}% of quarterly target booked" (NOT a Pill, NOT pending/paid90);
  remove "Last 90 days paid" line; bucket rows 14px padding + hairline; label ink 16px; value Archivo 800 18px green;
  clock icon muted. NOTE: need a quarterly-projection figure — derive (e.g. pending + next-quarter forecast) or
  compute from forecast; if none available, document the chosen definition.
- **ProductMixPanel**: ⚑ fixed per-product colors (Term=blue, Whole=**cyan**, IUL=green, FE=amber, Annuity=red)
  not index cycle; remove revenue column + leading-product callout; label 15px, pct 15px mono **cream** (not accent).
- **PremiumByStatePanel**: subtitle "Top N states by AP" muted; header number Archivo 800 30px cream; bars **blue**
  (not green); state label 15px; value 15px.

### Phase 2 — the 2 hard panels + layout (SERIAL, do yourself)
- **TrendChartPanel** (`significant-edit`): replace BarChart with dual-series **AreaChart/ComposedChart**:
  `Active` green smooth + gradient area (stops 0.32→0.02); `Lapsed` amber **dashed**, no fill; data from
  `getMonthlyTrendData(policies)` → `{month, active, lapsed}`; x-axis Jul–Jun skip every 2nd+last; legend
  ● Active policies / ● Lapsed; **3 flap tiles** (drop "Pending"): Active(green)/Lapsed(amber)/Cancelled(red);
  subtitle "Active vs lapsed retention".
- **TrendComparisonPanel** (`significant-edit`): replace sparkline cards with `ComparisonCard` (Phase 0).
  6 metrics already wired (prior vs now): Policies/AP/Commissions/AvgPrem(down)/ActivePolicies/Pipeline(new).
  Show BOTH prior + now values; subtitle "This period vs. the same point 30 days ago"; header "AP change" (sentence case).
- **AnalyticsDashboard layout**: grid gap `gap-4 (16) → gap-6 (24)`; drop the double-spacing (`mb-4` + gap →
  rely on gap, trim mb); keep 2400px width, Carriers, Inbound, upgrade banner, BoardPersistency row.

### Phase 3 — verify
- `npm run build` (zero TS errors — CI gate) + `npm run lint` + `npx vitest run` (policyStatusService tests etc.).
- Run/extend a smoke under `scripts/smoke/` that mounts the route without runtime errors if feasible unauthed;
  else document the visual-verify open loop (authed local screenshots are BLOCKED — see memory
  `feedback_never_touch_real_accounts_use_env_local`). **Owner to visually verify on the deployed/local authed site.**
- PAUSE for owner go-ahead before commit/push (this task is fresh/unbuilt).

## Files
- Primitives: `src/components/board/{Board,FlapTile,Pill,Bar,Num,ComparisonCard,index}.tsx`,
  `src/features/landing/hooks/useCountUp.ts`
- Panels: `src/features/analytics/board/*.tsx`
- Page: `src/features/analytics/AnalyticsDashboard.tsx`
- Data: `src/services/analytics/policyStatusService.ts` (`getMonthlyTrendData`), `src/hooks/analytics/useAnalyticsData.ts`

## Gap-analysis full output
Saved at the workflow task output (run `w9xy9w5k5`); 15 structured panel deltas with severity. Re-run via the
`analytics-gap-analysis` workflow script if needed.
