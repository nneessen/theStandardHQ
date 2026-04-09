#!/usr/bin/env node
// scripts/verify-team-appointments.mjs
//
// Ground-truth verification for the team-appointments edge function fix.
//
// What it does:
//   1. Reads env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHAT_BOT_API_URL, CHAT_BOT_API_KEY)
//   2. Given a user email (via --email or USER_EMAIL env), finds the caller + downline
//   3. For each active bot agent, paginates THROUGH ALL PAGES of the external appointments API
//   4. Computes per-agent today/thisWeek counts in the user's local timezone
//   5. Prints a report
//
// This reproduces exactly what the fixed edge function does server-side, so any
// mismatch between this script's numbers and what the UI shows indicates a
// remaining bug.
//
// Usage:
//   node scripts/verify-team-appointments.mjs --email=you@example.com
//   node scripts/verify-team-appointments.mjs --email=you@example.com --tz=America/New_York

import { createClient } from "@supabase/supabase-js";
import {
  loadEnv,
  parseArgs,
} from "./lib/chat-bot-review-runtime.mjs";

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

function escapeLike(s) {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`);
}

function formatLocal(date, tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isoToLocal(isoStr, tz) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  return formatLocal(d, tz);
}

function getStartOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
function getEndOfWeek(dateStr) {
  const start = new Date(getStartOfWeek(dateStr) + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() + 6);
  return start.toISOString().slice(0, 10);
}

async function fetchPage(apiUrl, apiKey, externalAgentId, page) {
  const url = `${apiUrl}/api/external/agents/${encodeURIComponent(externalAgentId)}/appointments?page=${page}&limit=${PAGE_LIMIT}`;
  const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.error || body?.message || JSON.stringify(body).slice(0, 200);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  const items = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  const pagination = body?.meta?.pagination ?? {};
  const totalPages =
    typeof pagination.totalPages === "number"
      ? pagination.totalPages
      : typeof pagination.totalItems === "number"
        ? Math.max(1, Math.ceil(pagination.totalItems / PAGE_LIMIT))
        : items.length < PAGE_LIMIT
          ? page
          : page + 1;
  const totalItems = typeof pagination.totalItems === "number" ? pagination.totalItems : null;
  return { items, totalPages, totalItems };
}

async function fetchAllAppointments(apiUrl, apiKey, externalAgentId) {
  const first = await fetchPage(apiUrl, apiKey, externalAgentId, 1);
  const last = Math.min(first.totalPages, MAX_PAGES);
  if (last <= 1) {
    return { items: first.items, totalPages: first.totalPages, totalItems: first.totalItems, capped: first.totalPages > MAX_PAGES };
  }
  const rest = await Promise.all(
    Array.from({ length: last - 1 }, (_, i) =>
      fetchPage(apiUrl, apiKey, externalAgentId, i + 2),
    ),
  );
  const all = first.items.concat(...rest.map((r) => r.items));
  return {
    items: all,
    totalPages: first.totalPages,
    totalItems: first.totalItems,
    capped: first.totalPages > MAX_PAGES,
  };
}

function normalize(item) {
  const raw = (item.status || item.event_status || "").toLowerCase();
  const status =
    raw === "confirmed" || raw === "active" || raw === "pending"
      ? "scheduled"
      : raw === "completed" || raw === "done"
        ? "completed"
        : raw === "cancelled" || raw === "canceled"
          ? "cancelled"
          : raw === "no_show" || raw === "no-show" || raw === "noshow"
            ? "no_show"
            : raw || "scheduled";
  return {
    leadName: item.leadName || item.lead_name || item.invitee_name || item.name || "Unknown",
    scheduledAt:
      item.scheduledAt ||
      item.scheduled_at ||
      item.startAt ||
      item.start_at ||
      item.start_time ||
      item.startTime ||
      null,
    status,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(process.cwd());
  const email = args.email || env.USER_EMAIL;
  const tz =
    args.tz ||
    env.USER_TIMEZONE ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  if (!email) {
    console.error("Usage: node scripts/verify-team-appointments.mjs --email=you@example.com [--tz=America/New_York]");
    process.exit(1);
  }

  // Match the edge function's behavior: prefer remote DB when available,
  // since bot_agents + user_profiles for real bot users live in production,
  // not local Supabase.
  const supabaseUrl =
    env.REMOTE_SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey =
    env.REMOTE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const apiUrl = env.CHAT_BOT_API_URL || env.STANDARD_CHAT_BOT_API_URL;
  const apiKey = env.CHAT_BOT_API_KEY || env.STANDARD_CHAT_BOT_EXTERNAL_API_KEY;
  if (!supabaseUrl || !supabaseKey || !apiUrl || !apiKey) {
    console.error("Missing required env: (REMOTE_)SUPABASE_URL, (REMOTE_)SUPABASE_SERVICE_ROLE_KEY, CHAT_BOT_API_URL, CHAT_BOT_API_KEY");
    process.exit(1);
  }
  console.log(`  db:       ${supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost") ? "LOCAL" : "REMOTE"}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find caller
  const { data: callerProfile, error: callerErr } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, hierarchy_path, email")
    .eq("email", email)
    .maybeSingle();
  if (callerErr || !callerProfile) {
    console.error("Caller lookup failed:", callerErr?.message || "not found");
    process.exit(1);
  }
  const callerPath = callerProfile.hierarchy_path || callerProfile.id;

  // Find downline
  const { data: downline } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name")
    .like("hierarchy_path", `${escapeLike(callerPath)}.%`)
    .limit(100);

  const allUserIds = [callerProfile.id, ...(downline || []).map((p) => p.id)];

  // Find active bot agents
  const { data: botAgents } = await supabase
    .from("chat_bot_agents")
    .select("user_id, external_agent_id")
    .in("user_id", allUserIds)
    .eq("provisioning_status", "active");

  if (!botAgents || botAgents.length === 0) {
    console.log("No active bot agents found for caller + downline.");
    process.exit(0);
  }

  const profileMap = new Map();
  profileMap.set(callerProfile.id, callerProfile);
  for (const p of downline || []) profileMap.set(p.id, p);

  const today = formatLocal(new Date(), tz);
  const weekStart = getStartOfWeek(today);
  const weekEnd = getEndOfWeek(today);

  console.log(`\nTeam Appointments Verification`);
  console.log(`  caller:   ${callerProfile.first_name} ${callerProfile.last_name} (${email})`);
  console.log(`  timezone: ${tz}`);
  console.log(`  today:    ${today}`);
  console.log(`  week:     ${weekStart} .. ${weekEnd}`);
  console.log(`  agents:   ${botAgents.length}\n`);

  let grandToday = 0;
  let grandWeek = 0;

  for (const ba of botAgents) {
    const profile = profileMap.get(ba.user_id);
    const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Agent" : "Agent";
    try {
      const result = await fetchAllAppointments(apiUrl, apiKey, ba.external_agent_id);
      const normalized = result.items.map(normalize);
      const todayAppts = normalized.filter((a) => isoToLocal(a.scheduledAt, tz) === today);
      const weekAppts = normalized.filter((a) => {
        const local = isoToLocal(a.scheduledAt, tz);
        return local !== null && local >= weekStart && local <= weekEnd;
      });
      grandToday += todayAppts.length;
      grandWeek += weekAppts.length;
      console.log(
        `  ${name.padEnd(25)}  fetched=${String(result.items.length).padStart(4)}  pages=${result.totalPages}  today=${todayAppts.length}  week=${weekAppts.length}${result.capped ? "  [CAPPED]" : ""}`,
      );
      if (args.verbose) {
        // Print every appointment within ±2 days of today so the user can see
        // whether the external API has the data at all.
        const nearby = normalized
          .filter((a) => {
            const local = isoToLocal(a.scheduledAt, tz);
            if (!local) return false;
            return local >= weekStart && local <= weekEnd;
          })
          .sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""));
        for (const a of nearby) {
          const local = isoToLocal(a.scheduledAt, tz);
          const localTime = new Date(a.scheduledAt).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
          const marker = local === today ? " ← TODAY" : "";
          console.log(`      [${local}] ${localTime.padEnd(25)} ${a.status.padEnd(10)} ${a.leadName}${marker}`);
          console.log(`                raw scheduledAt: ${a.scheduledAt}`);
        }
      } else if (todayAppts.length > 0) {
        for (const a of todayAppts.slice(0, 5)) {
          const localTime = new Date(a.scheduledAt).toLocaleString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
          console.log(`      • ${localTime}  ${a.leadName}  [${a.status}]`);
        }
      }
    } catch (err) {
      console.log(`  ${name.padEnd(25)}  ERROR: ${err.message}`);
    }
  }

  console.log(`\n  TOTAL today=${grandToday}  week=${grandWeek}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
