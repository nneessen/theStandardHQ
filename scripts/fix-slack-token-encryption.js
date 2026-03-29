// scripts/fix-slack-token-encryption.js
// Re-encrypts a Slack bot token with the current EMAIL_ENCRYPTION_KEY
// and updates the slack_integrations row in the remote DB.
//
// Usage:
//   node scripts/fix-slack-token-encryption.js <bot-token> [integration-id]
//
// Get your bot token from: https://api.slack.com/apps → Your App → OAuth & Permissions → Bot User OAuth Token
// Default integration: 40140fee (💎 SELF MADE 💎)

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY;
const SUPABASE_URL = process.env.REMOTE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_INTEGRATION_ID = "40140fee-9115-44ad-9574-c4769e097200"; // 💎 SELF MADE 💎

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function encrypt(plaintext) {
  const keyBytes = hexToBytes(ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

async function main() {
  const botToken = process.argv[2];
  const integrationId = process.argv[3] || DEFAULT_INTEGRATION_ID;

  if (!botToken) {
    console.error("Usage: node scripts/fix-slack-token-encryption.js <xoxb-bot-token> [integration-id]");
    console.error("\nGet your bot token from:");
    console.error("  https://api.slack.com/apps → Your App → OAuth & Permissions → Bot User OAuth Token");
    process.exit(1);
  }

  if (!botToken.startsWith("xoxb-")) {
    console.error("❌ Token must start with 'xoxb-' (Bot User OAuth Token)");
    process.exit(1);
  }

  if (!ENCRYPTION_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing env vars: EMAIL_ENCRYPTION_KEY, REMOTE_SUPABASE_URL, or REMOTE_SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log(`🔐 Encrypting bot token for integration ${integrationId}...`);

  const encryptedToken = await encrypt(botToken);

  // Verify we can decrypt it
  const [ivHex, ciphertextHex] = encryptedToken.split(":");
  const keyBytes = hexToBytes(ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex) },
    key,
    hexToBytes(ciphertextHex),
  );
  const decryptedText = new TextDecoder().decode(decrypted);
  if (decryptedText !== botToken) {
    console.error("❌ Encrypt/decrypt round-trip failed!");
    process.exit(1);
  }
  console.log("✅ Encryption verified (round-trip OK)");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: existing, error: fetchErr } = await supabase
    .from("slack_integrations")
    .select("id, team_name, connection_status")
    .eq("id", integrationId)
    .single();

  if (fetchErr || !existing) {
    console.error(`❌ Integration ${integrationId} not found:`, fetchErr?.message);
    process.exit(1);
  }

  console.log(`📝 Updating "${existing.team_name}" (${existing.id})...`);

  const { error: updateErr } = await supabase
    .from("slack_integrations")
    .update({
      bot_token_encrypted: encryptedToken,
      access_token_encrypted: encryptedToken,
      connection_status: "connected",
      last_error: null,
      last_connected_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  if (updateErr) {
    console.error("❌ Update failed:", updateErr.message);
    process.exit(1);
  }

  console.log(`✅ Token updated for "${existing.team_name}"`);
  console.log("\nTest it:");
  console.log("  npm run slack:ip-leaderboard");
}

main();
