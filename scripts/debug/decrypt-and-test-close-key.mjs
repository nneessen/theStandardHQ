#!/usr/bin/env node
// One-off debug script: decrypts a Close API key from close_config.api_key_encrypted
// and runs two GETs to probe the org's capabilities:
//   1. GET /api/v1/me/           → tells us which Close user/org the key belongs to + plan info
//   2. GET /api/v1/sequence/     → tells us if the org can even read sequences (plan gating)
//   3. POST /api/v1/sequence/    → (dry-run-ish) minimal payload to replicate the 400 body
//
// USAGE: node scripts/debug/decrypt-and-test-close-key.mjs <iv:ciphertext>
//
// Requires EMAIL_ENCRYPTION_KEY in the .env at repo root (same key the edge function uses).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = join(__dirname, "..", "..", ".env");

function loadEnv() {
  const text = readFileSync(ENV_PATH, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function decrypt(encrypted, hexKey) {
  const [ivHex, ctHex] = encrypted.split(":");
  if (!ivHex || !ctHex) throw new Error("Invalid encrypted format");
  const keyBytes = hexToBytes(hexKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex) },
    key,
    hexToBytes(ctHex),
  );
  return new TextDecoder().decode(plain);
}

function authHeader(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function probe(apiKey) {
  const base = "https://api.close.com/api/v1";
  const hdrs = { Authorization: authHeader(apiKey), Accept: "application/json" };

  console.log("\n── GET /me/ ──");
  const meRes = await fetch(`${base}/me/`, { headers: hdrs });
  console.log("status:", meRes.status);
  const meBody = await meRes.json().catch(() => null);
  console.log(JSON.stringify(meBody, null, 2)?.slice(0, 2000));

  console.log("\n── GET /sequence/?_limit=1 ──");
  const seqRes = await fetch(`${base}/sequence/?_limit=1`, { headers: hdrs });
  console.log("status:", seqRes.status);
  const seqBody = await seqRes.json().catch(() => null);
  console.log(JSON.stringify(seqBody, null, 2)?.slice(0, 2000));

  console.log("\n── POST /sequence/ (minimal payload, 1-step no children) ──");
  const postRes = await fetch(`${base}/sequence/`, {
    method: "POST",
    headers: {
      ...hdrs,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "[debug-probe] delete-me",
      timezone: "America/New_York",
      schedule: {
        ranges: [{ weekday: 1, start: "09:00", end: "17:00" }],
      },
      steps: [],
    }),
  });
  console.log("status:", postRes.status);
  const postBody = await postRes.json().catch(() => null);
  console.log(JSON.stringify(postBody, null, 2)?.slice(0, 2000));

  if (postRes.ok && postBody?.id) {
    console.log("\nCleaning up debug sequence…");
    await fetch(`${base}/sequence/${postBody.id}/`, {
      method: "DELETE",
      headers: hdrs,
    });
  }
}

async function main() {
  const encrypted = process.argv[2];
  if (!encrypted) {
    console.error("Usage: node decrypt-and-test-close-key.mjs <iv:ciphertext>");
    process.exit(1);
  }
  const env = loadEnv();
  const hexKey = env.EMAIL_ENCRYPTION_KEY;
  if (!hexKey) throw new Error("EMAIL_ENCRYPTION_KEY missing from .env");

  const apiKey = await decrypt(encrypted, hexKey);
  console.log("Decrypted key prefix:", apiKey.slice(0, 10) + "…");
  await probe(apiKey);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
