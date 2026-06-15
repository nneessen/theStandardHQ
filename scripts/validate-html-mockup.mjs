#!/usr/bin/env node
// Lightweight validator for self-contained HTML design mockups (no build step).
// Extracts the inline <script>, executes it under a minimal DOM stub, and
// confirms every view renders to a non-trivial HTML string without throwing.
// Usage: node scripts/validate-html-mockup.mjs docs/design/messages-redesign/index.html

import { readFileSync } from "node:fs";
import vm from "node:vm";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/validate-html-mockup.mjs <file.html>");
  process.exit(1);
}

const html = readFileSync(file, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("FAIL: no <script> block found");
  process.exit(1);
}

// Minimal DOM stub — enough for the mockup's render() + event wiring to run.
const noop = () => {};
const fakeEl = () => ({
  classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
  addEventListener: noop,
  dataset: {},
  set innerHTML(v) {
    this._html = v;
  },
  get innerHTML() {
    return this._html || "";
  },
});
const els = {};
const document = {
  getElementById: (id) => (els[id] ||= fakeEl()),
  querySelectorAll: () => [],
};

const ctx = { document, window: {}, console };
vm.createContext(ctx);

try {
  // Run the script (defines builders, wires events, calls render()).
  vm.runInContext(m[1], ctx, { filename: file });
} catch (e) {
  console.error("FAIL: script threw on load/render:\n", e);
  process.exit(1);
}

// Exercise every view + channel combination through the builders directly.
const checks = [
  ["viewReading('email')", () => ctx.viewReading("email")],
  ["viewReading('ig')", () => ctx.viewReading("ig")],
  ["viewFull('email')", () => ctx.viewFull("email")],
  ["viewFull('ig')", () => ctx.viewFull("ig")],
  ["viewModal('email')", () => ctx.viewModal("email")],
  ["viewModal('ig')", () => ctx.viewModal("ig")],
  ["viewTemplates()", () => ctx.viewTemplates()],
];

let ok = true;
for (const [name, fn] of checks) {
  try {
    const out = fn();
    if (typeof out !== "string" || out.length < 500) {
      console.error(`FAIL: ${name} produced ${typeof out} len=${out?.length}`);
      ok = false;
    } else if (out.includes("undefined")) {
      console.error(`WARN: ${name} contains literal "undefined"`);
      ok = false;
    } else {
      console.log(`ok   ${name.padEnd(22)} ${out.length} chars`);
    }
  } catch (e) {
    console.error(`FAIL: ${name} threw:`, e.message);
    ok = false;
  }
}

console.log(ok ? "\nMOCKUP VALIDATION: PASS" : "\nMOCKUP VALIDATION: FAIL");
process.exit(ok ? 0 : 1);
