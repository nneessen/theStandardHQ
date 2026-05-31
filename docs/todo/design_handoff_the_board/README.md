# Handoff: "The Board" — Dashboard Redesign (The Standard HQ)

## Overview
A reimagined main dashboard for The Standard HQ — an insurance/IMO production command
center. It replaces the generic dark-SaaS dashboard with a **"departure board" command
deck**: a lit nav rail, an animated **Jarvis** AI assistant (WebGL energy orb), a hero
"Premium Written" number, KPI panels, alerts reframed as flight-status "FLAGS", a quick
actions bar, and a live org ticker. Gamified spine (rank, season, premium-to-target).

## About the Design Files
The bundled files are a **working React prototype** (not a static mock). They were built
with the same primitives your app already uses — **React 18 + JSX** — plus **Three.js**
for the Jarvis orb. Treat them as the source of truth for layout, tokens, copy, and
behavior, and **re-implement them as components in your existing codebase** (TanStack
Router / React), wiring real data and routes in place of the mock data. You can lift most
JSX/style logic almost verbatim; the main work is (1) splitting the single file into your
component structure, (2) swapping the mock `window.DASH` object for your real data hooks,
and (3) wiring the actions/nav to your routes.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate
pixel-faithfully. Exact tokens are listed below and in `directions/TheBoard.jsx` (the `T`
object at the top).

## Tech / Dependencies
- **React 18** (already in your app).
- **three** (`npm i three`) — used only by the Jarvis orb (`directions/jarvisOrbs.js`).
  ~150KB gzipped; if you want to avoid it, the orb can fall back to a CSS/canvas version,
  but the WebGL "Twin Shells" core is the approved look.
- **Google Fonts**: `Archivo` (display/numbers), `Hanken Grotesk` (body), `Space Mono`
  (labels/eyebrows). Load via your existing font pipeline.
- No other runtime deps. The prototype loads React/Three via CDN; in your app use your
  bundler imports.

## Layout (1380 × 920 reference frame)
Two columns: a fixed **296px left rail** + a fluid **main column**.
- The prototype scales the whole 1380×920 frame to fit the viewport. **In your app, drop
  the scaler** — let the rail be a normal fixed/sticky sidebar and the main column flow
  responsively. The 1380×920 is just the design reference size.

### Left Rail (296px, top→bottom)
1. **Brand row** — "THE STANDARD" (Archivo 800/16) + amber "● HQ" (Space Mono 700/10).
2. **Jarvis dock** — rounded panel, cyan-tinted gradient bg, 1px cyan border, soft glow.
   Contains the animated **Jarvis orb** (58px) + "JARVIS" (Archivo 800/17) + "AI" pill +
   "Ask anything · ⌘J" (cyan, 12px). Whole panel is the launcher (opens Jarvis).
3. **Nav** — grouped (MAIN / BUSINESS / GROWTH / CONNECT / TOOLS). Group headers:
   Space Mono 700/12, color `--mut`, letter-spacing .16em, a hairline to the right.
   Items: 28px tall rows, 13.5px Archivo uppercase, line icon (17px) + label. Active row:
   `rgba(91,155,255,.10)` bg + 1px inset blue ring + "● NOW" tag, blue icon/text.
   **No leading numbers** (removed by request).
4. **Operator profile** (pinned bottom) — panel with "NN" monogram + name + "GATE FFG ·
   OWN IMO" + a 3-up mini stat row (PREMIUM / RANK / LVL) + a thin premium progress bar
   ("$2K of $34K · 1 day left"). **RANK value uses the split-flap treatment; the others
   are plain.**

### Main Column (top→bottom)
1. **Topbar** — "MAY 2026" (Archivo 800/40) + "30/31" (amber). Right: period segmented
   control (DAY/WK/MTD/MO/YR), MTD selected (blue). **No "+ Policy" button** (it lives in
   Quick Actions).
2. **Hero row** (grid 1.6fr / 1fr):
   - **Premium Written** panel — eyebrow + amber "● LIVE" + huge **$2,040** (Archivo
     800/60, light-blue `#82bcff`, soft glow) + progress bar (5% of $34K) + caption.
   - **Season Rank** panel — "SEASON RANK" + **#01 in split-flap tiles** + "THE STANDARD"
     + green "↑ Holding the lead" chip.
3. **Quick Actions** bar (one rounded panel, flush cells):
   - Left 36%: **Jarvis launcher** — animated orb (58px) + "JARVIS" + "AI" + "Ask
     anything, run any task" + "⌘J" key.
   - Right: 5 evenly-split action cells (icon-only, **no boxed tiles**): **Add Policy**
     (primary, blue glowing icon), **Add Recruit**, **Send Email**, **Log Expense**,
     **Discord** (with an amber "SOON" badge — placeholder, not yet wired).
