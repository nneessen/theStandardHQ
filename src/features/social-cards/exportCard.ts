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

// EMBED belt (THE WI-2 fix): the cards' webfonts (Big Shoulders Display, Inter, Space
// Grotesk, Instrument Serif) load via a CROSS-ORIGIN <link> to fonts.googleapis.com.
// modern-screenshot rasterizes into an SVG <foreignObject>, and to render a webfont
// there it must EMBED the @font-face into that SVG — but its auto-embed reads
// document.styleSheets, and a cross-origin sheet throws on .cssRules, so the googleapis
// @font-face rules are silently skipped. The browser still SHOWS the font (so the live
// preview is correct), but the exported PNG falls back to a WIDE system font. Because
// the hero-name sizing (heroNamePx) is deterministic and calibrated for the CONDENSED
// Big Shoulders metrics, the fallback overflows `white-space:nowrap; overflow:hidden`
// and the name CLIPS — "looks right in the app, mangled once posted."
//
// FIX: fetch the exact Google Fonts CSS ourselves (same-origin to us is irrelevant —
// fetch() works cross-origin and gstatic sends CORS headers), inline every woff2 it
// references as a data: URL, and hand the result to modern-screenshot via `font.cssText`
// ("if specified, ONLY this CSS is embedded"). Now the real condensed fonts travel
// INSIDE the screenshot SVG, so the PNG matches the preview byte-for-byte. Computed once
// and cached for the session (the woff2 are already in the browser cache from the <link>).
const CARD_FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@400;500;600;700&display=swap";

let cardFontEmbedCssPromise: Promise<string> | null = null;

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  // A non-2xx must REJECT: otherwise res.blob() is the error-page body and we'd base64
  // an HTML/JSON error INTO a font src — a corrupt @font-face the SVG silently drops,
  // which is worse than leaving the URL untouched. The caller's per-URL catch handles it.
  if (!res.ok) throw new Error(`font fetch ${res.status} for ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

// Build a SELF-CONTAINED @font-face CSS (every woff2 inlined as a data: URL). THROWS on a
// total failure so the caller falls back to modern-screenshot's DEFAULT embedding rather
// than pass partial/garbage CSS — critical because `font.cssText` is exclusive ("ONLY this
// CSS is embedded"), so a non-empty-but-broken string would REPLACE the default and make
// every font fall back (worse than not setting the option at all).
async function buildCardFontEmbedCss(): Promise<string> {
  if (typeof fetch !== "function" || typeof FileReader === "undefined")
    return "";
  // Ask Google for the woff2 form (the default for a modern UA) so the inlined glyphs are
  // the same the browser rendered. A non-2xx (quota/CORS/outage) MUST throw — a 4xx/5xx
  // body is not CSS, and returning it would defeat the whole fix.
  const res = await fetch(CARD_FONT_CSS_URL);
  if (!res.ok) throw new Error(`Google Fonts CSS ${res.status}`);
  let css = await res.text();
  // Capture gstatic URLs in both bare and quoted url() forms (Google emits bare today —
  // don't be brittle if that ever changes, or we'd silently inline nothing).
  const fontUrls = [
    ...new Set(
      [
        ...css.matchAll(
          /url\((['"]?)(https:\/\/fonts\.gstatic\.com\/[^)'"]+)\1\)/g,
        ),
      ].map((m) => m[2]),
    ),
  ];
  // No inlinable URLs → the cssText would carry unresolved REMOTE urls an SVG foreignObject
  // can't fetch at rasterize time. Throw so we fall back to the default embed, not pass it.
  if (fontUrls.length === 0) throw new Error("no embeddable gstatic font URLs");
  // Inline each woff2 as a data: URL so nothing is fetched at rasterize time. A single
  // failed weight keeps its remote URL (only that weight may fall back) rather than failing
  // the whole export — the other weights still embed.
  const pairs = await Promise.all(
    fontUrls.map(async (u) => {
      try {
        return [u, await fetchAsDataUrl(u)] as const;
      } catch {
        return [u, u] as const;
      }
    }),
  );
  for (const [u, dataUrl] of pairs) css = css.split(u).join(dataUrl);
  return css;
}

function cardFontEmbedCss(): Promise<string> {
  if (!cardFontEmbedCssPromise) {
    // Cache the SUCCESSFUL embed for the session. A failure is NOT cached: clear the
    // promise so the NEXT export retries instead of being stuck on fallback fonts for the
    // whole session after one transient network blip.
    cardFontEmbedCssPromise = buildCardFontEmbedCss().catch(() => {
      cardFontEmbedCssPromise = null;
      return "";
    });
  }
  return cardFontEmbedCssPromise;
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
  // 3. Build the self-contained @font-face CSS (woff2 inlined) so the condensed fonts
  //    are embedded in the export SVG (see EMBED belt above). Runs in parallel-safe,
  //    cached form; "" on failure → keep modern-screenshot's default embedding.
  const fontCss = await cardFontEmbedCss();
  // 4. Let the browser re-lay-out with the loaded fonts before serializing.
  await nextFrame();
  const { w, h } = FORMAT_DIMS[format];
  // scale:1 → native pixels; explicit width/height keep the canvas exactly the format
  // dimensions even if the node ever ends up under a transform again. `font.cssText`
  // forces OUR inlined fonts into the rasterized SVG (the WYSIWYG-on-Instagram fix).
  return domToPng(node, {
    scale: 1,
    width: w,
    height: h,
    ...(fontCss ? { font: { cssText: fontCss } } : {}),
  });
}
