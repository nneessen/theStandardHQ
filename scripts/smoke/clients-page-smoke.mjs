#!/usr/bin/env node
// scripts/smoke/clients-page-smoke.mjs
// Load-smoke for the Clients page. Bundles ClientsPage.tsx with the project's `@/` alias using
// esbuild (the same transformer Vite uses). This proves every import resolves and the module
// parses/transforms with no broken paths or syntax errors — i.e. the page will not throw a
// loading error in the real app. It does NOT type-check (tsc does that); it catches the class of
// failure a type-check can miss: bad import paths, missing exports, JSX/syntax breakage.
//
// Usage: node scripts/smoke/clients-page-smoke.mjs
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const entry = resolve(root, "src/features/clients/ClientsPage.tsx");

try {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    logLevel: "silent",
    jsx: "automatic",
    loader: { ".css": "empty", ".svg": "dataurl", ".png": "dataurl" },
    // Mirror tsconfig `@/* -> src/*`. Externalize node_modules so we only validate app code wiring.
    alias: { "@": resolve(root, "src") },
    packages: "external",
  });
  const bytes = result.outputFiles?.[0]?.contents?.length ?? 0;
  console.log(`✅ ClientsPage bundled cleanly (${bytes} bytes, all @/ imports resolved).`);
  process.exit(0);
} catch (err) {
  console.error("❌ ClientsPage failed to bundle — it would error on load:\n");
  for (const e of err.errors ?? [{ text: String(err) }]) {
    const loc = e.location
      ? `${e.location.file}:${e.location.line}:${e.location.column}`
      : "";
    console.error(`  • ${e.text} ${loc}`);
  }
  process.exit(1);
}
