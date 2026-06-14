// "The Board" departure-board design tokens.
// Ported verbatim from the design handoff `T` object (docs/todo/design_handoff_the_board)
// and the canonical Color System file. These values mirror the CSS variables in
// src/index.css (--bg, --panel, --blue, …); they are duplicated here as literals so the
// bespoke board components can lift the handoff's inline-style logic faithfully.

// Surface / Substrate Elevation ramp (Jun 14 2026 — "The Standard HQ" handoff).
// Eight levels, lightest-on-top. A component renders ONE level above whatever it
// sits on: page→s1, controls→s2, cards→s3, card-hover/raised→s4, popover→s5,
// menu-on-popover→s6, dialog→s7, menu-in-dialog→s8. Exact hex — do not "improve".
const surface = {
  surface1: "#171717", // page / app canvas
  surface2: "#1e1e1e", // controls: search, chips, inputs
  surface3: "#252525", // cards / panels
  surface4: "#2c2c2c", // card hover / raised tile-on-card
  surface5: "#333333", // popover
  surface6: "#3a3a3a", // menu on a popover
  surface7: "#414141", // dialog content
  surface8: "#484848", // menu inside a dialog
} as const;

export const T = {
  // Surface elevation ramp — exposed for components that need an explicit level.
  ...surface,
  // Semantic surface aliases mapped to the ramp BY ROLE (not by raw ordering).
  bg: surface.surface1, // #171717 — page canvas
  panel: surface.surface3, // #252525 — card / panel
  panel2: surface.surface4, // #2c2c2c — raised-on-card
  tile: surface.surface4, // #2c2c2c — raised tile-on-card
  tileText: "#fbfbfc",
  tileEdge: "rgba(0,0,0,0.55)",
  litBg: "#1a2740",
  litText: "#cfe0ff",
  // Lines (hairlines) — spec verbatim.
  line: "rgba(255,255,255,0.08)",
  line2: "rgba(255,255,255,0.14)",
  // Text — spec verbatim.
  ink: "#f3f3f4",
  cream: "#fbfbfc",
  // Two-tier muted text — spec verbatim (mut 0.62 / mut2 0.42), tuned against the
  // lighter #252525 cards. Kept in lockstep with --v2-ink-muted/--v2-ink-subtle +
  // --mut/--mut2 in index.css. (Verify labels read clearly on #252525; lift only if dim.)
  mut: "rgba(255,255,255,0.62)",
  mut2: "rgba(255,255,255,0.42)",
  // Accents — semantic. Blue = primary, cyan = Jarvis ONLY, amber/red/green = status,
  // violet = available decorative accent.
  blue: "#5b9bff",
  blueLit: "#82bcff",
  cyan: "#46d8f5",
  cyan2: "#35d6f5",
  amber: "#f4b43a",
  red: "#ff6a5d",
  green: "#5fd08a",
  violet: "#b69bff",
  // Type
  disp: '"Archivo", system-ui, sans-serif',
  mono: '"Space Mono", monospace',
  data: '"Hanken Grotesk", system-ui, sans-serif',
  // Chrome — panel gradient lifts s4→s3 (raised edge → card body).
  panelGradient: "linear-gradient(180deg, #2c2c2c, #252525)",
  panelShadow:
    "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.45)",
  brushed:
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px)",
} as const;

export type BoardTokens = typeof T;
