// scripts/social-studio-export-render/run.mjs
//
// Drives the FAITHFUL export harness (entry.tsx): boots Vite with the project's own
// config, mounts the REAL CardExportHost, calls the REAL exportAll(), decodes every
// slide's PNG, and asserts each one's pixel dimensions equal FORMAT_DIMS. This is the
// only harness that exercises the app's actual Download/Post export path AND the
// multi-page pagination.
//
// Usage:
//   node scripts/social-studio-export-render/run.mjs
//   RENDER_VIEWS=daily,monthly,aotw RENDER_FORMATS=portrait,square,story \
//     TOPN=all N=47 THEME=spotlight node scripts/social-studio-export-render/run.mjs
//
// Then READ the slide PNGs in ./out/ — right dimensions with a clipped last row or
// blank fonts is still a fail (overflow:hidden hides a clip from the dims check).
import { createServer } from "vite";
import { chromium } from "playwright";
import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(here, "out");
await rm(outDir, { recursive: true, force: true });
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
const TOPN = process.env.TOPN || "all";
const N = process.env.N || "47";

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
    const qp = `view=${view}&format=${format}&theme=${THEME}&topN=${TOPN}&n=${N}&deck=${process.env.DECK || "0"}`;
    const url = `http://localhost:5197/scripts/social-studio-export-render/index.html?${qp}`;
    try {
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.waitForFunction(() => window.__READY__ === true, {
        timeout: 30000,
      });
      const urls = await page.evaluate(() => window.__exportAll());
      const want = FORMAT_DIMS[format];
      for (let i = 0; i < urls.length; i++) {
        const buf = Buffer.from(urls[i].split(",")[1], "base64");
        const file = path.join(outDir, `${view}-${format}-p${i + 1}.png`);
        await writeFile(file, buf);
        const got = pngDims(buf);
        const dimsOk = got.w === want.w && got.h === want.h;
        if (!dimsOk) ok = false;
        console.log(
          `${dimsOk ? "✅" : "❌"} ${`${view}-${format}`.padEnd(16)} slide ${i + 1}/${urls.length}  ${got.w}×${got.h}  → ${path.relative(root, file)}`,
        );
      }
      if (errors.length) {
        ok = false;
        console.log(`   ⚠️  page errors: ${errors.join("; ")}`);
      }
    } catch (e) {
      ok = false;
      console.log(`❌ ${view}-${format} FAILED: ${e?.message || e}`);
    }
    await page.close();
  }
}

await browser.close();
await server.close();
console.log(
  ok
    ? "\nAll slides match FORMAT_DIMS. Now READ them to confirm content + pagination."
    : "\n❌ At least one slide does NOT match FORMAT_DIMS (or errored).",
);
process.exit(ok ? 0 : 1);
