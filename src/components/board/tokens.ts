// "The Board" departure-board design tokens.
// Ported from the design handoff `T` object (docs/todo/design_handoff_the_board).
//
// THEME-REACTIVE: each color is a `var(--*, <dark-fallback>)` reference to the CSS
// custom properties defined in src/index.css under `.theme-v2` (light) and
// `.dark .theme-v2` (dark). Because `var()` resolves in React inline `style={{}}`
// against the nearest `.theme-v2` ancestor (the App shell), every board component
// that reads `T.x` flips with the theme automatically — no call-site changes.
// The fallback equals the original dark literal, so board components rendered
// OUTSIDE any `.theme-v2` ancestor (e.g. the Command Center) keep their dark look.
//
// EXCEPTION: `var()` does NOT resolve in SVG presentation ATTRIBUTES
// (`<rect fill={T.blue}>`), canvas, or react-pdf. Charts that push T into SVG
// attributes use `useChartColors()` (theme-resolved literals) instead — see
// src/components/board/useChartColors.ts.

// Surface / Substrate Elevation ramp. Eight levels; a component renders ONE level
// above whatever it sits on: page→s1, controls→s2, cards→s3, card-hover/raised→s4,
// popover→s5, menu-on-popover→s6, dialog→s7, menu-in-dialog→s8.
const surface = {
  surface1: "var(--surface-1, #171717)", // page / app canvas
  surface2: "var(--surface-2, #1e1e1e)", // controls: search, chips, inputs
  surface3: "var(--surface-3, #252525)", // cards / panels
  surface4: "var(--surface-4, #2c2c2c)", // card hover / raised tile-on-card
  surface5: "var(--surface-5, #333333)", // popover
  surface6: "var(--surface-6, #3a3a3a)", // menu on a popover
  surface7: "var(--surface-7, #414141)", // dialog content
  surface8: "var(--surface-8, #484848)", // menu inside a dialog
} as const;

export const T = {
  // Surface elevation ramp — exposed for components that need an explicit level.
  ...surface,
  // Semantic surface aliases mapped to the ramp BY ROLE (not by raw ordering).
  bg: surface.surface1, // #171717 — page canvas
  panel: surface.surface3, // #252525 — card / panel
  panel2: surface.surface4, // #2c2c2c — raised-on-card
  tile: surface.surface4, // #2c2c2c — raised tile-on-card
  tileText: "var(--cream, #fbfbfc)",
  tileEdge: "var(--tile-edge, rgba(0,0,0,0.55))",
  litBg: "var(--lit-bg, #1a2740)",
  litText: "var(--lit-text, #cfe0ff)",
  // Lines (hairlines). Dark: white@opacity; light: slate@opacity (via the CSS var).
  line: "var(--line, rgba(255,255,255,0.08))",
  line2: "var(--line2, rgba(255,255,255,0.14))",
  // Text.
  ink: "var(--ink, #f3f3f4)",
  cream: "var(--cream, #fbfbfc)",
  // Two-tier muted text. Dark: white 0.62/0.42; light: solid slate #475569/#5b6677
  // (resolved through --mut/--mut2). Kept in lockstep with index.css.
  mut: "var(--mut, rgba(255,255,255,0.62))",
  mut2: "var(--mut2, rgba(255,255,255,0.42))",
  // Accents — semantic. Blue = primary, cyan = Jarvis ONLY, amber/red/green = status,
  // violet = available decorative accent.
  blue: "var(--blue, #5b9bff)",
  blueLit: "var(--blue2, #82bcff)",
  cyan: "var(--cyan, #46d8f5)",
  cyan2: "var(--cyan2, #35d6f5)",
  amber: "var(--amber, #f4b43a)",
  red: "var(--red, #ff6a5d)",
  green: "var(--green, #5fd08a)",
  violet: "var(--violet, #b69bff)",
  // Type — NOT colors; keep literal.
  disp: '"Archivo", system-ui, sans-serif',
  mono: '"Space Mono", monospace',
  data: '"Hanken Grotesk", system-ui, sans-serif',
  // Chrome — gradient / shadow / brushed texture all flip via their CSS vars.
  panelGradient: "var(--panelgrad, linear-gradient(180deg, #2c2c2c, #252525))",
  panelShadow:
    "var(--panelshadow, inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.45))",
  brushed:
    "var(--board-brushed, repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px))",
} as const;

export type BoardTokens = typeof T;
