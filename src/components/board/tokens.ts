// "The Board" departure-board design tokens.
// Ported verbatim from the design handoff `T` object (docs/todo/design_handoff_the_board)
// and the canonical Color System file. These values mirror the CSS variables in
// src/index.css (--bg, --panel, --blue, …); they are duplicated here as literals so the
// bespoke board components can lift the handoff's inline-style logic faithfully.

export const T = {
  // Surfaces — NEUTRAL CHARCOAL (no warm/brown cast). Text + accents stay warm.
  bg: "#0d0d0e",
  panel: "#161617",
  panel2: "#1b1b1c",
  tile: "#222224",
  tileText: "#ece2cd",
  tileEdge: "rgba(0,0,0,0.55)",
  litBg: "#1a2740",
  litText: "#cfe0ff",
  // Lines
  line: "rgba(236,226,205,0.10)",
  line2: "rgba(236,226,205,0.18)",
  // Text
  ink: "#f1e9d6",
  cream: "#ece2cd",
  mut: "rgba(236,226,205,0.55)",
  mut2: "rgba(236,226,205,0.36)",
  // Accents — semantic. Blue = primary, cyan = Jarvis ONLY, amber/red/green = status.
  blue: "#5b9bff",
  blueLit: "#82bcff",
  cyan: "#46d8f5",
  cyan2: "#35d6f5",
  amber: "#f4b43a",
  red: "#ff6a5d",
  green: "#5fd08a",
  // Type
  disp: '"Archivo", system-ui, sans-serif',
  mono: '"Space Mono", monospace',
  data: '"Hanken Grotesk", system-ui, sans-serif',
  // Chrome
  panelGradient: "linear-gradient(180deg, #1b1b1c, #161617)",
  panelShadow:
    "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.45)",
  brushed:
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px)",
} as const;

export type BoardTokens = typeof T;
