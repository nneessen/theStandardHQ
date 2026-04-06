// supabase/functions/discord-ip-leaderboard/index.ts
// Posts weekly IP (Issued Premium) + Submits report to Discord channels
//
// Reuses the same data logic as slack-ip-leaderboard but formats as Discord embeds.
// Posts to: weekly-leaderboard channel (agents) + agency-leaderboard channel (agencies)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  sendDiscordMessage,
  formatCurrency,
  getRankEmoji,
  COLORS,
  type DiscordEmbed,
} from "../_shared/discord.ts";

// ── Types ──

interface IPLeaderboardEntry {
  agent_id: string;
  agent_name: string;
  wtd_ip: number;
  wtd_policies: number;
  mtd_ip: number;
  mtd_policies: number;
  wtd_submits: number;
  wtd_submit_ap: number;
  mtd_submits: number;
  mtd_submit_ap: number;
}

interface AgencyIPEntry {
  agency_id: string;
  agency_name: string;
  wtd_ip: number;
  wtd_policies: number;
  mtd_ip: number;
  mtd_policies: number;
  wtd_submits: number;
  wtd_submit_ap: number;
  mtd_submits: number;
  mtd_submit_ap: number;
}

interface ActiveAgency {
  id: string;
  name: string;
  parent_agency_id: string | null;
  owner_id: string | null;
}

interface UserProfileForAgency {
  id: string;
  imo_id: string | null;
  agency_id: string | null;
  hierarchy_path: string | null;
  roles: string[] | null;
  is_admin: boolean | null;
  approval_status: string | null;
  archived_at: string | null;
}

interface PolicyForIP {
  id: string;
  user_id: string | null;
  agency_id: string | null;
  annual_premium: number | string | null;
  effective_date: string | null;
}

interface PolicyForSubmit {
  id: string;
  user_id: string | null;
  agency_id: string | null;
  annual_premium: number | string | null;
  submit_date: string | null;
}

interface SubmitData {
  wtd_submits: number;
  wtd_submit_ap: number;
  mtd_submits: number;
  mtd_submit_ap: number;
}

interface ReportingWindow {
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
  weekRange: string;
}

// ── Date helpers ──

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReportingWindow(): ReportingWindow {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );

  const day = et.getDay();
  const diff = et.getDate() - day + (day === 0 ? -6 : 1);
  const currentMonday = new Date(et);
  currentMonday.setDate(diff);

  let monday: Date;
  let sunday: Date;

  if (day === 0) {
    monday = new Date(currentMonday);
    sunday = new Date(et);
  } else {
    monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - 7);
    sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() - 1);
  }

  // Anchor MTD to the report end date (sunday), not monday.
  // When a week crosses month boundaries (e.g. Mar 30 – Apr 5),
  // MTD should reflect the current calendar month (April 1–5).
  const monthStart = new Date(sunday);
  monthStart.setDate(1);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  );
  const mtdEnd = sunday.getTime() < monthEnd.getTime() ? sunday : monthEnd;

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const mondayStr = monday.toLocaleDateString("en-US", options);
  const sundayStr = sunday.toLocaleDateString("en-US", options);

  return {
    weekStart: toIsoDate(monday),
    weekEnd: toIsoDate(sunday),
    monthStart: toIsoDate(monthStart),
    monthEnd: toIsoDate(mtdEnd),
    weekRange: `${mondayStr} - ${sundayStr}`,
  };
}

function inDateRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

// ── Data fetching (same as slack-ip-leaderboard) ──

