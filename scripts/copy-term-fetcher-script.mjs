#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "scripts", "termFetcher.md");

function extractFirstJavascriptBlock(markdown) {
  const match = markdown.match(/```javascript\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error(`No javascript code block found in ${DOC_PATH}`);
  }
  return match[1];
}

function parseArgs(argv) {
  return {
    copy: argv.includes("--copy"),
  };
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const markdown = fs.readFileSync(DOC_PATH, "utf8");
  const script = extractFirstJavascriptBlock(markdown);

  if (args.copy) {
    copyToClipboard(script);
    console.log("Copied term fetcher browser script to clipboard.");
    return;
  }

  process.stdout.write(script);
}

main();
