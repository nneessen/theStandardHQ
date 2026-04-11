// Unit tests for computeRoadmapStats — the % formula at the heart of the
// progress UI. Specifically covers the "skipped counts as resolved" rule
// and the required-vs-optional split that drives the two counters in the
// RoadmapProgressHeader.

import { describe, expect, it } from "vitest";
import { computeRoadmapStats } from "../services/completionCalc";
import type {
  RoadmapItem,
  RoadmapItemProgressRow,
  RoadmapProgressMap,
  RoadmapTree,
} from "../types/roadmap";

// --- Test helpers ---------------------------------------------------------

function makeItem(
  id: string,
  sectionId: string,
  overrides: Partial<RoadmapItem> = {},
): RoadmapItem {
  return {
    id,
    section_id: sectionId,
    roadmap_id: "rm-1",
    agency_id: "agency-1",
    title: `Item ${id}`,
    summary: null,
    content_blocks: [],
    is_required: true,
    is_published: true,
    estimated_minutes: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTree(items: RoadmapItem[]): RoadmapTree {
  return {
    id: "rm-1",
    agency_id: "agency-1",
    imo_id: null,
    title: "Test Roadmap",
    description: null,
    icon: null,
    is_published: true,
    is_default: false,
    sort_order: 0,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    sections: [
      {
        id: "sec-1",
        roadmap_id: "rm-1",
        agency_id: "agency-1",
        title: "Section 1",
        description: null,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        items,
      },
    ],
  };
}

function makeProgress(
  entries: Array<[string, RoadmapItemProgressRow["status"]]>,
): RoadmapProgressMap {
  const map: RoadmapProgressMap = new Map();
  for (const [itemId, status] of entries) {
    map.set(itemId, {
      id: `p-${itemId}`,
      user_id: "user-1",
      item_id: itemId,
      roadmap_id: "rm-1",
      agency_id: "agency-1",
      status,
      started_at: null,
      completed_at: null,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
  }
  return map;
}

// --- Tests ----------------------------------------------------------------

describe("computeRoadmapStats — null inputs", () => {
  it("returns zeros when tree is null", () => {
    const stats = computeRoadmapStats(null, new Map());
    expect(stats).toEqual({
      requiredTotal: 0,
      requiredDone: 0,
      percent: 0,
      optionalTotal: 0,
      optionalDone: 0,
    });
  });

  it("returns zeros when tree is undefined", () => {
    const stats = computeRoadmapStats(undefined, undefined);
    expect(stats.percent).toBe(0);
    expect(stats.requiredTotal).toBe(0);
  });
});

describe("computeRoadmapStats — required item counting", () => {
  it("counts all required published items as the denominator", () => {
    const tree = makeTree([
      makeItem("a", "sec-1"),
      makeItem("b", "sec-1"),
      makeItem("c", "sec-1"),
    ]);
    const stats = computeRoadmapStats(tree, new Map());
    expect(stats.requiredTotal).toBe(3);
    expect(stats.requiredDone).toBe(0);
    expect(stats.percent).toBe(0);
  });

  it("excludes unpublished items from the denominator", () => {
    const tree = makeTree([
      makeItem("a", "sec-1"),
      makeItem("b", "sec-1", { is_published: false }),
      makeItem("c", "sec-1"),
    ]);
    const stats = computeRoadmapStats(tree, new Map());
    expect(stats.requiredTotal).toBe(2);
  });

  it("counts completed required items in the numerator", () => {
    const tree = makeTree([
      makeItem("a", "sec-1"),
      makeItem("b", "sec-1"),
      makeItem("c", "sec-1"),
    ]);
    const progress = makeProgress([
      ["a", "completed"],
      ["b", "completed"],
    ]);
    const stats = computeRoadmapStats(tree, progress);
    expect(stats.requiredDone).toBe(2);
    expect(stats.percent).toBe(67); // 2/3 rounded
  });

  it("counts skipped required items as resolved (the 'skip=acknowledged' rule)", () => {
    const tree = makeTree([
      makeItem("a", "sec-1"),
      makeItem("b", "sec-1"),
      makeItem("c", "sec-1"),
    ]);
    const progress = makeProgress([
      ["a", "completed"],
      ["b", "skipped"],
      ["c", "completed"],
    ]);
    const stats = computeRoadmapStats(tree, progress);
    expect(stats.requiredDone).toBe(3);
    expect(stats.percent).toBe(100);
  });

  it("does NOT count in_progress as resolved", () => {
    const tree = makeTree([makeItem("a", "sec-1"), makeItem("b", "sec-1")]);
    const progress = makeProgress([
      ["a", "completed"],
      ["b", "in_progress"],
    ]);
    const stats = computeRoadmapStats(tree, progress);
    expect(stats.requiredDone).toBe(1);
    expect(stats.percent).toBe(50);
  });

  it("does NOT count not_started as resolved", () => {
    const tree = makeTree([makeItem("a", "sec-1"), makeItem("b", "sec-1")]);
    const progress = makeProgress([["a", "not_started"]]);
    const stats = computeRoadmapStats(tree, progress);
    expect(stats.requiredDone).toBe(0);
  });
});

describe("computeRoadmapStats — optional items", () => {
  it("counts optional items in optionalTotal, not requiredTotal", () => {
    const tree = makeTree([
      makeItem("a", "sec-1"),
      makeItem("b", "sec-1", { is_required: false }),
      makeItem("c", "sec-1", { is_required: false }),
    ]);
    const stats = computeRoadmapStats(tree, new Map());
    expect(stats.requiredTotal).toBe(1);
    expect(stats.optionalTotal).toBe(2);
  });

  it("tracks optionalDone separately and does not affect percent", () => {
    const tree = makeTree([
      makeItem("a", "sec-1"), // required
      makeItem("b", "sec-1", { is_required: false }),
      makeItem("c", "sec-1", { is_required: false }),
    ]);
    const progress = makeProgress([
      ["b", "completed"],
      ["c", "completed"],
    ]);
    const stats = computeRoadmapStats(tree, progress);
    expect(stats.optionalDone).toBe(2);
    expect(stats.requiredDone).toBe(0);
    expect(stats.percent).toBe(0); // 0/1 required done
  });
});

describe("computeRoadmapStats — edge cases", () => {
  it("handles a roadmap with zero items (percent=0, not NaN)", () => {
    const tree = makeTree([]);
    const stats = computeRoadmapStats(tree, new Map());
    expect(stats.percent).toBe(0);
    expect(Number.isNaN(stats.percent)).toBe(false);
  });

  it("handles a roadmap with only optional items (percent=0)", () => {
    const tree = makeTree([
      makeItem("a", "sec-1", { is_required: false }),
      makeItem("b", "sec-1", { is_required: false }),
    ]);
    const progress = makeProgress([
      ["a", "completed"],
      ["b", "completed"],
    ]);
    const stats = computeRoadmapStats(tree, progress);
    expect(stats.requiredTotal).toBe(0);
    expect(stats.percent).toBe(0); // no required items = 0% (not 100)
    expect(stats.optionalDone).toBe(2);
  });

  it("rounds percent to nearest integer", () => {
    const tree = makeTree([
      makeItem("a", "sec-1"),
      makeItem("b", "sec-1"),
      makeItem("c", "sec-1"),
      makeItem("d", "sec-1"),
      makeItem("e", "sec-1"),
      makeItem("f", "sec-1"),
      makeItem("g", "sec-1"),
    ]);
    const progress = makeProgress([
      ["a", "completed"],
      ["b", "completed"],
    ]);
    const stats = computeRoadmapStats(tree, progress);
    expect(stats.percent).toBe(29); // 2/7 = 28.57... → 29
  });
});
