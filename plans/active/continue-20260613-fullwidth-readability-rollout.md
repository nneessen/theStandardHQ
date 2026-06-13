# Full-width + readability rollout across all authenticated pages

## Context

On Jun 13 2026 the **Call Reviews library** page was reworked to fix four complaints —
it wasted horizontal space (capped + centered), used too-small fonts, had no row
separators, and rendered badges as flat dark charcoal pills. The fix shipped as commit
`0f8287d0` (and the "listened" marker as `c36b4f90`). The owner wants **that same recipe
applied to every other authenticated page** — "all the other pages are basically doing
the same thing."

Two scope decisions are **confirmed by the owner**:
1. **Full recipe** — width + bigger fonts + row separators + tinted badges (not width-only).
2. **Every page edge-to-edge** — including the ~37 pages already using the wide
   `max-w-[1820px]` Board cap; make them `w-full` too, matching Call Reviews exactly.

Net target: **~44 page components**, minus the deliberate full-bleed surfaces (excluded
below). Every page change must be screenshot-verified (build-green is NOT sufficient for
visual work — a hard-won lesson; see the Board-redesign memory).

**Premise verified (viewport-dependent — read this first).** The Group A `max-w-[1820px]`
pages already fill the width at a 1680px window (only `lg:px-12` padding shows); the cap only
leaves real gutters on **wide/ultrawide** monitors. Screenshotted `/targets` at both: at
**2560px the 1820 cap leaves ~260px of dead gutter on EACH side**; at 1680px it's ~48px
padding only. The owner's complaint ("too much space on the right **and** the left up to the
sidebar") matches the ultrawide picture, so the width win is real **for them**. Still, the
executing session must re-confirm at the owner's actual viewport first (see Verification
step 1) — if Group A already fills the owner's screen, the **font/border/badge** tiers are the
real deliverable and the width tier is mostly cosmetic at that size. Don't sweep blind.

## The recipe (what was done to Call Reviews — apply verbatim per page)

Reference file (the canonical "after"): `src/features/call-reviews/components/CallReviewsPage.tsx`.

1. **Width — remove the cap, fill the area.** On the page's OUTERMOST content `<div>`:
   - `mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6` → `w-full px-4 py-5 lg:py-6`
     (drop `mx-auto`, `max-w-[1820px]`, `sm:px-8`, `lg:px-12`; keep vertical rhythm).
   - `max-w-6xl|5xl|4xl|3xl mx-auto px-3 …` → `w-full px-4 …` (drop `max-w-*` + `mx-auto`,
     bump `px-3`→`px-4`).
   - `max-w-[1400px]` / `max-w-[1100px]` page caps → `w-full px-4` likewise.
   - Keep `py-*` and `space-y-*`. Do not touch grids/inner layout.

2. **Fonts — one step up, table/list BODY content only.** Bump the smallest text:
   `text-xs` row base → `text-sm`; `text-[11px]` cells → `text-[13px]`; `text-[9px]`/`text-[10px]`
   badges/labels → `text-[11px]`; table header row → `text-[11px]`; page `h1` → `text-xl`.
   Widen any fixed grid columns that would clip larger text.
   **Only in table/list page bodies** — NOT dialogs, forms, config panels, or the public
   recruit portal (see exclusions).

3. **Row separators.** On the rows container of any table/list, add
   `divide-y divide-v2-ring` (theme-aware hairline: faint slate in light, faint cream in the
   `.theme-v2` charcoal theme). Give rows breathing room (`py-2`→`py-2.5`).

4. **Badges — tinted, not flat-dark.** Replace inline `<Badge variant="outline" className="text-[9/10px] …">`
   status/outcome pills with soft semantic tints that read in both themes.
   **Create a shared helper first** (none exists app-wide today) — e.g.
   `src/components/ui/StatusBadge.tsx` exporting a `TINT` map + a `<StatusBadge tone=…>`:
   ```
   emerald: bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30
   blue:    bg-blue-100  … dark:bg-blue-500/15  …
   amber:   bg-amber-100 … dark:bg-amber-500/15 …
   slate:   bg-slate-100 text-slate-700 … dark:bg-slate-500/15 …
   rose:    bg-rose-100  text-rose-700  … dark:bg-rose-500/15  …
   ```
   Lift the file-local `TINT` map from `CallReviewsPage.tsx` (and the `KIND_STYLE` map in
   `GeneratedScriptView.tsx`) into this shared module and have Call Reviews import it too
   (de-dupe). Then refactor the ~35 inline-outline-badge sites to use it. Also fold in the
   pre-TINT light-only maps in `src/types/recruiting.types.ts` (`TERMINAL_STATUS_COLORS`,
   `CHECKLIST_STATUS_COLORS`) — they lack `dark:` variants.

