// Agent-of-the-Week graphic as a Creatomate `source` (full scene description) — the
// SINGLE source of truth for the design, imported by BOTH the edge function
// (generate-social-image, Deno) AND the verification harness
// (scripts/creatomate/verify-edge-source.mjs, Node) so what renders offline IS the
// edge fn's code — no hand-port to drift.
//
// This is a faithful recreation of the app's approved AURORA design
// (src/features/social-cards/AgentOfWeekCard.tsx): brand gradient
// (#5b6bff→#8b5cf6→#ff6a8d), soft light blobs, an arch-cropped portrait with a
// white ring + drop shadow, glassmorphism pill + stat panel, Unbounded display +
// Space Grotesk supporting type. Rendered server-side because the in-app PNG
// download (foreignObject rasterizer) cannot capture its backdrop-filter glass.
//
// Pure JS (no Deno/Node APIs, no types) so it imports cleanly into either runtime.
//
// Creatomate schema gotchas baked in (learned via render errors / pixel checks):
//  • 1080×1350 (Instagram 4:5), flat root layout so the arch math stays exact.
//  • GRADIENTS: a CSS "linear-gradient(...)" string on fill_color is ACCEPTED but
//    paints nothing → use a stops ARRAY ([{offset,color},…]) + gradient_angle
//    (linear) or gradient_type:"radial", on a full-bleed composition (not the scene).
//  • letter_spacing in % (NOT em); border_radius in px, and per-corner is supported
//    ("184 px 184 px 26 px 26 px") → the arch crop.
//  • text aligns LEFT by default; x_alignment "0%"/"50%"/"100%" = left/center/right.

const UNB = "Unbounded";
const GRO = "Space Grotesk";

// The brand gradient (aurora). Stops array is the form Creatomate actually paints.
const BRAND_GRADIENT = [
  { offset: "0%", color: "#5b6bff" },
  { offset: "42%", color: "#8b5cf6" },
  { offset: "100%", color: "#ff6a8d" },
];

/**
 * Build the AOTW scene from a data object:
 *   { agentName, premium, policies, periodLabel, agencyName, network, photoUrl }
 * (all strings; photoUrl is a public https URL or "" for none). The arch portrait +
 * ring are included only when a fetchable https URL is supplied.
 */
export function buildAotwSource(d) {
  const els = [];

  // Brand gradient (full-bleed composition — gradients don't paint on the scene).
  els.push({
    type: "composition", x: "50%", y: "50%", width: "100%", height: "100%",
    fill_color: BRAND_GRADIENT, gradient_angle: "150 deg",
  });
  // Soft light blobs for depth (radial stops fade fully transparent before the edge).
  els.push(
    { type: "composition", x: "98%", y: "0%", width: "64%", height: "52%",
      fill_color: [ { offset: "0%", color: "rgba(255,255,255,0.40)" }, { offset: "58%", color: "rgba(255,255,255,0)" } ],
      gradient_type: "radial" },
    { type: "composition", x: "0%", y: "100%", width: "58%", height: "48%",
      fill_color: [ { offset: "0%", color: "rgba(120,130,255,0.45)" }, { offset: "58%", color: "rgba(120,130,255,0)" } ],
      gradient_type: "radial" },
  );

  // Header: agency wordmark (left) + network (right).
  els.push(
    { type: "text", x: "50%", y: "7.2%", width: "84%", text: d.agencyName,
      font_family: UNB, font_weight: 800, font_size: "2.4 vmin", letter_spacing: "4%",
      fill_color: "#ffffff", x_alignment: "0%" },
  );
  if (d.network) {
    els.push({ type: "text", x: "50%", y: "7.6%", width: "84%", text: d.network,
      font_family: GRO, font_weight: 400, font_size: "1.4 vmin", letter_spacing: "28%",
      fill_color: "rgba(255,255,255,0.80)", text_transform: "uppercase", x_alignment: "100%" });
  }

  // Arch portrait (left) — ring = a slightly larger arch composition behind the photo.
  if (/^https:\/\//i.test(d.photoUrl)) {
    els.push(
      { type: "composition", x: "25%", y: "43%", width: "35.8%", height: "36.6%",
        fill_color: "rgba(255,255,255,0.6)", border_radius: "190 px 190 px 30 px 30 px",
        shadow_color: "rgba(0,0,0,0.30)", shadow_blur: "60 px", shadow_x: "0 px", shadow_y: "24 px" },
      { type: "image", x: "25%", y: "43%", width: "34.4%", height: "35.2%",
        source: d.photoUrl, fit: "cover", border_radius: "184 px 184 px 26 px 26 px" },
    );
  }

  // Glass pill eyebrow + name (right column).
  els.push(
    { type: "composition", x: "63%", y: "30%", width: "36%", height: "3.8%",
      fill_color: "rgba(255,255,255,0.16)", border_radius: "60 px",
      stroke_color: "rgba(255,255,255,0.45)", stroke_width: "1 px" },
    { type: "text", x: "63%", y: "30%", width: "36%", text: "AGENT OF THE WEEK",
      font_family: GRO, font_weight: 700, font_size: "1.3 vmin", letter_spacing: "24%",
      fill_color: "#ffffff", text_transform: "uppercase", x_alignment: "50%" },
    { type: "text", x: "70%", y: "45%", width: "48%", text: d.agentName,
      font_family: UNB, font_weight: 800, font_size: "8.4 vmin", line_height: "92%",
      letter_spacing: "-2%", fill_color: "#ffffff", x_alignment: "0%" },
  );

  // Glass stat panel (bottom): premium | divider | policies + period.
  els.push(
    { type: "composition", x: "50%", y: "84%", width: "84%", height: "15.5%",
      fill_color: "rgba(255,255,255,0.14)", border_radius: "28 px",
      stroke_color: "rgba(255,255,255,0.35)", stroke_width: "1 px" },
    { type: "text", x: "32%", y: "79.5%", width: "40%", text: "ANNUAL PREMIUM",
      font_family: GRO, font_weight: 500, font_size: "1.3 vmin", letter_spacing: "22%",
      fill_color: "rgba(255,255,255,0.82)", x_alignment: "0%" },
    { type: "text", x: "32%", y: "85%", width: "40%", text: d.premium,
      font_family: UNB, font_weight: 800, font_size: "7.2 vmin", letter_spacing: "-2%",
      fill_color: "#ffffff", x_alignment: "0%" },
    { type: "composition", x: "50%", y: "84%", width: "0.12%", height: "10.5%",
      fill_color: "rgba(255,255,255,0.3)" },
    { type: "text", x: "68%", y: "79.5%", width: "40%", text: "POLICIES",
      font_family: GRO, font_weight: 500, font_size: "1.3 vmin", letter_spacing: "20%",
      fill_color: "rgba(255,255,255,0.82)", x_alignment: "100%" },
    { type: "text", x: "68%", y: "84.5%", width: "40%", text: d.policies,
      font_family: UNB, font_weight: 800, font_size: "5 vmin",
      fill_color: "#ffffff", x_alignment: "100%" },
    { type: "text", x: "68%", y: "89.5%", width: "40%", text: d.periodLabel,
      font_family: GRO, font_weight: 500, font_size: "1.1 vmin", letter_spacing: "14%",
      fill_color: "rgba(255,255,255,0.72)", text_transform: "uppercase", x_alignment: "100%" },
  );

  return {
    output_format: "png", width: 1080, height: 1350,
    fill_color: "#7a5cf0", elements: els,
  };
}
