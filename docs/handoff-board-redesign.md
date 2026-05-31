# Handoff: "The Board" redesign — Phase 1 complete, Phase 2 plan

**Status:** Phase 1 (foundation + shell + dashboard) DONE and build-green, **uncommitted on `main`**. Phase 2 (per-archetype page sweep) NOT started. Authenticated surfaces not yet visually verified (no dev JWT in-session).
**Date:** 2026-05-31
**Source design:** `docs/todo/design_handoff_the_board/` + 3 canonical HTMLs in `~/Downloads/` ("Color System", "Jarvis Orb Lab", "The Board"). Original approved plan: `~/.claude/plans/need-to-completely-streamed-rose.md`. Memory: `project_board_redesign.md`.

---

## What this is
Apply the "departure-board command deck" design language across the **authenticated** app. Warm, dense, data-first: riveted "Board" panels, Archivo/Hanken Grotesk/Space Mono type, split-flap RANK tiles, a lit nav rail, an org ticker, and a Twin-Shells WebGL Jarvis orb. The public marketing family (landing, auth, `/join`, `/register`, legal) is **out of scope** and must stay on its original design.

## TWO HARD RULES (do not violate — both came from user corrections)
1. **The board theme is SCOPED to `.theme-v2`, never global.** All board tokens live in ONE block `.theme-v2, .theme-v2.dark, .dark .theme-v2 { … }` in `src/index.css`. `:root` and `.dark` are the ORIGINAL slate+indigo palettes (public pages depend on them). Never repoint `:root`/`.dark`/`body`/global fonts/`forcedTheme` for the board. Authenticated shell wrapper carries a scoped `dark` class (`src/App.tsx:234`). Public pages (`/login`, `/`) must keep `body` background `#0a0f1c` and their existing look.
2. **Surfaces are NEUTRAL CHARCOAL, NOT brown.** Ramp: bg `#0d0d0e`, panel `#161617`, panel2 `#1b1b1c`, tile `#222224`. The Color System file's warm `#120f08`/`#19140b` read brown at scale — rejected. Text stays warm cream (`#f1e9d6`/`#ece2cd`); accents: blue `#5b9bff` (primary), cyan `#46d8f5` (Jarvis ONLY), amber `#f4b43a`, red `#ff6a5d`, green `#5fd08a`. Mirrored in `src/components/board/tokens.ts` (`T`).

## Phase 1 — DONE
- **Tokens/theme** (`src/index.css`): board palette scoped to `.theme-v2` block; `:root`/`.dark` reverted to original; brushed-texture + panel-gradient + riveted-shadow utils. `tailwind.config.js`: `board-*` color namespace, `bg-brushed`/`bg-panel-gradient`, `shadow-board-panel`. `index.html` loads original + board fonts. `src/index.tsx` ThemeProvider reverted to `defaultTheme="dark" enableSystem`.
- **Board component library** (`src/components/board/*`): `Board` (riveted panel), `Cap`, `Num`, `SplitFlap`/`Flap` (RANK only), `StatusDot`, `Ticker`, `BoardPageHeader`, `tokens.ts`. Jarvis: `jarvis/twinShells.ts` (Twin Shells point-shells + shimmer shader core) → `JarvisOrbCanvas` (lazy three.js) → `JarvisOrbView` (halo + reduced-motion fallback). `three` is a SEPARATE lazy chunk (~497KB), not the main entry.
- **App shell** (`src/components/layout/`): `Sidebar` → lit rail; `SidebarNavItem` active = blue-tinted lit track + "● NOW"; `SidebarNavSection` group headers = Space-Mono `.16em` + hairline; new `SidebarJarvisDock` (orb + `⌘J` → `/command-center`); `SidebarFooter` ThemeToggle removed. `SoftCard` (`src/components/v2/`) promoted to board panel.
- **Dashboard** (`src/features/dashboard/DashboardHome.tsx`): rebuilt to `BoardPageHeader` + `BoardHero` + `QuickActions` + `BoardStatRow` + `BoardFlags` + `Ticker`, wired to the EXISTING real hooks (`useMetricsWithDateRange`, `useChargebackSummary`, `useMyRank` [new, real leaderboard rank], `useImoQueries`, `useRecruitingStats`, `useCalculatedTargets`, `useDashboardFeatures`). DetailsTable / Org / Team sections kept below. Board sub-components in `src/features/dashboard/components/board/`.
- **Verified:** `npm run build` green (tsc -b + vite); `npx tsc --noEmit` 0 errors; eslint 0 on changed files; `three` lazy-chunked; public `/login` + `/` render original slate, zero console errors (`scripts/smoke-board-redesign.py`).
- **NOT verified:** authenticated `/dashboard` + rail render (no JWT). User to confirm visually.

