# Board Page Template — redesigning any page into "The Board"

A reusable recipe for re-skinning a feature page into the shipped **"The Board"**
(split-flap departure-board) design system. The Analytics page is the worked
example (`src/features/analytics/AnalyticsDashboard.tsx` + `…/analytics/board/`);
the Dashboard (`src/features/dashboard/DashboardHome.tsx`) is the original.

Follow this to redesign the next page (Policies, Commissions, Recruiting, …) so
every surface shares one visual language.

---

## 0. Governing principle (read first)

> **The shipped Board design system is the source of truth for visual tokens,
> colors, radii, and primitives. A design handoff governs layout, structure,
> copy, and data-mapping. Where they disagree on a *visual* value, the shipped
> system wins.**

This is what makes pages consistent and the template valid. Concretely:

- **Surfaces are NEUTRAL CHARCOAL** — `--bg:#0d0d0e`, `--panel:#161617`,
  `--tile:#222224`. **Never** the warm-brown `#120f08` some handoffs specify;
  the user rejected brown. Text + accents stay warm (cream/blue/amber/green).
- Panel radius is **12** (`Board.tsx`), not a handoff's 14. Don't add a handoff's
  raw `:root` color block — the tokens already live in `index.css` under
  `.theme-v2` and `src/components/board/tokens.ts`.
- One accent per surface: **blue** = primary/selection, **cyan** = Jarvis ONLY,
  **amber/red/green** = status (never decorative).

---

## 1. Tokens — `import { T } from "@/components/board"`

| Group | Tokens |
|---|---|
| Surfaces | `T.bg T.panel T.panel2 T.tile` |
| Lines | `T.line` (hairline) `T.line2` (border) |
| Text | `T.ink` (headings) `T.cream` (numbers) `T.mut` (secondary) `T.mut2` (eyebrow) |
| Accents | `T.blue T.cyan T.amber T.red T.green` |
| Fonts | `T.disp` (Archivo — numbers/headings) `T.mono` (Space Mono — eyebrows/keys) `T.data` (Hanken Grotesk — body) |
| Chrome | `T.panelGradient T.panelShadow T.brushed` |

Numbers always use `font-variant-numeric: tabular-nums` (the Num/FlapTile/
AnimatedNumber primitives already do).

---

## 2. Primitives — all from `@/components/board`

| Primitive | Use |
|---|---|
| `<Board pad={20} rivets>` | the riveted panel surface — wrap every panel |
| `<Cap>EYEBROW</Cap>` | mono uppercase eyebrow/label (11px, .2em, mut2) |
| `<Num text size color lit />` | Archivo number (`xs\|sm\|md\|lg\|xl`; `lit` = blue glow) |
| `<AnimatedNumber value prefix suffix decimals size lit />` | count-up Num (reduced-motion safe) |
| `<SplitFlap text size lit />` | per-character Solari tiles — RANK / featured values only |
| `<FlapTile label value tone sm />` | inset stat tile (mono key + Archivo value); tone `default\|blue\|amber\|green\|red` |
| `<Pill tone dot>LABEL</Pill>` | status chip; tone `blue\|amber\|green\|red\|cyan` |
| `<Bar pct tone height />` | inset progress bar (pct 0–1); tone `blue\|amber\|green\|red` |
| `<RadialProgress pct tone caption />` | animated goal ring w/ count-up centre |
| `<StatusDot color size glow />` | glowing indicator dot |
| `<EmptyState icon title hint pad />` | dashed-ring intentional empty state |
| `<BoardPageHeader title meta periods period onPeriodChange actions />` | the departure-board topbar (used by the Dashboard) |
| `<Ticker items />` | bottom broadcast ticker |

If a page needs a new shared visual atom, add it to `src/components/board/` and
export it from the barrel — **never** scatter design-system pieces in a feature
dir, and never make a board primitive depend on a feature (keep the system
standalone; the one allowed cross-import is the canonical `useCountUp` via the
`@/features/landing` barrel).

---

## 2b. Shared controls & portaled surfaces (foundation)

Form controls that render **in-flow** inside `.theme-v2` (inline `Input`,
`Tabs`, `Switch`, `Checkbox`, `Radio`, in-flow tooltips) **already inherit** the
board tokens — don't rewrite the `components/ui/*.tsx` files for them.

The gotcha is **portaled** controls. `.theme-v2` lives on a `<div>` in
`App.tsx`, but Radix portals (`Select`, `DropdownMenu`, `Dialog`, `AlertDialog`,
`Popover`, `Tooltip`, `Sheet`, and `Command` via `Dialog`) mount at
`document.body` — *outside* the theme scope — so without intervention they
resolve the global `.dark` **Slate+Indigo** palette and visibly mismatch the
charcoal page.

Fix (already in place): a portal host inside the shell.
- `src/components/ui/portal-container.tsx` — `PortalContainerProvider` renders a
  `theme-v2-portal-host` node inside `.theme-v2` and exposes it via
  `usePortalContainer()`.
