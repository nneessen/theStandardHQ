#!/usr/bin/env node
// scripts/check-kpi-section.mjs
// Lightweight runnability check for the /kpi feature (Phase 1):
//   1. all expected feature files exist
//   2. the route + nav are wired (lazy import, route in tree, sidebar item)
//   3. the project type-checks (tsc --noEmit) — catches import/type breakage
//
// Usage: node scripts/check-kpi-section.mjs

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failures += 1;
}

console.log("KPI feature — file presence");
const requiredFiles = [
  "src/features/kpi/index.ts",
  "src/features/kpi/types/kpi.types.ts",
  "src/features/kpi/lib/recording-status.ts",
  "src/features/kpi/lib/format-call-duration.ts",
  "src/features/kpi/lib/kpi-derivations.ts",
  "src/features/kpi/services/recordingStorageService.ts",
  "src/features/kpi/hooks/index.ts",
  "src/features/kpi/hooks/kpiKeys.ts",
  "src/features/kpi/hooks/useDailyMetrics.ts",
  "src/features/kpi/hooks/useWordTracks.ts",
  "src/features/kpi/hooks/useRecordings.ts",
  "src/features/kpi/components/KpiPage.tsx",
  "src/features/kpi/components/KpiDashboardTab.tsx",
  "src/features/kpi/components/ManualKpiEntryPanel.tsx",
  "src/features/kpi/components/RecordingsTab.tsx",
  "src/features/kpi/components/RecordingUploadDropZone.tsx",
  "src/features/kpi/components/RecordingsList.tsx",
  "src/features/kpi/components/WordTracksTab.tsx",
  "src/features/kpi/components/WordTrackForm.tsx",
  "src/features/kpi/components/WordTrackLibrary.tsx",
];
for (const f of requiredFiles) {
  if (existsSync(join(root, f))) ok(f);
  else fail(`missing ${f}`);
}

console.log("\nKPI feature — route + nav wiring");
const router = readFileSync(join(root, "src/router.tsx"), "utf8");
if (/import\("\.\/features\/kpi"\)/.test(router))
  ok("router lazy-imports ./features/kpi");
else fail("router missing lazy import of ./features/kpi");
if (/path:\s*"kpi"/.test(router)) ok('route path "kpi" defined');
else fail('route path "kpi" not found');
if (/requireEmailIncludes="epiclife"[\s\S]{0,120}KpiPage|KpiPage[\s\S]{0,160}/.test(router) && /<KpiPage\s*\/>/.test(router))
  ok("KpiPage rendered in a route");
else fail("KpiPage not rendered in a route");
if (/\bkpiRoute\b,/.test(router)) ok("kpiRoute registered in routeTree");
else fail("kpiRoute not added to routeTree array");

const nav = readFileSync(
  join(root, "src/components/layout/sidebar/sidebar-nav.config.ts"),
  "utf8",
);
if (/href:\s*"\/kpi"/.test(nav)) ok("sidebar nav has /kpi item");
else fail("sidebar nav missing /kpi item");
if (/label:\s*"Call KPIs"/.test(nav)) ok('nav label "Call KPIs" present');
else fail('nav label "Call KPIs" missing');

console.log("\nKPI feature — type-check (tsc --noEmit)");
try {
  execSync("npx tsc --noEmit", { cwd: root, stdio: "pipe" });
  ok("tsc --noEmit: 0 errors");
} catch (e) {
  fail("tsc --noEmit reported errors:");
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.toString();
  // Surface only KPI-relevant lines first, then a tail of everything.
  const kpiLines = out.split("\n").filter((l) => l.includes("features/kpi"));
  if (kpiLines.length) console.error(kpiLines.join("\n"));
  else console.error(out.split("\n").slice(-30).join("\n"));
}

console.log(
  failures === 0
    ? "\nAll KPI section checks passed."
    : `\n${failures} KPI section check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