async function fetchPoliciesForRange(
  supabase: ReturnType<typeof createClient>,
  imoId: string,
  startDate: string,
  endDate: string,
): Promise<PolicyForIP[]> {
  const pageSize = 1000;
  let from = 0;
  const allPolicies: PolicyForIP[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("policies")
      .select("id, user_id, agency_id, annual_premium, effective_date")
      .eq("imo_id", imoId)
      .eq("status", "approved")
      .not("effective_date", "is", null)
      .gte("effective_date", startDate)
      .lte("effective_date", endDate)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Failed to fetch policies: ${error.message}`);
    const rows = (data || []) as PolicyForIP[];
    allPolicies.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allPolicies;
}

async function fetchSubmittedPoliciesForRange(
  supabase: ReturnType<typeof createClient>,
  imoId: string,
  startDate: string,
  endDate: string,
): Promise<PolicyForSubmit[]> {
  const pageSize = 1000;
  let from = 0;
  const allPolicies: PolicyForSubmit[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("policies")
      .select("id, user_id, agency_id, annual_premium, submit_date")
      .eq("imo_id", imoId)
      .in("status", ["active", "pending", "approved"])
      .not("submit_date", "is", null)
      .gte("submit_date", startDate)
      .lte("submit_date", endDate)
      .order("id", { ascending: true })
      .range(from, to);

    if (error)
      throw new Error(`Failed to fetch submitted policies: ${error.message}`);
    const rows = (data || []) as PolicyForSubmit[];
    allPolicies.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allPolicies;
}

async function fetchUserNames(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const chunkSize = 500;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .in("id", chunk);

    if (error) throw new Error(`Failed to fetch user names: ${error.message}`);
    for (const user of data || []) {
      const name =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        user.email ||
        "Unknown";
      map.set(user.id, name);
    }
  }

  return map;
}

async function fetchActiveAgencies(
  supabase: ReturnType<typeof createClient>,
  imoId: string,
): Promise<ActiveAgency[]> {
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, parent_agency_id, owner_id")
    .eq("imo_id", imoId)
    .eq("is_active", true);

  if (error)
    throw new Error(`Failed to fetch active agencies: ${error.message}`);
  return (data || []).map((a) => ({
    id: a.id,
    name: a.name || "Unknown Agency",
    parent_agency_id: a.parent_agency_id,
    owner_id: a.owner_id,
  }));
}

async function fetchAgencyUsers(
  supabase: ReturnType<typeof createClient>,
  imoId: string,
): Promise<UserProfileForAgency[]> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, imo_id, agency_id, hierarchy_path, roles, is_admin, approval_status, archived_at",
    )
    .eq("imo_id", imoId);

  if (error) throw new Error(`Failed to fetch agency users: ${error.message}`);
  return (data || []) as UserProfileForAgency[];
}

// ── Data processing (identical to slack-ip-leaderboard) ──

function buildSubmitMap(
  submitPolicies: PolicyForSubmit[],
  monthStart: string,
  monthEnd: string,
  weekStart: string,
  weekEnd: string,
): Map<string, SubmitData> {
  const byUser = new Map<string, SubmitData>();

  for (const policy of submitPolicies) {
    if (!policy.user_id || !policy.submit_date) continue;
    const premium = Number(policy.annual_premium || 0);
    const validPremium = Number.isFinite(premium) ? premium : 0;

    const existing = byUser.get(policy.user_id) || {
      wtd_submits: 0,
      wtd_submit_ap: 0,
      mtd_submits: 0,
      mtd_submit_ap: 0,
    };

    if (inDateRange(policy.submit_date, monthStart, monthEnd)) {
      existing.mtd_submits += 1;
      existing.mtd_submit_ap += validPremium;
    }
    if (inDateRange(policy.submit_date, weekStart, weekEnd)) {
      existing.wtd_submits += 1;
      existing.wtd_submit_ap += validPremium;
    }

    byUser.set(policy.user_id, existing);
  }

  return byUser;
}

function buildAgentEntries(
  ipPolicies: PolicyForIP[],
  submitMap: Map<string, SubmitData>,
  monthStart: string,
  monthEnd: string,
  weekStart: string,
  weekEnd: string,
  userNameById: Map<string, string>,
): IPLeaderboardEntry[] {
  const byUser = new Map<string, IPLeaderboardEntry>();

  for (const policy of ipPolicies) {
    if (!policy.user_id || !policy.effective_date) continue;
    const premium = Number(policy.annual_premium || 0);
    if (!Number.isFinite(premium)) continue;

    const existing = byUser.get(policy.user_id) || {
      agent_id: policy.user_id,
      agent_name: userNameById.get(policy.user_id) || "Unknown",
      wtd_ip: 0,
      wtd_policies: 0,
      mtd_ip: 0,
      mtd_policies: 0,
      wtd_submits: 0,
      wtd_submit_ap: 0,
      mtd_submits: 0,
      mtd_submit_ap: 0,
    };

    if (inDateRange(policy.effective_date, monthStart, monthEnd)) {
      existing.mtd_ip += premium;
      existing.mtd_policies += 1;
    }
    if (inDateRange(policy.effective_date, weekStart, weekEnd)) {
      existing.wtd_ip += premium;
      existing.wtd_policies += 1;
    }

    byUser.set(policy.user_id, existing);
  }

  for (const [userId, submit] of submitMap) {
    const existing = byUser.get(userId) || {
      agent_id: userId,
      agent_name: userNameById.get(userId) || "Unknown",
      wtd_ip: 0,
      wtd_policies: 0,
      mtd_ip: 0,
      mtd_policies: 0,
      wtd_submits: 0,
      wtd_submit_ap: 0,
      mtd_submits: 0,
      mtd_submit_ap: 0,
    };

    existing.wtd_submits = submit.wtd_submits;
    existing.wtd_submit_ap = submit.wtd_submit_ap;
    existing.mtd_submits = submit.mtd_submits;
    existing.mtd_submit_ap = submit.mtd_submit_ap;

    byUser.set(userId, existing);
  }

  return [...byUser.values()]
    .filter(
      (e) =>
        e.wtd_ip > 0 || e.mtd_ip > 0 || e.wtd_submits > 0 || e.mtd_submits > 0,
    )
    .sort((a, b) => b.mtd_ip - a.mtd_ip || b.mtd_submits - a.mtd_submits);
}

function buildAgencyEntries(
  ipPolicies: PolicyForIP[],
  submitMap: Map<string, SubmitData>,
  monthStart: string,
  monthEnd: string,
  weekStart: string,
  weekEnd: string,
  activeAgencies: ActiveAgency[],
  users: UserProfileForAgency[],
): AgencyIPEntry[] {
  const activeAgencyById = new Map(activeAgencies.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const childIdsByParentId = new Map<string, string[]>();
  for (const agency of activeAgencies) {
    if (!agency.parent_agency_id) continue;
    const siblings = childIdsByParentId.get(agency.parent_agency_id) || [];
    siblings.push(agency.id);
    childIdsByParentId.set(agency.parent_agency_id, siblings);
  }

  const descendantsByAgencyId = new Map<string, Set<string>>();
  const inProgressDescendants = new Set<string>();

  const getAgencyDescendants = (agencyId: string): Set<string> => {
    const cached = descendantsByAgencyId.get(agencyId);
    if (cached) return cached;
    if (inProgressDescendants.has(agencyId)) return new Set([agencyId]);
    inProgressDescendants.add(agencyId);

    const descendants = new Set<string>([agencyId]);
    for (const childId of childIdsByParentId.get(agencyId) || []) {
      for (const descendantId of getAgencyDescendants(childId)) {
        descendants.add(descendantId);
      }
    }

    inProgressDescendants.delete(agencyId);
    descendantsByAgencyId.set(agencyId, descendants);
    return descendants;
  };

  const policyTotalsByUserId = new Map<
    string,
    {
      wtd_ip: number;
      wtd_policies: number;
      mtd_ip: number;
      mtd_policies: number;
    }
  >();

  for (const policy of ipPolicies) {
    if (!policy.user_id || !policy.effective_date) continue;
    const premium = Number(policy.annual_premium || 0);
    if (!Number.isFinite(premium)) continue;

    const totals = policyTotalsByUserId.get(policy.user_id) || {
      wtd_ip: 0,
      wtd_policies: 0,
      mtd_ip: 0,
      mtd_policies: 0,
    };

    if (inDateRange(policy.effective_date, monthStart, monthEnd)) {
      totals.mtd_ip += premium;
      totals.mtd_policies += 1;
    }
    if (inDateRange(policy.effective_date, weekStart, weekEnd)) {
      totals.wtd_ip += premium;
      totals.wtd_policies += 1;
    }

    policyTotalsByUserId.set(policy.user_id, totals);
  }

  const isEligibleAgencyUser = (user: UserProfileForAgency): boolean => {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const hasAgentRole = roles.includes("agent");
    const hasActiveAgentRole = roles.includes("active_agent");
    const hasRecruitRole = roles.includes("recruit");
    const isRecruitOnly =
      hasRecruitRole && !hasAgentRole && !hasActiveAgentRole;

    return (
      user.approval_status === "approved" &&
      !user.archived_at &&
      (hasAgentRole || hasActiveAgentRole || user.is_admin === true) &&
      !isRecruitOnly
    );
  };

  const eligibleUsers = users.filter(isEligibleAgencyUser);
  const results: AgencyIPEntry[] = [];

  for (const agency of activeAgencies) {
    const ownerHierarchyPath = agency.owner_id
      ? userById.get(agency.owner_id)?.hierarchy_path || null
      : null;
    const descendantAgencyIds = getAgencyDescendants(agency.id);

    const memberUserIds = new Set<string>();
    for (const user of eligibleUsers) {
      const hierarchyPath = user.hierarchy_path;
      const matchesOwnerPath = ownerHierarchyPath
        ? hierarchyPath === ownerHierarchyPath ||
          (hierarchyPath !== null &&
            hierarchyPath.startsWith(`${ownerHierarchyPath}.`))
        : false;
      const matchesAgencyTree = user.agency_id
        ? descendantAgencyIds.has(user.agency_id)
        : false;

      if (matchesOwnerPath || matchesAgencyTree) {
        memberUserIds.add(user.id);
      }
    }

    let wtdIP = 0,
      wtdPolicies = 0,
      mtdIP = 0,
      mtdPolicies = 0;
    let wtdSubmits = 0,
      wtdSubmitAP = 0,
      mtdSubmits = 0,
      mtdSubmitAP = 0;

    for (const userId of memberUserIds) {
      const ipTotals = policyTotalsByUserId.get(userId);
      if (ipTotals) {
        wtdIP += ipTotals.wtd_ip;
        wtdPolicies += ipTotals.wtd_policies;
        mtdIP += ipTotals.mtd_ip;
        mtdPolicies += ipTotals.mtd_policies;
      }
      const submitTotals = submitMap.get(userId);
      if (submitTotals) {
        wtdSubmits += submitTotals.wtd_submits;
        wtdSubmitAP += submitTotals.wtd_submit_ap;
        mtdSubmits += submitTotals.mtd_submits;
        mtdSubmitAP += submitTotals.mtd_submit_ap;
      }
    }

    results.push({
      agency_id: agency.id,
      agency_name: activeAgencyById.get(agency.id)?.name ?? "Unknown Agency",
      wtd_ip: wtdIP,
      wtd_policies: wtdPolicies,
      mtd_ip: mtdIP,
      mtd_policies: mtdPolicies,
      wtd_submits: wtdSubmits,
      wtd_submit_ap: wtdSubmitAP,
      mtd_submits: mtdSubmits,
      mtd_submit_ap: mtdSubmitAP,
    });
  }

  return results
    .filter(
      (e) =>
        e.wtd_ip > 0 || e.mtd_ip > 0 || e.wtd_submits > 0 || e.mtd_submits > 0,
    )
    .sort((a, b) => b.mtd_ip - a.mtd_ip || b.mtd_submits - a.mtd_submits);
}

function buildDisplayAgencies(
  agencies: AgencyIPEntry[],
  totalWTD: number,
  totalMTD: number,
  totalWTDSubmits: number,
  totalWTDSubmitAP: number,
  totalMTDSubmits: number,
  totalMTDSubmitAP: number,
): AgencyIPEntry[] {
  const display = [...agencies]
    .filter(
      (a) =>
        a.wtd_ip > 0 || a.mtd_ip > 0 || a.wtd_submits > 0 || a.mtd_submits > 0,
    )
    .sort((a, b) => b.mtd_ip - a.mtd_ip || b.mtd_submits - a.mtd_submits);

  const selfMadeIndex = display.findIndex((a) =>
    a.agency_name.toLowerCase().includes("self made"),
  );

  if (selfMadeIndex >= 0) {
    display[selfMadeIndex] = {
      ...display[selfMadeIndex],
      wtd_ip: totalWTD,
      mtd_ip: totalMTD,
      wtd_submits: totalWTDSubmits,
      wtd_submit_ap: totalWTDSubmitAP,
      mtd_submits: totalMTDSubmits,
      mtd_submit_ap: totalMTDSubmitAP,
    };
  } else {
    display.unshift({
      agency_id: "self-made-rollup",
      agency_name: "Self Made Financial",
      wtd_ip: totalWTD,
      wtd_policies: 0,
      mtd_ip: totalMTD,
      mtd_policies: 0,
      wtd_submits: totalWTDSubmits,
      wtd_submit_ap: totalWTDSubmitAP,
      mtd_submits: totalMTDSubmits,
      mtd_submit_ap: totalMTDSubmitAP,
    });
  }

  return display.sort(
    (a, b) => b.mtd_ip - a.mtd_ip || b.mtd_submits - a.mtd_submits,
  );
}

// ── Discord embed builders ──

function buildAgentLeaderboardEmbeds(
  agents: IPLeaderboardEntry[],
  weekRange: string,
): DiscordEmbed[] {
  const embeds: DiscordEmbed[] = [];

  // Header embed
  embeds.push({
    title: "📊 Weekly IP & Submits Report",
    description: [
      `📅 **Week of ${weekRange}**`,
      "",
      "**IP (Issued Premium):** Approved & placed policies by effective date",
      "**Submitted Apps:** All submitted policies by submit date",
      "",
      "⚠️ *Accuracy depends on YOU: Update your policies from pending to approved when policies go into effect.*",
    ].join("\n"),
    color: COLORS.BLUE,
  });

  // WTD producers
  const agentsWithWTD = agents
    .filter((a) => a.wtd_ip > 0 || a.wtd_submits > 0)
    .sort((a, b) => b.wtd_submit_ap - a.wtd_submit_ap || b.wtd_ip - a.wtd_ip);

  if (agentsWithWTD.length > 0) {
    const lines = agentsWithWTD.map((agent, i) => {
      const rank = getRankEmoji(i + 1);
      return `${rank} **${formatCurrency(agent.wtd_submit_ap)}** AP  ·  ${agent.agent_name}  (${formatCurrency(agent.wtd_ip)} IP)`;
    });

    embeds.push({
      title: "🏆 Top Producers (WTD)",
      description: lines.join("\n"),
      color: COLORS.GOLD,
    });
  }

  // MTD producers
  const agentsWithMTD = agents
    .filter((a) => a.mtd_ip > 0 || a.mtd_submits > 0)
    .sort((a, b) => b.mtd_submit_ap - a.mtd_submit_ap || b.mtd_ip - a.mtd_ip);

  if (agentsWithMTD.length > 0) {
    const lines = agentsWithMTD.map((agent, i) => {
      const rank = getRankEmoji(i + 1);
      return `${rank} **${formatCurrency(agent.mtd_submit_ap)}** AP  ·  ${agent.agent_name}  (${formatCurrency(agent.mtd_ip)} IP)`;
    });

    embeds.push({
      title: "📈 Top Producers (MTD)",
      description: lines.join("\n"),
      color: COLORS.GREEN,
    });
  }

  // Totals
  const totalWTDIP = agents.reduce((s, a) => s + a.wtd_ip, 0);
  const totalMTDIP = agents.reduce((s, a) => s + a.mtd_ip, 0);
  const totalWTDSubmitAP = agents.reduce((s, a) => s + a.wtd_submit_ap, 0);
  const totalMTDSubmitAP = agents.reduce((s, a) => s + a.mtd_submit_ap, 0);

  embeds.push({
    title: "💰 Totals",
    fields: [
      {
        name: "WTD",
        value: `${formatCurrency(totalWTDSubmitAP)} AP submitted  ·  ${formatCurrency(totalWTDIP)} IP`,
        inline: true,
      },
      {
        name: "MTD",
        value: `${formatCurrency(totalMTDSubmitAP)} AP submitted  ·  ${formatCurrency(totalMTDIP)} IP`,
        inline: true,
      },
    ],
    color: COLORS.PURPLE,
  });

  return embeds;
}

function buildAgencyLeaderboardEmbeds(
  agencies: AgencyIPEntry[],
  agents: IPLeaderboardEntry[],
  weekRange: string,
): DiscordEmbed[] {
  const totalWTDIP = agents.reduce((s, a) => s + a.wtd_ip, 0);
  const totalMTDIP = agents.reduce((s, a) => s + a.mtd_ip, 0);
  const totalWTDSubmits = agents.reduce((s, a) => s + a.wtd_submits, 0);
  const totalWTDSubmitAP = agents.reduce((s, a) => s + a.wtd_submit_ap, 0);
  const totalMTDSubmits = agents.reduce((s, a) => s + a.mtd_submits, 0);
  const totalMTDSubmitAP = agents.reduce((s, a) => s + a.mtd_submit_ap, 0);

  const displayAgencies = buildDisplayAgencies(
    agencies,
    totalWTDIP,
    totalMTDIP,
    totalWTDSubmits,
    totalWTDSubmitAP,
    totalMTDSubmits,
    totalMTDSubmitAP,
  );

  const lines = displayAgencies.map(
    (agency) =>
      `**${agency.agency_name}**\nWTD: ${formatCurrency(agency.wtd_submit_ap)} AP · ${formatCurrency(agency.wtd_ip)} IP  |  MTD: ${formatCurrency(agency.mtd_submit_ap)} AP · ${formatCurrency(agency.mtd_ip)} IP`,
  );

  return [
    {
      title: "🏢 Agency Rankings",
      description: `📅 **Week of ${weekRange}**\n\n${lines.join("\n\n")}`,
      color: COLORS.BLUE,
    },
  ];
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[discord-ip-leaderboard] Function invoked");

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

    // Authenticate: require service_role key (called by cron and scripts only)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const imoId = body.imoId;
    const testChannelId = body.testChannelId; // Override channel for testing (service_role only)

    if (!imoId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing imoId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Discord integration
    const { data: integrations, error: integrationError } = await supabase
      .from("discord_integrations")
      .select("*")
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .limit(1);

    const integration = integrations?.[0];

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No active Discord integration found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const weeklyChannelId =
      testChannelId || integration.weekly_leaderboard_channel_id;
    const agencyChannelId =
      testChannelId || integration.agency_leaderboard_channel_id;

    if (!weeklyChannelId && !agencyChannelId) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "No leaderboard channels configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Get reporting window
    const reportingWindow = getReportingWindow();

    // Fetch all data — use the earlier of monthStart/weekStart so cross-month
    // weeks (e.g. week starts Mar 30, month starts Apr 1) don't lose WTD data.
    const fetchStart =
      reportingWindow.monthStart < reportingWindow.weekStart
        ? reportingWindow.monthStart
        : reportingWindow.weekStart;

    const [ipPolicies, submitPolicies, activeAgencies, allUsers] =
      await Promise.all([
        fetchPoliciesForRange(
          supabase,
          imoId,
          fetchStart,
          reportingWindow.weekEnd,
        ),
        fetchSubmittedPoliciesForRange(
          supabase,
          imoId,
          fetchStart,
          reportingWindow.weekEnd,
        ),
        fetchActiveAgencies(supabase, imoId),
        fetchAgencyUsers(supabase, imoId),
      ]);

    // Get user names
    const allUserIds = new Set<string>();
    for (const p of ipPolicies) if (p.user_id) allUserIds.add(p.user_id);
    for (const p of submitPolicies) if (p.user_id) allUserIds.add(p.user_id);
    const userNameById = await fetchUserNames(supabase, [...allUserIds]);

    // Build data
    const submitMap = buildSubmitMap(
      submitPolicies,
      reportingWindow.monthStart,
      reportingWindow.monthEnd,
      reportingWindow.weekStart,
      reportingWindow.weekEnd,
    );

    const agents = buildAgentEntries(
      ipPolicies,
      submitMap,
      reportingWindow.monthStart,
      reportingWindow.monthEnd,
      reportingWindow.weekStart,
      reportingWindow.weekEnd,
      userNameById,
    );

    // Approved agent count (unused currently, kept for future embed footer)
    await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("imo_id", imoId)
      .eq("approval_status", "approved")
      .is("archived_at", null)
      .or("roles.cs.{agent},roles.cs.{active_agent}");

    const agencies = buildAgencyEntries(
      ipPolicies,
      submitMap,
      reportingWindow.monthStart,
      reportingWindow.monthEnd,
      reportingWindow.weekStart,
      reportingWindow.weekEnd,
      activeAgencies,
      allUsers,
    );

    const weekRange = reportingWindow.weekRange;
    const results: { channel: string; ok: boolean; error?: string }[] = [];

    // Post agent leaderboard to weekly channel
    if (weeklyChannelId) {
      const embeds = buildAgentLeaderboardEmbeds(agents, weekRange);
      const result = await sendDiscordMessage(botToken, weeklyChannelId, {
        embeds,
      });

      await supabase.from("discord_messages").insert({
        imo_id: imoId,
        discord_integration_id: integration.id,
        channel_id: weeklyChannelId,
        notification_type: "ip_leaderboard",
        message_id: result.messageId || null,
        status: result.ok ? "sent" : "failed",
        message_text: `IP leaderboard for ${weekRange}`,
        related_entity_type: "leaderboard",
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.error || null,
      });

      results.push({
        channel: "weekly-leaderboard",
        ok: result.ok,
        error: result.error,
      });
    }

    // Post agency leaderboard to agency channel
    if (agencyChannelId) {
      const embeds = buildAgencyLeaderboardEmbeds(agencies, agents, weekRange);
      const result = await sendDiscordMessage(botToken, agencyChannelId, {
        embeds,
      });

      await supabase.from("discord_messages").insert({
        imo_id: imoId,
        discord_integration_id: integration.id,
        channel_id: agencyChannelId,
        notification_type: "agency_leaderboard",
        message_id: result.messageId || null,
        status: result.ok ? "sent" : "failed",
        message_text: `Agency leaderboard for ${weekRange}`,
        related_entity_type: "leaderboard",
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.error || null,
      });

      results.push({
        channel: "agency-leaderboard",
        ok: result.ok,
        error: result.error,
      });
    }

    const allOk = results.every((r) => r.ok);

    console.log(
      `[discord-ip-leaderboard] Posted IP & submits report (${weekRange}): ${JSON.stringify(results)}`,
    );

    return new Response(JSON.stringify({ ok: allOk, results, weekRange }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[discord-ip-leaderboard] Unexpected error:", err);
    const corsHeaders2 = getCorsHeaders(req.headers.get("origin"));
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders2, "Content-Type": "application/json" },
      },
    );
  }
});
