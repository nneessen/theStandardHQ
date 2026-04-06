// src/features/close-kpi/services/teamCallStatsService.ts
//
// Calls the get-team-call-stats edge function. The edge function fans out
// across team members (caller + downlines), pulls each one's Close call
// activity for the requested date range, and returns aggregated per-agent
// dial/connect/talk-time stats.
//
// All access control happens server-side: the edge function calls
// get_team_member_ids() with the caller's JWT to determine the team set.

import { supabase } from "@/services/base/supabase";
import type { TeamCallStatsResponse } from "../types/team-call-stats.types";

/**
 * Map raw server/transport error messages to user-friendly UI text. Internal
 * details (column names, function names, PostgREST error codes, JWT internals)
 * shouldn't bleed into the dashboard. Keep the mapping small and additive —
 * unknown errors fall through to the raw message rather than being silently
 * masked, so debugging is still possible from the network tab.
 */
function friendlyErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("missing bearer") || lower.includes("invalid bearer")) {
    return "Your session expired. Please refresh the page and sign in again.";
  }
  if (
    lower.includes("not authenticated") ||
    lower.includes("jwt expired") ||
    lower.includes("jwt invalid") ||
    lower.includes("pgrst301") ||
    lower.includes("pgrst302")
  ) {
    return "Your session expired. Please refresh the page and sign in again.";
  }
  if (lower.includes("close api timeout")) {
    return "Close CRM didn't respond in time. Try refreshing — if the problem persists, Close may be having an outage.";
  }
  if (lower.includes("close api 401") || lower.includes("close api 403")) {
    return "One or more agents have an invalid Close API key. Check the agent's Close connection in Settings.";
  }
  if (lower.includes("close api 429") || lower.includes("rate limit")) {
    return "Close CRM rate limit hit. Wait a minute and try again.";
  }
  if (lower.includes("from and to") && lower.includes("required")) {
    return "Invalid date range. Please pick a valid range.";
  }
  if (lower.includes("functionshttperror") || lower.includes("network")) {
    return "Couldn't reach the team monitoring service. Check your connection and try again.";
  }
  // Unknown error: pass through but truncate so it doesn't blow out the UI.
  return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
}

export async function fetchTeamCallStats(params: {
  from: string;
  to: string;
}): Promise<TeamCallStatsResponse> {
  const { data, error } = await supabase.functions.invoke(
    "get-team-call-stats",
    {
      body: { from: params.from, to: params.to },
    },
  );

  if (error) {
    // Surface the actual server error message so the UI can show something
    // useful instead of a generic "FunctionsHttpError".
    let msg = error.message ?? "Failed to load team call stats";
    if ("context" in error && error.context) {
      try {
        const ctx = error.context as { json?: () => Promise<unknown> };
        if (typeof ctx.json === "function") {
          const body = (await ctx.json()) as { error?: string };
          if (body?.error) msg = body.error;
        }
      } catch {
        /* ignore — keep generic msg */
      }
    }
    throw new Error(friendlyErrorMessage(msg));
  }

  return data as TeamCallStatsResponse;
}

// Exported for testing only — not part of the module's public surface.
export { friendlyErrorMessage as __friendlyErrorMessage };
