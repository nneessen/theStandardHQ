// One-shot diagnostic: decrypt Self Made Slack bot token and call Slack auth.test
// Usage: node scripts/test-slack-token.mjs
import pg from "pg";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const INTEGRATION_ID = "40140fee-9115-44ad-9574-c4769e097200";
const ENCRYPTION_KEY_HEX = process.env.EMAIL_ENCRYPTION_KEY;
const DB_URL = process.env.REMOTE_DATABASE_URL;

if (!ENCRYPTION_KEY_HEX) {
  console.error("Missing EMAIL_ENCRYPTION_KEY in .env");
  process.exit(1);
}
if (!DB_URL) {
  console.error("Missing REMOTE_DATABASE_URL in .env");
  process.exit(1);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Same algorithm as supabase/functions/_shared/encryption.ts
// Input format: "iv:ciphertext" (both hex). Uses AES-256-GCM.
function decrypt(encrypted) {
  const [ivHex, ctHex] = encrypted.split(":");
  if (!ivHex || !ctHex) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(hexToBytes(ivHex));
  const ctBytes = Buffer.from(hexToBytes(ctHex));
  // WebCrypto AES-GCM concatenates ciphertext + 16-byte tag
  const tag = ctBytes.subarray(ctBytes.length - 16);
  const ct = ctBytes.subarray(0, ctBytes.length - 16);
  const key = Buffer.from(hexToBytes(ENCRYPTION_KEY_HEX));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

const { rows } = await client.query(
  "SELECT id, team_name, bot_token_encrypted, policy_channel_id, policy_channel_name FROM slack_integrations WHERE id = $1",
  [INTEGRATION_ID],
);
await client.end();

if (rows.length === 0) {
  console.error("Integration not found");
  process.exit(1);
}

const row = rows[0];
console.log("Integration:", row.team_name, "channel:", row.policy_channel_name);

let botToken;
try {
  botToken = decrypt(row.bot_token_encrypted);
  console.log(
    "Decrypt OK. Token prefix:",
    botToken.slice(0, 12) + "...",
    "len:",
    botToken.length,
  );
} catch (err) {
  console.error("DECRYPT FAILED:", err.message);
  process.exit(1);
}

// Slack auth.test
const authRes = await fetch("https://slack.com/api/auth.test", {
  headers: { Authorization: `Bearer ${botToken}` },
});
const authJson = await authRes.json();
console.log("\nSlack auth.test response:");
console.log(JSON.stringify(authJson, null, 2));

if (!authJson.ok) {
  console.error(
    "\nTOKEN IS INVALID:",
    authJson.error,
    authJson.needed ? `(needed: ${authJson.needed})` : "",
  );
  process.exit(1);
}

// Verify bot is in the target channel (read-only)
const infoRes = await fetch(
  `https://slack.com/api/conversations.info?channel=${row.policy_channel_id}`,
  { headers: { Authorization: `Bearer ${botToken}` } },
);
const infoJson = await infoRes.json();
console.log("\nconversations.info for stored channel:");
console.log(
  JSON.stringify(
    {
      ok: infoJson.ok,
      id: infoJson.channel?.id,
      name: infoJson.channel?.name,
      is_member: infoJson.channel?.is_member,
      is_private: infoJson.channel?.is_private,
      is_archived: infoJson.channel?.is_archived,
    },
    null,
    2,
  ),
);

// Try to have the bot join the channel itself
// conversations.join works if: public channel + channels:join scope
const joinRes = await fetch("https://slack.com/api/conversations.join", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${botToken}`,
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({ channel: row.policy_channel_id }),
});
const joinJson = await joinRes.json();
console.log("\nconversations.join response:");
console.log(JSON.stringify(joinJson, null, 2));

if (joinJson.ok) {
  // Verify membership after join
  const verifyRes = await fetch(
    `https://slack.com/api/conversations.info?channel=${row.policy_channel_id}`,
    { headers: { Authorization: `Bearer ${botToken}` } },
  );
  const verifyJson = await verifyRes.json();
  console.log("\nPost-join is_member:", verifyJson.channel?.is_member);
}
