// src/features/agent-roadmap/services/completionCalc.ts
//
// Pure function to compute roadmap completion stats from a tree + progress map.
// Kept out of components so it's easy to unit test.

import type {
  RoadmapCompletionStats,
  RoadmapProgressMap,
  RoadmapTree,
} from "../types/roadmap";

/**
 * Compute completion stats per the plan's formula:
 *   required_done = items where is_required AND is_published AND
 *                   progress.status IN ('completed', 'skipped')
 *   percent       = required_done / required_total (0 when total is 0)
 *
 * Skipped counts as resolved, not completed — so the agent can 100% a roadmap
 * even if some required items don't apply to them.
 */
export function computeRoadmapStats(
  tree: RoadmapTree | null | undefined,
  progress: RoadmapProgressMap | null | undefined,
): RoadmapCompletionStats {
  if (!tree) {
    return {
      requiredTotal: 0,
      requiredDone: 0,
      percent: 0,
      optionalTotal: 0,
      optionalDone: 0,
    };
  }

  let requiredTotal = 0;
  let requiredDone = 0;
  let optionalTotal = 0;
  let optionalDone = 0;

  for (const section of tree.sections) {
    for (const item of section.items) {
      if (!item.is_published) continue;

      const prog = progress?.get(item.id);
      const resolved =
        prog?.status === "completed" || prog?.status === "skipped";

      if (item.is_required) {
        requiredTotal += 1;
        if (resolved) requiredDone += 1;
      } else {
        optionalTotal += 1;
        if (resolved) optionalDone += 1;
      }
    }
  }

  const percent =
    requiredTotal === 0 ? 0 : Math.round((requiredDone / requiredTotal) * 100);

  return {
    requiredTotal,
    requiredDone,
    percent,
    optionalTotal,
    optionalDone,
  };
}