- The shell wraps its content in `<PortalContainerProvider>` (`App.tsx`).
- Each portaling `components/ui/*` passes `container={usePortalContainer()}` to
  its Radix `Portal`. Public pages mount no provider → `undefined` →
  Radix falls back to `document.body` → original palette untouched (leak-proof).
- `index.css` gives the host's `[role="menu"|"listbox"|"dialog"|"alertdialog"]`
  the board panel gradient + lift shadow so they read as Board panels.

**When adding a NEW component that uses a Radix Portal**, pass
`container={usePortalContainer()}` to it — same one line.

---

## 3. The panel component skeleton

Every panel is **self-contained**: it reuses the existing feature hooks/services
for real data and renders into a `<Board>`. It must stretch to its row height
(`height: "100%"`) and must handle the empty/$0 case.

```tsx
import { Board, Cap, Num, FlapTile, EmptyState, T } from "@/components/board";
import { Activity } from "lucide-react";

export function XPanel() {
  const { /* real values */, isLoading } = useXData(); // reuse existing hooks
  if (isLoading) return <Board pad={26} style={{ height: "100%" }}>{/* skeleton */}</Board>;

  const empty = /* no meaningful data, e.g. rows.length === 0 */;

  return (
    <Board pad={26} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Cap>PANEL EYEBROW</Cap>
          <div style={{ font: `600 18px ${T.data}`, color: T.ink, marginTop: 4 }}>Subtitle</div>
        </div>
        {!empty && <Num text={headline} size="lg" />}
      </div>

      {empty ? (
        <EmptyState icon={<Activity size={20} />} title="No data yet"
          hint="Appears once …" pad={40} />
      ) : (
        <>{/* FlapTiles / table / Recharts / Bars */}</>
      )}
    </Board>
  );
}
```

### Charts
Use **Recharts** (installed), themed to tokens — grid stroke `T.line` (~0.08
alpha), axis text mono 11px `T.mut`, tooltip `background:#161617; border:1px
solid ${T.line2}`, mono values. `ResponsiveContainer` to fill width, fixed
height ~250 (300 featured). Use `isAnimationActive` for draw-on. See
`TrendChartPanel.tsx` / `GrowthChartPanel.tsx` / `TrendComparisonPanel.tsx`.

---

## 3b. Mobile / responsive (Board primitives use inline styles!)

Board primitives lean on **inline styles**, which **cannot hold media queries** — so
fixed inline `gridTemplateColumns`/`width`/non-wrapping flex rows overflow on phones
("cut off on the right"). When laying out, do NOT bake fixed columns inline:
- Multi-column rows → put the grid on a **className** with Tailwind breakpoints
  (`grid grid-cols-1 lg:grid-cols-[1.6fr_1fr]`), OR use inline
  `gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))"` so cells wrap.
- Toolbars/headers → `flexWrap: "wrap"` (BoardPageHeader already does).
- Don't mix an inline `gridTemplateColumns` with a className `grid-cols-*` — inline wins.
- Belt-and-suspenders: `overflow-x-clip` (sticky-safe, unlike `overflow-x-hidden`) on the
  page container catches stray overflow.
The dashboard's QuickActions/BoardHero/BoardStatRow were fixed this way.

## 4. Hard rules (these are the ones that bite)

1. **Empty/$0 states are first-class, not polish.** Real accounts are often $0.
   Never render flat-zero charts/counters (reads as broken) — branch to
   `<EmptyState>`. Decide the empty predicate per panel. The hero shows
   "set a target / push to get started", not a dead ring.
2. **No hardcoded sample numbers.** Every value wires to a real hook/service —
   CI fails on mock data in `src/**`. Handoff sample numbers are samples only.
3. **Reuse the data layer; recompose the UI.** Call the same hooks/services the
   existing v2 panel uses. TanStack Query dedupes, so many panels calling the
   same query hook is fine and is the existing pattern. Do **not** add new
   fetching, and do **not** restyle the old SoftCard in place — build a new
   Board panel beside it.
4. **Equal-height rows.** Page rows are CSS grid with `align-items: stretch`;
   each panel root `<Board>` gets `height: "100%"`. This is what makes the page
   look orderly instead of ragged.
5. **Respect the import-layering lint.** The repo forbids `@/`-alias *deep*
   imports and UI→infra imports. Either import from a domain barrel (`@/hooks`,
   `@/hooks/targets`, `@/lib/format`) or use a **relative** deep import for
   services without a barrel (e.g. `../../../services/analytics/gamePlanService`,
   matching the existing components). Strip unused `React` default imports.
6. **No leftover files.** When you replace a page, rewrite it in place — don't
   leave the old version at a parallel path.

---

## 5. Page assembly (verdict-first layout)

The Analytics page proves the pattern: lead with the *verdict* (am I on pace?),
then *what to do*, then supporting detail.

