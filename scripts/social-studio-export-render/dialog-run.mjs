// scripts/social-studio-export-render/dialog-run.mjs
// Screenshots the WI-5 PostConfirmDialog (Instagram chrome) for feed + story variants.
import { createServer } from "vite";
import { chromium } from "playwright";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(here, "out");
await mkdir(outDir, { recursive: true });

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { port: 5196, open: false, hmr: false },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch();
const VARIANTS = [
  { postType: "post", slides: "1", key: "confirm-feed-single" },
  { postType: "post", slides: "6", key: "confirm-feed-carousel" },
  { postType: "story", slides: "1", key: "confirm-story" },
];
let ok = true;
for (const v of VARIANTS) {
  const page = await browser.newPage({
    viewport: { width: 560, height: 820 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url = `http://localhost:5196/scripts/social-studio-export-render/dialog.html?postType=${v.postType}&slides=${v.slides}`;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction(() => window.__READY__ === true, {
      timeout: 30000,
    });
    const file = path.join(outDir, `${v.key}.png`);
    await page.screenshot({ path: file });
    if (errors.length) ok = false;
    console.log(
      `${errors.length ? "⚠️ " : "✅"} ${v.key} → ${path.relative(root, file)}${errors.length ? "  errors: " + errors.join("; ") : ""}`,
    );
  } catch (e) {
    ok = false;
    console.log(`❌ ${v.key} FAILED: ${e?.message || e}`);
  }
  await page.close();
}
await browser.close();
await server.close();
process.exit(ok ? 0 : 1);
