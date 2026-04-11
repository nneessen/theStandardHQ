// src/features/agent-roadmap/hooks/queryKeys.ts
//
// Hierarchical TanStack Query keys for the agent-roadmap feature.
// Convention matches training-modules: a factory object with readonly tuples.

export const roadmapKeys = {
  all: ["agent-roadmap"] as const,

  lists: () => [...roadmapKeys.all, "list"] as const,
  listByAgency: (agencyId: string) =>
    [...roadmapKeys.lists(), agencyId] as const,

  details: () => [...roadmapKeys.all, "detail"] as const,
  detail: (roadmapId: string) => [...roadmapKeys.details(), roadmapId] as const,

  /** Full tree: template + sections + items */
  tree: (roadmapId: string) => [...roadmapKeys.all, "tree", roadmapId] as const,

  /** Per-user progress map for one roadmap */
  progress: (userId: string, roadmapId: string) =>
    [...roadmapKeys.all, "progress", userId, roadmapId] as const,

  /** Super-admin monitoring view */
  teamOverview: (roadmapId: string) =>
    [...roadmapKeys.all, "team", roadmapId] as const,
} as const;
