// src/features/training-modules/components/learner/AssignmentsTab.tsx
import { useState, useMemo } from "react";
import { Search, AlertTriangle, ChevronsUpDown } from "lucide-react";
import {
  MODULE_CATEGORIES,
  DIFFICULTY_LEVELS,
  PRIORITY_LEVELS,
  type ModuleCategory,
  type DifficultyLevel,
  type PriorityLevel,
  type TrainingAssignment,
} from "../../types/training-module.types";
import { CategorySection } from "./CategorySection";

interface AssignmentsTabProps {
  assignments: TrainingAssignment[];
}

export function AssignmentsTab({ assignments }: AssignmentsTabProps) {
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<
    DifficultyLevel | ""
  >("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "">("");
  const [openCategories, setOpenCategories] = useState<Set<ModuleCategory>>(
    () => new Set(MODULE_CATEGORIES),
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return assignments.filter((a) => {
      if (!a.module) return false;
      if (query && !a.module.title.toLowerCase().includes(query)) return false;
      if (difficultyFilter && a.module.difficulty_level !== difficultyFilter)
        return false;
      if (priorityFilter && a.priority !== priorityFilter) return false;
      return true;
    });
  }, [assignments, search, difficultyFilter, priorityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<ModuleCategory, TrainingAssignment[]>();
    for (const a of filtered) {
      if (!a.module) continue;
      const cat = a.module.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    return map;
  }, [filtered]);

  const { overdueCount, urgentCount } = useMemo(() => {
    const now = new Date();
    let overdue = 0;
    let urgent = 0;
    for (const a of assignments) {
      if (a.due_date && new Date(a.due_date) < now && a.status === "active") {
        overdue++;
      }
      if (a.priority === "urgent" && a.status === "active") {
        urgent++;
      }
    }
    return { overdueCount: overdue, urgentCount: urgent };
  }, [assignments]);

  const hasFilters = search || difficultyFilter || priorityFilter;
  const allOpen = openCategories.size === MODULE_CATEGORIES.length;

  const toggleCategory = (cat: ModuleCategory) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allOpen) {
      setOpenCategories(new Set());
    } else {
      setOpenCategories(new Set(MODULE_CATEGORIES));
    }
  };

  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 text-xs text-v2-ink-subtle">
        No training assignments yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 text-[11px] bg-v2-card border border-v2-ring dark:border-v2-ring rounded-md text-v2-ink dark:text-v2-ink placeholder:text-v2-ink-subtle focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700"
          />
        </div>

        {/* Difficulty filter */}
        <select
          value={difficultyFilter}
          onChange={(e) =>
            setDifficultyFilter(e.target.value as DifficultyLevel | "")
          }
          className="h-7 px-2 text-[11px] bg-v2-card border border-v2-ring dark:border-v2-ring rounded-md text-v2-ink dark:text-v2-ink-muted focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700"
        >
          <option value="">All Levels</option>
          {DIFFICULTY_LEVELS.map((d) => (
            <option key={d} value={d} className="capitalize">
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as PriorityLevel | "")
          }
          className="h-7 px-2 text-[11px] bg-v2-card border border-v2-ring dark:border-v2-ring rounded-md text-v2-ink dark:text-v2-ink-muted focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700"
        >
          <option value="">All Priorities</option>
          {PRIORITY_LEVELS.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>

        {/* Expand/Collapse All */}
        <button
          onClick={toggleAll}
          className="h-7 px-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas bg-v2-card border border-v2-ring dark:border-v2-ring rounded-md flex items-center gap-1 transition-colors"
          title={allOpen ? "Collapse all" : "Expand all"}
        >
          <ChevronsUpDown className="h-3 w-3" />
          {allOpen ? "Collapse" : "Expand"}
        </button>
      </div>

      {/* Alert banner */}
      {(overdueCount > 0 || urgentCount > 0) && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-md text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>
            {overdueCount > 0 && <>{overdueCount} overdue</>}
            {overdueCount > 0 && urgentCount > 0 && " · "}
            {urgentCount > 0 && <>{urgentCount} urgent</>}
          </span>
        </div>
      )}

      {/* Category sections */}
      {filtered.length === 0 && hasFilters ? (
        <div className="text-center py-8 text-xs text-v2-ink-subtle">
          No assignments match your filters
        </div>
      ) : (
        <div className="space-y-1.5">
          {MODULE_CATEGORIES.filter((cat) => grouped.has(cat)).map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              assignments={grouped.get(cat)!}
              isOpen={openCategories.has(cat)}
              onToggle={() => toggleCategory(cat)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
