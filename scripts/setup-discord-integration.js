// scripts/setup-discord-integration.js
// Sets up the Discord integration: encrypts bot token, creates integration record, configures channels.
//
// Usage: node scripts/setup-discord-integration.js

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY;
const SUPABASE_URL = process.env.REMOTE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const GUILD_ID = "1485352568585719808"; // Self Made Financial
const IMO_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"; // Founders Financial Group

// Channel configuration
const CHANNELS = {
  leaderboard_channel_id: "1485356029934829671",
  leaderboard_channel_name: "daily-scoreboard",
  weekly_leaderboard_channel_id: "1485356071814959354",
  weekly_leaderboard_channel_name: "weekly-leaderboard",
  agency_leaderboard_channel_id: "1485356116992069772",
  agency_leaderboard_channel_name: "agency-leaderboard",
};

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
    "raw", keyBytes, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

async function main() {
  if (!ENCRYPTION_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BOT_TOKEN) {
    console.error("❌ Missing env vars: EMAIL_ENCRYPTION_KEY, REMOTE_SUPABASE_URL, REMOTE_SUPABASE_SERVICE_ROLE_KEY, or DISCORD_BOT_TOKEN");
    process.exit(1);
  }

  // Verify bot token works
  console.log("🔍 Verifying bot token...");
  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
  if (!meRes.ok) {
    console.error("❌ Bot token invalid:", await meRes.text());
    process.exit(1);
  }
  const me = await meRes.json();
  console.log(`✅ Bot: ${me.username}#${me.discriminator} (ID: ${me.id})`);

  // Verify bot can see the guild
  console.log("🔍 Verifying guild access...");
  const guildRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
  if (!guildRes.ok) {
    console.error("❌ Bot cannot access guild:", await guildRes.text());
    process.exit(1);
  }
  const guild = await guildRes.json();
  console.log(`✅ Guild: ${guild.name} (ID: ${guild.id})`);

  // Encrypt bot token
  console.log("🔐 Encrypting bot token...");
  const encryptedToken = await encrypt(BOT_TOKEN);
  console.log("✅ Token encrypted");

  // Upsert integration
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check for existing
  const { data: existing } = await supabase
    .from("discord_integrations")
    .select("id")
    .eq("guild_id", GUILD_ID)
    .maybeSingle();

  const integrationData = {
    imo_id: IMO_ID,
    guild_id: GUILD_ID,
    guild_name: guild.name,
    bot_token_encrypted: encryptedToken,
    bot_username: me.username,
    is_active: true,
    connection_status: "connected",
    last_connected_at: new Date().toISOString(),
    ...CHANNELS,
  };

  let integrationId;
  if (existing) {
    const { error } = await supabase
      .from("discord_integrations")
      .update(integrationData)
      .eq("id", existing.id);
    if (error) { console.error("❌ Update failed:", error.message); process.exit(1); }
    integrationId = existing.id;
    console.log(`✅ Updated existing integration ${integrationId}`);
  } else {
    const { data, error } = await supabase
      .from("discord_integrations")
      .insert(integrationData)
      .select("id")
      .single();
    if (error) { console.error("❌ Insert failed:", error.message); process.exit(1); }
    integrationId = data.id;
    console.log(`✅ Created new integration ${integrationId}`);
  }

  // Send test message
  console.log("\n📤 Sending test message to #test...");
  const testRes = await fetch("https://discord.com/api/v10/channels/1486027149738508308/messages", {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [{
        title: "✅ The Standard HQ Bot Connected",
        description: `Integration ID: \`${integrationId}\`\nGuild: ${guild.name}\nChannels configured: daily-scoreboard, weekly-leaderboard, agency-leaderboard`,
        color: 0x22c55e,
      }],
    }),
  });

  if (testRes.ok) {
    console.log("✅ Test message sent to #test channel!");
  } else {
    console.log("⚠️  Test message failed:", await testRes.text());
  }

  console.log("\n🎉 Discord integration setup complete!");
  console.log("\nNext: Deploy the edge function and test:");
  console.log("  npx supabase functions deploy discord-ip-leaderboard --no-verify-jwt");
  console.log("  node scripts/invoke-discord-ip-leaderboard.js");
}

main();
