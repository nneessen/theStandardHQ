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
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <h2
          className={`text-base font-bold tracking-tight transition-colors ${
            sectionComplete
              ? "text-muted-foreground"
              : "text-foreground group-hover:text-foreground"
          }`}
        >
          {section.title}
        </h2>
        {sectionComplete && (
          <span className="inline-flex items-center rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-success/20">
            Done
          </span>
        )}
        <span className="text-sm font-semibold text-muted-foreground tabular-nums ml-auto">
          {sectionStats.requiredDone} / {sectionStats.requiredTotal}
          {sectionStats.optionalTotal > 0 && (
            <>
              {" "}
              <span className="text-muted-foreground/60 font-normal">
                (+ {sectionStats.optionalDone}/{sectionStats.optionalTotal}{" "}
                bonus)
              </span>
            </>
          )}
        </span>
      </button>

      {section.description && !collapsed && (
        <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
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
