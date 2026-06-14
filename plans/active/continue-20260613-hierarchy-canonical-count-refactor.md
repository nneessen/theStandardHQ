# Hierarchy: one canonical "agents under X" — refactor plan

Status: PLAN (approved direction Jun 13 2026). Prereq DONE: path-trigger corruption fixed
& backfilled on prod (migration `20260613193709`). The tree cache (`hierarchy_path`/
`hierarchy_depth`) is now reliable, so counts built on it can finally be trusted.

## The problem

A codebase sweep found "how many agents are under X" implemented **~20 times** (≈13 SQL
RPCs + ≈7 TS spots) with **5 mutually-inconsistent definitions**:

1. **Direct-only** (`upline_id =`) vs **full recursive** (`hierarchy_path LIKE prefix.%`).
2. **Upline tree** vs **flat `agency_id` grouping**.
3. **Filtered** (approved + not-archived + agent/active_agent/admin, exclude pure recruit)
   vs **unfiltered** (some count recruits/pending/archived).
4. **Includes the leader** vs **excludes** them.
5. Two newest RPCs (`get_my_team_leaderboard`, `get_command_center_summary`) scope team
   with **no approval/role/archived filter at all**.

Visible symptoms: the **same agency shows different headcounts on different screens**
(team-comparison flat-by-agency vs agency-dashboard recursive — one note records 39→77);
the **team-leaderboard "minimum team size" filter qualifies by DIRECT downlines** while it
**displays recursive `team_size`** — so Jake (4 direct, 17 total) can be hidden at the
default threshold of 5 despite a large team.

Root cause: organic churn (same functions rewritten 4+ times flip-flopping the definition).
No single source of truth.

## Product decisions needed FIRST (owner)

These are business calls, not code calls — pick one each:

- **D1. "Team size" includes the leader?** Recommendation: store/compute descendants-only;
  UI adds "+ you" where it wants the leader counted. Apply the SAME choice everywhere.
- **D2. Do pure recruits / pending agents count as "agents"?** Recommendation: NO for
  "agent/producer" counts (keep current filter); YES only for explicitly-named
  "team/pipeline population" views (recruiting). Name the two variants distinctly.
- **D3. "Agency agent count" = members assigned to the agency (`agency_id`) OR the agency
  owner's downline subtree (`hierarchy_path`)?** These genuinely differ. Pick the headline
  definition; if both are needed, label them ("Assigned: 39" vs "Downline: 77").
- **D4. Team-leaderboard qualification:** qualify by the SAME metric you display
  (recommend: total team size), OR show both "X direct / Y total" and qualify by total.

## Target architecture — single source of truth

1. **One SQL membership primitive.** A `SECURITY DEFINER` function (or view) that is the
   ONLY place the team set is defined:
   `team_member_ids(p_leader_id uuid, p_include_self boolean, p_population text)`
   - traversal: `hierarchy_path = leader.path OR hierarchy_path LIKE leader.path || '.%'`
   - `p_population`: `'producers'` (approved, not archived, agent/active_agent/admin, not
     pure-recruit) | `'all'` (approved, not archived) — the only sanctioned variants.
   - imo-scoped to the leader's `imo_id`.
   Every rollup (team/agency/imo leaderboards, dashboards, command center) JOINs this set
   instead of re-deriving membership. Direct-downline count stays a SEPARATE, clearly-named
   metric (`direct_reports`), never conflated with `team_size`.

2. **Refactor the ~13 SQL RPCs** to call/JOIN the primitive. Delete the per-RPC bespoke
   membership CTEs. Keep return shapes stable (no frontend break) — only the WHERE/JOIN that
   defines membership changes.

3. **Refactor the ~7 TS sites** (`hierarchyService.getMyDownlines/getMyHierarchyStats/`
   `getAgentTeam/buildTree`, `HierarchyDashboardCompact`, `DownlinePerformance`,
   `teamAnalyticsService`) to consume ONE RPC. Remove hand-rolled `.like()` / `.length`
   counting. `total_agents = team count` from the RPC, not `downlines.length + 1`.

4. **Regression test:** seed a known tree; assert team page, team leaderboard, agency
   dashboard, IMO metrics, and command center ALL report the same number for the same node
   under the same population. This is the guardrail that keeps them from diverging again.

5. **CI/cron drift guard** (now available): assert `verify_hierarchy_integrity() = 0` so the
   path cache can't silently rot a third time.

## Sequencing

- Step 0 (done): trigger fix + backfill + verifier (`20260613193709`).
- Step 1: owner answers D1–D4.
- Step 2: build `team_member_ids` primitive + tests (migration).
- Step 3: migrate SQL RPCs onto it (one migration, return shapes unchanged), regen types.
- Step 4: migrate TS consumers; delete bespoke counters; build + tests green.
- Step 5: fix the leaderboard qualify-vs-display mismatch per D4.

## Files (entry points)

- SQL count sites: `get_team_leaderboard_data`, `get_team_leaders_for_leaderboard`,
  `get_leaderboard_data`, `get_agency_leaderboard_data`, `get_agency_dashboard_metrics`,
  `get_imo_production_by_agency`, `get_imo_dashboard_metrics`, `get_team_comparison_report`,
  `get_my_team_leaderboard`, `get_command_center_summary`, `check_team_size_limit`.
- TS: `src/services/hierarchy/hierarchyService.ts`, `HierarchyRepository.ts`,
  `src/services/leaderboard/leaderboardService.ts`, `src/services/analytics/teamAnalyticsService.ts`,
  `src/features/hierarchy/HierarchyDashboardCompact.tsx`,
  `src/features/hierarchy/components/DownlinePerformance.tsx`.