## Scope — pages to change (~44)

There is **no shared width chokepoint** — `AppShell` (`p-6 w-full`) and `SectionShell`
(`theme-v2 v2-canvas`) impose no `max-w`; each page caps itself. So this is **per-page**.

**Group A — the `max-w-[1820px]` pages (~37, the bulk).** Each is `<SectionShell>` wrapping
`mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6`. Representative paths
(full list via `grep -rl 'max-w-\[1820px\]' src/`):
`analytics/AnalyticsDashboard`, `policies/PolicyDashboard`, `targets/TargetsPage`,
`expenses/ExpensesPage`, `leaderboard/LeaderboardPage`, `kpi/components/KpiPage`,
`close-kpi/CloseKpiPage`, `billing/BillingPage`, `comps/CompGuide`,
`settings/SettingsDashboard`, `contracting/ContractingHubPage`, `marketing/MarketingHubPage`,
all six `hierarchy/*` pages, all `recruiting/*` dashboards + `LeadDetailPage`/`RecruitDetailPage`,
`training-hub/*`, `training-modules/.../MyTrainingPage`, `underwriting/.../UnderwritingGuidesPage`,
`admin/AdminControlCenter`+`AuthDiagnostic`+`BotHealthPage`+`lead-vendors/LeadIntelligenceDashboard`,
`agent-roadmap/admin/RoadmapListPage`+`TeamOverviewPage`, `workflows/.../WorkflowAdminPage`,
`the-standard-team/LicensingHubPage`, `close-ai-builder/CloseAiBuilderPage`.
⚠️ One `max-w-[1820px]` match is a **destructive-error banner**, not a page container —
skip it (`grep` for the `px-4 py-5` container, not the `border-destructive` one).

**Group B — genuinely tight caps (~7).**
- `call-reviews/components/CallReviewDetailPage.tsx` — `max-w-6xl mx-auto px-3 py-4`
- `call-reviews/components/scripts/ScriptDetailPage.tsx` — `max-w-5xl mx-auto px-4 py-6 … print:max-w-none` (keep the print class)
- `dashboard/DashboardHome.tsx` — `max-w-[1400px] … overflow-x-clip`
- `agent-roadmap/components/user/RoadmapLandingPage.tsx` — `max-w-4xl`
- `training-modules/components/learner/LessonViewer.tsx` — `max-w-3xl` (reading view — confirm owner wants this wide; reading columns often stay narrow on purpose)
- `recruiting/pages/RecruitingYourPage.tsx` — `max-w-[1100px]` (**intentional** narrow branding tool — confirm before widening; likely LEAVE)
- `call-reviews/.../ScriptsLibraryPage.tsx` — **already done**, use as a second reference.

## Exclusions — do NOT touch (deliberate full-bleed / own-surface)

These fill the viewport by design (fixed `h-[calc(100vh-…)]`, own header, no sidebar, or a
non-`theme-v2` landing theme). Detection signal in parens:
`/command-center` (App.tsx `isCommandCenter`, no AppShell), `/recruiting/my-pipeline`
(App.tsx `isRecruitPipeline`, `.theme-landing`), `/recruiting/custom-domains/setup`
(`isCustomDomainSetup`), `/voice-agent` + `/voice-agent/clone` (`h-[calc(100vh-4rem)]`),
`/chat-bot` (`h-[calc…]`), `/messages` (`h-[calc…]` split-pane), `my-training` ModulePlayer /
ModuleBuilder / PresentationDetail / PresentationRecord (`h-[calc…]`),
`agent-roadmap` RoadmapRunner + RoadmapEditor (`h-screen`/`h-[calc…]`),
`/underwriting/wizard` + `/underwriting/admin` (full-page wizard / two-pane),
marketing TemplateEditor + CampaignEditor (`h-full`), `/internal/design-preview` (bare iframe),
all public `/join`/`/register` routes.
For **fonts/badges**, additionally exclude: dialogs (`*Dialog.tsx`), config forms
(`settings/**` forms, `policies/**Form*`, chat-bot Setup/Admin tabs), and the public recruit
portal (`recruiting/layouts`, `recruiting/editorial`, `recruiting/public`) — these use small
type intentionally. (The portal dirs are already nearly clean: 1 styled label total.)

