// supabase/functions/slack-policy-notification/index.ts
// Posts simplified policy notifications and updates daily leaderboard in Slack

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";

interface PolicyNotificationPayload {
  action?:
    | "post-policy"
    | "update-leaderboard"
    | "complete-first-sale"
    | "complete-first-sale-batch";
  policyId?: string;
  policyNumber?: string;
  carrierId?: string;
  productId?: string;
  agentId?: string;
  clientName?: string;
  annualPremium?: number;
  effectiveDate?: string;
  submitDate?: string; // For backdated policy filtering (defense in depth)
  status?: string;
  imoId?: string;
  agencyId?: string;
  // For update-leaderboard and complete-first-sale actions
  logId?: string;
  // For complete-first-sale-batch action
  firstSaleGroupId?: string;
  title?: string;
}

interface DailyProductionEntry {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  slack_member_id: string | null;
  total_annual_premium: number;
  policy_count: number;
}

interface LeaderboardEntryWithPeriods {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  slack_member_id: string | null;
  today_ap: number;
  today_policies: number;
  wtd_ap: number;
  wtd_policies: number;
  mtd_ap: number;
  mtd_policies: number;
}

interface AgencySubmitTotals {
  agency_id: string;
  agency_name: string;
  wtd_ap: number;
  wtd_policies: number;
  mtd_ap: number;
  mtd_policies: number;
}

interface ImoSubmitTotals {
  wtd_ap: number;
  wtd_policies: number;
  mtd_ap: number;
  mtd_policies: number;
}

/**
 * Get today's date in US Eastern timezone (YYYY-MM-DD format)
 * This ensures consistent date handling for US business operations
 */
function getTodayDateET(): string {
  const now = new Date();
  // Format in Eastern Time
  const etDate = now.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  return etDate; // Returns YYYY-MM-DD format
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date - compact (e.g., "12/26")
 */
function formatDateCompact(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format product type enum to readable name
 * e.g., "whole_life" -> "Whole Life"
 */
function formatProductType(productType: string): string {
  if (!productType) return "Life";
  return productType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get rank emoji for leaderboard
 */
function getRankDisplay(rank: number): string {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `${rank}.`;
  }
}

/**
 * Sanitize user-provided title for Slack
 * - Removes Slack special mention patterns (<!channel>, <!here>, <!everyone>)
 * - Strips excessive whitespace
 * - Limits length to prevent display issues
 */
function sanitizeSlackTitle(title: string): string {
  const MAX_TITLE_LENGTH = 100;

  return (
    title
      // Remove Slack special mentions
      .replace(/<!(?:channel|here|everyone|subteam\^[A-Z0-9]+)>/gi, "")
      // Remove user mentions that could be injected
      .replace(/<@[A-Z0-9]+>/gi, "")
      // Remove link formatting that could be malicious
      .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
      // Limit length
      .slice(0, MAX_TITLE_LENGTH)
  );
}

/**
 * Get default title based on day of week (Eastern timezone)
 */
function getDefaultDailyTitle(): string {
  const today = new Date();
  // Get day name in Eastern Time
  const dayName = today.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });

  const titles: Record<string, string> = {
    Monday: "Monday Sales",
    Tuesday: "Tuesday Sales",
    Wednesday: "Wednesday Sales",
    Thursday: "Thursday Sales",
    Friday: "Friday Sales",
    Saturday: "Saturday Sales",
    Sunday: "Sunday Sales",
  };

  return titles[dayName] || `${dayName} Sales`;
}

/**
 * Slack user info returned from lookup
 */
