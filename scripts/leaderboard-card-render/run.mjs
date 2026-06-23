// Renders the LeaderboardSocialCard to PNGs in dark/light × post/story.
// Boots a Vite dev server with the project's own config (so the `@` alias,
// Tailwind, and index.css all apply), then screenshots the #card element in
// headless Chromium at exact pixel size. Outputs to ./out/.
//
// Usage:  node scripts/leaderboard-card-render/run.mjs
import { createServer } from "vite";
import { chromium } from "playwright";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(here, "out");
await mkdir(outDir, { recursive: true });

// Agent of the Week design directions (current showpiece). Cadence renders
// (daily/weekly/monthly × dark/light × post/story) are produced by passing
// RENDER_CADENCES=1; default run does the AOTW directions.
// RENDER_THEMES=1 → the brand themes (spotlight/editorial/lift) across card types.
// RENDER_VIEWS can scope which views (default daily,weekly,monthly,aotw).
const THEME_VIEWS = (process.env.RENDER_VIEWS || "daily,weekly,monthly,aotw").split(
  ",",
);
const VARIANTS = process.env.RENDER_THEMES
  ? THEME_VIEWS.flatMap((view) =>
      ["spotlight", "editorial", "lift"].map((theme) => ({
        view,
        theme,
        format: "portrait",
      })),
    )
  : process.env.RENDER_CADENCES
    ? ["daily", "weekly", "monthly"].flatMap((view) =>
        ["dark", "light"].flatMap((theme) =>
          ["portrait", "story"].map((format) => ({ view, theme, format })),
        ),
      )
    : ["aurora", "editorial", "noir"].map((design) => ({
        view: "aotw",
        design,
        format: "portrait",
      }));

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { port: 5198, open: false, hmr: false },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch();
let ok = true;

for (const v of VARIANTS) {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const key = v.design ? `${v.view}-${v.design}` : `${v.view}-${v.theme}`;
  const qp = v.design
    ? `view=${v.view}&design=${v.design}&format=${v.format}`
    : `view=${v.view}&theme=${v.theme}&format=${v.format}`;
  const url = `http://localhost:5198/scripts/leaderboard-card-render/index.html?${qp}`;
  const file = path.join(outDir, `${key}-${v.format}.png`);
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction(() => window.__READY__ === true, { timeout: 30000 });
    const card = await page.$("#card");
    if (!card) throw new Error("#card not found");
    await card.screenshot({ path: file });
    const box = await card.boundingBox();
    const status = errors.length === 0 ? "✅" : "⚠️ ";
    console.log(
      `${status} ${key}/${v.format} → ${path.relative(root, file)}  (${Math.round(box.width)}×${Math.round(box.height)})${errors.length ? "  errors: " + errors.join("; ") : ""}`,
    );
    if (errors.length) ok = false;
  } catch (e) {
    ok = false;
    console.log(`❌ ${v.theme}/${v.format} FAILED: ${e?.message || e}`);
  }
  await page.close();
}

await browser.close();
await server.close();
process.exit(ok ? 0 : 1);
