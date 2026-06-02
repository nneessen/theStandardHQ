# CONTINUATION — "The Board" DEEP rebuild of remaining pages + their inner components (2026-06-02)

## Mission
Finish "The Board" redesign by giving every remaining authenticated page a
**real body rebuild** — not just a shell+header wrap. That means the page's
**inner components** (stat strips, cards, tables, tabs, panels, dialogs) must
become Board surfaces too. The user's exact complaint that drove this doc:
> "why are you only doing some of the Team Page… you're being lazy"
> "all of these pages seem like they all look like they always did"

The cause: most nav pages this session got only `SectionShell .dashboard-canvas`
+ a `<Cap>`/`<h1>` departure header, while their **bodies stayed old**
(shadcn/`bg-v2-card`/`bg-card` cards with `text-[9/10/11px]`). Fix = rebuild the
bodies + inner components into `<Board>` panels / `<FlapTile>` rows.

---

## READ FIRST (every time)
1. `docs/design/board-page-template.md` — the authoritative recipe (tokens,
   primitives, panel skeleton, mobile gotcha, hard rules). Worked examples:
   Analytics, Targets, Dashboard.
2. This file.
3. Memory: "Board redesign — VISUAL LOOP + wrap-vs-rebuild lesson".

---

## ⛔ THE #1 RULE: SEE IT BEFORE YOU CALL IT DONE
We shipped a whole session build-verified-but-blind and it read as "unchanged."
**A visual loop now exists — use it on every page.**

- Creds are in gitignored `.env.local` (`E2E_EMAIL=nickneessen@thestandardhq.com`
  + `E2E_PASSWORD=…`). Dev server runs on `http://localhost:3000`.
- Screenshot tool: `scripts/board-shots.py` (Playwright; logs in, full-page PNG
  to `/tmp/board-shots/<route>-desktop.png`, flags horizontal overflow). Uses
  `domcontentloaded` so polling pages (close-kpi/voice) don't hang.
- Run:
  ```bash
  E2E_EMAIL='nickneessen@thestandardhq.com' E2E_PASSWORD='<pw from .env.local>' \
    python3 scripts/board-shots.py /targets /expenses /hierarchy
  ```
  then `Read` the PNG. **tsc/eslint/build green is NOT enough** — open the image
  and confirm it actually looks like The Board (and no h-overflow) before commit.

---

## The rebuild patterns (copy these)

### A) Stat strip / metric body → `<Board>` of `<FlapTile>`s
The single highest-impact move. Any dense "key: value" strip (4-column grids,
`MetricRow` lists, `bg-card` summary cards) becomes:
```tsx
import { Board, Cap, FlapTile } from "@/components/board";

<Board pad={20}>
  <Cap style={{ marginBottom: 14 }}>Summary Title</Cap>
  <div style={{ display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 10 }}>
    <FlapTile label="Monthly Total" value={formatCurrency(x)} tone="blue" />
    <FlapTile label="Retention" value={formatPercent(r)}
      tone={r > 90 ? "green" : r > 80 ? "amber" : "red"} />
    {/* …big legible numbers. DROP derivable sub-stats (%s, one-time) to cut clutter. */}
  </div>
</Board>
```
**User-approved tradeoff:** "big & clean" — consolidate, drop redundant/derivable
micro-stats. Worked examples committed this session:
`expenses/ExpenseDashboardCompact.tsx`, `hierarchy/components/TeamMetricsCard.tsx`,
`admin/components/lead-vendors/MarketPulse.tsx`.

### B) Old card panel → `<Board>` panel with `<Cap>` header
For tables/charts/lists that should stay but look old (`bg-v2-card rounded-* border`):
swap the root wrapper for `<Board pad={16}>` and the uppercase title `<div>` for
`<Cap>`. Keep the table/chart/data exactly. Worked example: the 6
`hierarchy/components/analytics/*` panels + `TeamAnalyticsDashboard.tsx`.

### C) Two near-identical tables stacked → one panel + toggle
Worked example: `HierarchyDashboardCompact` AP/IP `PillNav` toggle (one table at a
time). Use when a page shows duplicate-looking tables.

