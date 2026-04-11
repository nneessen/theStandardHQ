// src/features/agent-roadmap/components/user/RoadmapSectionAccordion.tsx
//
// Collapsible section wrapper showing per-section progress. Items are
// rendered via RoadmapItemCard (expanded inline, not through a drawer).

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RoadmapItemCard } from "./RoadmapItemCard";
import type {
  RoadmapProgressMap,
  RoadmapSectionWithItems,
} from "../../types/roadmap";

interface RoadmapSectionAccordionProps {
  section: RoadmapSectionWithItems;
  roadmapId: string;
  progress: RoadmapProgressMap;
  userId: string;
  /** If true, auto-expand any item whose status is not_started or in_progress */
  autoExpandInProgress?: boolean;
}

export function RoadmapSectionAccordion({
  section,
  roadmapId,
  progress,
  userId,
  autoExpandInProgress = false,
}: RoadmapSectionAccordionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Only show published items
  const visibleItems = useMemo(
    () => section.items.filter((i) => i.is_published),
    [section.items],
  );

  // Per-section stats for the header
  const sectionStats = useMemo(() => {
    let requiredTotal = 0;
    let requiredDone = 0;
    let optionalTotal = 0;
    let optionalDone = 0;
    for (const item of visibleItems) {
      const p = progress.get(item.id);
      const resolved = p?.status === "completed" || p?.status === "skipped";
      if (item.is_required) {
        requiredTotal += 1;
        if (resolved) requiredDone += 1;
      } else {
        optionalTotal += 1;
        if (resolved) optionalDone += 1;
      }
    }
    return { requiredTotal, requiredDone, optionalTotal, optionalDone };
  }, [visibleItems, progress]);

  // Find the first not-yet-done item so we can auto-expand it
  const firstOpenItemId = useMemo(() => {
    if (!autoExpandInProgress) return null;
    const firstIncomplete = visibleItems.find((item) => {
      const p = progress.get(item.id);
      return !p || p.status === "not_started" || p.status === "in_progress";
    });
    return firstIncomplete?.id ?? null;
  }, [autoExpandInProgress, visibleItems, progress]);

  const sectionComplete =
    sectionStats.requiredTotal > 0 &&
    sectionStats.requiredDone === sectionStats.requiredTotal;

  if (visibleItems.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left py-1 group"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        )}
        <h2
          className={`text-sm font-semibold ${
            sectionComplete
              ? "text-zinc-500 dark:text-zinc-500"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {section.title}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-auto">
          {sectionStats.requiredDone} / {sectionStats.requiredTotal}
          {sectionStats.optionalTotal > 0 && (
            <>
              {" "}
              <span className="text-zinc-400">
                (+ {sectionStats.optionalDone}/{sectionStats.optionalTotal}{" "}
                bonus)
              </span>
            </>
          )}
        </span>
      </button>

      {section.description && !collapsed && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-6">
          {section.description}
        </p>
      )}

      {!collapsed && (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <RoadmapItemCard
              key={item.id}
              item={item}
              roadmapId={roadmapId}
              progress={progress.get(item.id)}
              userId={userId}
              defaultExpanded={item.id === firstOpenItemId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