interface SlackUserInfo {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Look up Slack member by email - returns full user info for posting as user
 */
async function lookupSlackMemberByEmail(
  botToken: string,
  email: string,
): Promise<SlackUserInfo | null> {
  try {
    const response = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${botToken}`,
        },
      },
    );

    const data = await response.json();
    if (data.ok && data.user) {
      return {
        id: data.user.id,
        displayName:
          data.user.profile?.display_name ||
          data.user.profile?.real_name ||
          data.user.real_name ||
          email.split("@")[0],
        avatarUrl:
          data.user.profile?.image_72 || data.user.profile?.image_48 || null,
      };
    }
    return null;
  } catch (err) {
    console.error("[slack-policy-notification] Error looking up user:", err);
    return null;
  }
}

/**
 * Build the simple policy notification text
 * Format: $1,200 Carrier Product Eff Date: 12/26
 * Note: The agent's name/avatar is shown via postSlackMessage username/icon_url
 */
function buildSimplePolicyText(
  annualPremium: number,
  carrierName: string,
  productName: string,
  effectiveDate: string,
): string {
  const ap = formatCurrency(annualPremium);
  const date = formatDateCompact(effectiveDate);

  return `${ap} ${carrierName} ${productName} Eff Date: ${date}`;
}

/**
 * Post a message to Slack and return the response
 * Optionally post as a specific user (shows their name/avatar)
 */
async function postSlackMessage(
  botToken: string,
  channelId: string,
  text: string,
  options?: {
    username?: string;
    icon_url?: string;
    blocks?: unknown[];
  },
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    const payload: Record<string, unknown> = { channel: channelId, text };

    // If username/icon provided, post as that user (still shows APP label but uses their name/avatar)
    if (options?.username) {
      payload.username = options.username;
    }
    if (options?.icon_url) {
      payload.icon_url = options.icon_url;
    }
    // Add blocks for rich formatting
    if (options?.blocks) {
      payload.blocks = options.blocks;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (err) {
    console.error("[slack-policy-notification] Failed to post message:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

/**
 * Update an existing Slack message
 */
async function updateSlackMessage(
  botToken: string,
  channelId: string,
  messageTs: string,
  text: string,
  blocks?: unknown[],
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      channel: channelId,
      ts: messageTs,
      text,
    };
    if (blocks) {
      payload.blocks = blocks;
    }
    const response = await fetch("https://slack.com/api/chat.update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (err) {
    console.error("[slack-policy-notification] Failed to update message:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

// ============================================================================
// MILESTONE CELEBRATION SYSTEM
// ============================================================================

// Milestone thresholds (prefixed as they document the threshold values used in FLAVOR_TEXT keys)
const _POLICY_MILESTONES = [2, 3, 5] as const;
const _AP_MILESTONES = [2500, 5000, 7500, 10000] as const;

// Flavor text pools - randomized for variety
const FLAVOR_TEXT = {
  // Policy milestones
  policy_2: [
    "starting to cook 🍳",
    "the warmup is over",
    "they're locked in now",
  ],
  policy_3: [
    "three for three. no misses.",
    "hat trick secured 🎩",
    "rule of three: they write, they close, they repeat",
  ],
  policy_5: [
    "absolutely unhinged performance",
    "someone check on the competition 💀",
    "main character energy activated",
  ],
  // AP milestones
  ap_2500: ["bag secured 💼", "stacking starts here"],
  ap_5000: ["money printer go brrrr", "halfway to legendary"],
  ap_7500: ["big dawg behavior", "closing in on greatness"],
  ap_10000: [
    "generational wealth mindset 👑",
    "different breed. built different. 💎",
  ],
  // Dual milestone
  dual: [
    "that's called inevitable. 💎",
    "can't be stopped. won't be stopped.",
    "elite mentality, elite results.",
  ],
};

/**
 * Get random flavor text for a milestone
 */
function getFlavorText(type: "policy" | "ap" | "dual", value?: number): string {
  let pool: string[];
  if (type === "dual") {
    pool = FLAVOR_TEXT.dual;
  } else if (type === "policy") {
    pool =
      FLAVOR_TEXT[`policy_${value}` as keyof typeof FLAVOR_TEXT] ||
      FLAVOR_TEXT.policy_2;
  } else {
    pool =
      FLAVOR_TEXT[`ap_${value}` as keyof typeof FLAVOR_TEXT] ||
      FLAVOR_TEXT.ap_2500;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Build celebration blocks for Slack
 */
function buildCelebrationBlocks(
  agentName: string,
  slackMemberId: string | null,
  policyMilestone: number | null,
  apMilestone: number | null,
): { text: string; blocks: unknown[] } {
  const mention = slackMemberId ? `<@${slackMemberId}>` : agentName;
  const isDual = policyMilestone && apMilestone;

  let emoji: string;
  let title: string;
  let achievement: string;
  let flavor: string;
  let _color: string;

  if (isDual) {
    // Combined mega-celebration
    emoji = "🔥👑";
    title = "DOUBLE THREAT";
    const policyLabel =
      policyMilestone === 5
        ? "5 policies"
        : policyMilestone === 3
          ? "their 3rd policy"
          : "policy #2";
    const apLabel = formatCurrency(apMilestone);
    achievement = `${mention} just hit ${policyLabel} AND crossed ${apLabel} AP`;
    flavor =
      policyMilestone === 3
        ? `trifecta + big money? ${getFlavorText("dual")}`
        : getFlavorText("dual");
    _color = "#FFD700"; // Gold
  } else if (policyMilestone) {
    // Policy milestone
    switch (policyMilestone) {
      case 2:
        emoji = "🔥";
        title = "HEATING UP";
        achievement = `${mention} just locked in policy #2 today`;
        flavor = getFlavorText("policy", 2);
        _color = "#FF6B35";
        break;
      case 3:
        emoji = "🎯";
        title = "TRIFECTA";
        achievement = `${mention} just hit their 3rd policy today`;
        flavor = getFlavorText("policy", 3);
        _color = "#4ECDC4";
        break;
      case 5:
        emoji = "😈";
        title = "CERTIFIED DEMON";
        achievement = `${mention} locked in 5 policies today`;
        flavor = getFlavorText("policy", 5);
        _color = "#9B59B6";
        break;
      default:
        emoji = "🔥";
        title = "ON FIRE";
        achievement = `${mention} is crushing it`;
        flavor = "let's go!";
        _color = "#FF6B35";
    }
  } else if (apMilestone) {
    // AP milestone
    const apFormatted = formatCurrency(apMilestone);
    switch (apMilestone) {
      case 2500:
        emoji = "💪";
        title = "$2.5K DAY";
        achievement = `${mention} crossed $2,500 AP today`;
        flavor = getFlavorText("ap", 2500);
        _color = "#CD7F32"; // Bronze
        break;
      case 5000:
        emoji = "🚀";
        title = "$5K DAY";
        achievement = `${mention} crossed $5,000 AP today`;
        flavor = getFlavorText("ap", 5000);
        _color = "#C0C0C0"; // Silver
        break;
      case 7500:
        emoji = "💰";
        title = "$7.5K DAY";
        achievement = `${mention} crossed $7,500 AP today`;
        flavor = getFlavorText("ap", 7500);
        _color = "#FFD700"; // Gold
        break;
      case 10000:
        emoji = "👑";
        title = "$10K CLUB";
        achievement = `${mention} crossed $10,000 AP today`;
        flavor = getFlavorText("ap", 10000);
        _color = "#E5E4E2"; // Platinum
        break;
      default:
        emoji = "💰";
        title = `${apFormatted} DAY`;
        achievement = `${mention} crossed ${apFormatted} AP`;
        flavor = "big moves!";
        _color = "#FFD700";
    }
  } else {
    // Fallback (shouldn't happen)
    emoji = "🎉";
    title = "CELEBRATION";
    achievement = `${mention} is doing great!`;
    flavor = "keep it up!";
    _color = "#3498DB";
  }

