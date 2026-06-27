// src/services/social-studio/newAgentsService.ts
// Lists the caller's DOWNLINE agents for the Social Studio "New Agents" view (build/post a
// welcome graphic on demand). Scoped to the caller's own team — NOT the whole IMO: it
// derives the caller's materialized hierarchy_path from auth.uid() and returns only agents
// strictly below them in the tree (hierarchy_path LIKE '<my_path>.%'), the canonical downline
// pattern used by get_my_team_leaderboard / HierarchyRepository. So you only ever see your
// own team, never another upline's agents. (The leaderboard hook can't be reused: it lists
// ranked PRODUCERS, so a brand-new agent with no policies — exactly who you welcome — would
// never appear.)
//
// Each agent carries their rotation photo set (agent_photos, sort order) + rotation cursor
// (user_profiles.photo_rotation_idx) so welcome graphics can cycle through photos. Those are
// new (Phase C-B) and not in the generated database.types, so reads use a LOCALIZED TYPE
// BRIDGE ((supabase as any), same pattern as agentWelcomeService).
//
// Lives in the service layer so the feature/UI never touches the Supabase client directly.

import { supabase } from "../base/supabase";

export interface NewAgentRow {
  id: string;
  /** Full display name (format to last-initial in the card layer). */
  name: string;
  /** The stable primary avatar (user_profiles.profile_photo_url), or null. */
  photoUrl: string | null;
  createdAt: string | null;
  /** The agent's rotation photo set (agent_photos), in rotation (sort) order. */
  photos: string[];
  /** The rotation cursor (user_profiles.photo_rotation_idx). */
  rotationIdx: number;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  profile_photo_url: string | null;
  created_at: string | null;
  photo_rotation_idx: number | null;
}

interface PhotoRow {
  agent_id: string;
  photo_url: string;
}

/**
 * Approved, non-archived agents in the CALLER's downline (their team), newest first, each
 * with their rotation photo set. Capped at 50 — the owner picks specific new hires to
 * welcome, so the whole roster is never needed. Returns [] if the caller has no hierarchy
 * position (can't resolve a team).
 */
export async function listNewAgents(): Promise<NewAgentRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];

  // The caller's own position in the tree. Their downline = paths strictly below this one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: me, error: meErr } = await (supabase as any)
    .from("user_profiles")
    .select("hierarchy_path")
    .eq("id", uid)
    .maybeSingle();
  if (meErr) throw meErr;
  const path: string | null = me?.hierarchy_path ?? null;
  if (!path) return [];

  // Forward prefix match: everyone strictly below the caller (excludes the caller — you
  // don't welcome yourself). `.` and `-` are literal in LIKE; UUIDs contain no `_`/`%`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("user_profiles")
    .select(
      "id, first_name, last_name, profile_photo_url, created_at, photo_rotation_idx",
    )
    .like("hierarchy_path", `${path}.%`)
    .eq("approval_status", "approved")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const agents: NewAgentRow[] = ((data ?? []) as ProfileRow[]).map((r) => ({
    id: r.id,
    name:
      [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
      "New Agent",
    photoUrl: r.profile_photo_url ?? null,
    createdAt: r.created_at ?? null,
    photos: [],
    rotationIdx: r.photo_rotation_idx ?? 0,
  }));

  const ids = agents.map((a) => a.id);
  if (ids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: photoData, error: photoErr } = await (supabase as any)
      .from("agent_photos")
      .select("agent_id, photo_url, sort_order, created_at")
      .in("agent_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (photoErr) throw photoErr;
    const byAgent = new Map<string, string[]>();
    for (const p of (photoData ?? []) as PhotoRow[]) {
      const arr = byAgent.get(p.agent_id) ?? [];
      arr.push(p.photo_url);
      byAgent.set(p.agent_id, arr);
    }
    for (const a of agents) a.photos = byAgent.get(a.id) ?? [];
  }

  return agents;
}
