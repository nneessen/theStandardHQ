# Handoff: Analytics Page Redesign — "The Standard HQ"

## Overview
This is a full redesign of the **Analytics** page (the `/analytics` route — the trending-up icon in the
left rail) for The Standard HQ. It re-skins the existing page into the **"Board" (split-flap departure-board)**
visual language already used on the Dashboard redesign, and restructures it from a flat 3×4 grid of
equal-weight cards into a **"verdict-first"** hierarchy: lead with *"am I on pace?"*, then *"what do I do
about it?"*, then the supporting detail.

The redesign keeps **all the same information/panels** that exist today (Pace, Policy Status, Carriers,
Product Mix, Premium by State, Client Segments, Game Plan, Commission Pipeline, Predictive Analytics,
Trend Comparison, Agent Performance, Conversion Funnel) — it reorganizes and re-skins them, makes
everything **bigger and more legible**, adds **animated counters, a radial goal ring, gradient charts,
and sparklines**, and replaces broken-looking "No data" text with intentional states.

---

## About the Design Files
The files in this bundle are **design references built in plain HTML/CSS/JS** — prototypes that show the
intended look, layout, type, color, and motion. **They are not production code to paste in.** Your job is
to **recreate these designs inside the existing app** using its real environment:

- **React + TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** components
- **Recharts** for charts (you already pasted three Recharts components from 21st.dev — those are the
  intended chart implementations; see "Charts" below for exactly how each maps)
- **Framer Motion** (optional) for the count-up / draw-on animations, or a tiny `requestAnimationFrame`
  helper (the prototype uses the latter — see "Animations")

Use your established component patterns (`/components/ui/*`), your `cn()` util, your theme tokens, etc.
The HTML prototype hard-codes everything inline for fidelity; in the real app, build proper React
components and wire them to live data.

## Fidelity
**High-fidelity (hi-fi).** Colors, typography, spacing, radii, shadows, and interactions are final and
exact. Recreate the UI pixel-faithfully using the values in this document. The only thing that is *not*
real is the **data** — the prototype uses tagged **PREVIEW · SAMPLE DATA** so the charts and counters are
judgeable. Wire every number to your real API (mapping table in "Data Model" below).

---

## Tech / Libraries
| Concern | Use |
|---|---|
| Framework | React + TypeScript (existing) |
| Styling | Tailwind v4 + CSS variables (tokens below) |
| Components | shadcn/ui (`Card`, `Badge`, `Select`, `DropdownMenu`, `Table`, `Carousel`…) |
| Charts | Recharts (the `line-charts-5`, `line-charts-1`, `line-charts-8` components you provided) |
| Icons | `lucide-react` (the prototype uses inline SVGs that match Lucide 1:1) |
| Fonts | **Archivo** (display/numbers), **Hanken Grotesk** (body), **Space Mono** (labels/eyebrows) |
| Animation | Framer Motion *or* a small rAF count-up hook (see "Animations") |

Fonts (Google Fonts):
```
Archivo: 400,500,600,700,800,900
Hanken Grotesk: 400,500,600,700,800
Space Mono: 400,700
```

---

## Design Tokens
Add these to your Tailwind v4 theme / `:root`. (Full source also in `Color System.md`.)

```css
:root{
  /* surfaces */
  --bg:#120f08;        /* app canvas (warm near-black) */
  --panel:#19140b;     /* card gradient bottom */
  --panel2:#1d1810;    /* card gradient top */
  --tile:#221b10;      /* inset "flap" tiles, chips */
  /* lines */
  --line:rgba(236,226,205,0.10);
  --line2:rgba(236,226,205,0.18);
  /* text */
  --ink:#f1e9d6;       /* primary text/headings */
  --cream:#ece2cd;     /* numbers/values */
  --mut:rgba(236,226,205,0.55);   /* secondary */
  --mut2:rgba(236,226,205,0.36);  /* eyebrow/tertiary */
  /* semantic accents — ONE accent per surface */
  --blue:#5b9bff;      /* primary, selection, projected */
  --cyan:#46d8f5;      /* Jarvis/AI ONLY */
  --amber:#f4b43a;     /* live / warning / "behind" */
  --red:#ff6a5d;       /* critical / deficit */
  --green:#5fd08a;     /* positive / growth / active */
}
```
**Accent rule:** one accent per surface. Blue = primary/selection. Amber/Red/Green = status only (never
decorative). Cyan is reserved for Jarvis. For tinted chips use the accent at ~12–16% alpha with the solid
accent for text (e.g. bg `rgba(91,155,255,0.14)`, text `#5b9bff`).

