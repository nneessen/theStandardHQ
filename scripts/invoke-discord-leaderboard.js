// scripts/invoke-discord-leaderboard.js
// Manually triggers refresh of all Discord leaderboards for today
// Also auto-completes any pending first sales
//
// Usage:
//   npm run discord:leaderboard

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Use remote (production) Supabase since the edge function runs there
const SUPABASE_URL = process.env.REMOTE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log("📊 Discord Leaderboard Manager\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const functionUrl = `${SUPABASE_URL}/functions/v1/discord-policy-notification`;

  // Get today's date in ET (same format the function uses)
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  console.log(`Date: ${today}\n`);

  // =========================================================================
  // STEP 1: Check for and complete any pending first sales
  // =========================================================================
  console.log("🔍 Checking for pending first sales...\n");

  const { data: pendingLogs, error: pendingError } = await supabase
    .from("daily_sales_logs")
    .select(`
      id,
      first_sale_group_id,
      discord_integrations!inner (
        guild_id
      )
    `)
    .eq("log_date", today)
    .not("pending_policy_data", "is", null)
    .not("discord_integration_id", "is", null);

  if (pendingError) {
    console.error("❌ Error checking pending:", pendingError.message);
  } else if (pendingLogs && pendingLogs.length > 0) {
    console.log(`Found ${pendingLogs.length} pending first sale(s) - auto-completing...\n`);

    const processedGroups = new Set();

    for (const log of pendingLogs) {
      const groupId = log.first_sale_group_id || log.id;

      if (processedGroups.has(groupId)) {
        continue;
      }
      processedGroups.add(groupId);

      console.log(`   Completing: ${groupId}...`);

      try {
        const action = log.first_sale_group_id
          ? "complete-first-sale-batch"
          : "complete-first-sale";

        const payload = log.first_sale_group_id
          ? { action, firstSaleGroupId: log.first_sale_group_id }
          : { action, logId: log.id };

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.ok) {
          console.log(`   ✅ Posted to Discord`);
        } else {
          console.log(`   ❌ Failed: ${data.error || JSON.stringify(data)}`);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
    }
    console.log("");
  } else {
    console.log("   No pending first sales found.\n");
  }

  // =========================================================================
  // STEP 2: Refresh existing leaderboards
  // =========================================================================
  console.log("🔄 Refreshing existing leaderboards...\n");

  const { data: logs, error: logsError } = await supabase
    .from("daily_sales_logs")
    .select(`
      id,
      channel_id,
      title,
      leaderboard_message_ts,
      discord_integrations!inner (
        guild_id
      )
    `)
    .eq("log_date", today)
    .not("leaderboard_message_ts", "is", null)
    .not("discord_integration_id", "is", null);

  if (logsError) {
    console.error("❌ Error fetching logs:", logsError.message);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log("   No posted leaderboards found for today.\n");
  } else {
    console.log(`   Found ${logs.length} leaderboard(s) to refresh\n`);

    for (const log of logs) {
      console.log(`   Refreshing: ${log.channel_id} (msg: ${log.leaderboard_message_ts})...`);

      try {
        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            action: "update-leaderboard",
            logId: log.id,
          }),
        });

        const data = await response.json();

        if (data.ok && data.updated) {
          console.log(`   ✅ Updated`);
        } else {
          console.log(`   ❌ Failed: ${data.error || JSON.stringify(data)}`);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
    }
  }

  console.log("\n✅ Done!");
}

main();