### Legibility (do alongside): floor text at 11px
Safe-ordered tier bump (no double-apply): `text-[11px]→[12px]`, then
`text-[10px]→[11px]`, then `text-[9px]→[11px]`; inline `font: \`500 9/10px\`` → 11px;
loosen `space-y-1`→`space-y-2`; panel `pad` 16→20, row `gap` 14→18. (See the
TargetsPage commit `594b63c4`.)

---

## ✅ DONE — body is genuinely Board (don't redo)
Dashboard, Analytics, Targets, Policies, Leaderboard, Recruiting (+3 tier views),
**Expenses** (summary), **Team/Hierarchy** (metrics + analytics panels + AP/IP
toggle), **Lead Intelligence** (Market Pulse), **Overrides**.
(NOTE: Analytics/Dashboard/Policies/Leaderboard are done via `<Board>`/charts even
though they don't use the `FlapTile` primitive — don't be fooled by a
"no FlapTile" grep.)

### Session 2026-06-02 progress (verified by screenshot unless noted)
- **VISUAL LOOP FIXED** (commit 730880f2). The screenshots were all silently the
  LOGIN page: `board-shots.py` used `get_by_label("Email"/"Password")` but the
  login inputs are placeholder-only → filled nothing. Now selects
  `input[type=email]/[type=password]` and ABORTS loudly if still on `/login`.
  Also the dev server hits **LOCAL** Supabase (127.0.0.1:54321) and `.env.local`
  `E2E_PASSWORD` didn't match the local seed → reset local `auth.users` pw via
  `crypt()` to match (local-only, reversible). Login now → /policies. Memory:
  `project_board_visual_loop_creds`.
- **Bot Health** (`/admin/bot-health`) ✓ FULL — HeroCards→SYSTEM FlapTile band +
  status-Pill strip; queue/process/agents Cards→Board panels; Badges→Pills. (730880f2)
- **Downline Performance** (`/hierarchy/downlines`) ✓ FULL — added Downline-Totals
  FlapTile band; Card→Board table panel; empty persistency shows `—` not red 0.0%.
  Dialogs left as-is (Radix-portaled, inherit Board). (1ae66bbf, 1ae66bbf+fix)
- **Business Tools** (`/business-tools`) — ⛔ **OUT OF SCOPE (per user, 2026-06-02).**
  An Overview-tab rebuild was committed then **reverted** (e8f0f6f4 → revert
  15eb94b9) — files are back to original shadcn. Its bodies are gated by the
  `business-tools-proxy` edge fn (not served on local, CORS/ERR_FAILED) so it
  was never screenshot-verifiable anyway. **Do NOT redesign Business Tools.**
- **OrgChartPage** (`/hierarchy/org-chart`) ✓ page-level loading/error/empty
  Cards→Board. Data view already charcoal via `OrgChartVisualization` (whose
  inner `<Card>`s resolve to charcoal through theme-v2 `--card` — structural-only,
  deferred). (51fcfc56)
- **AgentDetailPage** (`/hierarchy/agent/$id`) ✓ FULL — **all 4 tabs** now have
  big-&-clean FlapTile bands: Production (header), Commissions, Override Earnings
  (+2 detail panels), Team. Level/status Badges→Pills. Each tab verified by a
  tab-click screenshot (`/tmp/tab-shot.py <route> <TabName> <out>`). EditAgentModal
  is a Radix form dialog → already charcoal, left as-is. (96331738, e09f9c71, +overrides)

