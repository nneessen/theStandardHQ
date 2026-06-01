# CONTINUATION — "The Board" redesign: remaining pages (2026-06-01)

## Mission
Redesign the remaining authenticated pages into **"The Board"** charcoal design
system, following the established recipe. Work through them in priority order,
verify each, and commit (only your own files).

## THE recipe (read first, every time)
`docs/design/board-page-template.md` — authoritative. Covers tokens, the board
primitives, the panel skeleton, hard rules (charcoal NOT brown, reuse the data
layer, first-class empty states, equal-height rows), the **mobile/responsive
gotcha** (Board primitives use inline styles → can't hold media queries → use
Tailwind className breakpoints or `repeat(auto-fit,minmax(min(100%,Npx),1fr))`;
never mix inline `gridTemplateColumns` with a className `grid-cols-*`), the
shared-controls/portal pattern (§2b — already done app-wide), and a step
checklist. The Analytics page + Targets/Policies are worked examples.

## DONE & SHIPPED (commit `fa9dba3d`, pushed to main → prod)
- Board primitives: `src/components/board/{Bar,Pill,FlapTile,RadialProgress,AnimatedNumber,EmptyState}.tsx`
- Analytics: full verdict-first rebuild (`src/features/analytics/AnalyticsDashboard.tsx` + `…/analytics/board/*` 12 panels)
- Targets, Policies: re-skinned (logic preserved)
- Shared controls: Radix portals re-hosted into `.theme-v2` via `src/components/ui/portal-container.tsx` (dropdowns/dialogs/selects now charcoal, not Slate/Indigo). **This is global — every page's controls are already themed.**
- Dashboard mobile: responsive QuickActions/BoardHero/BoardStatRow + subtler dividers
- Login: cinematic split-screen with a bloomed GPU particle reactor (`src/features/auth/login-reactor/*`) — user-approved.
- Tooling: `scripts/smoke-analytics-board.py` (authed + mobile screenshot + horizontal-overflow check).

## PROGRESS (this session, 2026-06-01)
- [x] **`/recruiting`** — re-skinned all THREE render variants (`RecruitingDashboardContent`, `FreeUplineRecruitingView`, free-tier `BasicRecruitingView`): dashboard-canvas shell + Board header + FlapTile snapshot band wired to the real `stats` counts (NO fabricated goal ring — recruiting has no genuine pace target) + `RecruitListTable` re-hosted in `<Board>`. Logic preserved. Committed `7346d447`. tsc/eslint/build green; NOT seen authed.
- [x] **`/hierarchy`** (main Team dashboard, `HierarchyDashboardCompact`) — dashboard-canvas shell + Board header + FlapTile hero on the REAL team stats (team size/direct/override MTD+YTD/pending). All child tables + timeframe controls preserved. Committed `e695214b`. tsc/eslint/build green; NOT seen authed.

## REMAINING PAGES (priority order)
1. **Recruiting/Team leftovers** — `MyRecruitingPipeline` (`/recruiting`-adjacent, 603 ln), `PipelineAdminPage` + admin sub-pages (`/recruiting/admin/*`), `AgentDetailPage` (`/hierarchy/agent/$id`), `OrgChartPage` (`/hierarchy/org-chart`), and the hierarchy sub-routes (`/hierarchy/overrides`, `/hierarchy/downlines`).
2. **Reports** — `/reports` (already Recharts-heavy → maps onto the board chart panels).
3. Then the rest of the sidebar nav: Expenses (`/expenses`), Lead Vendors (`/lead-vendors`), Marketing (`/marketing`), Messages (`/messages`), Leaderboard (`/leaderboard` — already imports board), UW Wizard/Admin (`/underwriting/*`), Chat Bot (`/chat-bot`), AI Voice Agent (`/voice-agent`), Orchestrator (`/channel-orchestration`), Close KPIs (`/close-kpi`), Business Tools (`/business-tools`), Billing (`/billing`), Settings (`/settings`), Admin (`/admin`), Workflows (`/system/workflows`).
   - **Command Center (`/command-center`) is intentionally its OWN Jarvis surface — do NOT reskin it.**

## Per-page method (fast path)
1. Find the route component (`src/router.tsx`) and read it.
2. **Check if it's already partly Board** (uses `BoardListHeader`/`SoftCard`/board imports). Often the only gap is wrapping in `<SectionShell className="dashboard-canvas">` + a max-width container + (optionally) a verdict hero — NOT a full rebuild (Policies was exactly this).
3. Reuse the existing data hooks/services; recompose UI into `<Board>` panels with `<Cap>`/`<Num>`/`<FlapTile>`/`<Bar>` etc. Add `<EmptyState>` branches.
4. For very large files (1500+ lines), a single subagent's context can overflow on its final message — but its edits still land. Either edit yourself or delegate and VERIFY yourself (don't trust a failed return).
5. **Preserve all logic** on re-skins (Targets/Policies kept every hook/handler/popover). When in doubt, it's logic — keep it.

## Verify EVERY page before moving on
- `npx tsc --noEmit -p tsconfig.json` → 0 errors
- `npx eslint <files>` → clean (note: relative deep imports `../../../services/...` are the repo's escape hatch; `@/`-alias deep imports are lint-blocked)
- `npm run build` → green
- Run the smoke script for visual/overflow (authed needs creds): `E2E_EMAIL=… E2E_PASSWORD=… python3 scripts/smoke-analytics-board.py http://localhost:3000`

## Hard gotchas / constraints (from memory)
- **Charcoal, never warm brown** (`#0d0d0e` ramp). Tokens live in `index.css` under `.theme-v2` + `src/components/board/tokens.ts`. Shipped system wins over any handoff's visual values.
- **NO `@react-three/fiber`** — clobbers JSX types repo-wide. Raw three.js only.
- **Animations bar is HIGH** ("movie-tier"); see `feedback_login_graphics_must_be_movie_tier.md` + `feedback_jarvis_animations_must_be_premium.md`. Judge WebGL live on a real GPU, not headless screenshots (swiftshader dulls/blows out bloom).
- **Commit discipline**: this repo has ~60 pre-existing uncommitted files that are NOT yours (signatures removal, edge functions, etc.). Stage ONLY your own files by explicit path — never `git add -A`.
- **Push**: only `main` deploys (Vercel). Push only on explicit user request; pushing main = prod deploy.
- No schema changes in this effort (`database.types.ts` untouched).

## Open verification debt (flag to user)
Analytics/Targets/Policies are live but were only build-verified, not seen authed by the assistant. Worth a prod click-through.

## Memory pointers
`MEMORY.md` → "Board page redesign progress", "Board shared-controls fix", "Analytics board redesign", plus the two animation-feedback files above.