## Phase 2 — TODO: per-archetype page sweep (~48 in-app pages)
Foundation propagates the board look via tokens + `SoftCard`/`Card`, BUT **~142 feature `.tsx` files hard-code `bg-white`/`text-black`/etc. (+7 with `bg-zinc-900`-style utilities)** — now on the dark canvas, unpolished. Track with `npm run audit:zinc:count` and `rg -l -g '*.tsx' '(bg-white|text-white|bg-black|text-black)\b' src/features | wc -l`.

**Method — one archetype at a time** (validate one representative, then propagate):
1. **Sweep hardcoded colors → tokens** in the archetype's files: `bg-white`→`bg-card`, `text-zinc-900`/`text-black`→`text-foreground`/`text-v2-ink`, `border-zinc-200`→`border-border`/`border-v2-ring`, status colors → `text-success`/`warning`/`error`. Add/keep `dark:` variants only where a light surface is intentional.
2. **Apply board chrome** where it fits: `BoardPageHeader` for page titles + period/segment controls; wrap list/section containers in `Board`/`SoftCard` panels; `Cap` eyebrows; `Num` for figures; `SplitFlap` for featured rank only.
3. **Verify** the representative renders with zero console errors (authed Playwright or manual) before propagating.

**Archetype order (by blast radius):**
- **Data-table lists (~10):** Policies, Expenses, Overrides, Downlines, Hierarchy Manage, Leaderboard, Contracting, Lead Vendors, TeamProgressPanel, TeamOverviewPage. (Consider a shared table-header reskin: Space-Mono uppercase `TableHead`.)
- **Tabbed hubs (~11):** Messages, ChatBot, VoiceAgent, CloseAiBuilder, MarketingHub, AdminControlCenter, MyTraining, TrainingHub, ChannelOrchestration, BusinessTools, CloseKpi, RecruitingDashboard.
- **Detail views (4):** AgentDetail, RecruitDetail, LeadDetail, PresentationDetail.
- **Wizards (5):** Underwriting, VoiceClone, LeadDrop, PresentationRecord, CampaignEditor.
- **Dashboards/analytics:** Analytics, TrainerDashboard, CloseKpi, Hierarchy.
- **Settings (left-nav + pane), Billing, Editors (Module/Template/Roadmap), Forms (Targets).**
- **Bespoke (light touch — tokens + panels only):** OrgChart canvas, Roadmap 3-pane editor.

**Excluded (do NOT reskin):** `/command-center` (own reactor HUD), public marketing family, and the recruit-facing `/recruiting/my-pipeline` + auth screens unless the user opts them in.

## Verification (typecheck is NOT verification)
- `npm run build` → 0 errors; `npm run lint` clean; confirm no mock imports in `src/**`.
- Run the app and LOOK (authed): per-archetype representative renders board palette, zero console errors, no leftover light surfaces. `scripts/smoke-board-redesign.py [BASE_URL]` checks public-page isolation + boot; extend it with an authed session for the board surfaces.
- Re-run `npm run audit:zinc:count` after each archetype to watch the number fall.

## Handoff notes
- All Phase 1 work is **uncommitted on `main`**. Don't push non-main branches (Vercel preview). Commit/push only when the user asks.
- Reuse, don't rebuild: `useCountUp` (`features/landing/hooks`), framer-motion (installed), `lucide-react` icons, the `ArcReactor` mount pattern (already mirrored by the orb).
