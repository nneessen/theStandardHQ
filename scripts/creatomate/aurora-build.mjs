// Faithful Creatomate recreation of the app's AURORA Agent-of-the-Week design
// (src/features/social-cards/AgentOfWeekCard.tsx) — the gradient + glassmorphism
// look the owner approved, rendered server-side at full fidelity (the in-app
// download can't capture its backdrop-filter glass). Iterate here (render→Read→
// refine); the final builder is ported into supabase/functions/_shared/aotwSource.mjs.
//
// Usage: set -a; source .env; set +a; node scripts/creatomate/aurora-build.mjs [photoUrl]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.CREATOMATE_API_KEY;
if (!KEY) { console.error("✗ no CREATOMATE_API_KEY"); process.exit(2); }
const OUT = dirname(fileURLToPath(import.meta.url)) + "/out";

const d = {
  agentName: "Marcus Wells",
  premium: "$52,400",
  policies: "31",
  periodLabel: "WEEK OF JUN 14–20",
  agencyName: "THE STANDARD",
  network: "EPIC LIFE",
  photoUrl: process.argv[2] ||
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&q=80&auto=format&fit=crop",
};

const UNB = "Unbounded";
const GRO = "Space Grotesk";

function auroraSource(d) {
  const els = [];
  // Brand gradient as a full-bleed composition (Creatomate gradient = stops array
  // + gradient_angle; CSS strings on fill_color don't paint).
  els.push({
    type: "composition", x: "50%", y: "50%", width: "100%", height: "100%",
    fill_color: [
      { offset: "0%", color: "#5b6bff" },
      { offset: "42%", color: "#8b5cf6" },
      { offset: "100%", color: "#ff6a8d" },
    ],
    gradient_angle: "150 deg",
  });
  // Soft light blobs (radial stops fade to transparent) for depth. Pushed into the
  // corners with the fade fully transparent before the box edge → no hard rectangle.
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
    { type: "text", x: "50%", y: "7.6%", width: "84%", text: d.network,
      font_family: GRO, font_weight: 400, font_size: "1.4 vmin", letter_spacing: "28%",
      fill_color: "rgba(255,255,255,0.80)", text_transform: "uppercase", x_alignment: "100%" },
  );

  // Arch portrait (left). Ring = a slightly larger arch composition behind the photo.
  const archPhoto = "184 px 184 px 26 px 26 px";
  const archRing = "190 px 190 px 30 px 30 px";
  if (/^https:\/\//i.test(d.photoUrl)) {
    els.push(
      { type: "composition", x: "25%", y: "43%", width: "35.8%", height: "36.6%",
        fill_color: "rgba(255,255,255,0.6)", border_radius: archRing,
        shadow_color: "rgba(0,0,0,0.30)", shadow_blur: "60 px", shadow_x: "0 px", shadow_y: "24 px" },
      { type: "image", x: "25%", y: "43%", width: "34.4%", height: "35.2%",
        source: d.photoUrl, fit: "cover", border_radius: archPhoto },
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

  // Glass stat panel (bottom).
  els.push(
    { type: "composition", x: "50%", y: "84%", width: "84%", height: "15.5%",
      fill_color: "rgba(255,255,255,0.14)", border_radius: "28 px",
      stroke_color: "rgba(255,255,255,0.35)", stroke_width: "1 px" },
    // left: premium
    { type: "text", x: "32%", y: "79.5%", width: "40%", text: "ANNUAL PREMIUM",
      font_family: GRO, font_weight: 500, font_size: "1.3 vmin", letter_spacing: "22%",
      fill_color: "rgba(255,255,255,0.82)", x_alignment: "0%" },
    { type: "text", x: "32%", y: "85%", width: "40%", text: d.premium,
      font_family: UNB, font_weight: 800, font_size: "7.2 vmin", letter_spacing: "-2%",
      fill_color: "#ffffff", x_alignment: "0%" },
    // divider
    { type: "composition", x: "50%", y: "84%", width: "0.12%", height: "10.5%",
      fill_color: "rgba(255,255,255,0.3)" },
    // right: policies + period
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

  return { output_format: "png", width: 1080, height: 1350,
    fill_color: "#7a5cf0", elements: els };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function render(source, label) {
  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ source }) });
  const t = await res.text();
  if (!res.ok) { console.error(`✗ HTTP ${res.status}: ${t.slice(0,500)}`); return false; }
  let r = JSON.parse(t); r = Array.isArray(r) ? r[0] : r;
  for (let i = 0; r?.status !== "succeeded" && r?.status !== "failed" && i < 30; i++) {
    await sleep(1500);
    const g = await fetch(`https://api.creatomate.com/v1/renders/${r.id}`, { headers: { Authorization: `Bearer ${KEY}` } });
    r = await g.json();
  }
  if (r?.status !== "succeeded") { console.error(`✗ ${label}: ${r?.status} → ${r?.error_message ?? ""}`); return false; }
  const buf = Buffer.from(await (await fetch(r.url)).arrayBuffer());
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/${label}.png`, buf);
  console.log(`✓ ${label}: ${OUT}/${label}.png (${buf.length} b)`);
  return true;
}

await render(auroraSource(d), "aurora-v3");