```
SectionShell className="dashboard-canvas"          ← charcoal canvas + brushed texture
  div max-w-[1820px] centered, px/py
    Header   (Cap eyebrow + big Archivo title + subtitle | period control + export)
    Hero band (full width — RadialProgress + verdict + 2×2 FlapTiles)
    Row g2:  [primary chart | secondary chart]
    Row g3:  [action feed (1) | wide table (span 2)]
    Row g3:  [funnel | segments | pipeline]
    Row g3:  [comparison (span 2) | stack(mix + geo)]
    Row g1:  [wide table]
    Footer note (mono, mut2)
```

Helpers used (copy from `AnalyticsDashboard.tsx`):

- `rowStyle(cols)` → `{ display:"grid", gridTemplateColumns:"repeat(cols,minmax(0,1fr))", gap:16, alignItems:"stretch", marginBottom:16 }`
- `<Cell section span minHeight>` → wraps each panel in its **subscription gate**
  → **Suspense** (lazy panel) → a `<PanelSkeleton>` fallback. `gridColumn: span N`
  for wide cells; `minWidth:0` so charts don't overflow the track.
- **Lazy-load each panel** (`lazy(() => import("./board").then(m => ({default: m.X})))`)
  so heavy deps (Recharts) stay out of the main bundle.

The page keeps its existing concerns: date-range provider/context, subscription
gating per section, export (CSV/PDF), upgrade banner.

---

## 6. Step-by-step checklist for the next page

1. **Map the data.** For each panel, note which hook/service feeds it and the
   exact real fields rendered, plus the empty predicate. (Reuse — don't refetch.)
2. **Inventory primitives.** Everything you need is probably in
   `@/components/board`. If not, add the atom there + export it.
3. **Build panels** in `src/features/<page>/board/`, one file each, following the
   §3 skeleton + §4 rules. Wire real data; add the `<EmptyState>` branch.
4. **Assemble** the page shell (§5): `SectionShell .dashboard-canvas`, header,
   verdict/hero band, equal-height grid rows, lazy + gated `<Cell>`s, barrel
   `index.ts`. Rewrite the route component in place.
5. **Verify**: `npx tsc --noEmit` (0 errors) → `npx eslint <new files>` (clean)
   → `npm run build` (green) → run the smoke/screenshot script
   (`scripts/smoke-analytics-board.py` is the template; authed capture needs
   `E2E_EMAIL`/`E2E_PASSWORD`). **See it render** before calling it done.

---

## Worked example files

- Primitives: `src/components/board/{Bar,Pill,FlapTile,RadialProgress,AnimatedNumber,EmptyState}.tsx`
- Shared controls / portals: `src/components/ui/portal-container.tsx` + §2b
- Page shells:
  - `src/features/analytics/AnalyticsDashboard.tsx` + `…/analytics/board/*.tsx` (12-panel dashboard, lazy + gated)
  - `src/features/targets/TargetsPage.tsx` (dense calculator re-skin: verdict hero + Board panels, logic preserved verbatim — shows the "re-skin, don't rewrite" path)
- Original handoff: `docs/todo/design_handoff_analytics/`
- Smoke script: `scripts/smoke-analytics-board.py`

## Page redesign progress
- [x] Dashboard (pre-existing) · [x] Analytics · [x] Shared controls/portals · [x] Targets · [x] Policies
- [x] Recruiting (`/recruiting` — all 3 tier variants) · [x] Team (`/hierarchy` main dashboard)
- [x] Recruiting/Team leftovers: `PipelineAdminPage`, `AgentDetailPage`, `OrgChartPage`, `OverrideDashboard`, `DownlinePerformance`, `HierarchyManagement`
- [⊘] `MyRecruitingPipeline` — intentionally NOT re-skinned (recruit's own full-bleed `.theme-landing` portal, like `/command-center`)
- [x] Reports (`/reports`)
- [x] Metric pages: Leaderboard, Close KPIs, Expenses, Lead Intelligence (`/lead-vendors`)
- [ ] (remaining nav pages: Marketing, Messages, UW Wizard/Admin/Guides, Chat Bot, Voice Agent, Orchestrator, Business Tools, Close AI Builder, Lead Drop, Billing, Settings, Admin (+ auth-diagnostic/bot-health), Workflows, Comps, Contracting, Training Hub/My Training/Trainer, Agent Roadmap, The Standard Team, recruit/lead detail pages)

### Font sizing (2026-06-01)
Modest +1px readability bump, committed `28608fb6`. Chrome primitives — `Cap` 11→12, `FlapTile` label 11→12, `Pill` 12→12.5 (propagates to all Board pages). Data tables — `text-[10px]→[11px]` then `text-[9px]→[10px]` (safe order, no double-bump) on 16 PRIMARY data-table/list components only. Deliberately NOT swept: public recruit portal (`recruiting/layouts|editorial|public`), config dialogs, widget config forms. If more readability is wanted, extend the same two-step sed to more table components — never blanket-sweep all 162 `text-[9/10px]` files (hits public + dialogs).

Note: some pages are already partly Board (use `BoardListHeader`/`SoftCard`). Check
first — often the only gap is the `dashboard-canvas` `SectionShell` wrapper + a
verdict hero, not a full rebuild.
