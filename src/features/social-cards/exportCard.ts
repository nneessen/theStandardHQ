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
// canvas from the node's transform-affected bounding rect — and because the preview
// scales the card down to fit the pane, that rect was ~448×560, so the export
// captured only the top-left fraction of the 1080×1350 card ("one eighth / too big /
// not fitting" once posted to Instagram).
import { FORMAT_DIMS, type SocialFormat } from "./socialFormat";

export async function renderCardToPng(
  node: HTMLElement,
  format: SocialFormat,
): Promise<string> {
  const { domToPng } = await import("modern-screenshot");
  // A runtime font swap can race the capture — wait for webfonts before rasterizing.
  if (document.fonts?.ready) await document.fonts.ready;
  const { w, h } = FORMAT_DIMS[format];
  // scale:1 → native pixels; explicit width/height keep the canvas exactly the format
  // dimensions even if the node ever ends up under a transform again.
  return domToPng(node, { scale: 1, width: w, height: h });
}
