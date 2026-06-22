// Creatomate API smoke: confirms CREATOMATE_API_KEY is valid and the render
// round-trip behaves as documented (POST /v1/renders without a webhook blocks
// until done, returning an array of render objects with status + url).
// Uses a minimal `source` so it needs NO pre-built template.
//
// Usage:  set -a; source .env; set +a; node scripts/creatomate/creatomate-smoke.mjs
const KEY = process.env.CREATOMATE_API_KEY;
if (!KEY) {
  console.error("✗ CREATOMATE_API_KEY not set (source .env first)");
  process.exit(2);
}

const body = {
  source: {
    output_format: "png",
    width: 600,
    height: 600,
    fill_color: "#1b1b1b",
    elements: [
      {
        type: "text",
        text: "Creatomate OK",
        fill_color: "#f4b43a",
        font_weight: 800,
        y: "50%",
      },
    ],
  },
};

const res = await fetch("https://api.creatomate.com/v1/renders", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error(`✗ HTTP ${res.status}: ${text.slice(0, 400)}`);
  process.exit(1);
}

let arr;
try {
  arr = JSON.parse(text);
} catch {
  console.error(`✗ non-JSON response: ${text.slice(0, 200)}`);
  process.exit(1);
}
let r = Array.isArray(arr) ? arr[0] : arr;
console.log(`✓ HTTP ${res.status}  render id=${r?.id}  status=${r?.status}`);

// This account renders ASYNC (status starts "planned"): poll until terminal.
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
for (let i = 0; r?.status !== "succeeded" && r?.status !== "failed" && i < 20; i++) {
  await sleep(1500);
  const g = await fetch(`https://api.creatomate.com/v1/renders/${r.id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  r = await g.json();
  console.log(`  …poll ${i + 1}: status=${r?.status}`);
}

console.log(`${r?.status === "succeeded" ? "✓" : "✗"} final status=${r?.status}`);
console.log(`  url: ${r?.url}`);
if (r?.status === "succeeded" && r?.url) {
  const head = await fetch(r.url, { method: "HEAD" });
  console.log(`  fetch rendered file → HTTP ${head.status} (${head.headers.get("content-type")})`);
}
process.exit(r?.status === "succeeded" ? 0 : 1);
