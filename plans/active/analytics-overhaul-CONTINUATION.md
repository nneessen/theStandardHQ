# Analytics Overhaul — Continuation Handoff (2026-06-27)

## PROMPT FOR NEXT SESSION (paste this)

> Continue the Analytics overhaul on branch `feat/analytics-team-scope-mtd-exports`.
> Three commits are already landed and verified (`2ac8f757`, `475ddd65`, `c02ce8c9`).
> Finish the remaining three items below in this order: (1) Inbound tab → individual-only
> + remove its duplicate agent leaderboard; (2) replace "Smart Moves" on the Team tab with
> a Team Inbound KPIs panel; (3) add CSV/Excel/PDF export to the Team "Agent Performance"
> table. Reuse existing services/hooks — `/recall` the vault first, do NOT ask for values the
> app already computes. Commit ONLY analytics files (explicit `git add` by path) — the working
> tree has unrelated social-studio WIP that must NOT be swept in. Verify each item with
> `npx tsc --noEmit | grep -v social-studio` (must be clean), eslint, the analytics smoke, and
> a screenshot before committing. Do not push.

---

## Branch / commit state
- Branch: `feat/analytics-team-scope-mtd-exports` (off `main`). **Not pushed** (never push non-main branches).
- Commits this effort:
  - `2ac8f757` — team-scoped Team tab, MTD default, labeled CSV (reuse `policyExport`), on-brand @react-pdf report, persistency placement (Overview=own / Team=team band).
  - `475ddd65` — weekly pipeline buckets, 2.5% renewal label, sortable + show-all agent table.
  - `c02ce8c9` — New-Business histogram (replaced broken retention chart) + Inbound Economics panel (replaced outbound funnel) + `COST_PER_INBOUND_CALL`.

## ⚠️ BUILD BLOCKER (not ours) — read first
The working tree carries **concurrent social-studio / social-cards WIP** (Carousel Builder rebuild, applied from a "social WIP" stash). It fails `tsc` in `src/features/social-studio/components/CarouselBuilder.tsx` (`MarketingVariant` vs `MarketingCopyVariant`) and **breaks `npm run build` / CI**. It is NOT analytics work.
- Verify our work with: `npx tsc --noEmit 2>&1 | grep -v social-studio | grep "error TS"` → must be empty.
- **Commit ONLY analytics files** (explicit `git add <path>`), never `git add -A`. The social-studio files (`src/features/social-cards/*`, `src/features/social-studio/*`, `src/services/social-studio/*`, `supabase/functions/_shared/social-copy.ts`, `close-ai-builder/ai/anthropic-client.ts`) belong to the Carousel Builder effort (see `project_social_studio_carousel_builder_rebuild_20260627` memory). Leave them alone.
- A full green `npm run build` won't be possible until that WIP is finished/reverted by its owner.

## Working rules (learned this session — honor them)
- **Reuse existing services + `/recall` the Obsidian vault before asking the user for anything.** This app already computes commissions/rates (per-policy `commissionPercentage`, `comp_guide`, `CommissionLifecycleService`). Do not ask for known/derivable values. (Memory: `feedback_use_existing_services_and_recall_vault_before_asking`.)
- User prefers **plain-text conversational clarification**; they rejected the multiple-choice AskUserQuestion tool twice.
- Cross-feature imports go through the **barrel only** (`@/features/x`); deep `@/features/*/**` is ESLint-banned; **feature components cannot import `@/services/**`** (route service access through a hook).

---

## REMAINING WORK

### (1) Inbound tab → individual-only + remove duplicate leaderboard  [task #15]
File: `src/features/analytics/tabs/InboundCallsTab.tsx`
- The daily-log panels `PerformanceBand` + `TrendPanel` are already self-scoped (individual) via `useDailyMetrics` (`.eq("agent_id", uid)`). Keep.
- The recording panels (`InboundCallsOverviewPanel`, `CallTimingPanel`, `CallDemographicsPanel`, `CallGeographyPanel`, `CallLengthPanel`, `CallAgentLeaderboardPanel`) use `useKpiCallAnalytics(range)` which returns **all RLS-visible (team) recordings** — that's the team-wide data to move/scope.
- **Remove `CallAgentLeaderboardPanel`** from this tab (the team has the leaderboard on the Team tab). Also remove it from `tabs/panels.tsx` + `board/index.ts` if it becomes unused elsewhere (grep first).
- Scope the remaining recording panels to the **current agent**: `useKpiCallAnalytics` (`src/features/kpi/hooks/useCallAnalytics.ts`, aggregator `src/features/kpi/lib/call-analytics.ts`) currently has no agent filter. Add an optional `agentId` param to the hook (filter `kpi_call_recordings` by `agent_id`), pass the current user (`useCurrentUserProfile`/`useAuth`). Export any new hook signature through the kpi barrel.
- Net Inbound tab = the logged-in agent's own inbound performance only.

