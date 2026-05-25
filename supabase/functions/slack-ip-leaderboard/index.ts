// supabase/functions/slack-ip-leaderboard/index.ts
// Posts weekly IP (Issued Premium) + Submits report to configured Slack channel
//
// **IP (Issued Premium) Definition:**
// Policies that are APPROVED and PLACED/ISSUED count towards IP.
// Based on effective_date, not submit_date.
// Does NOT include pending policies that have not been issued yet.
//
// **Submits Definition:**
// All submitted policies (active, pending, approved) count towards submits.
// Based on submit_date.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  authorizeSlackImoAccess,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

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
 * Get rank emoji
 */
function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return ":first_place_medal:";
    case 2:
      return ":second_place_medal:";
    case 3:
      return ":third_place_medal:";
    default:
      return `${rank}.`;
  }
}

/**
 * Format date as YYYY-MM-DD (using local date parts from ET-derived Date object)
 */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get reporting window for weekly IP report.
 * - Mon-Sat runs: previous completed Mon-Sun week
 * - Sunday runs: current Mon-Sun week ending today
 */
function getReportingWindow(): ReportingWindow {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );

  // Get Monday of current week
  const day = et.getDay();
  const diff = et.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const currentMonday = new Date(et);
  currentMonday.setDate(diff);

  let monday: Date;
  let sunday: Date;

  // Sunday should report the week that just ended today (Mon-Sun).
  if (day === 0) {
    monday = new Date(currentMonday);
    sunday = new Date(et);
  } else {
    // Mon-Sat report the most recent completed Mon-Sun week.
    monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - 7);
    sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() - 1);
  }

  // Anchor MTD to the month the reported week starts in.
  // This prevents cross-month weeks (e.g. Feb 23 - Mar 1) from collapsing MTD
  // to only the first day of the new month.
  const monthStart = new Date(monday);
  monthStart.setDate(1);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  );

  // MTD should not spill into the next month when a week crosses month boundary.
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

/**
 * Fetch all approved policies in the given effective-date window.
 * Uses pagination to avoid row limits.
 */
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

    if (error) {
      throw new Error(`Failed to fetch policies: ${error.message}`);
    }

    const rows = (data || []) as PolicyForIP[];
    allPolicies.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allPolicies;
}

