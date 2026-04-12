// src/features/agent-roadmap/components/user/RoadmapSectionAccordion.tsx
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
  autoExpandInProgress?: boolean;
}

export function RoadmapSectionAccordion({
  section,
  roadmapId,
  progress,
  userId,
  autoExpandInProgress = false,
}: RoadmapSectionAccordionProps) {
  // Sections start COLLAPSED by default. The only section that auto-opens
  // is the one containing the first unfinished item (autoExpandInProgress).
  const [collapsed, setCollapsed] = useState(!autoExpandInProgress);

  const visibleItems = useMemo(
    () => section.items.filter((i) => i.is_published),
    [section.items],
  );

  const sectionStats = useMemo(() => {
    let requiredTotal = 0;
    let requiredDone = 0;
    for (const item of visibleItems) {
      if (!item.is_required) continue;
      requiredTotal += 1;
      const p = progress.get(item.id);
      if (p?.status === "completed" || p?.status === "skipped") {
        requiredDone += 1;
      }
    }
    return { requiredTotal, requiredDone };
  }, [visibleItems, progress]);

  const sectionComplete =
    sectionStats.requiredTotal > 0 &&
    sectionStats.requiredDone === sectionStats.requiredTotal;

  const firstOpenItemId = useMemo(() => {
    if (!autoExpandInProgress) return null;
    const first = visibleItems.find((item) => {
      const p = progress.get(item.id);
      return !p || p.status === "not_started" || p.status === "in_progress";
    });
    return first?.id ?? null;
  }, [autoExpandInProgress, visibleItems, progress]);

  if (visibleItems.length === 0) return null;

  return (
    <section>
      {/* Section header — white card with border for contrast */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left bg-white dark:bg-zinc-900 rounded-lg px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
        )}
        <h2
          className={`text-sm font-semibold ${
            sectionComplete
              ? "text-zinc-500 dark:text-zinc-400"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {section.title}
        </h2>
        {sectionComplete && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-emerald-200 dark:border-emerald-800">
            Done
          </span>
        )}
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 tabular-nums ml-auto">
          {sectionStats.requiredDone}/{sectionStats.requiredTotal}
        </span>
      </button>

      {section.description && !collapsed && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-8 mt-1">
          {section.description}
        </p>
      )}

      {!collapsed && (
        <div className="space-y-1.5 mt-2 ml-3 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700">
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
