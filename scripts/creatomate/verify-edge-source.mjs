// Proof-render of the EXACT builder the edge function uses (imported from the
// shared module, not a copy) — so a transcription bug can't 504 on the owner's
// first real click. Renders both the with-photo and no-photo branches.
//
// Usage:  set -a; source .env; set +a; node scripts/creatomate/verify-edge-source.mjs [photoUrl]
//   Pass a real public spotlight-assets URL as argv[1] to also confirm Creatomate
//   can fetch a Supabase-hosted image; otherwise a public stand-in is used.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAotwSource } from "../../supabase/functions/_shared/aotwSource.mjs";

const KEY = process.env.CREATOMATE_API_KEY;
if (!KEY) {
  console.error("✗ CREATOMATE_API_KEY not set (`set -a; source .env; set +a` first)");
  process.exit(2);
}

const OUT_DIR = dirname(fileURLToPath(import.meta.url)) + "/out";
const photoArg = process.argv[2];
const photoUrl =
  photoArg ||
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80&auto=format&fit=crop";

const base = {
  agentName: "Marcus Wells",
  premium: "$52,400",
  policies: "31",
  periodLabel: "WEEK OF JUN 14–20",
  agencyName: "THE STANDARD",
  network: "EPIC LIFE",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function render(source, label) {
  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`✗ [${label}] HTTP ${res.status}: ${text.slice(0, 600)}`);
    return false;
  }
  let r = JSON.parse(text);
  r = Array.isArray(r) ? r[0] : r;
  for (let i = 0; r?.status !== "succeeded" && r?.status !== "failed" && i < 30; i++) {
    await sleep(1500);
    const g = await fetch(`https://api.creatomate.com/v1/renders/${r.id}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    r = await g.json();
  }
  if (r?.status !== "succeeded" || !r?.url) {
    console.error(`✗ [${label}] status=${r?.status} error=${r?.error_message ?? ""}`);
    return false;
  }
  const png = await fetch(r.url);
  const buf = Buffer.from(await png.arrayBuffer());
  await mkdir(OUT_DIR, { recursive: true });
  const path = `${OUT_DIR}/edge-${label}.png`;
  await writeFile(path, buf);
  console.log(`✓ [${label}] ${path} (${buf.length} bytes)`);
  return true;
}

console.log(`photo: ${photoUrl.slice(0, 80)}…`);
const okPhoto = await render(buildAotwSource({ ...base, photoUrl }), "with-photo");
const okNone = await render(buildAotwSource({ ...base, photoUrl: "" }), "no-photo");
process.exit(okPhoto && okNone ? 0 : 1);