## Approach (ultra/max multi-agent)

Tiered so the high-value, low-risk work lands first and verification stays tractable.

- **Tier 0 — shared helper (1 agent, do first).** Create `src/components/ui/StatusBadge.tsx`
  with the `TINT` map; switch Call Reviews + GeneratedScriptView to import it. `tsc` + build.
  Commit before Tier 2 fans out (it's a shared dependency).
- **Tier 1 — width = a CODEMOD, not a swarm.** The Group A string is **byte-identical across
  37 files** (`mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6` → `w-full px-4
  py-5 lg:py-6`). That's one scripted find-replace + one build + a screenshot spot-check of a
  few representative pages — faster and safer than per-page agents. Handle the ~7 Group B/C
  one-off strings manually. Do NOT spend agents here. (⚠️ exclude the `border-destructive`
  banner match.)
- **Tier 2 — borders + badges (fan out — needs per-page judgment).** Add `divide-y
  divide-v2-ring` to table/list row containers, and refactor inline outline badges →
  `StatusBadge`. **This is semantic, not mechanical:** each of the ~35 sites has its OWN status
  vocabulary (lead vs recruiting vs carrier vs training vs permission statuses), and the agent
  must map each status value to the right tone by hand (sold/approved/published→emerald,
  pending/processing→amber, denied/failed→rose, neutral→slate, info→blue). One agent per
  feature area, each owning its domain's status→tone mapping.
- **Tier 3 — fonts (fan out, careful).** Bump table/list body font sizes per the recipe,
  honoring the dialog/form/portal exclusions. Highest-touch, most error-prone tier — one agent
  per feature area, each screenshotting its pages.

Orchestration notes: page edits are independent → safe to parallelize; use `isolation:
worktree` only if agents would collide on a shared file. Keep one screenshot pass per batch so
verification rides along with each change. Commit per tier (or per feature batch) so the diff
stays reviewable and bisectable. Right tool per tier: codemod for width, agent fan-out only
for the judgment tiers (badges, fonts).

## Verification (mandatory, per page)

The visual loop is already wired:
```
set -a; source .env.local; set +a            # E2E creds (or demo: agent1@epiclife-demo.test / DemoPass123!)
(npx vite --port 5173 &)                      # dev server
BOARD_BASE=http://localhost:5173 python3 scripts/board-shots.py /targets /policies /expenses …
```
(`board-shots.py` logs in, full-page-screenshots each route to `/tmp/board-shots/<route>.png`,
and prints an h-overflow "cut off on the right" flag.) For each changed page: screenshot,
confirm it now fills the width, no horizontal overflow, badges/fonts/borders render in the
charcoal theme. Then `npx tsc --noEmit` + `npm run build` green (zero TS errors — Vercel is
strict). Per the global rule, the per-feature smoke/screenshot artifact is the proof — do not
declare a page done on build-green alone.

## Risks / notes

- **Board-redesign tension:** the `max-w-[1820px]` cap was a deliberate Board-redesign choice
  (centered "departure-header" layout). The owner is intentionally overriding it to full-bleed.
  Record this so a future pass doesn't "restore" the cap. Update the Board-redesign memory
  entries accordingly.
- **Reading views:** `LessonViewer` (`max-w-3xl`) and `RecruitingYourPage` (`max-w-[1100px]`)
  are arguably intentional narrow layouts — verify with the owner or leave them; full-bleed
  body text hurts readability. Default: LEAVE both unless owner says otherwise.
- **Fixed-grid clipping:** larger fonts in fixed `grid-cols-[…px…]` tables can clip — widen
  those columns (as done on Call Reviews). Watch dense tables (close-kpi, hierarchy, leaderboard).
- **No schema/DB changes** in this rollout — pure presentational. No types regen.

## Done criteria

All ~44 in-scope pages: `w-full` (no `max-w` cap, no centering gutters), table/list bodies at
the bumped font sizes with `divide-y` row hairlines and tinted `StatusBadge`s; exclusions
untouched; every changed page screenshot-verified filling the width with no overflow;
`tsc` + `npm run build` green; shared `StatusBadge` helper in use (no duplicated TINT maps);
committed in reviewable tiers on `main`.
