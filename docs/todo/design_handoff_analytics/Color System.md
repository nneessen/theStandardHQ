# The Standard HQ — Color System

The palette behind the dashboard redesign, organized for reuse across the whole product.
Warm near-black surfaces, cream text, and a tight set of semantic accents — electric blue
as the primary, cyan reserved for Jarvis/AI, and amber / red / green for status.

**Usage rule of thumb:** one accent per surface. Blue carries primary actions and
selection; cyan belongs to Jarvis only; amber/red/green are status-only (never
decorative). Keep saturated color to small areas against the warm-black field.

---

## Surfaces

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#120F08` | App canvas / deepest layer |
| `--panel` | `#19140B` | Cards & panels (top of gradient) |
| `--panel2` | `#1D1810` | Panel gradient base / raised |
| `--tile` | `#221B10` | Insets, chips, number tiles |

## Lines & Strokes

| Token | Value | Usage |
|---|---|---|
| `--line` | `rgba(236,226,205,0.10)` | Hairline dividers, card borders |
| `--line2` | `rgba(236,226,205,0.18)` | Stronger borders, separators |

## Text

| Token | Value | Usage |
|---|---|---|
| `--ink` | `#F1E9D6` | Primary text & headings |
| `--cream` | `#ECE2CD` | Numbers / values on dark |
| `--mut` | `rgba(236,226,205,0.55)` | Secondary text, labels |
| `--mut2` | `rgba(236,226,205,0.36)` | Tertiary / eyebrow text |

## Accents — Semantic

| Token | Hex | Meaning | Usage |
|---|---|---|---|
| `--blue` | `#5B9BFF` | Primary | Primary actions, selection, links |
| `--cyan` | `#46D8F5` | Jarvis / AI | AI / Jarvis only |
| `--amber` | `#F4B43A` | Live / Warning | Live indicators, warnings, "delayed" |
| `--red` | `#FF6A5D` | Critical | Errors, critical alerts, "halted" |
| `--green` | `#5FD08A` | Positive | Growth, healthy, "up" |

**Accent tint convention:** for soft backgrounds/chips, use the accent at ~12–16% alpha
(e.g. `rgba(91,155,255,0.14)`) with the solid accent for text/icon.

---

## Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display / Numbers | **Archivo** | 800 | `font-variant-numeric: tabular-nums` |
| Heading | **Archivo** | 700–800 | — |
| Body | **Hanken Grotesk** | 400–600 | — |
| Label / Eyebrow | **Space Mono** | 700 | uppercase, letter-spacing `.16em` |

---

## Other tokens

| Token | Value |
|---|---|
| Radius — panel | `12px` |
| Radius — small | `6–8px` |
| Radius — pill | `999px` |
| Brushed texture | `repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px)` over `--bg` |

---

## CSS variables (drop into `:root`)

```css
:root {
  /* surfaces */
  --bg:#120f08; --panel:#19140b; --panel2:#1d1810; --tile:#221b10;
  /* lines */
  --line:rgba(236,226,205,0.10); --line2:rgba(236,226,205,0.18);
  /* text */
  --ink:#f1e9d6; --cream:#ece2cd; --mut:rgba(236,226,205,0.55); --mut2:rgba(236,226,205,0.36);
  /* accents */
  --blue:#5b9bff;   /* primary / selection */
  --cyan:#46d8f5;   /* Jarvis / AI only */
  --amber:#f4b43a;  /* live / warning */
  --red:#ff6a5d;    /* critical */
  --green:#5fd08a;  /* positive / up */
  /* type */
  --font-display:"Archivo",system-ui,sans-serif;
  --font-body:"Hanken Grotesk",system-ui,sans-serif;
  --font-mono:"Space Mono",monospace;
}
```

## Tailwind theme (optional)

```js
// tailwind.config.js → theme.extend.colors
colors: {
  bg:'#120f08', panel:'#19140b', panel2:'#1d1810', tile:'#221b10',
  ink:'#f1e9d6', cream:'#ece2cd',
  blue:'#5b9bff', cyan:'#46d8f5', amber:'#f4b43a', red:'#ff6a5d', green:'#5fd08a',
}
```

---

## Libraries / dependencies to install

| Library | Install | Why | Required? |
|---|---|---|---|
| **React 18** | (already in your app) | The UI components are React/JSX | Yes — you have it |
| **three** | `npm i three` | Powers the Jarvis "Twin Shells" energy orb (WebGL) | Only if you use the animated orb |
| **Archivo / Hanken Grotesk / Space Mono** | Google Fonts | Display+numbers / body / labels | Yes (or self-host the same families) |

That's the whole list — **the only runtime package to add is `three`** (≈150 KB gzipped),
and only for the Jarvis orb. Everything else is plain React + CSS variables + inline SVG
icons.

**Fonts — two ways to load:**

```html
<!-- 1. Google Fonts <link> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
```

```bash
# 2. Self-host via Fontsource (recommended for apps)
npm i @fontsource/archivo @fontsource/hanken-grotesk @fontsource/space-mono
```

**Not required:** no UI kit, CSS framework, animation library, or icon package is needed.
Tailwind is optional (mapping above). Icons are inline stroke SVGs you can keep or swap
for your existing icon set.
