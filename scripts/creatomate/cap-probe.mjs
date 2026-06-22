// Creatomate capability probe — isolates ONE feature per render so the descriptive
// error_message teaches the exact accepted format (how we learned letter_spacing→%,
// border_radius→px). Drives the aurora recreation.
//
// Usage: set -a; source .env; set +a; node scripts/creatomate/cap-probe.mjs
const KEY = process.env.CREATOMATE_API_KEY;
if (!KEY) { console.error("✗ no CREATOMATE_API_KEY"); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(label, source) {
  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const t = await res.text();
  if (!res.ok) { console.log(`✗ ${label}: HTTP ${res.status} ${t.slice(0,300)}`); return; }
  let r = JSON.parse(t); r = Array.isArray(r) ? r[0] : r;
  for (let i = 0; r?.status !== "succeeded" && r?.status !== "failed" && i < 20; i++) {
    await sleep(1200);
    const g = await fetch(`https://api.creatomate.com/v1/renders/${r.id}`, { headers: { Authorization: `Bearer ${KEY}` } });
    r = await g.json();
  }
  console.log(`${r.status === "succeeded" ? "✓" : "✗"} ${label}: ${r.status}${r.error_message ? "  → " + r.error_message : ""}`);
}

const W = 1080, H = 1350;
// A. gradient on scene fill_color (CSS string)
await run("A scene gradient (css string)", { output_format: "png", width: W, height: H, fill_color: "linear-gradient(150deg,#5b6bff,#8b5cf6,#ff6a8d)", elements: [] });
// B. gradient via rectangle element (gradient array of stops)
await run("B rect gradient (stops array)", { output_format: "png", width: W, height: H, elements: [
  { type: "rectangle", width: "100%", height: "100%", x: "50%", y: "50%", gradient: { type: "linear", angle: "150 deg", stops: [ { offset: "0%", color: "#5b6bff" }, { offset: "42%", color: "#8b5cf6" }, { offset: "100%", color: "#ff6a8d" } ] } } ] });
// C. element blur
await run("C blur", { output_format: "png", width: W, height: H, fill_color: "#222", elements: [
  { type: "text", text: "blur", x: "50%", y: "50%", fill_color: "#fff", blur_radius: "20 px" } ] });
// D. drop shadow
await run("D shadow", { output_format: "png", width: W, height: H, fill_color: "#222", elements: [
  { type: "text", text: "shadow", x: "50%", y: "50%", fill_color: "#fff", shadow_color: "rgba(0,0,0,0.5)", shadow_blur: "30 px", shadow_x: "0 px", shadow_y: "10 px" } ] });
// E. multi-value border_radius (arch: top round, bottom slight)
await run("E per-corner radius", { output_format: "png", width: W, height: H, fill_color: "#222", elements: [
  { type: "composition", x: "50%", y: "50%", width: "40%", height: "50%", fill_color: "#5b6bff", border_radius: "180 px 180 px 26 px 26 px" } ] });
// F. Unbounded + Space Grotesk fonts
await run("F Unbounded font", { output_format: "png", width: W, height: H, fill_color: "#222", elements: [
  { type: "text", text: "Unbounded", x: "50%", y: "40%", fill_color: "#fff", font_family: "Unbounded", font_weight: 800 },
  { type: "text", text: "Space Grotesk", x: "50%", y: "60%", fill_color: "#fff", font_family: "Space Grotesk", font_weight: 700 } ] });
