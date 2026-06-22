// Rasterizer fidelity check for the in-app "Download PNG".
//
// The app's download was switched html-to-image → modern-screenshot. This renders
// the REAL leaderboard card in headless Chromium and saves it two ways:
//   • native   — Playwright's element.screenshot()  (ground truth, real browser)
//   • modern   — modern-screenshot domToPng()        (the actual download lib)
// If they match, the download is faithful. Needs NO real DB data (uses the
// harness fixture roster), so it works even when Social Studio is in sample mode.
//
// Usage:  node scripts/leaderboard-card-render/verify-rasterizer.mjs [daily|weekly|monthly]
import { createServer } from "vite";
import { chromium } from "playwright";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(here, "out");
await mkdir(outDir, { recursive: true });

const view = process.argv[2] || "weekly";
const format = "portrait";

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { port: 5199, open: false, hmr: false },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const url = `http://localhost:5199/scripts/leaderboard-card-render/index.html?view=${view}&theme=dark&format=${format}`;
let ok = true;
try {
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => window.__READY__ === true, { timeout: 30000 });
  const card = await page.$("#card");
  if (!card) throw new Error("#card not found");

  const nativePath = path.join(outDir, `verify-${view}-native.png`);
  await card.screenshot({ path: nativePath });
  const box = await card.boundingBox();

  // The real download lib, run in-page on the same #card.
  const dataUrl = await page.evaluate(() => window.__domToPng());
  const b64 = dataUrl.split(",")[1];
  const modernPath = path.join(outDir, `verify-${view}-modern.png`);
  await writeFile(modernPath, Buffer.from(b64, "base64"));
  const modernKb = Math.round(Buffer.from(b64, "base64").length / 1024);

  const status = errors.length === 0 ? "✅" : "⚠️ ";
  console.log(
    `${status} ${view}/${format}  native=${path.relative(root, nativePath)} (${Math.round(box.width)}×${Math.round(box.height)})  modern=${path.relative(root, modernPath)} (${modernKb}KB)`,
  );
  if (errors.length) {
    ok = false;
    console.log("   errors: " + errors.join("; "));
  }
  console.log("→ READ both PNGs: they should be visually identical (fonts + amber gradients).");
} catch (e) {
  ok = false;
  console.log(`❌ FAILED: ${e?.message || e}`);
}

await browser.close();
await server.close();
process.exit(ok ? 0 : 1);