  const text = `${emoji} ${title} ${emoji}\n${achievement}\n${flavor}`;

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${title}* ${emoji}\n━━━━━━━━━━━━━━━━━━━━━━\n${achievement}\n\n_${flavor}_`,
      },
    },
  ];

  return { text, blocks };
}

/**
 * Check and post milestone celebration
 * Called after leaderboard is updated
 */
async function checkAndPostCelebration(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  channelId: string,
  logId: string,
  agentId: string,
  agentName: string,
  slackMemberId: string | null,
  imoId: string,
  agencyId: string | null,
): Promise<{
  celebrated: boolean;
  policyMilestone?: number;
  apMilestone?: number;
  smsSent?: boolean;
}> {
  try {
    // Get agent's current daily stats
    const { data: statsData, error: statsError } = await supabase.rpc(
      "get_agent_daily_stats",
      {
        p_user_id: agentId,
        p_imo_id: imoId,
      },
    );

    if (statsError || !statsData || statsData.length === 0) {
      console.log(
        "[slack-policy-notification] Could not get agent stats:",
        statsError,
      );
      return { celebrated: false };
    }

    const { policy_count, total_ap } = statsData[0];

    // Check and update milestones
    const { data: milestoneData, error: milestoneError } = await supabase.rpc(
      "check_and_update_milestones",
      {
        p_log_id: logId,
        p_policy_count: policy_count,
        p_total_ap: total_ap,
      },
    );

    if (milestoneError || !milestoneData || milestoneData.length === 0) {
      console.log(
        "[slack-policy-notification] Could not check milestones:",
        milestoneError,
      );
      return { celebrated: false };
    }

    const { new_policy_milestone, new_ap_milestone, should_send_sms } =
      milestoneData[0];

    // If no new milestone, return early
    if (!new_policy_milestone && !new_ap_milestone) {
      console.log("[slack-policy-notification] No new milestones to celebrate");
      return { celebrated: false };
    }

    console.log(
      `[slack-policy-notification] New milestone! Policy: ${new_policy_milestone}, AP: ${new_ap_milestone}, SMS: ${should_send_sms}`,
    );

    // Build and post celebration message
    const { text, blocks } = buildCelebrationBlocks(
      agentName,
      slackMemberId,
      new_policy_milestone || null,
      new_ap_milestone || null,
    );

    const celebrationResult = await postSlackMessage(
      botToken,
      channelId,
      text,
      {
        blocks,
      },
    );

    if (!celebrationResult.ok) {
      console.error(
        "[slack-policy-notification] Failed to post celebration:",
        celebrationResult.error,
      );
    } else {
      console.log(
        "[slack-policy-notification] Celebration posted successfully!",
      );
    }

    // Send SMS if mega milestone (5 policies or $10k AP)
    let smsSent = false;
    if (should_send_sms) {
      smsSent = await sendMegaMilestoneSMS(
        supabase,
        agentId,
        agentName,
        imoId,
        agencyId,
        new_policy_milestone === 5,
        new_ap_milestone === 10000,
      );
    }

    return {
      celebrated: true,
      policyMilestone: new_policy_milestone || undefined,
      apMilestone: new_ap_milestone || undefined,
      smsSent,
    };
  } catch (err) {
    console.error(
      "[slack-policy-notification] Error in checkAndPostCelebration:",
      err,
    );
    return { celebrated: false };
  }
}

/**
 * Send SMS blast for mega milestones (5 policies or $10k AP)
 */
async function sendMegaMilestoneSMS(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  agentName: string,
  imoId: string,
  agencyId: string | null,
  isCertifiedDemon: boolean,
  is10kClub: boolean,
): Promise<boolean> {
  try {
    console.log(
      `[slack-policy-notification] Sending mega milestone SMS for ${agentName}`,
    );

    // Get users to notify
    const { data: users, error: usersError } = await supabase.rpc(
      "get_agency_users_for_sms",
      {
        p_agency_id: agencyId,
        p_imo_id: imoId,
        p_exclude_user_id: agentId,
      },
    );

    if (usersError || !users || users.length === 0) {
      console.log(
        "[slack-policy-notification] No users to SMS or error:",
        usersError,
      );
      return false;
    }

    // Build SMS message
    let message: string;
    if (isCertifiedDemon && is10kClub) {
      message = `🚨 ${agentName} is UNREAL - 5 policies AND $10K AP! Flood the Slack channel! 🐐`;
    } else if (isCertifiedDemon) {
      message = `🔥 ${agentName} just hit 5 POLICIES today! Go show some love in Slack! 😈`;
    } else {
      message = `👑 ${agentName} crossed $10K AP today! Drop some 🔥 in Slack!`;
    }

    // Get the edge function URL for send-sms
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[slack-policy-notification] Missing Supabase env vars");
      return false;
    }

    let successCount = 0;
    const smsUrl = `${SUPABASE_URL}/functions/v1/send-sms`;

    // Send SMS to each user (in parallel with a limit)
    const sendPromises = users
      .slice(0, 50)
      .map(async (user: { phone: string; first_name: string }) => {
        if (!user.phone) return false;

        try {
          const response = await fetch(smsUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: user.phone,
              message,
              trigger: "mega_milestone",
            }),
          });

          const result = await response.json();
          if (result.success) {
            successCount++;
            return true;
          }
          console.log(
            `[slack-policy-notification] SMS failed for ${user.first_name}:`,
            result.error,
          );
          return false;
        } catch (err) {
          console.error(
            `[slack-policy-notification] SMS error for ${user.first_name}:`,
            err,
          );
          return false;
        }
      });

    await Promise.all(sendPromises);
    console.log(
      `[slack-policy-notification] SMS sent to ${successCount}/${users.length} users`,
    );

    return successCount > 0;
  } catch (err) {
    console.error("[slack-policy-notification] Error sending SMS blast:", err);
    return false;
  }
}

/**
 * Build the daily leaderboard with Block Kit for better formatting
 * Returns both text (fallback) and blocks
 *
 * @deprecated Use buildLeaderboardWithPeriods for WTD/MTD support
 */
function buildLeaderboard(
  title: string,
  entries: DailyProductionEntry[],
  totalAP: number,
): { text: string; blocks: unknown[] } {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });

  // Build fallback text (shown in notifications/previews)
  let text = `${title} - ${today}\n`;
  entries.forEach((entry, index) => {
    const rank = index + 1;
    const ap = formatCurrency(entry.total_annual_premium);
    text += `${rank}. ${entry.agent_name || "Unknown"} - ${ap}\n`;
  });
  text += `Total: ${formatCurrency(totalAP)}`;

  // Build Block Kit blocks for rich display
  const blocks: unknown[] = [];

  // Header with title
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: title,
      emoji: true,
    },
  });

  // Date context
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📅 ${today}`,
      },
    ],
  });

  // Divider
  blocks.push({ type: "divider" });

  if (entries.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No sales yet today_",
      },
    });
  } else {
    // Build leaderboard entries - AP first for natural alignment
    // Pad AP values so they right-align (e.g., "  $761" vs "$9,934")
    const maxApLen = Math.max(
      ...entries.map((e) => formatCurrency(e.total_annual_premium).length),
    );

    const lines = entries.map((entry, index) => {
      const rank = index + 1;
      const rankEmoji = getRankDisplay(rank);
      const name = entry.agent_name || "Unknown";
      const ap = formatCurrency(entry.total_annual_premium).padStart(maxApLen);
      const policies = entry.policy_count;
      const policyText = policies === 1 ? "policy" : "policies";

      return `${rankEmoji} ${ap}  ·  *${name}*  _(${policies} ${policyText})_`;
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n"),
      },
    });
  }

  // Divider before total
  blocks.push({ type: "divider" });

  // Total
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*💰 Total: ${formatCurrency(totalAP)}*`,
    },
  });

  return { text, blocks };
}

/**
 * Build the daily leaderboard with WTD/MTD aggregate totals and agency rankings
 * Format:
 * 1. Daily leaderboard (ranked by today's AP) - same as original
 * 2. Total, WTD, MTD aggregate totals (from scoped agency, not just today's sellers)
 * 3. Agency Rankings (all agencies WTD/MTD)
 * 4. Disclaimer
 */
function buildLeaderboardWithPeriods(
  title: string,
  entries: LeaderboardEntryWithPeriods[],
  agencyTotals: AgencySubmitTotals[] | null,
  scopeAgencyId: string | null, // The agency this leaderboard is scoped to (null = IMO-level)
  imoTotals: ImoSubmitTotals | null = null, // Flat IMO totals to avoid double-counting hierarchical agency rows
): { text: string; blocks: unknown[] } {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });

  // Calculate today's total from shown entries
  const todayTotalAP = entries.reduce((sum, e) => sum + (e.today_ap || 0), 0);

  // WTD/MTD totals should come from the scoped agency's hierarchical totals,
  // NOT from summing today's sellers (which would miss agents who sold earlier but not today)
  let wtdTotalAP = 0;
  let mtdTotalAP = 0;

  if (agencyTotals && agencyTotals.length > 0) {
    if (scopeAgencyId) {
      // Find the scoped agency's totals
      const scopedAgency = agencyTotals.find(
        (a) => a.agency_id === scopeAgencyId,
      );
      if (scopedAgency) {
        wtdTotalAP = scopedAgency.wtd_ap;
        mtdTotalAP = scopedAgency.mtd_ap;
      }
    } else {
      // IMO-level: use flat IMO totals to avoid double-counting hierarchical agency rows
      if (imoTotals) {
        wtdTotalAP = imoTotals.wtd_ap;
        mtdTotalAP = imoTotals.mtd_ap;
      } else {
        // Fallback: sum all agencies (may double-count with hierarchy)
        wtdTotalAP = agencyTotals.reduce((sum, a) => sum + (a.wtd_ap || 0), 0);
        mtdTotalAP = agencyTotals.reduce((sum, a) => sum + (a.mtd_ap || 0), 0);
      }
    }
  }

  // Build fallback text (shown in notifications/previews)
  let text = `${title} - ${today}\n`;
  entries.forEach((entry, index) => {
    const rank = index + 1;
    text += `${rank}. ${entry.agent_name || "Unknown"} - ${formatCurrency(entry.today_ap)}\n`;
  });
  text += `Total: ${formatCurrency(todayTotalAP)}`;

  // Build Block Kit blocks for rich display
  const blocks: unknown[] = [];

  // =====================================================
  // SECTION 1: Header with title and date
  // =====================================================
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: title,
      emoji: true,
    },
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📅 ${today}`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  // =====================================================
  // SECTION 2: Daily Leaderboard (same format as original)
  // =====================================================
  if (entries.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No sales yet today_",
      },
    });
  } else {
    // Build leaderboard entries - AP first for natural alignment
    const maxApLen = Math.max(
      ...entries.map((e) => formatCurrency(e.today_ap).length),
    );

    const dailyLines = entries.map((entry, index) => {
      const rank = index + 1;
      const rankEmoji = getRankDisplay(rank);
      const name = entry.agent_name || "Unknown";
      const ap = formatCurrency(entry.today_ap).padStart(maxApLen);
      const policies = entry.today_policies;
      const policyText = policies === 1 ? "policy" : "policies";

      return `${rankEmoji} ${ap}  ·  *${name}*  _(${policies} ${policyText})_`;
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: dailyLines.join("\n"),
      },
    });
  }

  blocks.push({ type: "divider" });

  // =====================================================
  // SECTION 3: Aggregate Totals (Total, WTD, MTD)
  // =====================================================
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*💰 Total: ${formatCurrency(todayTotalAP)}*\n*📈 WTD: ${formatCurrency(wtdTotalAP)}*\n*📆 MTD: ${formatCurrency(mtdTotalAP)}*`,
    },
  });

  // =====================================================
  // SECTION 4: Agency Rankings
  // =====================================================
  if (agencyTotals && agencyTotals.length > 0) {
    blocks.push({ type: "divider" });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🏢 Agency Rankings*",
      },
    });

    // Show WTD and MTD for each agency
    const agencyLines = agencyTotals.map((agency) => {
      const wtd = formatCurrency(agency.wtd_ap);
      const mtd = formatCurrency(agency.mtd_ap);
      return `*${agency.agency_name}*: WTD ${wtd} · MTD ${mtd}`;
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: agencyLines.join("\n"),
      },
    });
  }

  // =====================================================
  // SECTION 5: Disclaimer
  // =====================================================
  blocks.push({ type: "divider" });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "_* Submit totals may be temporarily off until all users update policies with correct submit dates_",
      },
    ],
  });

  return { text, blocks };
}

/**
 * Build the daily leaderboard text (simple text format) - kept for backwards compatibility
 */
function _buildLeaderboardText(
  title: string,
  entries: DailyProductionEntry[],
  totalAP: number,
): string {
  return buildLeaderboard(title, entries, totalAP).text;
}

/**
 * Handle complete-first-sale action
 * Posts the pending policy notification and leaderboard after user names (or skips) the leaderboard
 * @param overrideTitle - Optional title to use instead of the log's title (for batch processing)
 */
async function handleCompleteFirstSale(
  supabase: ReturnType<typeof createClient>,
  logId: string,
  overrideTitle?: string,
): Promise<{
  ok: boolean;
  error?: string;
  policyOk?: boolean;
  leaderboardOk?: boolean;
}> {
  console.log(
    "[slack-policy-notification] Completing first sale for log:",
    logId,
  );

  // Fetch the daily log with pending data (including hierarchy_depth for leaderboard logic)
  const { data: log, error: logError } = await supabase
    .from("daily_sales_logs")
    .select(
      `
      id,
      imo_id,
      slack_integration_id,
      channel_id,
      log_date,
      title,
      pending_policy_data,
      first_seller_id,
      hierarchy_depth
    `,
    )
    .eq("id", logId)
    .single();

  if (logError || !log) {
    console.error("[slack-policy-notification] Log not found:", logError);
    return { ok: false, error: "Log not found" };
  }

  if (!log.pending_policy_data) {
    console.log(
      "[slack-policy-notification] No pending data - already completed",
    );
    return { ok: true, policyOk: true, leaderboardOk: true };
  }

  // Guard: skip logs that belong to Discord (not Slack).
  // The batch handler gets ALL logs in a group — Discord logs have
  // slack_integration_id = NULL. We must NOT clear pending_policy_data
  // on Discord logs, or the Discord edge function will think it's done.
  if (!log.slack_integration_id) {
    console.log(
      "[slack-policy-notification] Log has no slack_integration_id (Discord log) - skipping",
    );
    return { ok: true, policyOk: true, leaderboardOk: true };
  }

  const pendingData = log.pending_policy_data as {
    policyText: string;
    carrierName: string;
    productName: string;
    agentName: string;
    agentSlackMemberId: string | null;
    agentDisplayName?: string;
    agentAvatarUrl?: string | null;
    annualPremium: number;
    effectiveDate: string;
    agentId: string;
  };

  // ========================================================================
  // CRITICAL FIX: Clear pending_policy_data AND set title IMMEDIATELY
  // This ensures the dialog dismisses regardless of what happens next
  // (Slack failures, timeouts, etc. will NOT leave the dialog stuck)
  //
  // BUG FIX: We MUST set the title here, not just clear pending_policy_data.
  // The RPC check_first_seller_naming_unified returns logs where:
  //   title IS NULL OR pending_policy_data IS NOT NULL
  // If we only clear pending_policy_data but leave title NULL, the dialog
  // will keep reappearing on the next background check.
  // ========================================================================
  const effectiveTitle = overrideTitle
    ? sanitizeSlackTitle(overrideTitle)
    : log.title
      ? sanitizeSlackTitle(log.title)
      : getDefaultDailyTitle();

  const { error: clearError } = await supabase
    .from("daily_sales_logs")
    .update({
      pending_policy_data: null,
      title: effectiveTitle,
      title_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (clearError) {
    console.error(
      "[slack-policy-notification] CRITICAL: Failed to clear pending_policy_data:",
      clearError,
    );
    // Continue anyway - we'll try to post and the cron job is a backup
  } else {
    console.log(
      "[slack-policy-notification] Cleared pending_policy_data for log:",
      logId,
    );
  }

  // Get the Slack integration (including workspace logo for leaderboard posts)
  const { data: integration, error: intError } = await supabase
    .from("slack_integrations")
    .select(
      "id, bot_token_encrypted, agency_id, include_leaderboard_with_policy, workspace_logo_url",
    )
    .eq("id", log.slack_integration_id)
    .single();

  if (intError || !integration) {
    console.error(
      "[slack-policy-notification] Integration not found:",
      intError,
    );
    return { ok: false, error: "Slack integration not found" };
  }

  // Decrypt bot token
  const botToken = await decrypt(integration.bot_token_encrypted);

  // Post the policy notification as the agent
  const postAsUserOptions = {
    username: pendingData.agentDisplayName || pendingData.agentName,
    icon_url: pendingData.agentAvatarUrl || undefined,
  };

  const policyResult = await postSlackMessage(
    botToken,
    log.channel_id,
    pendingData.policyText,
    postAsUserOptions,
  );

  // Track policy post result - but DON'T return early on failure
  // pending_policy_data is already cleared, so dialog will close regardless
  const policyOk = policyResult.ok;
  if (!policyOk) {
    console.error(
      "[slack-policy-notification] Failed to post policy to Slack:",
      policyResult.error,
    );
    // Dialog will still close - we cleared pending_policy_data above
    // Slack notification is lost, but app functionality is preserved
  }

  // Only post leaderboard if the integration has it enabled
  let leaderboardOk = false;
  let leaderboardMessageTs: string | null = null;

  if (integration.include_leaderboard_with_policy) {
    // Get today's production for leaderboard with WTD/MTD data
    const [{ data: leaderboardData }, { data: agencyData }, { data: imoData }] =
      await Promise.all([
        supabase.rpc("get_slack_leaderboard_with_periods", {
          p_imo_id: log.imo_id,
          p_agency_id: integration.agency_id,
        }),
        supabase.rpc("get_all_agencies_submit_totals", {
          p_imo_id: log.imo_id,
        }),
        !integration.agency_id
          ? supabase.rpc("get_imo_submit_totals", { p_imo_id: log.imo_id })
          : Promise.resolve({ data: null }),
      ]);

    const production: LeaderboardEntryWithPeriods[] = leaderboardData || [];
    const agencyTotals: AgencySubmitTotals[] = agencyData || [];
    const imoTotals: ImoSubmitTotals | null = Array.isArray(imoData)
      ? imoData[0] || null
      : null;

    // Build leaderboard with the title (use override, then log title, then default)
    // Sanitize user-provided title to prevent Slack injection
    const title = overrideTitle
      ? sanitizeSlackTitle(overrideTitle)
      : log.title
        ? sanitizeSlackTitle(log.title)
        : getDefaultDailyTitle();
    const { text: leaderboardText, blocks: leaderboardBlocks } =
      buildLeaderboardWithPeriods(
        title,
        production,
        agencyTotals,
        integration.agency_id,
        imoTotals,
      );

    // Post the leaderboard with Block Kit (use workspace logo if configured)
    const leaderboardResult = await postSlackMessage(
      botToken,
      log.channel_id,
      leaderboardText,
      {
        blocks: leaderboardBlocks,
        icon_url: integration.workspace_logo_url || undefined,
      },
    );

    leaderboardOk = leaderboardResult.ok;
    leaderboardMessageTs = leaderboardResult.ts || null;
  }

  // Update the log with leaderboard message_ts if we have one
  // (pending_policy_data was already cleared at the start of this function)
  if (leaderboardMessageTs) {
    const { error: updateError } = await supabase
      .from("daily_sales_logs")
      .update({
        leaderboard_message_ts: leaderboardMessageTs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    if (updateError) {
      console.error(
        "[slack-policy-notification] Failed to update leaderboard_message_ts:",
        updateError,
      );
    }
  }

  // =====================================================================
  // Check and post milestone celebration after first sale completion
  // =====================================================================
  if (leaderboardOk) {
    await checkAndPostCelebration(
      supabase,
      botToken,
      log.channel_id,
      logId,
      pendingData.agentId,
      pendingData.agentName,
      pendingData.agentSlackMemberId,
      log.imo_id,
      integration.agency_id,
    );
  }

  console.log(
    `[slack-policy-notification] First sale completed: policyOk=${policyOk}, leaderboardOk=${leaderboardOk}`,
  );
  return {
    ok: policyOk, // Consider it "ok" if policy posted successfully
    policyOk,
    leaderboardOk,
  };
}

/**
 * Handle update-leaderboard action
 * Updates an existing Slack leaderboard message with a new title
 */
async function handleUpdateLeaderboard(
  supabase: ReturnType<typeof createClient>,
  logId: string,
): Promise<{
  ok: boolean;
  error?: string;
  updated?: boolean;
}> {
  console.log(
    "[slack-policy-notification] Updating leaderboard for log:",
    logId,
  );

  // Fetch the daily log with integration details (including hierarchy_depth for validation)
  const { data: log, error: logError } = await supabase
    .from("daily_sales_logs")
    .select(
      `
      id,
      imo_id,
      slack_integration_id,
      channel_id,
      log_date,
      title,
      leaderboard_message_ts,
      first_seller_id,
      hierarchy_depth
    `,
    )
    .eq("id", logId)
    .single();

  if (logError || !log) {
    console.error("[slack-policy-notification] Log not found:", logError);
    return { ok: false, error: "Log not found" };
  }

  // ALL integrations now get leaderboards (multi-channel naming enabled)
  if (!log.leaderboard_message_ts) {
    console.error("[slack-policy-notification] No message_ts to update");
    return { ok: false, error: "No Slack message to update" };
  }

  // Get the Slack integration (including workspace logo)
  const { data: integration, error: intError } = await supabase
    .from("slack_integrations")
    .select("id, bot_token_encrypted, agency_id, workspace_logo_url")
    .eq("id", log.slack_integration_id)
    .single();

  if (intError || !integration) {
    console.error(
      "[slack-policy-notification] Integration not found:",
      intError,
    );
    return { ok: false, error: "Slack integration not found" };
  }

  // Decrypt bot token
  const botToken = await decrypt(integration.bot_token_encrypted);

  // Get today's production for leaderboard with WTD/MTD data
  const [{ data: leaderboardData }, { data: agencyData }, { data: imoData }] =
    await Promise.all([
      supabase.rpc("get_slack_leaderboard_with_periods", {
        p_imo_id: log.imo_id,
        p_agency_id: integration.agency_id,
      }),
      supabase.rpc("get_all_agencies_submit_totals", {
        p_imo_id: log.imo_id,
      }),
      !integration.agency_id
        ? supabase.rpc("get_imo_submit_totals", { p_imo_id: log.imo_id })
        : Promise.resolve({ data: null }),
    ]);

  const production: LeaderboardEntryWithPeriods[] = leaderboardData || [];
  const agencyTotals: AgencySubmitTotals[] = agencyData || [];
  const imoTotals: ImoSubmitTotals | null = Array.isArray(imoData)
    ? imoData[0] || null
    : null;

  // Build leaderboard with the title from database (which was just updated)
  // Sanitize user-provided title to prevent Slack injection
  const title = log.title
    ? sanitizeSlackTitle(log.title)
    : getDefaultDailyTitle();
  const { text: leaderboardText, blocks: leaderboardBlocks } =
    buildLeaderboardWithPeriods(
      title,
      production,
      agencyTotals,
      integration.agency_id,
      imoTotals,
    );

  // Update the Slack message with Block Kit
  const updateResult = await updateSlackMessage(
    botToken,
    log.channel_id,
    log.leaderboard_message_ts,
    leaderboardText,
    leaderboardBlocks,
  );

  if (!updateResult.ok) {
    console.error(
      "[slack-policy-notification] Failed to update Slack message:",
      updateResult.error,
    );
    return {
      ok: false,
      error: updateResult.error || "Failed to update Slack message",
    };
  }

  console.log(
    "[slack-policy-notification] Leaderboard updated successfully with title:",
    title,
  );
  return { ok: true, updated: true };
}

/**
 * Handle complete-first-sale-batch action
 * Processes ALL logs in a first_sale_group with the same title
 */
async function handleCompleteFirstSaleBatch(
  supabase: ReturnType<typeof createClient>,
  firstSaleGroupId: string,
  title?: string,
): Promise<{
  ok: boolean;
  error?: string;
  results: Array<{
    logId: string;
    channelName?: string;
    policyOk: boolean;
    leaderboardOk: boolean;
    error?: string;
  }>;
}> {
  console.log(
    "[slack-policy-notification] Completing first sale batch for group:",
    firstSaleGroupId,
  );

  // Get all logs in this group using the RPC
  const { data: groupLogs, error: groupError } = await supabase.rpc(
    "get_pending_first_sale_logs",
    { p_first_sale_group_id: firstSaleGroupId },
  );

  if (groupError) {
    console.error(
      "[slack-policy-notification] Error fetching group logs:",
      groupError,
    );
    return { ok: false, error: "Failed to fetch group logs", results: [] };
  }

  if (!groupLogs || groupLogs.length === 0) {
    console.log("[slack-policy-notification] No logs found in group");
    return { ok: true, results: [] };
  }

  console.log(
    `[slack-policy-notification] Processing ${groupLogs.length} logs in batch`,
  );

  const results: Array<{
    logId: string;
    channelName?: string;
    policyOk: boolean;
    leaderboardOk: boolean;
    error?: string;
  }> = [];

  // Process each log with the same title
  for (const log of groupLogs) {
    const result = await handleCompleteFirstSale(supabase, log.log_id, title);

    results.push({
      logId: log.log_id,
      policyOk: result.policyOk || false,
      leaderboardOk: result.leaderboardOk || false,
      error: result.error,
    });
  }

  const allOk = results.every((r) => r.policyOk);
  console.log(
    `[slack-policy-notification] Batch complete: ${results.filter((r) => r.policyOk).length}/${results.length} successful`,
  );

  return { ok: allOk, results };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-policy-notification] Function invoked");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: PolicyNotificationPayload = await req.json();

    // Handle complete-first-sale action (posts pending notification after naming dialog)
    if (body.action === "complete-first-sale") {
      if (!body.logId) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing required field: logId" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await handleCompleteFirstSale(supabase, body.logId);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle update-leaderboard action (for refreshing Slack message after title is set)
    if (body.action === "update-leaderboard") {
      if (!body.logId) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing required field: logId" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await handleUpdateLeaderboard(supabase, body.logId);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle complete-first-sale-batch action (unified naming - posts to ALL channels with same title)
    if (body.action === "complete-first-sale-batch") {
      if (!body.firstSaleGroupId) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Missing required field: firstSaleGroupId",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await handleCompleteFirstSaleBatch(
        supabase,
        body.firstSaleGroupId,
        body.title,
      );
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default action: post-policy (original behavior)
    const {
      policyId,
      carrierId,
      productId,
      agentId,
      annualPremium,
      effectiveDate,
      submitDate,
      imoId,
      agencyId,
    } = body;

    // =========================================================================
    // DEFENSE IN DEPTH: Backup check for backdated policies
    // The database trigger should already filter these, but we double-check here
    // to ensure backdated policies NEVER post to Slack regardless of trigger state
    // =========================================================================
    const todayET = getTodayDateET();
    if (submitDate && submitDate !== todayET) {
      console.log(
        `[slack-policy-notification] BACKUP CHECK: Skipping backdated policy ${policyId}: submit_date=${submitDate}, today=${todayET}`,
      );
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "Backdated policy - submit_date is not today",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!imoId || !policyId || !agentId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required fields: imoId, policyId, agentId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[slack-policy-notification] Processing policy ${policyId} for agent ${agentId}, imoId=${imoId}, agencyId=${agencyId}`,
    );

    // =========================================================================
    // Get Slack integrations for the agency hierarchy
    // =========================================================================
    interface HierarchyIntegration {
      integration_id: string;
      agency_id: string | null;
      agency_name: string;
      team_id: string;
      team_name: string;
      display_name: string;
      policy_channel_id: string;
      policy_channel_name: string;
      include_client_info: boolean;
      include_leaderboard: boolean;
      hierarchy_depth: number;
    }

    let hierarchyIntegrations: HierarchyIntegration[] = [];

    if (agencyId) {
      // Debug: First check the raw agency hierarchy
      const { data: rawHierarchy, error: rawError } = await supabase.rpc(
        "get_agency_hierarchy",
        { p_agency_id: agencyId },
      );
      if (rawError) {
        console.error(
          "[slack-policy-notification] Error fetching raw hierarchy:",
          rawError,
        );
      } else {
        console.log(
          `[slack-policy-notification] Agency hierarchy for ${agencyId}: ${JSON.stringify(rawHierarchy)}`,
        );
      }

      const { data: hierarchyData, error: hierarchyError } = await supabase.rpc(
        "get_slack_integrations_for_agency_hierarchy",
        { p_agency_id: agencyId },
      );

      if (hierarchyError) {
        console.error(
          "[slack-policy-notification] Error fetching hierarchy:",
          hierarchyError,
        );
      } else {
        hierarchyIntegrations = hierarchyData || [];
        console.log(
          `[slack-policy-notification] Found ${hierarchyIntegrations.length} integrations for agency ${agencyId}`,
        );
        // Debug: log each integration details
        hierarchyIntegrations.forEach((int, idx) => {
          console.log(
            `[slack-policy-notification] Integration ${idx + 1}: team="${int.team_name}", agency="${int.agency_name}", agency_id=${int.agency_id}, hierarchy_depth=${int.hierarchy_depth}`,
          );
        });
      }
    } else {
      // Fall back to IMO-level integration
      const { data: imoIntegration } = await supabase
        .from("slack_integrations")
        .select(
          "id, agency_id, team_id, team_name, display_name, policy_channel_id, policy_channel_name, include_client_info, include_leaderboard_with_policy",
        )
        .eq("imo_id", imoId)
        .is("agency_id", null)
        .eq("is_active", true)
        .eq("connection_status", "connected")
        .not("policy_channel_id", "is", null)
        .maybeSingle();

      if (imoIntegration) {
        hierarchyIntegrations = [
          {
            integration_id: imoIntegration.id,
            agency_id: null,
            agency_name: "IMO-Level",
            team_id: imoIntegration.team_id,
            team_name: imoIntegration.team_name,
            display_name: imoIntegration.display_name,
            policy_channel_id: imoIntegration.policy_channel_id,
            policy_channel_name: imoIntegration.policy_channel_name,
            include_client_info: imoIntegration.include_client_info || false,
            include_leaderboard:
              imoIntegration.include_leaderboard_with_policy || false,
            hierarchy_depth: 999,
          },
        ];
      }
    }

    if (hierarchyIntegrations.length === 0) {
      console.log(
        "[slack-policy-notification] No active Slack integrations for IMO:",
        imoId,
      );
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "No active integrations",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // =========================================================================
    // Fetch policy details (including product enum), agent, carrier, product
    // =========================================================================
    const [
      policyResult,
      agentResult,
      carrierResult,
      productResult,
      slackPrefsResult,
    ] = await Promise.all([
      // Get the policy to access the 'product' enum field
      supabase
        .from("policies")
        .select("product, product_id")
        .eq("id", policyId)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("first_name, last_name, email, slack_member_overrides")
        .eq("id", agentId)
        .maybeSingle(),
      carrierId
        ? supabase
            .from("carriers")
            .select("name")
            .eq("id", carrierId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      productId
        ? supabase
            .from("products")
            .select("name")
            .eq("id", productId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("user_slack_preferences")
        .select("slack_member_id, auto_post_enabled")
        .eq("user_id", agentId)
        .eq("imo_id", imoId)
        .maybeSingle(),
    ]);

    const agentName = agentResult.data
      ? `${agentResult.data.first_name || ""} ${agentResult.data.last_name || ""}`.trim() ||
        agentResult.data.email
      : "Unknown";
    const agentEmail = agentResult.data?.email || null;
    const slackMemberOverrides = (agentResult.data?.slack_member_overrides ||
      {}) as Record<
      string,
      { slack_member_id: string; display_name: string; avatar_url: string }
    >;

    const carrierName = carrierResult.data?.name || "Unknown";

    // Product name: prefer products table, fall back to policy.product enum
    let productName = productResult.data?.name;
    if (!productName && policyResult.data?.product) {
      productName = formatProductType(policyResult.data.product);
    }
    if (!productName) {
      productName = "Life";
    }

    const _agentSlackMemberId = slackPrefsResult.data?.slack_member_id || null; // Unused - we look up per-workspace now
    const autoPostEnabled = slackPrefsResult.data?.auto_post_enabled ?? true;

    if (!autoPostEnabled) {
      console.log(
        "[slack-policy-notification] Auto-post disabled for user:",
        agentId,
      );
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "User disabled auto-posting",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // =========================================================================
    // Pre-check: Determine if ANY channel will be a first sale
    // Generate a single first_sale_group_id for unified naming
    // =========================================================================
    const todayDate = getTodayDateET();
    let firstSaleGroupId: string | null = null;
    let hasAnyFirstSale = false;

    // Check each integration to see if it's a first sale
    for (const integration of hierarchyIntegrations) {
      const { data: existingLog } = await supabase
        .from("daily_sales_logs")
        .select("id, first_seller_id, pending_policy_data")
        .eq("imo_id", imoId)
        .eq("slack_integration_id", integration.integration_id)
        .eq("channel_id", integration.policy_channel_id)
        .eq("log_date", todayDate)
        .maybeSingle();

      // Check if this would be a first sale for this channel
      const isFirstForChannel =
        !existingLog ||
        (!existingLog.first_seller_id && !existingLog.pending_policy_data);

      if (isFirstForChannel) {
        hasAnyFirstSale = true;
        break; // We found at least one, that's all we need to know
      }
    }

    // Generate a single group ID if any channel is a first sale
    if (hasAnyFirstSale) {
      firstSaleGroupId = crypto.randomUUID();
      console.log(
        `[slack-policy-notification] First sale detected - generated group ID: ${firstSaleGroupId}`,
      );
    }

    // =========================================================================
    // Post to each Slack workspace in the hierarchy
    // =========================================================================
    const results: Array<{
      integrationId: string;
      teamName: string;
      channelName: string;
      policyOk: boolean;
      leaderboardOk: boolean;
      isFirstSale: boolean;
      pendingFirstSale?: boolean;
      logId?: string | null;
      firstSaleGroupId?: string | null;
      error: string | null;
    }> = [];

    for (const integration of hierarchyIntegrations) {
      try {
        // Get bot token and workspace logo
        const { data: fullIntegration } = await supabase
          .from("slack_integrations")
          .select("bot_token_encrypted, workspace_logo_url")
          .eq("id", integration.integration_id)
          .single();

        if (!fullIntegration) {
          results.push({
            integrationId: integration.integration_id,
            teamName: integration.team_name,
            channelName: integration.policy_channel_name,
            policyOk: false,
            leaderboardOk: false,
            isFirstSale: false,
            error: "Failed to fetch integration",
          });
          continue;
        }

        const botToken = await decrypt(fullIntegration.bot_token_encrypted);

        // =====================================================================
        // Look up Slack user FOR THIS SPECIFIC WORKSPACE
        // Slack user IDs are workspace-specific, so we must look up per-workspace
        // We get the full user info (id, name, avatar) to post as that user
        // First check for manual overrides (for users with different emails per workspace)
        // =====================================================================
        let workspaceSlackUser: SlackUserInfo | null = null;

        // Check for manual override first
        const override = slackMemberOverrides[integration.integration_id];
        if (override) {
          workspaceSlackUser = {
            id: override.slack_member_id,
            displayName: override.display_name,
            avatarUrl: override.avatar_url,
          };
          console.log(
            `[slack-policy-notification] Using override for ${agentName} in ${integration.team_name}: ${workspaceSlackUser.displayName} (${workspaceSlackUser.id})`,
          );
        } else if (agentEmail) {
          // Fall back to email lookup
          workspaceSlackUser = await lookupSlackMemberByEmail(
            botToken,
            agentEmail,
          );
          if (workspaceSlackUser) {
            console.log(
              `[slack-policy-notification] Found Slack user for ${agentEmail} in ${integration.team_name}: ${workspaceSlackUser.displayName} (${workspaceSlackUser.id})`,
            );
          } else {
            console.log(
              `[slack-policy-notification] Could not find Slack user for ${agentEmail} in ${integration.team_name} - using name`,
            );
          }
        }

        // Build the simple policy notification text
        // Use Eastern timezone for fallback date display
        const fallbackDate = new Date().toLocaleDateString("en-CA", {
          timeZone: "America/New_York",
        });
        const policyText = buildSimplePolicyText(
          annualPremium,
          carrierName,
          productName,
          effectiveDate || fallbackDate,
        );

        // Options for posting as the agent (shows their name/avatar)
        const postAsUserOptions = workspaceSlackUser
          ? {
              username: workspaceSlackUser.displayName,
              icon_url: workspaceSlackUser.avatarUrl || undefined,
            }
          : { username: agentName };

        // =====================================================================
        // Check FIRST if this is a first sale - before posting anything
        // ALL integrations now get leaderboards (multi-channel naming enabled)
        // =====================================================================
        let leaderboardOk = false;
        let isFirstSale = false;

        // Check if there's already a daily log for today (Eastern timezone)
        const todayDate = getTodayDateET();
        const { data: existingLog } = await supabase
          .from("daily_sales_logs")
          .select("*")
          .eq("imo_id", imoId)
          .eq("slack_integration_id", integration.integration_id)
          .eq("channel_id", integration.policy_channel_id)
          .eq("log_date", todayDate)
          .maybeSingle();

        // Get today's production for leaderboard with WTD/MTD data
        // Use integration's agency_id so each level shows appropriate scope:
        // - The Standard's scoreboard shows only The Standard's sales
        // - Self Made's scoreboard shows Self Made + all child agencies
        const integrationAgencyId = integration.agency_id;
        const [
          { data: leaderboardData },
          { data: agencyData },
          { data: imoData },
        ] = await Promise.all([
          supabase.rpc("get_slack_leaderboard_with_periods", {
            p_imo_id: imoId,
            p_agency_id: integrationAgencyId,
          }),
          supabase.rpc("get_all_agencies_submit_totals", {
            p_imo_id: imoId,
          }),
          !integrationAgencyId
            ? supabase.rpc("get_imo_submit_totals", { p_imo_id: imoId })
            : Promise.resolve({ data: null }),
        ]);

        const production: LeaderboardEntryWithPeriods[] = leaderboardData || [];
        const agencyTotals: AgencySubmitTotals[] = agencyData || [];
        const imoTotals: ImoSubmitTotals | null = Array.isArray(imoData)
          ? imoData[0] || null
          : null;

        // Detect if this is effectively the first sale of the day
        // More robust check: if log exists, verify the first_seller still has production
        // This handles the case where policies were deleted
        let isEffectivelyFirstSale = !existingLog;

        if (existingLog && existingLog.first_seller_id) {
          // Check if the recorded first_seller still has any production today
          const firstSellerProduction = production.find(
            (p) => p.agent_id === existingLog.first_seller_id,
          );
          const firstSellerHasProduction =
            firstSellerProduction && firstSellerProduction.today_policies > 0;

          // If first seller has no production, their policies were deleted - reset
          if (!firstSellerHasProduction) {
            isEffectivelyFirstSale = true;
            console.log(
              "[slack-policy-notification] First seller has no production, resetting log",
            );
          }
        }

        // Also check if there's a pending first sale that hasn't been completed
        if (existingLog && existingLog.pending_policy_data) {
          // There's already a pending first sale - treat this as subsequent sale
          isEffectivelyFirstSale = false;
        }

        if (isEffectivelyFirstSale) {
          // =====================================================================
          // FIRST SALE HANDLING - ALL integrations get naming dialog opportunity
          // =====================================================================
          isFirstSale = true;

          console.log(
            "[slack-policy-notification] First sale detected - storing pending data for naming dialog",
          );

          // Store the policy data for later posting after user names the leaderboard
          const pendingData = {
            policyText,
            carrierName,
            productName,
            agentName,
            agentSlackMemberId: workspaceSlackUser?.id || null, // Store workspace-specific ID
            agentDisplayName: workspaceSlackUser?.displayName || agentName,
            agentAvatarUrl: workspaceSlackUser?.avatarUrl || null,
            annualPremium,
            effectiveDate: effectiveDate || fallbackDate,
            agentId,
          };

          let savedLogId: string | null = null;

          if (existingLog) {
            // Log exists but was stale (first seller's policies deleted) - update it
            const { error: updateError } = await supabase
              .from("daily_sales_logs")
              .update({
                first_seller_id: agentId,
                pending_policy_data: pendingData,
                leaderboard_message_ts: null, // Clear old message_ts
                hierarchy_depth: integration.hierarchy_depth, // Track integration level for leaderboard logic
                first_sale_group_id: firstSaleGroupId, // Group all first sales for unified naming
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingLog.id);

            if (updateError) {
              console.error(
                "[slack-policy-notification] Failed to update daily log:",
                updateError,
              );
            } else {
              savedLogId = existingLog.id;
            }
          } else {
            // No log exists - create new one with pending data
            const { data: insertedLog, error: insertError } = await supabase
              .from("daily_sales_logs")
              .insert({
                imo_id: imoId,
                slack_integration_id: integration.integration_id,
                channel_id: integration.policy_channel_id,
                log_date: todayDate,
                first_seller_id: agentId,
                pending_policy_data: pendingData,
                hierarchy_depth: integration.hierarchy_depth, // Track integration level for leaderboard logic
                first_sale_group_id: firstSaleGroupId, // Group all first sales for unified naming
              })
              .select("id")
              .single();

            if (insertError) {
              console.error(
                "[slack-policy-notification] Failed to insert daily log:",
                insertError,
              );
            } else {
              savedLogId = insertedLog?.id || null;
            }
          }

          // Return result indicating pending first sale (no Slack messages sent)
          results.push({
            integrationId: integration.integration_id,
            teamName: integration.team_name,
            channelName: integration.policy_channel_name,
            policyOk: false, // Not posted yet
            leaderboardOk: false, // Not posted yet
            isFirstSale: true,
            pendingFirstSale: true,
            logId: savedLogId,
            firstSaleGroupId, // Include group ID for unified naming
            error: null,
          });

          console.log(
            `[slack-policy-notification] Pending first sale stored for ${integration.team_name} - awaiting naming dialog`,
          );
          continue; // Skip to next integration
        }

        // =====================================================================
        // SUBSEQUENT SALE - Post policy notification normally (as the agent)
        // =====================================================================
        const policyData = await postSlackMessage(
          botToken,
          integration.policy_channel_id,
          policyText,
          postAsUserOptions,
        );

        // =====================================================================
        // Handle daily leaderboard for subsequent sales
        // Only post leaderboard if the integration has it enabled
        // =====================================================================
        if (existingLog && integration.include_leaderboard) {
          // Subsequent sale - delete old leaderboard and post fresh one
          // This ensures leaderboard always appears AFTER the latest policy notification
          // Sanitize user-provided title to prevent Slack injection
          const { text: leaderboardText, blocks: leaderboardBlocks } =
            buildLeaderboardWithPeriods(
              existingLog.title
                ? sanitizeSlackTitle(existingLog.title)
                : getDefaultDailyTitle(),
              production,
              agencyTotals,
              integration.agency_id,
              imoTotals,
            );

          // Delete old leaderboard message if it exists (ignore errors - message may be gone)
          if (existingLog.leaderboard_message_ts) {
            try {
              const deleteResponse = await fetch(
                "https://slack.com/api/chat.delete",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${botToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    channel: integration.policy_channel_id,
                    ts: existingLog.leaderboard_message_ts,
                  }),
                },
              );
              const deleteData = await deleteResponse.json();
              if (!deleteData.ok && deleteData.error !== "message_not_found") {
                console.log(
                  "[slack-policy-notification] Could not delete old leaderboard:",
                  deleteData.error,
                );
              }
            } catch (deleteErr) {
              console.log(
                "[slack-policy-notification] Error deleting old leaderboard (continuing):",
                deleteErr,
              );
            }
          }

          // Always post fresh leaderboard after the policy notification with Block Kit
          // Use workspace logo as bot icon if configured
          const leaderboardData = await postSlackMessage(
            botToken,
            integration.policy_channel_id,
            leaderboardText,
            {
              blocks: leaderboardBlocks,
              icon_url: fullIntegration?.workspace_logo_url || undefined,
            },
          );
          leaderboardOk = leaderboardData.ok;

          // Update the log with new message_ts
          if (leaderboardData.ok && leaderboardData.ts) {
            const { error: updateLogError } = await supabase
              .from("daily_sales_logs")
              .update({
                leaderboard_message_ts: leaderboardData.ts,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingLog.id);

            if (updateLogError) {
              console.error(
                "[slack-policy-notification] Failed to update log with new message_ts:",
                updateLogError,
              );
            }
          } else if (!leaderboardData.ok) {
            console.error(
              "[slack-policy-notification] Failed to post new leaderboard:",
              leaderboardData.error,
            );
          }

          // =====================================================================
          // Check and post milestone celebration after leaderboard update
          // =====================================================================
          if (leaderboardOk && existingLog?.id) {
            await checkAndPostCelebration(
              supabase,
              botToken,
              integration.policy_channel_id,
              existingLog.id,
              agentId,
              agentName,
              workspaceSlackUser?.id || null,
              imoId,
              integration.agency_id,
            );
          }
        }

        results.push({
          integrationId: integration.integration_id,
          teamName: integration.team_name,
          channelName: integration.policy_channel_name,
          policyOk: policyData.ok,
          leaderboardOk,
          isFirstSale,
          error: policyData.error || null,
        });

        console.log(
          `[slack-policy-notification] Posted to ${integration.team_name} #${integration.policy_channel_name}`,
        );
      } catch (err) {
        console.error(
          `[slack-policy-notification] Error posting to ${integration.team_name}:`,
          err,
        );
        results.push({
          integrationId: integration.integration_id,
          teamName: integration.team_name,
          channelName: integration.policy_channel_name,
          policyOk: false,
          leaderboardOk: false,
          isFirstSale: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        results,
        summary: {
          total: results.length,
          policySuccess: results.filter((r) => r.policyOk).length,
          leaderboardSuccess: results.filter((r) => r.leaderboardOk).length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[slack-policy-notification] Unexpected error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
