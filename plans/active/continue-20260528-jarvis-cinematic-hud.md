# Continuation: Jarvis Command Center — Cinematic HUD overhaul

**Date:** 2026-05-28
**Branch / worktree:** `feat/assistant-command-center` in `/Users/nickneessen/projects/commissionTracker-jarvis` (NOT the main repo — Jarvis is not merged to main).
**State:** **NOT committed.**

---

## SESSION 2 UPDATE (2026-05-28, later) — v2 PREMIUM REBUILD + AUTHENTICATED VISUAL VERIFICATION DONE

v1 (below) was rejected by the user as "the most basic animation I've ever seen," "too chunky," and "cut off in a small square." Rebuilt the reactor + reorganized the whole stage. Verified live via Playwright login (`nickneessen@thestandardhq.com`) against the gated page.

**What changed this session:**
- **`components/hud/ReactorDial.tsx` (NEW)** — the centerpiece. A crisp, fine multi-ring **SVG** dial: outer tick scale, dotted ring, broken segmented arcs, mid scale, numbered markers, dashed ring, inner segments, inner ticks, core ring with quadrant diamonds, a radar sweep (fading fan), and bright pulsing "active" arcs. All layers rotate independently off ONE `framer-motion` `useAnimationFrame` clock with an eased per-mode speed (idle→thinking spins up). `overflow:visible` so nothing clips. Reduced-motion → static. This is what fixed "basic/chunky."
- **`components/hud/reactorScene.ts` (REWRITTEN)** — GLSL energy CORE only now (Ashima simplex displacement + fresnel rim + emissive veins), 2 tight fresnel bloom shells (was 3 big diffuse → that was the wash/"square"), fine particle dust. Removed the chunky tori + coil boxes (the dial owns ring structure). Mode-distinct via eased `turbulence`/`convergence`/`fresnel`/`speed` targets (thinking = energized spiky star + inward particle convergence).
- **`components/hud/usePointerTilt.ts` (NEW)** — window-level pointer → spring rotateX/rotateY for a holographic parallax tilt on the reactor container (own effect, reduced-motion-gated). Wired in `CommandCenterLayout` via `perspective` + `motion.div`.
- **`components/hud/BootSequence.tsx` (REWRITTEN)** — cinematic **"THE STANDARD"** wordmark (metallic cyan gradient + sweeping highlight + swoosh underline), reactor ignition flash, staggered boot log. Subtitle `{assistantName} · COMMAND CENTER`.
- **`components/hud/HudFrame.tsx` (TRIMMED)** — removed its old tick rings (dial owns them); now just grid + vignette + corner brackets + scanline.
- **`components/hud/HudPanel.tsx` (NEW)** + **`components/hud/SidePanels.tsx` (NEW)** — framed glass HUD panels docked in the margins with REAL data (no mock): live clock + signed-in operator + "all systems online" (Status), team leaderboard top-3 (`useTeamLeaderboard().entries`), Production MTD (totalAp/Policies/IP/Prospects/leads-scored), Recruiting (active/total/completed + byPhase bars). **Deleted `TelemetryRail.tsx`** (superseded).
- **`src/App.tsx`** — added `isCommandCenter = pathname === "/command-center"` early-return branch (mirrors `isRecruitPipeline`): renders `ImoProvider > ApprovalGuard > Outlet` with NO sidebar/app chrome, so Jarvis owns the viewport uniformly. Back-to-app chip lives in the `CommandCenterLayout` header (`Link to="/dashboard"`).
- **`components/CommandCenterLayout.tsx` (RESTRUCTURED)** — full-screen `h-screen` flex column; reactor stage (dial+core, pointer-tilt) fills the upper viewport; conversation docks to the bottom with a top fade mask (`AssistantPage` content block updated); top command bar with back chip + JARVIS + agent badge + VoiceOrb + settings; `SidePanels` in the margins.

**Verification (this session):** `npm run build` green (exit 0; three isolated in lazy `ArcReactor-*.js` 505KB chunk) · `npx eslint src/features/assistant src/App.tsx` clean · `npx vitest run src/features/assistant` 7/7 · authenticated Playwright screenshots: full desktop HUD, thinking mode, "THE STANDARD" boot, send→agent-routed→tool-chip→typewriter→settled (real-data reply), reduced-motion static, mobile compact — all with NO page errors.

