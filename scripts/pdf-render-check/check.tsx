// Regression guard for the Sales Script "Download PDF" feature.
//
// Renders the REAL ScriptPdfDocument through @react-pdf — exactly as the
// download handler does — for a LARGE, synthetic, multi-page (12-phase) script.
// This is the case that broke in production: a `fixed` footer with a dynamic
// `render` callback made @react-pdf throw "unsupported number: …e+21" on any
// document spanning 3+ pages, so the button silently failed. Small scripts
// (and the local demo seed) fit on 1–2 pages and never tripped it, which is why
// scripts/smoke/smoke-call-scripts.py alone didn't catch it.
//
// No DB / auth / network needed — pure synthetic data. Run via run.mjs.
import { pdf } from "@react-pdf/renderer";
import { ScriptPdfDocument } from "@/features/call-reviews/components/scripts/ScriptPdfDocument";
import type { GeneratedScript } from "@/features/call-reviews/types";

const out = document.getElementById("out")!;
function report(r: unknown) {
  (window as unknown as { __PDF_RESULT__: unknown }).__PDF_RESULT__ = r;
  out.textContent = "RESULT: " + JSON.stringify(r);
  // eslint-disable-next-line no-console
  console.log("__PDF_RESULT__", r);
}

// 12 phases × rich steps ⇒ ~4+ pages, well past the 3-page failure threshold.
const PHASES = 12;
const script: GeneratedScript = {
  call_type: "Regression Script",
  summary:
    "A deliberately long synthetic master script used only to verify the PDF " +
    "renderer survives a multi-page document. ".repeat(8),
  key_principles: Array.from(
    { length: 6 },
    (_, i) => `Principle ${i + 1}: keep the conversation service-first — ${"detail ".repeat(12)}`,
  ),
  placeholders_used: ["[CLIENT_NAME]", "[CARRIER]", "[STATE]", "[AMOUNT]"],
  phases: Array.from({ length: PHASES }, (_, p) => ({
    title: `Phase ${p + 1} — extended discovery and handling`,
    goal: "Establish rapport and surface the real need. ".repeat(4),
    tonality: "Warm, calm, consultative",
    est_minutes: 3,
    call_pct: Math.round(100 / PHASES),
    steps: Array.from({ length: 4 }, (_, s) => ({
      kind: (["say", "ask", "do", "transition"] as const)[s % 4],
      say: `Say this to the caller in phase ${p + 1}, step ${s + 1}. ${"Spoken line ".repeat(20)}`,
      do: `Do this concrete action. ${"Action detail ".repeat(8)}`,
      delivery_note: "Smile; slow down on the numbers. ".repeat(3),
      tonality: "Reassuring",
      pause_cue: "Pause two beats and let them answer.",
      why_it_works: "It lowers resistance and builds trust. ".repeat(4),
      word_track_ids: [],
      objections: [
        {
          objection: "I'm not interested — I just want to cancel.",
          type: "stall",
          rebuttal: "Totally understand. Before anything, let me confirm a detail. ".repeat(3),
          tonality: "Calm",
        },
      ],
    })),
  })),
} as unknown as GeneratedScript;

(async () => {
  try {
    const blob = await pdf(
      <ScriptPdfDocument
        callTypeName="Regression Script — Multi-Page"
        script={script}
        wordTrackMap={new Map()}
        generatedAt={new Date(0).toISOString()}
        sourceCallCount={9}
      />,
    ).toBlob();
    report({ ok: true, size: blob.size, phases: PHASES });
  } catch (e) {
    report({ ok: false, phases: PHASES, err: (e as Error)?.message });
  }
})();
