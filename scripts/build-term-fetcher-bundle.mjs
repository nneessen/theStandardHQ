#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TERM_FETCHER_DOC_PATH = path.join(
  REPO_ROOT,
  "docs",
  "scripts",
  "termFetcher.md",
);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printUsage() {
  console.error(`Usage:
  node scripts/build-term-fetcher-bundle.mjs \\
    --carrier "Transamerica" \\
    --product "Trendsetter Super" \\
    [--imo-id <uuid>] \\
    [--output ./tmp/trendsetter-super-bundle.js] \\
    [--copy]

What it does:
  - extracts the browser fetcher script from docs/scripts/termFetcher.md
  - generates the matching setTermFetcherTargets(...) block
  - combines both into one paste-ready JavaScript file
`);
}

function extractFirstJavascriptBlock(markdown) {
  const match = markdown.match(/```javascript\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error(`No javascript code block found in ${TERM_FETCHER_DOC_PATH}`);
  }
  return match[1].trim();
}

function buildTargetBlock({ carrier, product, imoId }) {
  const args = [
    "scripts/generate-term-fetch-targets.mjs",
    "--carrier",
    carrier,
    "--product",
    product,
  ];

  if (imoId) {
    args.push("--imo-id", imoId);
  }

  const output = execFileSync("node", args, {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  return output.trim();
}

function copyToClipboard(text) {
  const result = spawnSync("pbcopy", {
    input: text,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || "pbcopy failed");
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const carrier = String(args.carrier || "").trim();
  const product = String(args.product || "").trim();
  const imoId = args["imo-id"] ? String(args["imo-id"]).trim() : "";

  if (!carrier || !product) {
    printUsage();
    process.exit(1);
  }

  const markdown = fs.readFileSync(TERM_FETCHER_DOC_PATH, "utf8");
  const browserFetcherScript = extractFirstJavascriptBlock(markdown);
  const targetBlock = buildTargetBlock({ carrier, product, imoId });

  const bundle = [
    browserFetcherScript,
    "",
    "// Generated target block",
    targetBlock,
    "",
  ].join("\n");

  if (args.output) {
    const outputPath = path.resolve(REPO_ROOT, String(args.output));
    ensureParentDir(outputPath);
    fs.writeFileSync(outputPath, bundle, "utf8");
    console.log(outputPath);
    return;
  }

  if (args.copy) {
    copyToClipboard(bundle);
    console.log("Copied paste-ready term fetcher bundle to clipboard.");
    return;
  }

  process.stdout.write(bundle);
}

main();