**Known / out-of-scope:** orchestrator returns literal `**markdown**` (TranscriptPanel renders plain text — pre-existing); Production hero shows `$0` because `totals.totalAp` rolls up 0 while per-agent AP + totalIp are populated (backend quirk, surfaced truthfully). Pointer-tilt's actual motion not isolated in a screenshot (subtle ±5°; build/render-verified). Still NOT committed; user has not asked to commit.

---

## SESSION 1 (original handoff — v1, since superseded by the rebuild above)

**State (at the time):** All v1 work is written and BUILDS GREEN + unit tests pass, but is **NOT committed** (sits alongside prior in-progress voice work). Authenticated visual E2E was NOT done (gated page, no login creds).

---

## Why this exists / mission

`/command-center` is the embedded agentic "Jarvis" assistant. v1 of a visual overhaul turned the plain chatbot into an Iron-Man-style HUD. The user reviewed it and gave two pieces of direction for THIS next session:

1. **The animations are too basic/generic** — not up to the app's bar. Make them genuinely premium and distinctive (the user used the word "ridiculously awesome", Iron-Man-movie level). The current arc reactor is functional but reads as generic.
2. **The sidebar clashes** — when in command-center mode the whole aesthetic is different from the rest of the app, but the normal left sidebar still shows in its standard style. The user wants the sidebar to do **something different** in command-center mode (themed to match Jarvis, auto-collapsed, hidden/replaced, or transformed).
3. Also: **do a code review** of everything below and confirm it actually works (see Verification + Code-review checklist).

Audience stays GATED (`requireEmailIncludes="epiclife"` + super-admins) — do NOT change the route guard. Tech: **framer-motion + raw three.js** (see the hard constraint below). Sound: on, with a toggle, default on.

---

## HARD CONSTRAINT discovered this session (do not relearn the hard way)

**Do NOT use `@react-three/fiber` or `@react-three/drei`.** Installing fiber@9 broke the ENTIRE app's typecheck — every DOM element's props became `never` across dozens of unrelated files. Cause: fiber's `declare module 'react'/'react/jsx-runtime' { namespace JSX { interface IntrinsicElements extends ThreeElements } }` collapses `React.JSX.IntrinsicElements` under this repo's React 19 + @types/react 19 + `jsx: react-jsx`. Proven by stub experiment (stubbing the fiber imports made all app-wide errors vanish). fiber + drei were uninstalled. The reactor was rebuilt with **raw imperative three.js**. `three` alone is safe (no JSX augmentation). `framer-motion@12` is fine. Memory saved: `feedback_no_react_three_fiber.md`. If you want WebGL, keep using raw three.js (pattern in `reactorScene.ts` + `ArcReactor.tsx`).

---

## What was built this session (full inventory)

All paths under `src/features/assistant/` unless noted. Logic/data flow (`useSendAssistantMessage`, `useAssistantVoiceSession`, approvals) was REUSED untouched; only presentation changed (plus 2 additive tweaks + 1 migration).

### New dependencies (package.json)
- `framer-motion@^12.40.0`, `three@^0.184.0`, `@types/three@^0.184.1` (dev).
- (fiber + drei were installed then REMOVED — do not re-add.)

