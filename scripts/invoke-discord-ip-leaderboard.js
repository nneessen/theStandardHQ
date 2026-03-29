// scripts/invoke-discord-ip-leaderboard.js
// Manually triggers IP (Issued Premium) + Submits leaderboard report to Discord
//
// Usage:
//   npm run discord:ip-leaderboard
//   node scripts/invoke-discord-ip-leaderboard.js [--test]  (posts to #test channel instead)

import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.REMOTE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY;
const IMO_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const TEST_CHANNEL = "1486027149738508308";

async function main() {
  const isTest = process.argv.includes("--test");

  console.log("📊 IP & Submits Leaderboard - Weekly Report (Discord)\n");
  console.log("IP (Issued Premium) = Approved & placed policies by effective_date");
  console.log("Submits = All submitted policies by submit_date\n");

  if (isTest) {
    console.log("🧪 TEST MODE: Posting to #test channel\n");
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing REMOTE_SUPABASE_URL or REMOTE_SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const functionUrl = `${SUPABASE_URL}/functions/v1/discord-ip-leaderboard`;

  console.log("📤 Posting IP & submits report to Discord...\n");

  try {
    const body = { imoId: IMO_ID };
    if (isTest) {
      body.testChannelId = TEST_CHANNEL;
    }

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.ok) {
      if (data.skipped) {
        console.log(`⏭️  Skipped: ${data.reason}`);
      } else {
        console.log(`✅ Posted! Week: ${data.weekRange}`);
        for (const result of data.results || []) {
          console.log(`   ${result.ok ? "✅" : "❌"} #${result.channel}${result.error ? `: ${result.error}` : ""}`);
        }
      }
    } else {
      console.log(`❌ Failed: ${data.error || JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}${err.cause ? ` (${err.cause.message})` : ""}`);
  }
}

main();
