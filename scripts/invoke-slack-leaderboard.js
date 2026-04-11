// scripts/invoke-slack-leaderboard.js
// Manually triggers refresh of all Slack leaderboards for today
// Also auto-completes any pending first sales
//
// Usage:
//   npm run slack:leaderboard

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Slack leaderboards only exist in production — local Supabase has no real
// workspace integrations. Prefer REMOTE_* env vars; fall back to VITE_* only
// if a remote target isn't configured (e.g. running from a prod CI env).
const SUPABASE_URL =
  process.env.REMOTE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log("📊 Slack Leaderboard Manager\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "❌ Missing REMOTE_SUPABASE_URL/REMOTE_SUPABASE_SERVICE_ROLE_KEY (or VITE_ fallback) in .env",
    );
    process.exit(1);
  }

  const isLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
  console.log(`Target: ${SUPABASE_URL}${isLocal ? " (LOCAL)" : " (REMOTE)"}`);
  if (isLocal) {
    console.log(
      "⚠️  Pointing at local Supabase — there is almost certainly no real",
    );
    console.log(
      "   Slack integration data here. Set REMOTE_SUPABASE_URL in .env to",
    );
    console.log("   debug production Slack posts.\n");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const functionUrl = `${SUPABASE_URL}/functions/v1/slack-policy-notification`;

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
      slack_integrations!inner (
        team_name,
        policy_channel_name
      )
    `)
    .eq("log_date", today)
    .not("pending_policy_data", "is", null);

  if (pendingError) {
    console.error("❌ Error checking pending:", pendingError.message);
  } else if (pendingLogs && pendingLogs.length > 0) {
    console.log(`Found ${pendingLogs.length} pending first sale(s) - auto-completing...\n`);

    // Group by first_sale_group_id to avoid duplicate processing
    const processedGroups = new Set();

    for (const log of pendingLogs) {
      const groupId = log.first_sale_group_id || log.id;
      const channelName = log.slack_integrations?.policy_channel_name || "unknown";
      const teamName = log.slack_integrations?.team_name || "Unknown";

      if (processedGroups.has(groupId)) {
        continue;
      }
      processedGroups.add(groupId);

      console.log(`   Completing: ${teamName} #${channelName}...`);

      try {
        // Use batch completion if there's a group, otherwise single
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
          console.log(`   ✅ Posted to Slack`);
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
      slack_integrations!inner (
        team_name,
        policy_channel_name
      )
    `)
    .eq("log_date", today)
    .not("leaderboard_message_ts", "is", null);

  if (logsError) {
    console.error("❌ Error fetching logs:", logsError.message);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log("   No posted leaderboards found for today.\n");
  } else {
    console.log(`   Found ${logs.length} leaderboard(s) to refresh\n`);

    for (const log of logs) {
      const channelName = log.slack_integrations?.policy_channel_name || log.channel_id;
      const teamName = log.slack_integrations?.team_name || "Unknown";

      console.log(`   Refreshing: ${teamName} #${channelName}...`);

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
