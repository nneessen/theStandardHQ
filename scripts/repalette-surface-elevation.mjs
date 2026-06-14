#!/usr/bin/env node
/**
 * repalette-surface-elevation.mjs
 *
 * One-shot codemod for the "Surface / Substrate Elevation" repalette (Jun 14 2026).
 * Swaps ONLY the unambiguous, hardcoded surface / text / accent hex literals inside
 * authenticated-app chrome to the new The-Standard-HQ ramp. Token sources of truth
 * (tokens.ts, index.css, tailwind.config.js) are edited by hand, NOT by this script.
 *
 * Deliberately conservative:
 *   - NEVER touches white-alpha rgba(255,255,255,…) — those are shadows/glows/overlays,
 *     not just text/lines; the genuine text/hairline ones are hand-fixed per file.
 *   - NEVER touches status hex (#f4b43a/#ff6a5d/#5fd08a/#46d8f5) or effect gradients.
 *   - Hard-skips public landing (.theme-landing / HQ), customer white-label recruiting
 *     theme, email/marketing TEMPLATE strings, and the pre-React boot splash.
 *
 * Usage:  node scripts/repalette-surface-elevation.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = path.resolve(import.meta.dirname, "..");

// Ordered, non-overlapping replacements. Each `re` is global + case-insensitive for
// hex; the replacement is the canonical lowercase new value.
const RULES = [
  // surfaces (role-mapped)
  { name: "bg #0d0d0d→#171717", re: /#0d0d0d/gi, to: "#171717" },
  { name: "card #161616→#252525", re: /#161616/gi, to: "#252525" },
  { name: "raised #1c1c1c→#2c2c2c", re: /#1c1c1c/gi, to: "#2c2c2c" },
  { name: "tile #232323→#2c2c2c", re: /#232323/gi, to: "#2c2c2c" },
  // text
  { name: "ink #fafafa→#f3f3f4", re: /#fafafa/gi, to: "#f3f3f4" },
  { name: "cream #ededed→#fbfbfc", re: /#ededed/gi, to: "#fbfbfc" },
  // accent (blue family)
  { name: "blue #6b97ff→#5b9bff", re: /#6b97ff/gi, to: "#5b9bff" },
  { name: "blueLit #8fb4ff→#82bcff", re: /#8fb4ff/gi, to: "#82bcff" },
  {
    name: "accent-glow rgba(107,151,255→rgba(91,155,255",
    re: /rgba\(\s*107\s*,\s*151\s*,\s*255/gi,
    to: "rgba(91,155,255",
  },
];

// Files/dirs that must never be rewritten by this codemod.
const SKIP = [
  "src/features/landing/", // public landing (.theme-landing)
  "/hq/", // The Standard HQ landing (.theme-hq — keeps warm cream)
  "src/lib/recruiting-theme.ts", // customer white-label branding
  "src/components/board/tokens.ts", // token source of truth (hand-edited)
  "src/index.css", // CSS var source of truth (hand-edited)
  "tailwind.config.js",
  // False positives — NOT app chrome:
  "src/features/marketing/services/starterTemplateService.ts", // customer email/page templates
  "src/services/hierarchy/invitationService.ts", // outbound email HTML template
  "src/index.tsx", // pre-React boot/error splash (renders before theme)
];

// Enumerate tracked source files via git (fast, respects .gitignore).
const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => !SKIP.some((s) => f.includes(s)));

const totals = Object.fromEntries(RULES.map((r) => [r.name, 0]));
const touched = [];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const before = readFileSync(abs, "utf8");
  let after = before;
  const perFile = {};
  for (const rule of RULES) {
    const n = (after.match(rule.re) || []).length;
    if (n) {
      after = after.replace(rule.re, rule.to);
      perFile[rule.name] = n;
      totals[rule.name] += n;
    }
  }
  if (after !== before) {
    touched.push({ rel, perFile });
    if (!DRY) writeFileSync(abs, after);
  }
}

// Report
console.log(`\nSurface-elevation repalette — ${DRY ? "DRY RUN" : "APPLIED"}`);
console.log(`Scanned ${files.length} files, modified ${touched.length}.\n`);
for (const { rel, perFile } of touched) {
  const summary = Object.entries(perFile)
    .map(([k, v]) => `${v}× ${k.split(" ")[0]}`)
    .join(", ");
  console.log(`  ${rel}  (${summary})`);
}
console.log("\nPer-pattern totals:");
for (const [name, n] of Object.entries(totals)) {
  if (n) console.log(`  ${n.toString().padStart(4)}  ${name}`);
}
console.log("");
