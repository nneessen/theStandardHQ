// src/features/agent-roadmap/services/roadmapProgressService.ts
//
// Per-user progress CRUD + super-admin team overview.
// Progress rows are never DELETEd by users — unchecking is a status transition
// so we preserve an audit trail.

import { supabase } from "@/services/base";
import type {
  RoadmapItemProgressRow,
  RoadmapProgressMap,
  RoadmapTeamProgressRow,
  UpsertProgressInput,
} from "../types/roadmap";

export const roadmapProgressService = {
  /**
   * Load all progress rows for a user on a given roadmap and return them
   * keyed by item_id for O(1) lookups during render.
   */
  async getProgressForRoadmap(
    userId: string,
    roadmapId: string,
  ): Promise<RoadmapProgressMap> {
    const { data, error } = await supabase
      .from("roadmap_item_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("roadmap_id", roadmapId);

    if (error)
      throw new Error(`getProgressForRoadmap failed: ${error.message}`);

    const map: RoadmapProgressMap = new Map();
    for (const row of data ?? []) {
      map.set(row.item_id, row);
    }
    return map;
  },

  /**
   * Transition progress status on an item. Delegates to the
   * `roadmap_upsert_progress` RPC which:
   *   - Preserves the earliest `started_at` across state changes
   *     (so "how long did this take?" stays accurate)
   *   - Sets completed_at only when transitioning to 'completed'
   *   - Reads auth.uid() server-side so the caller can't forge user_id
   *
   * Pass notes=null to avoid touching the notes field at all.
   * Use `updateNotes()` for notes-only updates.
   */
  async upsertProgress(
    _userId: string,
    input: UpsertProgressInput,
  ): Promise<RoadmapItemProgressRow> {
    const { data, error } = await supabase.rpc("roadmap_upsert_progress", {
      p_item_id: input.item_id,
      p_status: input.status,
      p_notes: input.notes ?? undefined,
    });

    if (error) throw new Error(`upsertProgress failed: ${error.message}`);
    if (!data) throw new Error("upsertProgress returned no row");
    return data as RoadmapItemProgressRow;
  },

  /**
   * Update just the notes field on a progress row. Delegates to the
   * `roadmap_update_progress_notes` RPC which is notes-only — it NEVER
   * touches status, started_at, or completed_at, so typing a note on a
   * completed item can't clobber its completion state.
   */
  async updateNotes(
    _userId: string,
    itemId: string,
    notes: string | null,
  ): Promise<RoadmapItemProgressRow> {
    const { data, error } = await supabase.rpc(
      "roadmap_update_progress_notes",
      {
        p_item_id: itemId,
        p_notes: notes,
      },
    );

    if (error) throw new Error(`updateNotes failed: ${error.message}`);
    if (!data) throw new Error("updateNotes returned no row");
    return data as RoadmapItemProgressRow;
  },

  /**
   * Super-admin: load an aggregated view of all users' progress on a roadmap.
   * Used by the TeamProgressPanel. Returns one row per user that has ever
   * touched the roadmap.
   *
   * Implementation note: we use a client-side fold over raw progress rows
   * rather than an RPC because (a) super-admin RLS already grants access to
   * all rows in the agency, and (b) the dataset is small (≤ N users × ≤ M items).
   * If this starts being slow, move it into a SQL function.
   */
  async getTeamOverview(roadmapId: string): Promise<RoadmapTeamProgressRow[]> {
    // 1. Load all progress rows for this roadmap
    const { data: progress, error: progErr } = await supabase
      .from("roadmap_item_progress")
      .select("user_id, item_id, status, updated_at")
      .eq("roadmap_id", roadmapId);

    if (progErr)
      throw new Error(`getTeamOverview (progress) failed: ${progErr.message}`);

    // 2. Load the required items count for the denominator
    const { data: items, error: itemsErr } = await supabase
      .from("roadmap_items")
      .select("id, is_required, is_published")
      .eq("roadmap_id", roadmapId);

    if (itemsErr)
      throw new Error(`getTeamOverview (items) failed: ${itemsErr.message}`);

    const requiredItemIds = new Set(
      (items ?? [])
        .filter((i) => i.is_required && i.is_published)
        .map((i) => i.id),
    );
    const requiredTotal = requiredItemIds.size;

    // 3. Load user profile details for anyone in the progress set
    const userIds = Array.from(new Set((progress ?? []).map((p) => p.user_id)));
    if (userIds.length === 0) return [];

    const { data: users, error: usersErr } = await supabase
      .from("user_profiles")
      .select("id, email, first_name, last_name")
      .in("id", userIds);

    if (usersErr)
      throw new Error(`getTeamOverview (users) failed: ${usersErr.message}`);

    const usersById = new Map((users ?? []).map((u) => [u.id, u]));

    // 4. Fold progress into per-user aggregates
    interface Agg {
      completed: number;
      in_progress: number;
      skipped: number;
      requiredDone: number;
      lastActivityAt: string | null;
    }
    const aggByUser = new Map<string, Agg>();

    for (const row of progress ?? []) {
      let agg = aggByUser.get(row.user_id);
      if (!agg) {
        agg = {
          completed: 0,
          in_progress: 0,
          skipped: 0,
          requiredDone: 0,
          lastActivityAt: null,
        };
        aggByUser.set(row.user_id, agg);
      }
      if (row.status === "completed") agg.completed += 1;
      if (row.status === "in_progress") agg.in_progress += 1;
      if (row.status === "skipped") agg.skipped += 1;

      if (
        requiredItemIds.has(row.item_id) &&
        (row.status === "completed" || row.status === "skipped")
      ) {
        agg.requiredDone += 1;
      }

      if (!agg.lastActivityAt || row.updated_at > agg.lastActivityAt) {
        agg.lastActivityAt = row.updated_at;
      }
    }

    return Array.from(aggByUser.entries()).map(([userId, agg]) => {
      const user = usersById.get(userId);
      const percent =
        requiredTotal === 0
          ? 0
          : Math.round((agg.requiredDone / requiredTotal) * 100);
      return {
        user_id: userId,
        user_email: user?.email ?? null,
        user_first_name: user?.first_name ?? null,
        user_last_name: user?.last_name ?? null,
        completed_count: agg.completed,
        in_progress_count: agg.in_progress,
        skipped_count: agg.skipped,
        required_total: requiredTotal,
        required_done: agg.requiredDone,
        percent,
        last_activity_at: agg.lastActivityAt,
      };
    });
  },
};