### Spacing / radius / shadow
| Token | Value |
|---|---|
| Page padding | `40px 48px 64px` |
| Grid gap | `24px` |
| Panel padding | `26px 28px` |
| Radius — panel | `14px` |
| Radius — tile | `9px` · chips/pills `999px` |
| Panel border | `1px solid var(--line2)` |
| Panel background | `linear-gradient(180deg, var(--panel2), var(--panel))` |
| Panel shadow | `inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.45)` |
| Body bg texture | `repeating-linear-gradient(90deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)` over `--bg` |

### Typography scale (exact)
| Role | Font / weight / size | Notes |
|---|---|---|
| Page title ("ANALYTICS") | Archivo 800, 60px, line-height .95, uppercase | letter-spacing -.01em |
| Eyebrow / labels | Space Mono 700, 13px, uppercase | letter-spacing .22em (panel titles .20em) |
| Panel title (`.p-title`) | Space Mono 700, 13px, uppercase, color `--mut2` | letter-spacing .20em |
| Panel subtitle (`.p-sub`) | Hanken 600, 18px, color `--ink` (dim variant `--mut` 500) |
| Hero number (`.num-xl`) | Archivo 800, 58–60px, color `--cream`; "lit" variant `#dfe9ff` + `text-shadow:0 0 22px rgba(91,155,255,.35)` | tabular-nums |
| Large number (`.num-lg`) | Archivo 800, 38–40px | tabular-nums |
| Flap tile value | Archivo 800, 26px (sm: 21px) | tabular-nums |
| Body / meta | Hanken 500, 15px, color `--mut` |
| Table header | Space Mono 700, 11.5px, uppercase, `--mut2` | letter-spacing .14em |
| Table cell | Hanken 600, 15.5px, `--ink`, tabular-nums |

All numbers use `font-variant-numeric: tabular-nums`.

---

## Global Structure

```
<body> warm-black + brushed texture
 └─ .shell (flex)
     ├─ .rail   (left, 84px, sticky, full height)  ── icon-only nav (see "Rail")
     └─ .content (flex:1, padding 40/48/64, max-width 1820px)
         ├─ Header           (eyebrow + ANALYTICS + subtitle | date-range segmented + Export)
         ├─ Hero verdict band (full width)
         ├─ Row: [Trend chart | Growth chart]              (2-col, equal height)
         ├─ Row: [Action feed (1) | Agent table (2-wide)]  (3-col)
         ├─ Row: [Funnel | Client Segments | Pipeline]     (3-col)
         ├─ Row: [Trend Comparison sparklines (2-wide) | stack(Product Mix + Premium by State)]
         └─ Footer note
```

### CRITICAL layout rule — equal-height rows
Within every row, all panels **stretch to equal height** (CSS grid `align-items: stretch`, each panel
`height:100%`). This is what makes the page look orderly instead of ragged. Panels are intentionally
**paired by natural height**: the two charts go together; the short Action Feed is paired with the tall
Agent table (and the Action Feed is *padded out* with the What-If Scenarios table so it fills the row).
Keep this pairing.

### Grid
- `.g2` → `grid-template-columns: repeat(2,1fr); gap:24px; align-items:stretch`
- `.g3` → `grid-template-columns: repeat(3,1fr); gap:24px; align-items:stretch`
- "2-wide" cell → `grid-column: span 2`
- `.stack` (Product Mix + Premium by State in one cell) → `display:grid; gap:24px; align-content:start`

