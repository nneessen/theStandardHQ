// Regression runner for the Sales Script Download-PDF feature.
// Boots a Vite dev server using the project's own config (so the `@` alias and
// plugins apply), renders the real ScriptPdfDocument for a large multi-page
// script in headless Chromium, and exits non-zero if the PDF fails to generate.
//
// Usage:  node scripts/pdf-render-check/run.mjs
// Requires: playwright (already a devDependency).
import { createServer } from "vite";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { port: 5197, open: false, hmr: false },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

let result = null;
try {
  await page.goto("http://localhost:5197/scripts/pdf-render-check/index.html", {
    waitUntil: "load",
    timeout: 60000,
  });
  await page.waitForFunction(() => window.__PDF_RESULT__ !== undefined, {
    timeout: 90000,
  });
  result = await page.evaluate(() => window.__PDF_RESULT__);
} catch (e) {
  result = { ok: false, err: String(e?.message || e) };
}

await browser.close();
await server.close();

const ok = result?.ok && result.size > 1000 && errors.length === 0;
console.log("PDF render check:", JSON.stringify({ ...result, pageErrors: errors }));
console.log(ok ? "✅ PASS — multi-page script PDF generated" : "❌ FAIL");
process.exit(ok ? 0 : 1);
