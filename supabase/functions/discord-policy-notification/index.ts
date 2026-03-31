// supabase/functions/discord-policy-notification/index.ts
// Posts policy notifications, manages first-sale flow, and updates daily leaderboard in Discord.
//
// Actions:
//   "post-policy" (default) — called by DB trigger on policy INSERT
//   "complete-first-sale"   — called by frontend after naming dialog
//   "complete-first-sale-batch" — completes all logs in a first_sale_group
//   "update-leaderboard"    — refreshes existing leaderboard message

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  sendDiscordMessage,
  editDiscordMessage,
  formatCurrency,
  getRankEmoji,
  COLORS,
  type DiscordEmbed,
} from "../_shared/discord.ts";

// ── Types ──

interface PolicyNotificationPayload {
  action?:
    | "post-policy"
    | "complete-first-sale"
    | "complete-first-sale-batch"
    | "update-leaderboard";
  policyId?: string;
  policyNumber?: string;
  carrierId?: string;
  productId?: string;
  agentId?: string;
  annualPremium?: number;
  effectiveDate?: string;
  status?: string;
  imoId?: string;
  agencyId?: string;
  logId?: string;
  firstSaleGroupId?: string;
  title?: string;
}

interface LeaderboardAgent {
  agent_id: string;
  agent_name: string;
  today_ap: number;
  today_policies: number;
  wtd_ap: number;
  wtd_policies: number;
  mtd_ap: number;
  mtd_policies: number;
}

interface PendingPolicyData {
  policyText: string;
  carrierName: string;
  productName: string;
  agentName: string;
  agentDisplayName: string;
  agentAvatarUrl: string | null;
  annualPremium: number;
  effectiveDate: string;
  agentId: string;
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

// ── Discord guild member lookup ──

async function findDiscordDisplayName(
  botToken: string,
  guildId: string,
  searchName: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(searchName)}&limit=5`,
      {
        headers: { Authorization: `Bot ${botToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      console.log(
        `[discord-policy-notification] Guild member search failed: ${response.status}`,
      );
      return null;
    }
    const members = await response.json();
    if (members.length > 0) {
      // Use nickname (server-specific) first, then global display name, then username
      const member = members[0];
      return (
        member.nick || member.user?.global_name || member.user?.username || null
      );
    }
    return null;
  } catch {
    return null;
  }
}

// ── Helpers ──