### Responsive
Designed for desktop (16" MacBook Pro, ~1680px usable). Below ~1100px, collapse `.g3`/`.g2` to 1 column
and let the hero band wrap (radial ring on top, stats below). Sidebar stays icon-only.

---

## The Reusable Primitives (build these first)

**Panel** — the riveted card. A `<div>` with the panel gradient/border/shadow above, plus **4 corner
"rivets"**: 5px circles at 9px inset from each corner,
`background: radial-gradient(circle at 35% 30%, #4a4031, #110d06); box-shadow: 0 1px 1px rgba(0,0,0,.6)`.
```
PanelHeader: left = <p-title> eyebrow + <p-sub> subtitle; right (optional) = big number + small label
```

**Flap tile** — inset "split-flap" stat tile. `background: var(--tile)`, radius 9px, padding 16/18,
`box-shadow: inset 0 1px 0 rgba(255,255,255,.05), inset 0 -3px 6px rgba(0,0,0,.4)`, and a **horizontal seam
line** at 50%: a 1px line `rgba(0,0,0,.5)` with `box-shadow: 0 1px 0 rgba(255,255,255,.04)`. Contains a
mono uppercase key (11px, `--mut2`) + Archivo value (26/21px). Value color variants: red/green/blue/amber.

**Pill** — status chip. Mono 700 12px uppercase, padding 7/13, radius 999px, tinted bg + solid accent
text, optional 7px glowing dot. Variants: red / amber / green / blue.

**Bar** — progress bar. Track `rgba(0,0,0,.45)` inset shadow; fill = accent with `box-shadow: 0 0 10px
<accent>`. Variants blue/amber/green/red.

**Radial progress ring** — see "Animations".

---

## Screens / Panels (exact specs)

> Copy/content below is the exact sample text. Replace numbers with live data per the Data Model.

### Header
- Eyebrow: bar-chart icon + `PERFORMANCE` + a **blue pill** `● PREVIEW · SAMPLE DATA` (remove the pill in
  production — it only marks sample data).
- Title: `ANALYTICS` (Archivo 800, 60px, uppercase).
- Subtitle: "Performance metrics and insights across your book."
- Right side: segmented control `MTD · YTD · 30D · 60D · 90D · 12M` (selected = blue tint, see Pill/seg
  styling) + an **Export** ghost button (shadcn `Button variant="outline"`), and optionally a CSV/PDF
  split as today.

### Hero Verdict Band (full width)
A panel with a **blue spotlight** background:
`radial-gradient(130% 180% at 0% 0%, rgba(91,155,255,0.12), rgba(91,155,255,0.01))` layered over the panel
gradient, border `rgba(91,155,255,0.28)`. Three-part flex row (wraps on narrow):
1. **Radial ring** (208px, 18px thick, blue) — center shows `58%` (count-up) + "OF MONTHLY GOAL".
2. **Verdict** — eyebrow `DEPARTURE STATUS · JUNE 2026`; then a huge **lit** number = projected AP
   (`$32,700`, count-up) + amber pill `● PROJECTED · 96%`; label "Projected AP at current pace"; then a
   sentence: *"Behind the board's pace — **$1,267 short** (red) of the **$34K** target at close. **12 days**
   left to make it up."*
3. **Stats** — 2×2 flap tiles: **MTD Written** `$19,640` · **Monthly Goal** `$34,000` · **Gap to Goal**
   `$14,360` (red) · **Need / Day** `$1,197` (blue).

### Trend Chart Panel — "Policy Status · 12-Month Trend"
- Header right: big `312` + "active".
- Three flap tiles: **Active** `312` (green key) · **Lapsed** `18` (amber key) · **Cancelled** `6` (red key).
- **Chart** = your **`line-charts-5`** component (dual-series gradient area/line). Two series:
  - `Active` — green `#5fd08a`, **gradient area fill** (stop 0%: color @0.32 → 100%: @0.02), smooth line.
  - `Lapsed` — amber `#f4b43a`, **dashed** line, no fill.
  - X labels: Jul…Jun (12 months, show every 2nd + last). Dashed horizontal gridlines `rgba(236,226,205,.08)`.
  - Tooltip: dark `#1b150c` card, border `--line2`, mono values.
- Legend: ● Active policies / ● Lapsed.
- Sample data: Active `[248,256,262,270,268,278,284,290,296,300,306,312]`,
  Lapsed `[9,11,8,13,10,14,12,15,11,16,13,18]`.

### Growth Chart Panel — "Predictive Analytics"
- Header right: green `↗ 12.4%` + "projected growth".
- Two flap tiles: **Next 3 Mo · Renewals** `41` · **Est. Renewal Revenue** `$9,360` (green).
- **Chart** = your **`line-charts-1`** component (line + gradient area + reference line). One series:
  - `Projected AP` — blue `#5b9bff`, gradient area fill, smooth.
  - **Per-point confidence dots**: months 1–4 green, 5–8 amber, 9–12 red (drop-shadow glow on each dot).
  - **Reference line** (dashed, blue) at `y = $34K` = the goal.
  - Y axis formatted `$NN K`. X labels Jul…Jun.
- Legend: ● High / ● Medium / ● Low confidence / — $34K goal.
- Footnote (mut, 13px): *"**Note:** Renewal revenue is an **estimate** based on 25% of first-year
  commission rates. Actual renewal rates vary by carrier and product."*
- Sample data (in $K): `[19.6,21.2,22.8,24.1,25.6,27.0,28.7,30.1,31.8,33.4,35.0,36.7]`.

### Action Feed Panel — "Smart Moves · Flags"
- Header right: amber count `04`.
- List rows (glowing dot + bold title + muted detail + right status pill). Pill text: `Act Now` (red) for
  High priority, `Monitor` (amber) for Medium. Sample rows:
  1. **Push for close** — "7 applications approved & awaiting first payment" — red · Act Now
  2. **Reactivate 18 lapsed** — "$14.7K AP at risk this cycle" — red · Act Now
  3. **Lean into Term Life** — "42% of mix, best close rate at 31%" — amber · Monitor
  4. **Recruit pipeline thin** — "Only 3 prospects in onboarding" — amber · Monitor
- Then a divider + **What-If Scenarios** table (Scenario / Projected / Goal %):
  - Keep current pace — `$32,700` — 96% (amber)
  - Add 1 policy/week — `$37,360` — 110% (green)
  - Add 2 policies/week — `$42,020` — 124% (green)

### Agent Performance Panel (2-wide)
- Header right: big "Hayes Crockett" + "top performer". Subtitle "84 agents · top 10 shown".
- **Table** (shadcn `Table`): columns `# · Agent · Policies · AP · IP`, right-aligned numeric columns with
  `padding-left:18px` between columns so values don't touch. Rank in Archivo 800 `--mut2`; agent name in
  Archivo 700 16px `--ink`. 10 rows (see Data Model `agents`).
- Footer: 3 flap tiles — **Total Policies** `27` · **Total AP** `$19,640` · **Total IP** `$49,504` (green).

### Conversion Funnel Panel
- Four labeled bars with count-up values + proportional widths:
  Leads Purchased `480` (blue, 100%) · Applications `212` (amber, 44%) · Approved `156` (amber, 32%) ·
  Active `132` (green, 27%).
- Footer: 2 flap tiles — **Lead → Active** `27.5%` (green) · **Avg Close Time** `9.4d`.

### Client Segments Panel
- Header right: big `$214,800` + "total AP".
- **Table** cols `Tier · Clients · Total AP · Avg AP · Mix %`. Tier label colored (HIGH green / MED amber /
  LOW red), Mix % colored to match. Rows:
  - HIGH · 38 · $128.9K · $3,392 · 60.0%
  - MED · 96 · $64.4K · $671 · 30.0%
  - LOW · 178 · $21.5K · $121 · 10.0%

### Commission Pipeline Panel
- "Total Pending" `$18,240` (num-lg, count-up). "Quarterly projection · $22,300".
- Divider, then rows (clock icon + label + green value): Next 30 days `$7,400` · 60 `$6,100` · 90 `$4,740`.
- Footer note (green): "Healthy pipeline · 82% of quarterly target booked".

### Product Mix Panel
- "9 products in book". Rows: label + % + bar (width = %), accent per row:
  Term Life 42% (blue) · Whole Life 23% (cyan) · IUL 16% (green) · Final Expense 12% (amber) · Annuity 7% (red).

### Premium by State Panel
- Header right: big `$214,800` + "total premium". Rows: state (Archivo 700) + `$K` value + bar:
  TX $58.0K · FL $41.2K · GA $28.6K · NC $22.4K · OH $18.1K · AZ $14.9K.

### Trend Comparison Panel (2-wide) — sparkline cards
- Header right: green `↗ +21%` + "AP change".
- A 2-column grid of **sparkline cards** = your **`line-charts-8`** mini-chart pattern. Each card: label +
  delta badge (green ▲ / red ▼) on top; big value + a small sparkline (smooth line, end dot with glow,
  faint gradient). Six cards:
  - Policies Written `58` ▲41% · AP Written `$19.6K` ▲21% · Commissions `$5.3K` ▲29% ·
    Avg Premium `$818` ▲3% · Active Policies `312` ▲5% · Pipeline `$18.2K` ▲14%

### Footer
Centered mono note: "Real-time calculations · Auto-refresh on data changes". (Drop the "sample data shown
for preview" suffix in production.)

### Rail (left nav) — re-skin only
Icon-only, 84px wide, sticky full height, gradient bg + right border `--line2`. Top: hamburger (boxed) +
**Jarvis avatar** (54px circle, cyan ring + glow). Then icon buttons (50px hit targets, 13px radius). The
**Analytics** icon (trending-up) is **active**: blue text, `bg rgba(91,155,255,.12)`, `inset 0 0 0 1px
rgba(91,155,255,.4)` + blue glow. A divider before the tools group; logout at the bottom in red. Use your
existing nav/route structure — just apply these styles.

---

## Charts — mapping to your Recharts components
You provided three components. Use them as-is, themed to the tokens:

| Prototype chart | Your component | Key config |
|---|---|---|
| 12-Month Trend (Active vs Lapsed) | **`line-charts-5`** (ComposedChart, dual series, gradient) | series colors green/amber; Lapsed dashed; gradient area on Active; dashed gridlines; dark tooltip |
| Growth Projection | **`line-charts-1`** (line + area + ReferenceLine) | blue line + gradient; **ReferenceLine y=34000** (the $34K goal); per-point dot color by confidence (green/amber/red) |
| Trend Comparison cards | **`line-charts-8`** (mini sparkline cards) | one series each, smooth `monotone`, active end dot w/ glow |

Theme every chart with the token colors (not Tailwind defaults): grid `rgba(236,226,205,0.08)`, axis text
`rgba(236,226,205,0.4)` Space Mono 11px, tooltip bg `#1b150c` border `--line2`. Set
`ResponsiveContainer` so charts fill panel width; fixed height ~250px (300px when featured).

---

## Animations
The prototype animates on load. Recreate with Framer Motion or a small hook.

**Count-up** — numbers animate 0 → target over ~1.1s, ease-out-cubic, comma-formatted, optional
prefix (`$`) / suffix (`%`,`d`) / decimals. (Provide a `useCountUp(target, {prefix,suffix,decimals})` hook
or `<AnimatedNumber/>`.) Trigger when the element enters the viewport (IntersectionObserver / Framer
`whileInView`).

**Radial ring** — SVG, two concentric circles. Track = `rgba(0,0,0,.45)`; value circle = blue with
`stroke-linecap:round`, `filter: drop-shadow(0 0 7px <color>)`, rotated -90°, animate `stroke-dashoffset`
from full circumference to `C*(1 - pct/100)` over ~1.3s ease-out. Center text count-up.

**Chart draw-on** — line `stroke-dasharray = pathLength`, animate `stroke-dashoffset → 0` over ~1.1s; area
fades opacity 0→1. (Recharts has `isAnimationActive` + `animationDuration` — use those instead of manual.)

Respect `prefers-reduced-motion` (snap to final values).

---

## Data Model (map sample → real)
The prototype's sample object (`analytics-data.js → window.DATA`). Replace each with your API field:

| Field | Sample | Meaning |
|---|---|---|
| `monthGoal` / `mtd` / `pctMonth` | 34000 / 19640 / 58 | monthly AP goal, written MTD, % of goal |
| `projected` / `pctProjected` / `gap` / `needDay` / `projDeficit` | 32700 / 96 / 14360 / 1197 / 1267 | pace projection |
| `daysElapsed` / `daysTotal` / `daysLeft` | 18 / 30 / 12 | month progress |
| `annualGoal` / `ytd` / `pctAnnual` | 408000 / 214800 / 53 | annual pacing |
| `active` / `lapsed` / `cancelled` / `policiesMTD` / `avgAP` | 312 / 18 / 6 / 24 / 818 | policy status |
| `carriers` / `products` / `bookPremium` | 7 / 9 / 214800 | book composition |
| `pendingComm` / `comm30/60/90` / `quarterly` | 18240 / 7400 / 6100 / 4740 / 22300 | commission pipeline |
| `growth` / `renewals3mo` / `renewalRev` | 12.4 / 41 / 9360 | predictive |
| `leads` / `applications` / `approved` / `activeF` / `leadToActive` / `avgClose` | 480 / 212 / 156 / 132 / 27.5 / 9.4 | funnel |
| `agents[]` | `[name, policies, AP, IP]` ×10 | leaderboard |
| `segments[]` | `[tier, clients, totalAP, avgAP, mix%, color]` | client tiers |
| `states[]` | `[state, premium, share%]` | geo |
| `productMix[]` | `[name, pct, color]` | product split |
| `smartMoves[]` | `[title, detail, priority, color]` | action feed |
| `scenarios[]` | `[label, projected, pct, color]` | what-if |
| Trend/Growth/Spark series | numeric arrays | chart data |

**Derived/threshold logic to keep:** pace verdict color (ahead = green, behind = amber/red), per-point
confidence coloring (near = green, mid = amber, far = red), pill priority mapping (High→red "Act Now",
Medium→amber "Monitor"), pipeline health note (% of quarterly booked).

## Empty / early state (important — your real account is mostly $0 today)
Don't render charts/counters as flat zeros (looks broken). For panels with no data yet, show an
**intentional empty state**: a dashed-ring icon + a title ("No carrier data yet") + one line of guidance
("Carrier mix appears once policies are written this period"). The hero band should still show the goal and
"0% of goal · push to get started" rather than a dead ring. The first HTML prototype
(`The Standard HQ - Analytics.html` earlier version is in the repo) demonstrated honest zero-states — match
that tone for empty panels, and switch to the populated design once data exists.

---

## Files in this bundle
| File | What it is |
|---|---|
| `The Standard HQ - Analytics.html` | **The final design (Option A — verdict-first).** Primary reference. |
| `The Standard HQ - Analytics Options.html` | A/B/C comparison (A verdict-first, B bento, C carousel). Use the A/B/C switcher in the top bar to see the alternatives — Option C shows the carousel pattern if you want it later. |
| `analytics-charts.js` | Reference chart/counter engine (radial, area/line, sparkline, carousel, count-up). Recreate equivalents with Recharts + a count-up hook. |
| `analytics-data.js` | The sample `DATA` object + chart configs. Mirror this shape, fed by your API. |
| `analytics-panels.js` | Every panel as an HTML builder — the source of truth for markup, copy, and structure of each panel. |
| `Color System.md` | Full palette + type + token reference. |

## Suggested build order for Claude Code
1. Add tokens + fonts to the Tailwind theme.
2. Build primitives: `Panel` (with rivets), `FlapTile`, `Pill`, `Bar`, `AnimatedNumber`/`useCountUp`,
   `RadialProgress`.
3. Theme the three Recharts components (`line-charts-5/1/8`) to the tokens.
4. Build each panel component (props = data) per the specs above.
5. Assemble the page with the row layout + **equal-height rows** rule.
6. Wire to real data; add the empty/early states.
7. Re-skin the existing rail; mark Analytics active.

**Recreate the design — do not ship the HTML.** When in doubt about a measurement, color, or copy string,
the matching builder in `analytics-panels.js` is authoritative.