### New files
- `lib/agentTheme.ts` — 13 agent keys → `{ label, accent (hex), icon, tagline }` + `agentTheme()` + `DEFAULT_ACCENT` (#22d3ee). Drives HUD accent, banner, message theming.
- `lib/toolMeta.ts` — 8 tool names → `{ label, icon }` for the choreographed tool chips.
- `lib/useDocumentVisible.ts` — tab-visibility hook (pauses canvases when hidden).
- `hooks/useTypewriter.ts` — char-by-char reveal; `enabled`, `startDelayMs`; reduced-motion → instant.
- `hooks/useSound.ts` — **procedural** Web Audio cues (`boot/send/response/toolTick/approve/error`); one shared AudioContext lazily on first gesture; gated on `enabled`. No binary assets.
- `components/hud/reactorScene.ts` — imperative three.js scene builder: core icosahedron + 3 additive halos, 3 counter-rotating tori, 9 coil segments, 220-point particle ring. Returns `{ group, update(dt,t,mode,accent,audioLevel), dispose() }`. Eases speed/intensity/pulse toward per-mode targets; lerps color.
- `components/hud/ArcReactor.tsx` — owns the three.js renderer lifecycle (renderer created once per mount; rAF loop started/stopped separately on tab visibility so the WebGL context is NOT recreated on tab switch). Reduced-motion → `StaticReactor` CSS-glow fallback (no WebGL).
- `components/hud/ArcReactorLazy.tsx` — `React.lazy` boundary so the ~900KB three.js chunk only loads when the reactor mounts. **Consumers import the component from here; only `import type { ReactorMode }` may cross from `ArcReactor.tsx`** (so three doesn't leak into the main bundle).
- `components/hud/HudFrame.tsx` — SVG/CSS overlay: drifting grid, 2 counter-rotating tick rings (centered top-[38%]), corner brackets, scanline sweep. Reduced-motion → static.
- `components/hud/BootSequence.tsx` — framer-motion one-per-session power-up (`sessionStorage` key `jarvis-booted`); typed boot lines over the reactor; skipped under reduced motion.
- `components/hud/AgentBanner.tsx` — framer-motion "SPECIALIST ONLINE" flash on `agentKey` change (per-agent color/icon/tagline), auto-dismiss ~3.2s.
- `components/hud/TelemetryRail.tsx` — live KPI tiles via EXISTING hooks (no new polling): `useTeamLeaderboard({filters:{timePeriod:"mtd",scope:"team"}})` → AP + policies, `useLeadHeatScoreCount()`, `useRecruitingStats()`. Animated with `useCountUp`. Desktop-only.
- `components/VoiceImmersion.tsx` — full-screen takeover (framer-motion `AnimatePresence`) while a voice session is active: giant reactor + a **real audio-reactive waveform** `<canvas>` reading `voice.getFrequencyData()`; synthetic envelope while speaking/thinking; ESC / close / backdrop click → `voice.stop()`.

### Modified files
- `AssistantPage.tsx` — orchestrates everything: boot gate (sessionStorage + reduced-motion), `accent` from `agentTheme(agentKey)`, derived `reactorMode` (listening/thinking/responding/speaking/idle from `voice.state` + `send.isPending` + a 1.6s `justResponded` window), low-rate `audioLevel` sampling for the background reactor, and sound cues woven into `runMessage` (`send` on start, `response` on success, `error` on catch). Renders BootSequence → CommandCenterLayout → VoiceImmersion.
- `components/CommandCenterLayout.tsx` — dark-locked (`className="dark ... bg-[#050811]"`) HUD shell: HudFrame + background ArcReactor (absolute, centered top-[38%], `hidden lg:block`) + TelemetryRail (absolute right, lg only) + AgentBanner + restyled glass header + content column. New props: `accent`, `reactorMode`, `audioLevel`.
- `components/TranscriptPanel.tsx` — HUD message rows; typewriter on the LATEST assistant turn only (`startDelayMs = toolCount*260+150`); framer-motion staggered tool chips (each fires a `toolTick` cue via `onAnimationComplete`); agent-accent theming; "Scanning your data…" pending state. New props: `accent`, `play`.
- `components/CommandInput.tsx` — HUD command-line aesthetic (chevron prompt, glow focus ring, accent send button, animated quick-prompt pills). New prop: `accent`.
- `components/PendingActionsPanel.tsx` + `components/ActionApprovalModal.tsx` — threaded a new optional `onApproved?: ()=>void` so a successful send plays the `approve` cue.
- `components/AssistantSettingsSheet.tsx` — added a **Sound** toggle (writes `sound_enabled`).
- `hooks/useAssistantVoiceSession.ts` — ADDITIVE only: stores last mic RMS in `levelRef` and returns `getFrequencyData(out: Uint8Array): boolean` + `getLevel(): number`. VAD logic untouched.
- `hooks/useAssistantPreferences.ts` + `types/assistant.types.ts` — added `sound_enabled` (default true) to defaults, select list, return mapping, and the `AssistantPreferences` interface.
- `src/types/database.types.ts` — hand-patched `assistant_preferences` Row/Insert/Update with `sound_enabled` (surgical, to avoid full-regen leaking undeployed schema — see memory `Branch reorg + database.types.ts split lesson`).
- `VoiceOrb.tsx` shows as modified in git but that is from the PRIOR voice session, not this work.

### Migration (applied to BOTH DBs already)
- `supabase/migrations/20260528185626_assistant_sound_enabled.sql` — `ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true`. Applied LOCAL + REMOTE via `run-migration.sh` (confirmed `schema_migrations updated` for both). Idempotent.

---

## Reactor "modes" + choreography (current design — keep the data contract, upgrade the visuals)

On send: `send` cue → reactor `thinking` → "Scanning your data…" placeholder. On response: reactor `responding` → tool chips replay 1-at-a-time (~260ms, each ticks) → typewriter the text → AgentBanner if agent changed → approval modal if a draft. Modes: `idle | listening | thinking | responding | speaking`. The orchestrator returns ONE atomic JSON blob (no token streaming), so the *arrival* is choreographed client-side — keep that philosophy.

---

## Verification status

- ✅ `npm run build` GREEN (zero TS errors) — run in the worktree, NOT `validate-app.sh` (it hangs, per memory).
- ✅ ESLint clean (`npx eslint src/features/assistant` exit 0). NOTE: a code-review pass caught 4 `no-restricted-imports` violations in `TelemetryRail` (deep cross-feature imports) — FIXED by importing from barrels (`@/hooks/leaderboard`, `@/features/close-kpi`, `@/hooks/recruiting`, `@/features/landing`) and adding `useLeadHeatScoreCount` to `src/features/close-kpi/index.ts`. Run `quick-check` (tsc+eslint) before declaring done — tsc passing alone does NOT catch barrel violations.
- ✅ Dark-lock verified correct: tailwind `darkMode:["class"]` + app `defaultTheme="dark"` (next-themes), so the nested `.dark` wrapper in `CommandCenterLayout` reliably forces dark.
- ✅ Assistant unit tests pass (`npx vitest run src/features/assistant` → 7/7). `TranscriptPanel.test.tsx` was updated (forces reduced-motion via matchMedia mock; matches new copy/labels).
- ✅ three.js confirmed code-split into its own `ArcReactor-*.js` chunk; main bundle dropped ~900KB.
- ✅ Dev server boots clean (`npm run dev`, localhost:3000); `/command-center` correctly redirects to `/login` (guard intact); no page errors from this code.
- ⏳ **NOT DONE: authenticated visual render.** `/command-center` is gated; no login creds available to the agent. The user MUST eyeball it (or provide a test login so the next session can drive Playwright). `.env.local` in this worktree points at PROD — be careful.

---

## THE TWO NEW TASKS FOR THIS SESSION

### Task A — Make the animations genuinely premium (not generic)

The current reactor is a rotating-rings-and-particles look. Push it much further. Concrete directions to consider (pick what reads as high-end, get the user's eye on it):
- **Reactor**: volumetric/energy core (custom GLSL shader material with fresnel rim glow, animated noise/turbulence, pulsing emissive), layered depth, lens-flare/bloom-ish additive sprites, energy arcs/filaments, a subtle parallax/tilt that reacts to pointer. Smooth, weighty easing — not constant-speed spin. Distinct silhouettes per mode (e.g. thinking = tighter faster vortex with inward particle flow; speaking = concentric pulse rings emitted in time with the waveform).
- **Choreography**: richer entrance/exit on messages (blur-in, scale, accent sweep), a "data materializing" effect on tool chips, a typed reply with a glowing scan-cursor and a faint per-character flicker. Use framer-motion layout animations and spring physics, not linear fades.
- **Boot**: more cinematic (staggered HUD elements powering on in sequence, reactor ignition flash, frame draw-on).
- Respect `prefers-reduced-motion` throughout (static fallbacks already exist — keep them real).
- Keep perf sane: cap DPR, pause on hidden tab (already wired), lazy-load three (already wired). A custom shader is fine but profile it.
- For shader work in raw three.js: use `THREE.ShaderMaterial`/`RawShaderMaterial` in `reactorScene.ts`. Do NOT reach for fiber/drei postprocessing — implement additive bloom-ish glow with layered meshes or a cheap custom pass.

### Task B — Distinct sidebar treatment in command-center mode

The app already has a precedent for route-specific layouts. Use it:
- `src/App.tsx` line ~177 defines `isRecruitPipeline = location.pathname === "/recruiting/my-pipeline"` and renders a COMPLETELY different sidebar-less layout (`RecruitHeader` + `Outlet`). `useLocation()` and the `isSidebarCollapsed`/`setIsSidebarCollapsed` state already live in this component.
- `src/components/layout/AppShell.tsx` owns sidebar spacing (`md:ml-[244px]` / `md:ml-[96px]`).
- `src/components/layout/Sidebar.tsx` + `src/components/layout/sidebar/*` are the sidebar pieces.

Options to design/discuss with the user (recommend one, show it):
1. **Immersive (recommended to try first):** add `isCommandCenter = location.pathname === "/command-center"` and render a dedicated full-bleed layout (no standard sidebar) like the `isRecruitPipeline` branch, so Jarvis owns the whole viewport. Provide a minimal "back to app" affordance.
2. **Jarvis-themed sidebar:** keep the sidebar but pass a `variant="jarvis"` down so it goes dark/cyan, reactor-tinted, with glow — matching the command center instead of the v2 light theme.
3. **Auto-collapse + theme:** force-collapse the sidebar on entry to `/command-center` (set `isSidebarCollapsed`) and tint the collapsed rail to match.

Whichever: it must not break the other routes, must restore normal sidebar on leaving, and must keep keyboard/focus + mobile behavior sane.

### Task C — Code review (do this too)

Review the inventory above for correctness. Specific things to scrutinize:
- `ArcReactor.tsx` renderer lifecycle: created once per mount; rAF loop in a separate `[visible]` effect that does NOT recreate the WebGL context. Confirm no context leak on remount/route changes; confirm `dispose()` frees all geometries/materials (`reactorScene.ts` collects disposables).
- Dark-lock: `CommandCenterLayout` wraps in `className="dark"`. Confirm tailwind `darkMode` strategy makes a nested `.dark` subtree actually re-theme (the app uses `theme-v2 v2-canvas` at the top — verify the override actually wins and text is readable over the reactor glow behind the `backdrop-blur-md` transcript).
- `useSound`: AudioContext resume on first gesture; confirm no console errors; `boot` cue is silent on autoload (browser autoplay policy) — acceptable or move it.
- `useTypewriter` + reduced-motion: confirm `useReducedMotion()` (null initial) never makes the latest reply show fully then re-type, and historical messages render instantly.
- `TelemetryRail`: confirm the 3 hooks don't error for users without downlines (graceful zeros), and that none auto-poll (avoid `useLeadHeatDashboardStatus` — it polls).
- `VoiceImmersion`: confirm ESC/teardown stops the mic; waveform canvas cancels rAF on unmount/hidden.
- General: no `never`-type regressions app-wide (the fiber issue is gone, but re-verify after any new dep).

---

## How to run / verify
```
cd /Users/nickneessen/projects/commissionTracker-jarvis
npm run build            # authoritative; must be zero TS errors
npx vitest run src/features/assistant
npm run dev              # localhost:3000 — NOTE .env.local points at PROD
```
Then log in as an `epiclife`/super-admin account, open `/command-center`, and verify: boot sequence (once/session), send "Brief me on what needs my attention today" (cue → thinking reactor → tool chips ticking → typewriter → agent banner → telemetry populated), trigger a draft (approval modal + approve cue + real send), enable voice (immersion + reactive waveform, ESC exits), toggle Sound off (silent), OS reduced-motion (static reactor / instant text / no boot), resize < 1024px (clean compact fallback, no WebGL errors).

## Known follow-ups / risks
- Authenticated visual E2E still owed (above).
- Boot cue silent on autoload (autoplay policy).
- Reactor sits behind the transcript glass — verify readability vs. spectacle on tall viewports.
- Nothing is committed; the working tree mixes this work with prior voice work + a deleted `assistant-voice-token` function. Sort the commit story when ready (don't push non-main branches — Vercel deploys on any push).
- Don't run a full `supabase gen types` regen casually (leaks undeployed schema); keep hand-patching `database.types.ts` if more columns are added.