function getTodayET(): string {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const year = et.getFullYear();
  const month = String(et.getMonth() + 1).padStart(2, "0");
  const day = String(et.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateCompact(dateStr: string): string {
  if (!dateStr) return "N/A";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
}

function buildPolicyEmbed(
  agentName: string,
  carrierName: string,
  productName: string,
  annualPremium: number,
  effectiveDate: string,
): DiscordEmbed {
  const ap = formatCurrency(annualPremium);
  const date = formatDateCompact(effectiveDate);
  return {
    description: `**${agentName}** ${ap} ${carrierName} ${productName} Eff Date: ${date}`,
    color: COLORS.GREEN,
    timestamp: new Date().toISOString(),
  };
}

function buildLeaderboardEmbeds(
  agents: LeaderboardAgent[],
  title: string | null,
  agencyTotals: AgencySubmitTotals[] | null,
  scopeAgencyId: string | null,
  imoTotals: ImoSubmitTotals | null = null,
): DiscordEmbed[] {
  if (agents.length === 0) return [];

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const headerTitle = title || `📊 ${today} Sales`;

  // Daily rankings only — matches Slack format
  const todayEntries = agents
    .filter((a) => a.today_ap > 0 || a.today_policies > 0)
    .sort((a, b) => b.today_ap - a.today_ap);

  const todayLines = todayEntries.map((agent, i) => {
    const rank = getRankEmoji(i + 1);
    const policies = agent.today_policies;
    const policyText = policies === 1 ? "app" : "apps";
    return `${rank} ${formatCurrency(agent.today_ap)}  ·  ${agent.agent_name}  _(${policies} ${policyText})_`;
  });

  const totalToday = agents.reduce((s, a) => s + a.today_ap, 0);

  // WTD/MTD totals come from agency/IMO-level RPCs, NOT from summing today's sellers
  // (today's sellers miss anyone who sold earlier in the week/month but not today)
  let wtdTotalAP = 0;
  let mtdTotalAP = 0;

  if (agencyTotals && agencyTotals.length > 0) {
    if (scopeAgencyId) {
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

  if (todayLines.length === 0) return [];

  // Main embed: daily rankings + summary totals
  const description = [
    todayLines.join("\n"),
    "",
    `**💰 Total: ${formatCurrency(totalToday)}**`,
    `**📈 WTD: ${formatCurrency(wtdTotalAP)}**`,
    `**📆 MTD: ${formatCurrency(mtdTotalAP)}**`,
  ].join("\n");

  const embeds: DiscordEmbed[] = [
    {
      title: headerTitle,
      description,
      color: COLORS.GOLD,
    },
  ];

  // Agency rankings embed
  if (agencyTotals && agencyTotals.length > 0) {
    const agencyLines = agencyTotals.map((agency) => {
      const wtd = formatCurrency(agency.wtd_ap);
      const mtd = formatCurrency(agency.mtd_ap);
      return `**${agency.agency_name}**: WTD ${wtd} · MTD ${mtd}`;
    });

    embeds.push({
      title: "🏢 Agency Rankings",
      description: agencyLines.join("\n"),
      color: COLORS.ZINC,
    });
  }

  return embeds;
}

// ── Action Handlers ──

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
    `[discord-policy-notification] complete-first-sale logId=${logId}`,
  );

  // Fetch log with pending data
  const { data: log, error: logErr } = await supabase
    .from("daily_sales_logs")
    .select("*, discord_integrations(*)")
    .eq("id", logId)
    .not("discord_integration_id", "is", null)
    .maybeSingle();

  if (logErr || !log) {
    // Fall back to Slack if no Discord log
    return {
      ok: false,
      error: logErr?.message || "Log not found or not a Discord log",
    };
  }

  const pending = log.pending_policy_data as PendingPolicyData | null;
  if (!pending) {
    return { ok: false, error: "No pending policy data" };
  }

  const integration = log.discord_integrations;
  if (!integration) {
    return { ok: false, error: "No Discord integration found" };
  }

  const effectiveTitle = overrideTitle || log.title || null;

  // Clear pending data and set title
  await supabase
    .from("daily_sales_logs")
    .update({
      pending_policy_data: null,
      title: effectiveTitle,
      title_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  // Decrypt bot token
  const botToken = await decrypt(integration.bot_token_encrypted);
  const channelId = log.channel_id;

  // Post policy notification
  const policyEmbed = buildPolicyEmbed(
    pending.agentName,
    pending.carrierName,
    pending.productName,
    pending.annualPremium,
    pending.effectiveDate,
  );
  const policyResult = await sendDiscordMessage(botToken, channelId, {
    embeds: [policyEmbed],
  });

  // Post leaderboard — fetch all 3 RPCs for correct WTD/MTD totals
  const [{ data: leaderboardData }, { data: agencyData }, { data: imoData }] =
    await Promise.all([
      supabase.rpc("get_slack_leaderboard_with_periods", {
        p_imo_id: log.imo_id,
        p_agency_id: integration.agency_id || null,
      }),
      supabase.rpc("get_all_agencies_submit_totals", {
        p_imo_id: log.imo_id,
      }),
      !integration.agency_id
        ? supabase.rpc("get_imo_submit_totals", { p_imo_id: log.imo_id })
        : Promise.resolve({ data: null }),
    ]);

  const agents = (leaderboardData || []) as LeaderboardAgent[];
  const agencyTotals = (agencyData || []) as AgencySubmitTotals[];
  const imoTotals: ImoSubmitTotals | null = Array.isArray(imoData)
    ? imoData[0] || null
    : null;
  const leaderboardEmbeds = buildLeaderboardEmbeds(
    agents,
    effectiveTitle,
    agencyTotals,
    integration.agency_id || null,
    imoTotals,
  );

  let leaderboardOk = true;
  if (leaderboardEmbeds.length > 0) {
    const lbResult = await sendDiscordMessage(botToken, channelId, {
      embeds: leaderboardEmbeds,
    });
    leaderboardOk = lbResult.ok;

    if (lbResult.ok && lbResult.messageId) {
      await supabase
        .from("daily_sales_logs")
        .update({ leaderboard_message_ts: lbResult.messageId })
        .eq("id", logId);
    }
  }

  // Audit
  await supabase.from("discord_messages").insert({
    imo_id: log.imo_id,
    discord_integration_id: integration.id,
    channel_id: channelId,
    notification_type: "policy_created",
    message_id: policyResult.messageId || null,
    status: policyResult.ok ? "sent" : "failed",
    message_text: `First sale: ${pending.agentName} - ${pending.carrierName}`,
    related_entity_type: "policy",
    sent_at: policyResult.ok ? new Date().toISOString() : null,
    error_message: policyResult.error || null,
  });

  return { ok: policyResult.ok, policyOk: policyResult.ok, leaderboardOk };
}

async function handleCompleteFirstSaleBatch(
  supabase: ReturnType<typeof createClient>,
  firstSaleGroupId: string,
  title?: string,
): Promise<{
  ok: boolean;
  results: { logId: string; ok: boolean; error?: string }[];
}> {
  console.log(
    `[discord-policy-notification] complete-first-sale-batch groupId=${firstSaleGroupId}`,
  );

  const { data: logs } = await supabase
    .from("daily_sales_logs")
    .select("id")
    .eq("first_sale_group_id", firstSaleGroupId)
    .not("discord_integration_id", "is", null)
    .not("pending_policy_data", "is", null);

  const results: { logId: string; ok: boolean; error?: string }[] = [];

  for (const log of logs || []) {
    const result = await handleCompleteFirstSale(supabase, log.id, title);
    results.push({ logId: log.id, ok: result.ok, error: result.error });
  }

  return { ok: results.every((r) => r.ok), results };
}

async function handleUpdateLeaderboard(
  supabase: ReturnType<typeof createClient>,
  logId: string,
): Promise<{ ok: boolean; error?: string; updated?: boolean }> {
  console.log(
    `[discord-policy-notification] update-leaderboard logId=${logId}`,
  );

  const { data: log, error: logErr } = await supabase
    .from("daily_sales_logs")
    .select("*, discord_integrations(*)")
    .eq("id", logId)
    .not("discord_integration_id", "is", null)
    .maybeSingle();

  if (logErr || !log) {
    return {
      ok: false,
      error: logErr?.message || "Log not found or not a Discord log",
    };
  }

  const integration = log.discord_integrations;
  if (!integration) {
    return { ok: false, error: "No Discord integration found" };
  }

  const botToken = await decrypt(integration.bot_token_encrypted);

  // Fetch all 3 RPCs for correct WTD/MTD totals
  const [{ data: leaderboardData }, { data: agencyData }, { data: imoData }] =
    await Promise.all([
      supabase.rpc("get_slack_leaderboard_with_periods", {
        p_imo_id: log.imo_id,
        p_agency_id: integration.agency_id || null,
      }),
      supabase.rpc("get_all_agencies_submit_totals", {
        p_imo_id: log.imo_id,
      }),
      !integration.agency_id
        ? supabase.rpc("get_imo_submit_totals", { p_imo_id: log.imo_id })
        : Promise.resolve({ data: null }),
    ]);

  const agents = (leaderboardData || []) as LeaderboardAgent[];
  const agencyTotals = (agencyData || []) as AgencySubmitTotals[];
  const imoTotals: ImoSubmitTotals | null = Array.isArray(imoData)
    ? imoData[0] || null
    : null;
  const leaderboardEmbeds = buildLeaderboardEmbeds(
    agents,
    log.title,
    agencyTotals,
    integration.agency_id || null,
    imoTotals,
  );

  if (leaderboardEmbeds.length === 0) {
    return { ok: true, updated: false };
  }

  // If we have an existing message, edit it; otherwise post new
  if (log.leaderboard_message_ts) {
    const result = await editDiscordMessage(
      botToken,
      log.channel_id,
      log.leaderboard_message_ts,
      { embeds: leaderboardEmbeds },
    );

    if (!result.ok) {
      // If edit fails (message deleted?), post new
      const newResult = await sendDiscordMessage(botToken, log.channel_id, {
        embeds: leaderboardEmbeds,
      });
      if (newResult.ok && newResult.messageId) {
        await supabase
          .from("daily_sales_logs")
          .update({ leaderboard_message_ts: newResult.messageId })
          .eq("id", logId);
      }
      return { ok: newResult.ok, updated: true };
    }

    return { ok: true, updated: true };
  } else {
    const result = await sendDiscordMessage(botToken, log.channel_id, {
      embeds: leaderboardEmbeds,
    });
    if (result.ok && result.messageId) {
      await supabase
        .from("daily_sales_logs")
        .update({ leaderboard_message_ts: result.messageId })
        .eq("id", logId);
    }
    return { ok: result.ok, updated: true };
  }
}

// ── Main: post-policy ──

async function handlePostPolicy(
  supabase: ReturnType<typeof createClient>,
  body: PolicyNotificationPayload,
): Promise<Response> {
  const {
    policyId,
    carrierId,
    productId,
    agentId,
    annualPremium,
    effectiveDate,
    imoId,
    agencyId: _agencyId,
  } = body;

  if (!imoId || !policyId) {
    return jsonResponse({ ok: false, error: "Missing imoId or policyId" }, 400);
  }

  // Resolve agentId — fallback chain: policies.user_id → commissions.user_id
  let resolvedAgentId = agentId;
  if (!resolvedAgentId && policyId) {
    // Try policies.user_id first
    const { data: policyRow } = await supabase
      .from("policies")
      .select("user_id")
      .eq("id", policyId)
      .maybeSingle();
    resolvedAgentId = policyRow?.user_id || undefined;

    // If still null, check commissions table (source of truth for selling agent)
    if (!resolvedAgentId) {
      const { data: commission } = await supabase
        .from("commissions")
        .select("user_id")
        .eq("policy_id", policyId)
        .eq("type", "advance")
        .maybeSingle();
      resolvedAgentId = commission?.user_id || undefined;
    }

    if (resolvedAgentId) {
      console.log(
        `[discord-policy-notification] Resolved agentId via fallback: ${resolvedAgentId}`,
      );
    }
  }

  // Backdating defense
  const todayDate = getTodayET();
  const { data: policy } = await supabase
    .from("policies")
    .select("submit_date")
    .eq("id", policyId)
    .maybeSingle();

  if (policy?.submit_date && policy.submit_date !== todayDate) {
    console.log(
      `[discord-policy-notification] Skipping backdated policy ${policyId}`,
    );
    return jsonResponse({ ok: true, skipped: true, reason: "backdated" });
  }

  // Get Discord integration
  const { data: integrations } = await supabase
    .from("discord_integrations")
    .select("*")
    .eq("imo_id", imoId)
    .eq("is_active", true)
    .eq("connection_status", "connected")
    .not("policy_channel_id", "is", null);

  if (!integrations || integrations.length === 0) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: "no_discord_integration",
    });
  }

  const integration = integrations[0];
  const channelId = integration.policy_channel_id!;

  // Fetch carrier, product, and agent names
  // Log IDs to help debug "Unknown" issues
  console.log(
    `[discord-policy-notification] Lookup IDs — agent=${resolvedAgentId}, carrier=${carrierId}, product=${productId}`,
  );

  const [carrierRes, productRes, agentRes] = await Promise.all([
    carrierId
      ? supabase
          .from("carriers")
          .select("name")
          .eq("id", carrierId)
          .maybeSingle()
      : null,
    productId
      ? supabase
          .from("products")
          .select("name")
          .eq("id", productId)
          .maybeSingle()
      : null,
    resolvedAgentId
      ? supabase
          .from("user_profiles")
          .select("first_name, last_name, email, profile_photo_url")
          .eq("id", resolvedAgentId)
          .maybeSingle()
      : null,
  ]);

  if (carrierRes?.error) {
    console.error(
      "[discord-policy-notification] Carrier lookup error:",
      carrierRes.error.message,
    );
  }
  if (productRes?.error) {
    console.error(
      "[discord-policy-notification] Product lookup error:",
      productRes.error.message,
    );
  }
  if (agentRes?.error) {
    console.error(
      "[discord-policy-notification] Agent lookup error:",
      agentRes.error.message,
    );
  }

  const carrierName = carrierRes?.data?.name || "Unknown Carrier";
  const productName = productRes?.data?.name || "Unknown Product";
  const agentData = agentRes?.data;
  const profileName = agentData
    ? `${agentData.first_name || ""} ${agentData.last_name || ""}`.trim() ||
      agentData.email ||
      "Unknown"
    : "Unknown Agent";

  // Try Discord guild member search first, fall back to user_profiles name
  const botToken = await decrypt(integration.bot_token_encrypted);
  let agentName = profileName;
  if (profileName !== "Unknown Agent" && integration.guild_id) {
    const discordName = await findDiscordDisplayName(
      botToken,
      integration.guild_id,
      profileName,
    );
    if (discordName) {
      agentName = discordName;
      console.log(
        `[discord-policy-notification] Using Discord display name: ${discordName}`,
      );
    }
  }

  console.log(
    `[discord-policy-notification] Resolved — agent=${agentName}, carrier=${carrierName}, product=${productName}`,
  );
  const premium = Number(annualPremium || 0);

  // Check daily_sales_logs for first sale
  const { data: existingLog } = await supabase
    .from("daily_sales_logs")
    .select(
      "id, first_seller_id, pending_policy_data, leaderboard_message_ts, title",
    )
    .eq("imo_id", imoId)
    .eq("discord_integration_id", integration.id)
    .eq("channel_id", channelId)
    .eq("log_date", todayDate)
    .maybeSingle();

  const isFirstSale =
    !existingLog ||
    (!existingLog.first_seller_id && !existingLog.pending_policy_data);

  if (isFirstSale) {
    // Store pending policy data for naming dialog
    const firstSaleGroupId = crypto.randomUUID();
    const pendingData: PendingPolicyData = {
      policyText: `${agentName} - ${carrierName} ${productName} - ${formatCurrency(premium)}`,
      carrierName,
      productName,
      agentName,
      agentDisplayName: agentName,
      agentAvatarUrl: agentData?.profile_photo_url || null,
      annualPremium: premium,
      effectiveDate: effectiveDate || "",
      agentId: resolvedAgentId || "",
    };

    if (existingLog) {
      await supabase
        .from("daily_sales_logs")
        .update({
          first_seller_id: resolvedAgentId,
          pending_policy_data: pendingData,
          leaderboard_message_ts: null,
          first_sale_group_id: firstSaleGroupId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLog.id);

      return jsonResponse({
        ok: true,
        pendingFirstSale: true,
        logId: existingLog.id,
        firstSaleGroupId,
      });
    } else {
      const { data: newLog, error: insertErr } = await supabase
        .from("daily_sales_logs")
        .insert({
          imo_id: imoId,
          discord_integration_id: integration.id,
          channel_id: channelId,
          log_date: todayDate,
          first_seller_id: resolvedAgentId,
          pending_policy_data: pendingData,
          first_sale_group_id: firstSaleGroupId,
          hierarchy_depth: 0,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(
          "[discord-policy-notification] Failed to create log:",
          insertErr,
        );
        return jsonResponse({ ok: false, error: insertErr.message }, 500);
      }

      return jsonResponse({
        ok: true,
        pendingFirstSale: true,
        logId: newLog.id,
        firstSaleGroupId,
      });
    }
  }

  // Subsequent sale — post policy immediately
  const policyEmbed = buildPolicyEmbed(
    agentName,
    carrierName,
    productName,
    premium,
    effectiveDate || "",
  );

  const policyResult = await sendDiscordMessage(botToken, channelId, {
    embeds: [policyEmbed],
  });

  // Audit
  await supabase.from("discord_messages").insert({
    imo_id: imoId,
    discord_integration_id: integration.id,
    channel_id: channelId,
    notification_type: "policy_created",
    message_id: policyResult.messageId || null,
    status: policyResult.ok ? "sent" : "failed",
    message_text: `${agentName} - ${carrierName} - ${formatCurrency(premium)}`,
    related_entity_type: "policy",
    related_entity_id: policyId,
    sent_at: policyResult.ok ? new Date().toISOString() : null,
    error_message: policyResult.error || null,
  });

  // Update leaderboard — fetch all 3 RPCs for correct WTD/MTD totals
  const [{ data: leaderboardData }, { data: agencyData }, { data: imoData }] =
    await Promise.all([
      supabase.rpc("get_slack_leaderboard_with_periods", {
        p_imo_id: imoId,
        p_agency_id: integration.agency_id || null,
      }),
      supabase.rpc("get_all_agencies_submit_totals", {
        p_imo_id: imoId,
      }),
      !integration.agency_id
        ? supabase.rpc("get_imo_submit_totals", { p_imo_id: imoId })
        : Promise.resolve({ data: null }),
    ]);

  const agents = (leaderboardData || []) as LeaderboardAgent[];
  const agencyTotals = (agencyData || []) as AgencySubmitTotals[];
  const imoTotals: ImoSubmitTotals | null = Array.isArray(imoData)
    ? imoData[0] || null
    : null;
  const leaderboardEmbeds = buildLeaderboardEmbeds(
    agents,
    existingLog?.title || null,
    agencyTotals,
    integration.agency_id || null,
    imoTotals,
  );

  if (leaderboardEmbeds.length > 0 && existingLog) {
    // Delete old leaderboard message and post new one
    if (existingLog.leaderboard_message_ts) {
      // Try to delete old message (best effort)
      try {
        await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages/${existingLog.leaderboard_message_ts}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bot ${botToken}` },
            signal: AbortSignal.timeout(10_000),
          },
        );
      } catch {
        // Ignore delete failures
      }
    }

    const lbResult = await sendDiscordMessage(botToken, channelId, {
      embeds: leaderboardEmbeds,
    });

    if (lbResult.ok && lbResult.messageId) {
      await supabase
        .from("daily_sales_logs")
        .update({ leaderboard_message_ts: lbResult.messageId })
        .eq("id", existingLog.id);
    }
  }

  return jsonResponse({
    ok: policyResult.ok,
    posted: true,
    messageId: policyResult.messageId,
    error: policyResult.error,
  });
}

// ── Utility ──

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Auth helper ──

async function authenticateCaller(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ ok: true; imoId?: string } | { ok: false; response: Response }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // Service role callers (DB trigger, cron) — full access
  if (token === serviceRoleKey) {
    return { ok: true };
  }

  // User JWT callers (frontend) — verify and extract imo_id
  if (token) {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        ),
      };
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("imo_id")
      .eq("id", user.id)
      .maybeSingle();

    return { ok: true, imoId: profile?.imo_id || undefined };
  }

  return {
    ok: false,
    response: new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    ),
  };
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
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

    // Authenticate caller
    const auth = await authenticateCaller(
      req,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );
    if (!auth.ok) return auth.response;

    const body: PolicyNotificationPayload = await req.json();
    const action = body.action || "post-policy";

    console.log(`[discord-policy-notification] action=${action}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // For user-initiated actions, verify ownership via imo_id
    if (auth.imoId && body.imoId && auth.imoId !== body.imoId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden: IMO mismatch" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "complete-first-sale" && body.logId) {
      // IDOR protection: verify log belongs to caller's IMO
      if (auth.imoId) {
        const { data: logCheck } = await supabase
          .from("daily_sales_logs")
          .select("imo_id")
          .eq("id", body.logId)
          .maybeSingle();
        if (logCheck && logCheck.imo_id !== auth.imoId) {
          return new Response(
            JSON.stringify({ ok: false, error: "Forbidden" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
      const result = await handleCompleteFirstSale(supabase, body.logId);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete-first-sale-batch" && body.firstSaleGroupId) {
      const result = await handleCompleteFirstSaleBatch(
        supabase,
        body.firstSaleGroupId,
        body.title,
      );
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-leaderboard" && body.logId) {
      const result = await handleUpdateLeaderboard(supabase, body.logId);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: post-policy
    return handlePostPolicy(supabase, body);
  } catch (err) {
    console.error("[discord-policy-notification] Unexpected error:", err);
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