/**
 * Fetch all submitted policies in the given submit-date window.
 * Includes active, pending, and approved statuses.
 * Uses pagination to avoid row limits.
 */
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

    if (error) {
      throw new Error(`Failed to fetch submitted policies: ${error.message}`);
    }

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

    if (error) {
      throw new Error(`Failed to fetch user names: ${error.message}`);
    }

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

  if (error) {
    throw new Error(`Failed to fetch active agencies: ${error.message}`);
  }

  return (data || []).map((agency) => ({
    id: agency.id,
    name: agency.name || "Unknown Agency",
    parent_agency_id: agency.parent_agency_id,
    owner_id: agency.owner_id,
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

  if (error) {
    throw new Error(`Failed to fetch agency users: ${error.message}`);
  }

  return (data || []) as UserProfileForAgency[];
}

/**
 * Build submit data map keyed by user_id from submitted policies.
 */
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

  // Process IP policies
  for (const policy of ipPolicies) {
    if (!policy.user_id || !policy.effective_date) continue;
    const premium = Number(policy.annual_premium || 0);
    if (!Number.isFinite(premium)) continue;

    const existing =
      byUser.get(policy.user_id) ||
      ({
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
      } as IPLeaderboardEntry);

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

  // Merge submit data into existing entries and create submit-only entries
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
      (entry) =>
        entry.wtd_ip > 0 ||
        entry.mtd_ip > 0 ||
        entry.wtd_submits > 0 ||
        entry.mtd_submits > 0,
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
  const activeAgencyById = new Map(
    activeAgencies.map((agency) => [agency.id, agency]),
  );
  const userById = new Map(users.map((user) => [user.id, user]));

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

    if (inProgressDescendants.has(agencyId)) {
      return new Set([agencyId]);
    }

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

  // IP totals per user
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

    let wtdIP = 0;
    let wtdPolicies = 0;
    let mtdIP = 0;
    let mtdPolicies = 0;
    let wtdSubmits = 0;
    let wtdSubmitAP = 0;
    let mtdSubmits = 0;
    let mtdSubmitAP = 0;

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
      (entry) =>
        entry.wtd_ip > 0 ||
        entry.mtd_ip > 0 ||
        entry.wtd_submits > 0 ||
        entry.mtd_submits > 0,
    )
    .sort((a, b) => b.mtd_ip - a.mtd_ip || b.mtd_submits - a.mtd_submits);
}

/**
 * Apply reporting business rule:
 * Self Made (top/root agency) should reflect rolled-up IMO totals.
 */
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

  const selfMadeIndex = display.findIndex((agency) =>
    agency.agency_name.toLowerCase().includes("self made"),
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

/**
 * Build combined IP + Submits leaderboard message
 */
function buildIPLeaderboardMessage(
  agents: IPLeaderboardEntry[],
  agencies: AgencyIPEntry[],
  _totalAgentCount: number,
  weekRange: string,
): string {
  let message = `:chart_with_upwards_trend: *Weekly IP & Submits Report*\n`;
  message += `:date: Week of ${weekRange}\n\n`;
  message += `*IP (Issued Premium):* Approved & placed policies by effective date\n`;
  message += `*Submitted Apps:* All submitted policies by submit date\n\n`;
  message += `:warning: *Accuracy depends on YOU:* Update your policies from pending to approved when policies go into effect.\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // ── Top Producers WTD (ranked by submit AP) ──
  const agentsWithWTD = agents
    .filter((a) => a.wtd_ip > 0 || a.wtd_submits > 0)
    .sort((a, b) => b.wtd_submit_ap - a.wtd_submit_ap || b.wtd_ip - a.wtd_ip);

  if (agentsWithWTD.length > 0) {
    message += `*Top Producers (WTD):*\n`;
    agentsWithWTD.forEach((agent, index) => {
      const rank = index + 1;
      const emoji = getRankEmoji(rank);
      const submitAP = formatCurrency(agent.wtd_submit_ap);
      const paddedAP = submitAP.padStart(10, " ");
      const ip = formatCurrency(agent.wtd_ip);
      message += `${emoji} ${paddedAP} AP  ·  ${agent.agent_name}  (${ip} IP)\n`;
    });
    message += `\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // ── Top Producers MTD (ranked by submit AP) ──
  const agentsWithMTD = agents
    .filter((a) => a.mtd_ip > 0 || a.mtd_submits > 0)
    .sort((a, b) => b.mtd_submit_ap - a.mtd_submit_ap || b.mtd_ip - a.mtd_ip);

  if (agentsWithMTD.length > 0) {
    message += `*Top Producers (MTD):*\n`;
    agentsWithMTD.forEach((agent, index) => {
      const rank = index + 1;
      const emoji = getRankEmoji(rank);
      const submitAP = formatCurrency(agent.mtd_submit_ap);
      const paddedAP = submitAP.padStart(10, " ");
      const ip = formatCurrency(agent.mtd_ip);
      message += `${emoji} ${paddedAP} AP  ·  ${agent.agent_name}  (${ip} IP)\n`;
    });
    message += `\n`;
  }

  // ── Totals ──
  const totalWTDIP = agents.reduce((sum, agent) => sum + agent.wtd_ip, 0);
  const totalMTDIP = agents.reduce((sum, agent) => sum + agent.mtd_ip, 0);
  const totalWTDSubmits = agents.reduce((sum, a) => sum + a.wtd_submits, 0);
  const totalWTDSubmitAP = agents.reduce((sum, a) => sum + a.wtd_submit_ap, 0);
  const totalMTDSubmits = agents.reduce((sum, a) => sum + a.mtd_submits, 0);
  const totalMTDSubmitAP = agents.reduce((sum, a) => sum + a.mtd_submit_ap, 0);

  const displayAgencies = buildDisplayAgencies(
    agencies,
    totalWTDIP,
    totalMTDIP,
    totalWTDSubmits,
    totalWTDSubmitAP,
    totalMTDSubmits,
    totalMTDSubmitAP,
  );

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `:moneybag: *Total WTD:* ${formatCurrency(totalWTDSubmitAP)} AP submitted  ·  ${formatCurrency(totalWTDIP)} IP\n`;
  message += `:calendar: *Total MTD:* ${formatCurrency(totalMTDSubmitAP)} AP submitted  ·  ${formatCurrency(totalMTDIP)} IP\n\n`;

  // ── Agency rankings ──
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `:office: *Agency Rankings*\n\n`;

  displayAgencies.forEach((agency) => {
    message += `${agency.agency_name}:\n`;
    message += `  WTD: ${formatCurrency(agency.wtd_submit_ap)} AP · ${formatCurrency(agency.wtd_ip)} IP  |  MTD: ${formatCurrency(agency.mtd_submit_ap)} AP · ${formatCurrency(agency.mtd_ip)} IP\n`;
  });

  return message;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-ip-leaderboard] Function invoked");
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body = await req.json();
    const { imoId } = body;

    if (!imoId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing imoId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const imoAccessResponse = await authorizeSlackImoAccess(
      authContext,
      corsHeaders,
      imoId,
    );
    if (imoAccessResponse) {
      return imoAccessResponse;
    }

    const supabase = authContext.supabaseAdmin;

    // Get Self Made Slack integration specifically
    const { data: integrations, error: integrationError } = await supabase
      .from("slack_integrations")
      .select("*, workspace_logo_url")
      .eq("imo_id", imoId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .ilike("team_name", "%self made%")
      .limit(1);

    const integration = integrations?.[0];

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No active Slack integration found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if leaderboard channel is configured
    if (!integration.leaderboard_channel_id) {
      console.log("[slack-ip-leaderboard] No leaderboard channel configured");
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "No leaderboard channel configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const reportingWindow = getReportingWindow();
    const fetchStartDate =
      reportingWindow.weekStart < reportingWindow.monthStart
        ? reportingWindow.weekStart
        : reportingWindow.monthStart;

    // Fetch IP policies (approved, by effective_date) and submitted policies
    // (active/pending/approved, by submit_date) in parallel
    const [ipPolicies, submitPolicies] = await Promise.all([
      fetchPoliciesForRange(
        supabase,
        imoId,
        fetchStartDate,
        reportingWindow.weekEnd,
      ),
      fetchSubmittedPoliciesForRange(
        supabase,
        imoId,
        fetchStartDate,
        reportingWindow.weekEnd,
      ),
    ]);

    if (
      (!ipPolicies || ipPolicies.length === 0) &&
      (!submitPolicies || submitPolicies.length === 0)
    ) {
      console.log("[slack-ip-leaderboard] No IP or submit data available");
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "No IP or submit data",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Collect all user IDs from both datasets
    const ipUserIds = ipPolicies
      .map((p) => p.user_id)
      .filter(Boolean) as string[];
    const submitUserIds = submitPolicies
      .map((p) => p.user_id)
      .filter(Boolean) as string[];
    const allUserIds = [...new Set([...ipUserIds, ...submitUserIds])];

    const [userNameById, activeAgencies, agencyUsers] = await Promise.all([
      fetchUserNames(supabase, allUserIds),
      fetchActiveAgencies(supabase, imoId),
      fetchAgencyUsers(supabase, imoId),
    ]);

    // Build submit map from submitted policies
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

    const agencies = buildAgencyEntries(
      ipPolicies,
      submitMap,
      reportingWindow.monthStart,
      reportingWindow.monthEnd,
      reportingWindow.weekStart,
      reportingWindow.weekEnd,
      activeAgencies,
      agencyUsers,
    );

    // Get total active agent count for "agents with $0" calculation
    const { count: totalAgentCount } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved")
      .is("archived_at", null)
      .or("roles.cs.{agent},roles.cs.{active_agent}");

    // Build message
    const weekRange = reportingWindow.weekRange;
    const message = buildIPLeaderboardMessage(
      agents,
      agencies,
      totalAgentCount ?? 0,
      weekRange,
    );

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Build message payload
    const messagePayload: Record<string, unknown> = {
      channel: integration.leaderboard_channel_id,
      text: message,
    };

    // Use workspace logo as bot icon if configured
    if (integration.workspace_logo_url) {
      messagePayload.icon_url = integration.workspace_logo_url;
    }

    // Send to Slack
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const data = await response.json();

    // Record message
    await supabase.from("slack_messages").insert({
      imo_id: imoId,
      slack_integration_id: integration.id,
      channel_id: integration.leaderboard_channel_id,
      notification_type: "ip_leaderboard",
      message_text: message,
      related_entity_type: "leaderboard",
      related_entity_id: null,
      status: data.ok ? "sent" : "failed",
      message_ts: data.ts || null,
      error_message: data.error || null,
      sent_at: data.ok ? new Date().toISOString() : null,
    });

    // Update integration status if token is invalid
    if (data.error === "token_revoked" || data.error === "invalid_auth") {
      await supabase
        .from("slack_integrations")
        .update({
          connection_status: "error",
          last_error: data.error,
        })
        .eq("id", integration.id);
    }

    const totalWTDIP = agents.reduce((sum, agent) => sum + agent.wtd_ip, 0);
    const totalMTDIP = agents.reduce((sum, agent) => sum + agent.mtd_ip, 0);
    const totalWTDSubmits = agents.reduce((sum, a) => sum + a.wtd_submits, 0);
    const totalMTDSubmits = agents.reduce((sum, a) => sum + a.mtd_submits, 0);
    const displayAgencies = buildDisplayAgencies(
      agencies,
      totalWTDIP,
      totalMTDIP,
      totalWTDSubmits,
      agents.reduce((sum, a) => sum + a.wtd_submit_ap, 0),
      totalMTDSubmits,
      agents.reduce((sum, a) => sum + a.mtd_submit_ap, 0),
    );

    const result = {
      channel: integration.leaderboard_channel_name,
      weekRange,
      topWTD: [...agents]
        .filter((agent) => agent.wtd_ip > 0 || agent.wtd_submits > 0)
        .sort((a, b) => b.wtd_ip - a.wtd_ip || b.wtd_submits - a.wtd_submits)
        .slice(0, 5)
        .map((agent) => ({
          name: agent.agent_name,
          ip: Math.round(agent.wtd_ip),
          policies: agent.wtd_policies,
          submits: agent.wtd_submits,
          submitAP: Math.round(agent.wtd_submit_ap),
        })),
      topMTD: [...agents]
        .filter((agent) => agent.mtd_ip > 0 || agent.mtd_submits > 0)
        .sort((a, b) => b.mtd_ip - a.mtd_ip || b.mtd_submits - a.mtd_submits)
        .slice(0, 5)
        .map((agent) => ({
          name: agent.agent_name,
          ip: Math.round(agent.mtd_ip),
          policies: agent.mtd_policies,
          submits: agent.mtd_submits,
          submitAP: Math.round(agent.mtd_submit_ap),
        })),
      topAgencies: displayAgencies.slice(0, 5).map((agency) => ({
        name: agency.agency_name,
        wtd: Math.round(agency.wtd_ip),
        mtd: Math.round(agency.mtd_ip),
        wtdSubmits: agency.wtd_submits,
        mtdSubmits: agency.mtd_submits,
      })),
      ok: data.ok,
      error: data.error,
    };

    console.log(
      `[slack-ip-leaderboard] Posted IP & submits report to #${integration.leaderboard_channel_name} (${weekRange})`,
    );

    return new Response(JSON.stringify({ ok: true, results: [result] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[slack-ip-leaderboard] Unexpected error:", err);
    const corsHeaders = getCorsHeaders(req.headers.get("origin"));
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
