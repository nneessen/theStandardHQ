#!/usr/bin/env node
// scripts/check-call-reviews.mjs
// Lightweight runnability check for the all-agents Call Reviews training feature:
//   1. all expected feature files exist
//   2. the routes + nav are wired (lazy imports, both routes in tree, sidebar item)
//   3. the edge functions exist
//   4. the project type-checks (tsc --noEmit) — catches import/type breakage
//
// Usage: node scripts/check-call-reviews.mjs

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  console.error(`  ✗ ${m}`);
  failures += 1;
};

console.log("Call Reviews — file presence");
const requiredFiles = [
  "src/features/call-reviews/index.ts",
  "src/features/call-reviews/types.ts",
  "src/features/call-reviews/hooks/callReviewKeys.ts",
  "src/features/call-reviews/hooks/useCallLibrary.ts",
  "src/features/call-reviews/hooks/useCallMarkers.ts",
  "src/features/call-reviews/hooks/useCallScripts.ts",
  "src/features/call-reviews/components/CallReviewsPage.tsx",
  "src/features/call-reviews/components/CallReviewDetailPage.tsx",
  "src/features/call-reviews/components/CallAudioPlayer.tsx",
  "src/features/call-reviews/components/TranscriptPanel.tsx",
  "src/features/call-reviews/components/CallMarkersPanel.tsx",
  "src/features/call-reviews/components/CallAnalysisPanel.tsx",
  "src/features/call-reviews/components/CallScriptPanel.tsx",
  "supabase/functions/transcribe-call-recording/index.ts",
  "supabase/functions/analyze-call-transcript/index.ts",
];
for (const f of requiredFiles) {
  if (existsSync(join(root, f))) ok(f);
  else fail(`missing ${f}`);
}

console.log("\nCall Reviews — route + nav wiring");
const router = readFileSync(join(root, "src/router.tsx"), "utf8");
if (/import\("\.\/features\/call-reviews"\)/.test(router))
  ok("router lazy-imports ./features/call-reviews");
else fail("router missing lazy import of ./features/call-reviews");
if (/path:\s*"call-reviews"/.test(router)) ok('route path "call-reviews" defined');
else fail('route path "call-reviews" not found');
if (/path:\s*"call-reviews\/\$recordingId"/.test(router))
  ok('detail route "call-reviews/$recordingId" defined');
else fail('detail route "call-reviews/$recordingId" not found');
if (/\bcallReviewsRoute\b,/.test(router) && /\bcallReviewDetailRoute\b,/.test(router))
  ok("both call-review routes registered in routeTree");
else fail("call-review routes not added to routeTree array");

const nav = readFileSync(
  join(root, "src/components/layout/sidebar/sidebar-nav.config.ts"),
  "utf8",
);
if (/href:\s*"\/call-reviews"/.test(nav)) ok("sidebar nav has /call-reviews item");
else fail("sidebar nav missing /call-reviews item");
if (/label:\s*"Call Reviews"/.test(nav)) ok('nav label "Call Reviews" present');
else fail('nav label "Call Reviews" missing');

console.log("\nCall Reviews — Deepgram + analyze pipeline");
const transcribe = readFileSync(
  join(root, "supabase/functions/transcribe-call-recording/index.ts"),
  "utf8",
);
if (/api\.deepgram\.com\/v1\/listen/.test(transcribe) && /diarize/.test(transcribe))
  ok("transcribe uses Deepgram diarization");
else fail("transcribe not wired to Deepgram diarization");
if (/analyze-call-transcript/.test(transcribe))
  ok("transcribe fires analyze-call-transcript");
else fail("transcribe does not fire analyze-call-transcript");

console.log("\nCall Reviews — type-check (tsc --noEmit)");
try {
  execSync("npx tsc --noEmit", { cwd: root, stdio: "pipe" });
  ok("tsc --noEmit: 0 errors");
} catch (e) {
  fail("tsc --noEmit reported errors:");
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.toString();
  const lines = out.split("\n").filter((l) => l.includes("call-reviews"));
  console.error((lines.length ? lines : out.split("\n").slice(-30)).join("\n"));
}

console.log(
  failures === 0
    ? "\nAll Call Reviews checks passed."
    : `\n${failures} Call Reviews check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
