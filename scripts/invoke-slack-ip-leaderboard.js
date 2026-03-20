// scripts/invoke-slack-ip-leaderboard.js
// Manually triggers IP (Issued Premium) + Submits leaderboard report to Slack
//
// IP (Issued Premium) = Approved & placed policies by effective_date
// Submits = All submitted policies (active/pending/approved) by submit_date
//
// Usage:
//   npm run slack:ip-leaderboard

import dotenv from "dotenv";

dotenv.config();

// Always use remote/production Supabase — edge functions are deployed there
const SUPABASE_URL = process.env.REMOTE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY;
const IMO_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"; // Founders Financial Group

async function main() {
  console.log("📊 IP & Submits Leaderboard - Weekly Report\n");
  console.log("IP (Issued Premium) = Approved & placed policies by effective_date");
  console.log("Submits = All submitted policies by submit_date\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing REMOTE_SUPABASE_URL or REMOTE_SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const functionUrl = `${SUPABASE_URL}/functions/v1/slack-ip-leaderboard`;

  console.log("📤 Posting IP & submits report to Slack...\n");

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        imoId: IMO_ID,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      if (data.skipped) {
        console.log(`⏭️  Skipped: ${data.reason}`);
      } else {
        console.log(`✅ Posted to #${data.results[0].channel}`);
        if (data.results[0].weekRange) {
          console.log(`📅 Week Range: ${data.results[0].weekRange}`);
        }
        if (Array.isArray(data.results[0].topWTD)) {
          console.log("🏆 Top WTD preview:");
          for (const row of data.results[0].topWTD) {
            console.log(`   - ${row.name}: $${row.ip} IP (${row.policies} issued) · ${row.submits} submitted ($${row.submitAP} AP)`);
          }
        }
        if (Array.isArray(data.results[0].topMTD)) {
          console.log("📈 Top MTD preview:");
          for (const row of data.results[0].topMTD) {
            console.log(`   - ${row.name}: $${row.ip} IP (${row.policies} issued) · ${row.submits} submitted ($${row.submitAP} AP)`);
          }
        }
        if (Array.isArray(data.results[0].topAgencies)) {
          console.log("🏢 Top Agencies preview:");
          for (const row of data.results[0].topAgencies) {
            console.log(`   - ${row.name}: WTD $${row.wtd} / ${row.wtdSubmits} apps · MTD $${row.mtd} / ${row.mtdSubmits} apps`);
          }
        }
      }
    } else {
      console.log(`❌ Failed: ${data.error || JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}${err.cause ? ` (${err.cause.message})` : ""}`);
  }

  console.log("\n✅ Done!");
}

main();
