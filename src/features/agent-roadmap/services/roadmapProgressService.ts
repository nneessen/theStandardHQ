// src/features/agent-roadmap/services/roadmapProgressService.ts
//
// Per-user progress CRUD + super-admin team overview.
// Progress rows are never DELETEd by users — unchecking is a status transition
// so we preserve an audit trail.

import { supabase } from "@/services/base";
import type {
  RoadmapItemProgressRow,
  RoadmapProgressMap,
  RoadmapProgressSummary,
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
   *   - Verifies the item is visible to the caller (B-3 fix)
   *
   * Pass notes=null to avoid touching the notes field at all.
   * Use `updateNotes()` for notes-only updates.
   */
  async upsertProgress(
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
   * Per-roadmap progress summaries for the current user, across ALL published
   * roadmaps in the agency. Used by the landing page to show progress bars
   * and status badges on each roadmap card.
   *
   * 2 queries regardless of how many roadmaps exist (RLS filters by agency):
   *   1. All published items → per-roadmap item counts
   *   2. All user's progress rows → per-roadmap completion counts
   * Client-side fold produces the summaries.
   */
  async getProgressSummaries(
    userId: string,
  ): Promise<Map<string, RoadmapProgressSummary>> {
    // 1. All published items visible to this user (RLS scopes to agency)
    const { data: items, error: itemsErr } = await supabase
      .from("roadmap_items")
      .select("id, roadmap_id, is_required, is_published")
      .eq("is_published", true);

    if (itemsErr)
      throw new Error(
        `getProgressSummaries (items) failed: ${itemsErr.message}`,
      );

    // 2. All progress rows for this user
    const { data: progress, error: progErr } = await supabase
      .from("roadmap_item_progress")
      .select("item_id, roadmap_id, status, updated_at")
      .eq("user_id", userId);

    if (progErr)
      throw new Error(
        `getProgressSummaries (progress) failed: ${progErr.message}`,
      );

    // 3. Fold into per-roadmap summaries
    interface Acc {
      requiredTotal: number;
      requiredDone: number;
      optionalTotal: number;
      optionalDone: number;
      totalItems: number;
      lastActivityAt: string | null;
      anyInProgress: boolean;
    }

    const accByRoadmap = new Map<string, Acc>();

    // Initialize from items
    for (const item of items ?? []) {
      let acc = accByRoadmap.get(item.roadmap_id);
      if (!acc) {
        acc = {
          requiredTotal: 0,
          requiredDone: 0,
          optionalTotal: 0,
          optionalDone: 0,
          totalItems: 0,
          lastActivityAt: null,
          anyInProgress: false,
        };
        accByRoadmap.set(item.roadmap_id, acc);
      }
      acc.totalItems += 1;
      if (item.is_required) acc.requiredTotal += 1;
      else acc.optionalTotal += 1;
    }

    // Build a set of item_id → roadmap_id for quick lookup
    const itemToRoadmap = new Map(
      (items ?? []).map((i) => [
        i.id,
        { roadmapId: i.roadmap_id, isRequired: i.is_required },
      ]),
    );

    // Fold progress
    for (const row of progress ?? []) {
      const itemInfo = itemToRoadmap.get(row.item_id);
      if (!itemInfo) continue; // orphaned progress row or unpublished item
      const acc = accByRoadmap.get(itemInfo.roadmapId);
      if (!acc) continue;

      const resolved = row.status === "completed" || row.status === "skipped";
      if (itemInfo.isRequired && resolved) acc.requiredDone += 1;
      if (!itemInfo.isRequired && resolved) acc.optionalDone += 1;
      if (
        row.status === "in_progress" ||
        row.status === "completed" ||
        row.status === "skipped"
      ) {
        acc.anyInProgress = true;
      }

      if (!acc.lastActivityAt || row.updated_at > acc.lastActivityAt) {
        acc.lastActivityAt = row.updated_at;
      }
    }

    // Convert to RoadmapProgressSummary
    const result = new Map<string, RoadmapProgressSummary>();
    for (const [roadmapId, acc] of accByRoadmap.entries()) {
      const percent =
        acc.requiredTotal === 0
          ? 0
          : Math.round((acc.requiredDone / acc.requiredTotal) * 100);

      let status: RoadmapProgressSummary["status"];
      if (acc.requiredTotal > 0 && percent === 100) {
        status = "completed";
      } else if (
        acc.anyInProgress ||
        acc.requiredDone > 0 ||
        acc.optionalDone > 0
      ) {
        status = "in_progress";
      } else {
        status = "not_started";
      }

      result.set(roadmapId, {
        roadmapId,
        requiredTotal: acc.requiredTotal,
        requiredDone: acc.requiredDone,
        percent,
        optionalTotal: acc.optionalTotal,
        optionalDone: acc.optionalDone,
        totalItems: acc.totalItems,
        lastActivityAt: acc.lastActivityAt,
        status,
      });
    }

    return result;
  },

  /**
   * Super-admin: cross-roadmap progress for every agent in the agency.
   * Returns a per-agent row with per-roadmap progress summaries — the
   * data model for the team owner's "check on all my agents" dashboard.
   *
   * Shape: Array<{ userId, name, email, roadmaps: Map<roadmapId, summary> }>
   */
  async getTeamCrossRoadmapOverview(agencyId: string): Promise<
    Array<{
      userId: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      roadmaps: Map<string, RoadmapProgressSummary>;
      overallPercent: number;
      lastActivityAt: string | null;
    }>
  > {
    // 1. All published roadmaps in the agency
    const { data: templates, error: tplErr } = await supabase
      .from("roadmap_templates")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("is_published", true);

    if (tplErr)
      throw new Error(
        `getTeamCrossRoadmapOverview (templates) failed: ${tplErr.message}`,
      );

    const roadmapIds = (templates ?? []).map((t) => t.id);
    if (roadmapIds.length === 0) return [];

    // 2. All published items across those roadmaps
    const { data: items, error: itemsErr } = await supabase
      .from("roadmap_items")
      .select("id, roadmap_id, is_required")
      .eq("is_published", true)
      .in("roadmap_id", roadmapIds);

    if (itemsErr)
      throw new Error(
        `getTeamCrossRoadmapOverview (items) failed: ${itemsErr.message}`,
      );

    // 3. ALL progress rows for ALL users in these roadmaps
    const { data: progress, error: progErr } = await supabase
      .from("roadmap_item_progress")
      .select("user_id, item_id, roadmap_id, status, updated_at")
      .in("roadmap_id", roadmapIds);

    if (progErr)
      throw new Error(
        `getTeamCrossRoadmapOverview (progress) failed: ${progErr.message}`,
      );

    // 4. All user profiles in the agency
    const { data: users, error: usersErr } = await supabase
      .from("user_profiles")
      .select("id, email, first_name, last_name")
      .eq("agency_id", agencyId);

    if (usersErr)
      throw new Error(
        `getTeamCrossRoadmapOverview (users) failed: ${usersErr.message}`,
      );

    // 5. Build per-roadmap item counts
    const itemsByRoadmap = new Map<
      string,
      { requiredTotal: number; optionalTotal: number; totalItems: number }
    >();
    const itemToRoadmap = new Map<
      string,
      { roadmapId: string; isRequired: boolean }
    >();

    for (const item of items ?? []) {
      const acc = itemsByRoadmap.get(item.roadmap_id) ?? {
        requiredTotal: 0,
        optionalTotal: 0,
        totalItems: 0,
      };
      acc.totalItems += 1;
      if (item.is_required) acc.requiredTotal += 1;
      else acc.optionalTotal += 1;
      itemsByRoadmap.set(item.roadmap_id, acc);
      itemToRoadmap.set(item.id, {
        roadmapId: item.roadmap_id,
        isRequired: item.is_required,
      });
    }

    // 6. Fold progress into per-user × per-roadmap summaries
    type UserAcc = {
      byRoadmap: Map<
        string,
        {
          requiredDone: number;
          optionalDone: number;
          anyActivity: boolean;
          lastActivityAt: string | null;
        }
      >;
      lastActivityAt: string | null;
    };

    const accByUser = new Map<string, UserAcc>();

    for (const row of progress ?? []) {
      let userAcc = accByUser.get(row.user_id);
      if (!userAcc) {
        userAcc = { byRoadmap: new Map(), lastActivityAt: null };
        accByUser.set(row.user_id, userAcc);
      }

      const itemInfo = itemToRoadmap.get(row.item_id);
      if (!itemInfo) continue;

      let rmAcc = userAcc.byRoadmap.get(itemInfo.roadmapId);
      if (!rmAcc) {
        rmAcc = {
          requiredDone: 0,
          optionalDone: 0,
          anyActivity: false,
          lastActivityAt: null,
        };
        userAcc.byRoadmap.set(itemInfo.roadmapId, rmAcc);
      }

      const resolved = row.status === "completed" || row.status === "skipped";
      if (itemInfo.isRequired && resolved) rmAcc.requiredDone += 1;
      if (!itemInfo.isRequired && resolved) rmAcc.optionalDone += 1;
      if (
        row.status === "in_progress" ||
        row.status === "completed" ||
        row.status === "skipped"
      ) {
        rmAcc.anyActivity = true;
      }
      if (!rmAcc.lastActivityAt || row.updated_at > rmAcc.lastActivityAt) {
        rmAcc.lastActivityAt = row.updated_at;
      }
      if (!userAcc.lastActivityAt || row.updated_at > userAcc.lastActivityAt) {
        userAcc.lastActivityAt = row.updated_at;
      }
    }

    // 7. Build result: one row per user in the agency (even if they have 0 progress)
    const result: Array<{
      userId: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      roadmaps: Map<string, RoadmapProgressSummary>;
      overallPercent: number;
      lastActivityAt: string | null;
    }> = [];

    for (const u of users ?? []) {
      const userAcc = accByUser.get(u.id);
      const roadmapSummaries = new Map<string, RoadmapProgressSummary>();

      let totalRequired = 0;
      let totalDone = 0;

      for (const rmId of roadmapIds) {
        const itemCounts = itemsByRoadmap.get(rmId) ?? {
          requiredTotal: 0,
          optionalTotal: 0,
          totalItems: 0,
        };
        const rmProgress = userAcc?.byRoadmap.get(rmId);
        const requiredDone = rmProgress?.requiredDone ?? 0;
        const optionalDone = rmProgress?.optionalDone ?? 0;
        const percent =
          itemCounts.requiredTotal === 0
            ? 0
            : Math.round((requiredDone / itemCounts.requiredTotal) * 100);

        let status: RoadmapProgressSummary["status"];
        if (itemCounts.requiredTotal > 0 && percent === 100) {
          status = "completed";
        } else if (
          rmProgress?.anyActivity ||
          requiredDone > 0 ||
          optionalDone > 0
        ) {
          status = "in_progress";
        } else {
          status = "not_started";
        }

        roadmapSummaries.set(rmId, {
          roadmapId: rmId,
          requiredTotal: itemCounts.requiredTotal,
          requiredDone,
          percent,
          optionalTotal: itemCounts.optionalTotal,
          optionalDone,
          totalItems: itemCounts.totalItems,
          lastActivityAt: rmProgress?.lastActivityAt ?? null,
          status,
        });

        totalRequired += itemCounts.requiredTotal;
        totalDone += requiredDone;
      }

      const overallPercent =
        totalRequired === 0 ? 0 : Math.round((totalDone / totalRequired) * 100);

      result.push({
        userId: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        roadmaps: roadmapSummaries,
        overallPercent,
        lastActivityAt: userAcc?.lastActivityAt ?? null,
      });
    }

    // Sort: lowest overall % first (agents who need the most help at the top)
    result.sort((a, b) => a.overallPercent - b.overallPercent);

    return result;
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