4. **Stat row** (3 panels): COMMISSIONS $945 (8%), POLICIES 01 (6%), PIPELINE $0.
5. **FLAGS · Departure Status** panel — alerts reframed as a flight board. Each row: a
   glowing status dot + title + sub + a right-aligned status word: warn→**DELAYED**
   (amber), crit→**HALTED** (red), info→**BOARDING** (blue).
6. **Org ticker** (pinned bottom) — blue "◈ ORG" tab + a marquee-style row of
   org/override values (Ann. Premium, Commissions, Unearned, Overrides, Uplines,
   Downlines, Avg/Agent, Clients), amber dot separators.

## The Jarvis Orb
- File: `directions/jarvisOrbs.js`, export `window.JarvisOrb.twin(el)` → mounts a Three.js
  scene into `el` and returns `{ stop }` (call on unmount).
- "Twin Shells": two counter-rotating displaced icosahedron **point clouds** (cyan
  `#35d6f5` outer, white-cyan `#c8f6ff` inner), additive blending, transparent canvas (no
  solid disc, no hard ring — it glows and fades). Wrap it in a div sized to taste plus a
  soft radial-gradient halo behind it.
- In React: a small wrapper component mounts it in `useEffect` and calls `stop()` on
  cleanup (see `JarvisOrbView` in `TheBoard.jsx`). Two instances render fine (rail +
  quick actions).
- The lab file (not bundled) explored 6 variants; **"Twin Shells" is the chosen one.**

## Interactions & Behavior
- **Jarvis launchers** (rail + quick actions): click/`⌘J` should open a Jarvis command
  panel (NOT YET BUILT — currently visual). This is the intended next step.
- **Quick action cells**: click → respective flow (open policy form, recruit invite,
  compose email, expense entry). **Discord** = placeholder (`SOON`).
- **Nav items**: route navigation; active state styled as above.
- **Period control**: switches the dashboard's time window (Day/Week/MTD/Month/Year).
- No load-in flip animation (a split-flap entrance was tried and removed for reliability).

## State / Data
All content is driven by a mock object `window.DASH` (`directions/data.js`). Replace each
field with your real data (query hooks). Key fields: `kpis` (premium/commissions/policies/
pipeline + pct of target), `alerts` (sev: warn|crit|info), `financial`/`policyHealth`/
`clients` stat rows, `imo`/`overrides`/`production` org rollups, `nav` groups, user.
The hero number, rank, season, streak/level are gamification framing on top of real
production data.

## Design Tokens (from the `T` object in `TheBoard.jsx`)
- **Surfaces**: bg `#120f08`, panel `#19140b`→`#1d1810` (gradient), tile `#221b10`.
- **Lines**: `rgba(236,226,205,0.10)` / `.18`.
- **Text**: ink `#f1e9d6`, mut `rgba(236,226,205,0.55)`, mut2 `rgba(236,226,205,0.36)`,
  tileText (cream) `#ece2cd`.
- **Accents**: blue `#5b9bff` (primary/lit), Jarvis cyan `#46d8f5`/`#35d6f5`,
  amber `#f4b43a` (live/warn), red `#ff6a5d` (crit), green `#5fd08a` (good).
- **Type**: display `Archivo` (700/800), body `Hanken Grotesk`, mono `Space Mono`.
  Numbers = Archivo bold, `font-variant-numeric: tabular-nums`.
- **Radius**: panels 12, pills 999, small 6–8. **Brushed texture**: faint 1px vertical
  repeating-linear-gradient over `bg` (see `brushed`).
- **Split-flap** (RANK only): char tiles, dark bg, seam line across the middle, inset
  shadow — see the `Flap`/`SplitFlap` components.

## Assets
- No raster assets. Icons are inline stroke SVGs in `directions/icons.jsx` (Lucide-style;
  swap for your icon library if you have one). Fonts via Google Fonts.

## Files in this bundle
- `The Standard HQ — The Board.html` — entry/prototype (React+Three via CDN, scaler).
- `directions/TheBoard.jsx` — the entire dashboard (Rail, Topbar, Hero, QuickActions,
  StatRow, Flags, Ticker, Jarvis wrappers, tokens). **Primary reference.**
- `directions/jarvisOrbs.js` — Jarvis WebGL orb (`twin` + 5 other variants).
- `directions/icons.jsx` — inline SVG icon set.
- `directions/data.js` — mock data shape to replace with real data.

## Suggested implementation order
1. Add fonts + `three`. 2. Port tokens to your theme. 3. Build the Rail (nav from your
route config). 4. Build the main panels with real data hooks. 5. Drop in the
`JarvisOrbView` wrapper around `JarvisOrb.twin`. 6. Wire quick actions to flows. 7. Build
the Jarvis command panel (`⌘J`).
