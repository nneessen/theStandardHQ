// scripts/social-studio-export-render/run.mjs
//
// Drives the FAITHFUL export harness (entry.tsx): boots Vite with the project's own
// config (so `@` alias + Tailwind + index.css + fonts all apply), mounts the REAL
// <SocialPreview>, calls the in-app domToPng() export, decodes the resulting PNG, and
// asserts its pixel dimensions equal FORMAT_DIMS. This is the ONLY harness that
// reproduces the WI-1 transform-crop bug — leaderboard-card-render cannot, because it
// has no transform ancestor and screenshots natively.
//
// Usage:
//   node scripts/social-studio-export-render/run.mjs
//   RENDER_VIEWS=daily,monthly,aotw RENDER_FORMATS=portrait,square,story TOPN=10 \
//     node scripts/social-studio-export-render/run.mjs
//
// Then READ the PNGs in ./out/ as images — right dimensions with blank/clipped
// content is still a fail.
import { createServer } from "vite";
import { chromium } from "playwright";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(here, "out");
await mkdir(outDir, { recursive: true });

const FORMAT_DIMS = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

// Decode width/height from a PNG's IHDR chunk (big-endian u32 at byte 16 and 20).
function pngDims(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const VIEWS = (process.env.RENDER_VIEWS || "daily,monthly,aotw").split(",");
const FORMATS = (process.env.RENDER_FORMATS || "portrait").split(",");
const THEME = process.env.THEME || "spotlight";
const topN = process.env.TOPN || "10";

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { port: 5197, open: false, hmr: false },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch();
let ok = true;

for (const view of VIEWS) {
  for (const format of FORMATS) {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const key = `${view}-${format}`;
    const qp = `view=${view}&format=${format}&theme=${THEME}&topN=${topN}`;
    const url = `http://localhost:5197/scripts/social-studio-export-render/index.html?${qp}`;
    try {
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.waitForFunction(() => window.__READY__ === true, {
        timeout: 30000,
      });
      const dataUrl = await page.evaluate(() => window.__exportPng());
      const buf = Buffer.from(dataUrl.split(",")[1], "base64");
      const file = path.join(outDir, `${key}.png`);
      await writeFile(file, buf);
      const got = pngDims(buf);
      const want = FORMAT_DIMS[format];
      const dimsOk = got.w === want.w && got.h === want.h;
      if (!dimsOk || errors.length) ok = false;
      const status = dimsOk && errors.length === 0 ? "✅" : "❌";
      console.log(
        `${status} ${key.padEnd(18)} export=${got.w}×${got.h}  want=${want.w}×${want.h}  → ${path.relative(root, file)}${errors.length ? "  errors: " + errors.join("; ") : ""}`,
      );
    } catch (e) {
      ok = false;
      console.log(`❌ ${key} FAILED: ${e?.message || e}`);
    }
    await page.close();
  }
}

await browser.close();
await server.close();
console.log(
  ok
    ? "\nAll exports match FORMAT_DIMS. Now READ the PNGs to confirm content."
    : "\n❌ At least one export does NOT match FORMAT_DIMS (or errored).",
);
process.exit(ok ? 0 : 1);
