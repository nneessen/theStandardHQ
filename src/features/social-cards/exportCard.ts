// src/features/social-cards/exportCard.ts
//
// The single, shared "render a mounted card node to a faithful Instagram-sized PNG"
// routine. Used by BOTH the in-app Download / Post path
// (SocialStudioPage.renderCardPng) AND the headless verification harness
// (scripts/social-studio-export-render) so the thing we test is byte-for-byte the
// thing we ship — the harness can never drift from the app.
//
// WI-1 belt: passing explicit width/height (= FORMAT_DIMS) pins the output canvas to
// the format's native size regardless of any ancestor transform on `node`. The
// primary fix is that callers point this at an UN-transformed full-size node (see
// SocialPreview's off-screen export copy); without that, modern-screenshot sized the
// canvas from the node's transform-affected bounding rect.
//
// WYSIWYG belt: the cards lay out with bespoke webfonts (Big Shoulders Display, Inter,
// Space Grotesk, Instrument Serif). `document.fonts.ready` only awaits fonts the browser
// has ALREADY decided to load — if the rasterizer captures before a font is applied, it
// renders a FALLBACK system font whose glyph widths differ, which shifts every line of
// text ("looks right in the app, alignment is off once posted"). So before capturing we
// FORCE-load the exact families + weights, then await fonts.ready, then let layout settle.
import { FORMAT_DIMS, type SocialFormat } from "./socialFormat";

// Family + weight combos the cards actually render (must cover every `font:` in the card
// components). document.fonts.load resolves once the (cached) font is ready; loading the
// same family twice is a no-op.
const CARD_FONTS = [
  '700 64px "Big Shoulders Display"',
  '800 64px "Big Shoulders Display"',
  '400 32px "Inter"',
  '500 32px "Inter"',
  '600 32px "Inter"',
  '700 32px "Inter"',
  '800 32px "Inter"',
  '500 32px "Space Grotesk"',
  '700 32px "Space Grotesk"',
  '400 48px "Instrument Serif"',
];

async function ensureCardFontsLoaded(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;
  // A missing/blocked family must never reject the export — swallow per-font failures.
  await Promise.all(
    CARD_FONTS.map((f) => fonts.load(f).catch(() => undefined)),
  );
}

// Two animation frames → the off-screen node is guaranteed laid out (with the now-loaded
// fonts) before modern-screenshot serializes it.
function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export async function renderCardToPng(
  node: HTMLElement,
  format: SocialFormat,
): Promise<string> {
  const { domToPng } = await import("modern-screenshot");
  // 1. Force the exact card webfonts to load (covers the freshly-mounted-node race).
  await ensureCardFontsLoaded();
  // 2. Await any still-in-flight font work.
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) await fonts.ready;
  // 3. Let the browser re-lay-out with the loaded fonts before serializing.
  await nextFrame();
  const { w, h } = FORMAT_DIMS[format];
  // scale:1 → native pixels; explicit width/height keep the canvas exactly the format
  // dimensions even if the node ever ends up under a transform again.
  return domToPng(node, { scale: 1, width: w, height: h });
}