### ‼️ CRITICAL TRIAGE CORRECTION (supersedes the light-vs-charcoal note below)
The earlier "LIGHT shadcn `bg-card` = offender" heuristic was **WRONG**. Inside
`.theme-v2`, `index.css` overrides `--card:#161617`, `--background:#0d0d0e`,
`--border: cream hairline`, `--muted:#222224`. So **`bg-card`, `<Card>`,
`bg-background`, `border-border` ALL render CHARCOAL already** — they are NOT light
offenders. The `grep -c "<Card|bg-card"` "light count" is meaningless for pages
already inside the `dashboard-canvas`/`.theme-v2` shell (AgentDetail's "15 light
Cards" were all charcoal). The ONLY genuinely-light surfaces are pages NOT yet
wrapped in the shell at all (none remain in Tier-1).
**So the real remaining work is NOT charcoal-ifying — it's the "big & clean"
FlapTile treatment.** The user's "looks the same as always" = pages whose stat
strips are still cramped `text-[11px]` `key: value` rows with `·`/`|` dividers
(charcoal but generic), instead of `<Board>` bands of big-Archivo `<FlapTile>`s.
**Find the real work with:** `grep -rnE 'text-\[(9|10|11)px\].*(font-semibold|text-success|formatCurrency)' src/features/<dir>` and look for inline divider strips (`h-3 w-px bg-muted`). Convert those → FlapTile bands. Ignore the `bg-card` count.

### ⚠️ KEY TRIAGE LESSON (use this to prioritize remaining work)
Not every shadcn surface is a "looks the same" offender. Two classes:
- **LIGHT shadcn = REAL offender → convert:** `<Card variant="outlined">`,
  `<Card>`, `bg-card`, `bg-background`. These render the global light/Slate card
  and visibly clash. (Bot Health was this.)
- **Already-charcoal → LOW payoff, defer:** `bg-v2-card` / `rounded-v2-*` and
  shadcn `<Card>` *inside `.theme-v2`* (whose `--card` token is charcoal). These
  already look Board; converting to `<Board>` only adds the gradient/rivets/hairline.
  (Contracting + OrgChartVisualization + My-Training inner are this — visible but
  already dark.)
**Inventory command (do this FIRST per page):**
`grep -rlnE '<Card |<Card>|variant="outlined"|bg-card\b|bg-background\b' src/features/<dir>`
→ that's the LIGHT-offender worklist. "Done" = empty. Then spend leftover budget
on the charcoal-but-shadcn polish only if time allows.

### Remaining Tier-1 (find cramped `text-[11px]` stat strips → FlapTile bands):
Per the triage correction above, hunt **inline divider stat strips**, not `bg-card`.
- **TrainerDashboard** (`/trainer-dashboard`) — check for KPI stat strips.
- **TeamOverviewPage** + **RoadmapListPage** (roadmap) — progress/XP stat blocks.
- **HierarchyManagement** (`/hierarchy/manage`) — inline dialogs.
- **My-Training** inner (`training-modules/.../learner/`) — XP/streak/progress
  blocks (already charcoal; only worth it if they're cramped key:value strips).
- **Get an agent `$id`** from local: `nickneessen@thestandardhq.com` =
  `d0d3edea-af6d-4990-80b8-1765ba829896` (it's the test login = "own profile", so
  the "Your Overrides from This Agent" panel is hidden — view a DOWNLINE's id to
  see it).

---

## 🟡 REMAINING — shell+header only, BODIES + INNER COMPONENTS still old
For EACH page below: rebuild the page file AND walk its feature dir's
`components/`, tabs, panels, dialogs. **Do not stop at the page file.**

### TIER 1 — stat/metric bodies → FlapTile rebuild (highest payoff)
| Page (route) | Page file | Inner components to also restyle |
|---|---|---|
| Bot Health (`/admin/bot-health`) | `admin/components/BotHealthPage.tsx` | inline `HeroCard`, `StatPair` helpers (same file) — make HeroCards into FlapTiles |
| Agent Detail (`/hierarchy/agent/$id`) | `hierarchy/AgentDetailPage.tsx` | inline stat header + the AP/commission/override/policy tables; `components/EditAgentModal.tsx` |
| Downline Performance (`/hierarchy/downlines`) | `hierarchy/components/DownlinePerformance.tsx` | inline `EditHierarchyDialog`, `DeleteAgentDialog` |
| Contracting (`/contracting`) | `contracting/components/ContractingDashboard.tsx` | `contracting/components/`: `MyCarrierContractsCard`, `ContractLevelDisplay`, `ContractingFilters`, `BulkActionToolbar`, `InlineEditableCell`, `ContractRequestDetailDialog`, `BulkStatusChangeDialog` |
| Trainer Dashboard (`/trainer-dashboard`) | `training-hub/components/TrainerDashboard.tsx` | `training-hub/components/`: `AgencyPipelineOverview`, `ActivityTab`, `RecruitingTab`, `DocumentsTab`, `EmailTemplatesTab` |
| My Training (`/my-training`) | `training-modules/components/learner/MyTrainingPage.tsx` | `training-modules/components/learner/` (XP/streak/progress stat blocks) |
| Roadmap List / Team Progress (`/agent-roadmap*`) | `agent-roadmap/components/admin/RoadmapListPage.tsx`, `…/TeamOverviewPage.tsx` | inline `AdminRoadmapCard`, `SortableAdminRoadmapCard`, `RoadmapCell`; `agent-roadmap/components/` |

### TIER 2 — forms / config / tables / editors → card→Board polish (Pattern B; FlapTiles only where there are real stat blocks)
| Page | Page file | Inner components dir |
|---|---|---|
| Settings (`/settings`) | `settings/SettingsDashboard.tsx` | `settings/components/` + every tab dir: `agency/`, `carriers/`, `commission-rates/`, `imo/`, `integrations/`, `landing-page/`, `legal/`, `notifications/`, `products/`, plus `ConstantsManagement`, `GoalsManagement` |
| Admin Control Center (`/admin`) | `admin/components/AdminControlCenter.tsx` | `admin/components/`: `SystemSettingsTab`, `UsersAccessTab`, `RolesPermissionsTab`, `RecruitingPipelineTab`, `UserManagementDashboard`, `SystemAutomationsConfig`, `RolePermissionEditor`, dialogs (`AddUserDialog`, `EditUserDialog`, …) |
| Billing (`/billing`) | `billing/BillingPage.tsx` | `billing/components/`: `CurrentPlanCard`, `UsageOverview`, `PlanComparisonTable`, `PricingCards`, `PremiumAddonsSection`, `TeamUWWizardManager` |
| Reports (`/reports`) | `reports/ReportsDashboard.tsx` | `reports/components/`: `ReportSectionCard`, `ExecutiveSummary`, `InsightCard`, `ReportDocumentHeader`, `ImoPerformanceReport`, `AgencyPerformanceReport`, `charts/*`, `ScheduledReportsManager` |
| Marketing (`/marketing`) | `marketing/MarketingHubPage.tsx` | `marketing/components/templates/*`, `marketing/components/campaigns/*` (the LIST/gallery tabs; the EDITORS are full-bleed → leave) |
| Lead Intelligence other tabs (`/lead-vendors`) | `admin/components/lead-vendors/LeadIntelligenceDashboard.tsx` | remaining panels: `ConversionPanel`, `SpeedPanel`, `FreshVsAgedPanel`, `HeatDistribution`, `TopPerformersPanel`, `LeadKpiTabs`, `VendorIntelligenceTable`, `PackPurchaseTable`, `LeadPoliciesTable` (Market Pulse already done) |
| Workflows (`/system/workflows`) | `workflows/components/WorkflowAdminPage.tsx` | `workflows/components/` (`WorkflowActionsBuilder`, builders) |
| Pipeline Admin (`/recruiting/admin/pipelines`) | `recruiting/admin/PipelineAdminPage.tsx` | `recruiting/admin/`: `PipelineTemplatesList`, `PipelineTemplateEditor`, `PhaseEditor`, `ChecklistItem*` |
| Comp Guide (`/comps`) | `comps/CompGuide.tsx` | `comps/` components |
| Underwriting Guides (`/underwriting/guides`) | `underwriting/components/UnderwritingGuidesPage.tsx` | `underwriting/admin/` panels (admin page itself is full-bleed → leave) |
| The Standard Team (`/the-standard-team`) | `the-standard-team/TheStandardTeamPage.tsx` | its directory/compare components |
| Training Hub (`/training-hub`) | `training-hub/components/TrainingHubPage.tsx` | the tab components listed under Trainer Dashboard |
| Recruit/Lead Detail | `recruiting/pages/RecruitDetailPage.tsx`, `…/LeadDetailPage.tsx` | their hero/timeline/section components |
| Close AI Builder (`/close-ai-builder`) | `close-ai-builder/CloseAiBuilderPage.tsx` | `close-ai-builder/components/` builder tabs |
| Lead Drop (`/close-lead-drop`) | `close-lead-drop/LeadDropPage.tsx` | `close-lead-drop/components/` wizard steps |
| Hierarchy Management (`/hierarchy/manage`) | `hierarchy/components/HierarchyManagement.tsx` | inline dialogs |
| Org Chart (`/hierarchy/org-chart`) | `hierarchy/OrgChartPage.tsx` | `hierarchy/components/OrgChartVisualization.tsx` |
| Basic Recruiting (free tier) | `recruiting/components/BasicRecruitingView.tsx` | its inline table + dialogs |

### Close KPIs (`/close-kpi`) — `close-kpi/CloseKpiPage.tsx`
Purpose-built **widget dashboard** (`close-kpi/components/widgets/*`,
`config-forms/*`, `team/*`). NOT a stat-strip — only do light card→Board polish if
the user asks; do NOT force FlapTiles. Its `team/TeamSummaryCards` IS a candidate
if you want one win there.

---

## ⊘ DO NOT TOUCH — deliberate full-bleed own-surfaces (like /command-center)
They fill the viewport and break if centered in the padded canvas; already charcoal
in `.theme-v2`:
`/command-center`, `/recruiting/my-pipeline`, `/chat-bot`, `/voice-agent`(+`/clone`),
`/messages`, `/slack/name-leaderboard`, `/underwriting/wizard` + `/underwriting/admin`,
marketing template/campaign **editors**, training **ModulePlayer/ModuleBuilder/
Presentation record+detail**, agent-roadmap **Runner/Editor + non-admin landing**.
Public/auth/legal routes are out of scope.

---

## Per-page method
1. `board-shots.py /<route>` → Read the PNG to see the CURRENT body.
2. Identify stat strips (→ Pattern A FlapTiles) vs cards/tables (→ Pattern B Board
   panels). Preserve ALL hooks/handlers/data/dialogs — chrome only.
3. Walk the feature dir's `components/` + tabs + panels + dialogs and restyle each
   (this is the part that was being skipped). A dialog/tab is "inner" too.
4. `npx tsc --noEmit -p tsconfig.json` (0) → `npx eslint <files>` (0) → screenshot
   again → confirm visually (no h-overflow) → commit (your own files only).

## Hard constraints
- Charcoal, never brown. NO `@react-three/fiber`.
- `database.types.ts` untouched (no schema work here). Don't read it whole (slicer
  `node scripts/dbtype.mjs <name>`).
- Import-layering lint: domain barrels (`@/hooks`, `@/lib/format`) or **relative**
  deep service imports; no `@/`-alias deep imports.
- Commit discipline: stage ONLY your files by explicit path. ~60 pre-existing
  foreign uncommitted files exist — never `git add -A`.
- Push only on explicit user request (main = prod via Vercel).

## ⚠️ Concurrent-session caveat (active as of 2026-06-02)
A SECOND autonomous `claude` session (pid 60986, same cwd) is doing "perf(jarvis)"
work and **autocommits with a rebase flow** to `main` in this same worktree. It has
swept our files into its commits and raced HEAD (ref-lock errors, dropped a cosmetic
commit). User chose to leave it running. Mitigations: commit your work promptly in
small batches; if a commit fails with "cannot lock ref HEAD", just retry (HEAD
settled); verify `git log` after each commit. If it gets disruptive, ask the user to
stop session 60986 or move jarvis to its own worktree (`commissionTracker-jarvis`).

## Done-criteria
A page is done when, in a fresh screenshot: the body is `<Board>` panels (not
`bg-card`/`bg-v2-card`), stat strips are `<FlapTile>` rows with big numbers, text
floors at ~11px, no horizontal overflow, AND its inner components (tabs/panels/
dialogs) match — verified by opening the dialogs/tabs where feasible.