### (2) Team Inbound KPIs on Team tab, replacing "Smart Moves"  [tasks #14, #16]
File: `src/features/analytics/tabs/TeamTab.tsx`
- **Remove `ActionFeedPanel`** ("Smart Moves · Flags") — user: "pointless." (Remove its `panels.tsx`/`board/index.ts` exports if unused after.)
- Add a **Team Inbound KPIs** panel (mirror `InboundEconomicsPanel` but team-scoped). Metrics: Calls, Close Rate, Sales, Premium, Commission, Call Spend, CPA, Net Profit, ROI — aggregated across **me + full downline**.
- Data sources:
  - Team call volume: **new hook needed** — `kpi_daily_call_metrics` RLS **allows upline reads** (policy `is_upline_of(agent_id)`, migration `20260606135121`). Add `useTeamDailyMetrics(teamIds, range)` doing `supabase.from("kpi_daily_call_metrics").select("*").in("agent_id", teamIds).gte/lte("metric_date", …)` (no `.eq` self-scope). Sum `total_inbound_calls`. Pattern: `useCallAnalytics.ts` already does team `.in()` reads.
  - `teamIds` = `[currentUser.id, ...useMyDownlines()]` (same as `AgentTablePanel.tsx`).
  - Team commission/premium/policies: `useTeamAnalyticsData` (`src/hooks/analytics/useTeamAnalyticsData.ts`) — already team-scoped (RPC `get_team_analytics_data`). ⚠️ its per-agent `commissionEarned` sums `earned_amount`, NOT `amount`; for ROI you want the advance (`amount`/`commission_amount`) basis — sum `commission_amount` from `rawData.commissions` (the RPC returns both columns) to match the individual panel.
- **Avoid duplication:** extract the metric math (spend/closeRate/cpa/net/roi from {calls, policies, premium, commission}) into a shared helper (e.g. `src/features/analytics/board/inboundEconomics.ts`) used by both `InboundEconomicsPanel` and the new team panel.

### (3) Export the Agent Performance table (CSV / Excel / PDF)  [task #9]
File: `src/features/analytics/board/AgentTablePanel.tsx`
- Add a small export control (header of the panel). Columns: Rank, Agent, Policies, AP, IP (the rows shown, all team members).
- Reuse: CSV → `downloadCSV(rows, name, headers)` from `@/utils/exportHelpers`; Excel → ExcelJS pattern in `src/features/policies/utils/policyExport.ts` (`exportPoliciesToExcel`); PDF → `@react-pdf` dynamic-import pattern like `AnalyticsReportDocument.tsx` / `ScriptDetailPage.handleDownloadPdf` (STATIC footer — never a render-callback footer; documented v4 crash).
- Keep it lint-clean (board panel; dynamic-import the PDF generator).

---

## Key facts (already explored — don't re-investigate)
- `COST_PER_INBOUND_CALL = 42.5` → `src/constants/financial.ts`. Spend = calls × this. Every inbound call is answered (no "Answered" stage).
- Renewal multiplier `ANALYTICS_CONSTANTS.RENEWAL_RATE_MULTIPLIER = 0.025` already used by `forecastService`; only labels were wrong (fixed).
- Commission "earned this period" (individual) = sum `commission.amount` over `isCollectibleCommissionStatus(c.status)` from `useAnalyticsData().raw.commissions` (period-filtered). Matches `PaceMetrics` / `useMetricsWithDateRange`. `amount` = the advance (cash). `earned_amount` = accrual (different).
- `useAgentKpiSummary(range:{from,to})` now exported from `@/features/kpi` (individual daily totals; self-scoped). `DateRange = {from,to}` (yyyy-mm-dd).
- `getAgentLeaderboard` (`leaderboardService`) hardcodes `p_scope:"all"` and is shared by 5 call sites — DON'T change it; the Team table filters client-side to `teamIds`.
- Inbound funnel has **no "quoted" stage** in the data. No automatic bid-platform spend column — cost is derived from the $42.50 constant.

## Verification recipe
1. `npx tsc --noEmit 2>&1 | grep -v social-studio | grep "error TS"` → empty. `npx eslint <changed files>` → 0.
2. Dev server on `:3000` (already running this session; else `npm run dev`).
3. `python3 scripts/smoke/smoke-analytics.py` (logs in as throwaway `mgr1@epiclife-demo.test` / `DemoPass123!`) — extend it with assertions for the new Team inbound panel + that the Inbound tab no longer shows the agent leaderboard.
4. Screenshot the affected tabs (Playwright: login → `goto /analytics?tab=team|inbound` → full-page screenshot to `/tmp/board-shots/`) and eyeball.
5. `git add` ONLY the analytics files by path; commit with a `feat(analytics): …` message + the Co-Authored-By trailer. Do not push.

## Memory pointers
- `project_analytics_inbound_economics_and_overhaul_20260627.md` (this effort, full detail)
- `project_analytics_team_scope_mtd_exports_persistency_20260627.md` (commit 1 detail)
- `feedback_use_existing_services_and_recall_vault_before_asking.md` (the working-style correction)
