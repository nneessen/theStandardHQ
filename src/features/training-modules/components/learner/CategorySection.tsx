// src/features/training-modules/components/learner/CategorySection.tsx
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  MODULE_CATEGORY_LABELS,
  type ModuleCategory,
  type TrainingAssignment,
} from "../../types/training-module.types";
import { AssignmentRow } from "./AssignmentRow";

const CATEGORY_DOT_COLORS: Record<ModuleCategory, string> = {
  script_training: "bg-violet-500",
  objections_rebuttals: "bg-rose-500",
  product_knowledge: "bg-blue-500",
  carrier_training: "bg-amber-500",
  compliance: "bg-red-500",
  sales_techniques: "bg-emerald-500",
  onboarding: "bg-cyan-500",
  custom: "bg-zinc-400",
};

interface CategorySectionProps {
  category: ModuleCategory;
  assignments: TrainingAssignment[];
  isOpen: boolean;
  onToggle: () => void;
}

export function CategorySection({
  category,
  assignments,
  isOpen,
  onToggle,
}: CategorySectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="bg-v2-card border border-v2-ring dark:border-v2-ring rounded-md overflow-hidden">
        {/* Category header */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 transition-colors">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_DOT_COLORS[category]}`}
            />
            <span className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
              {MODULE_CATEGORY_LABELS[category]}
            </span>
            <span className="text-[10px] text-v2-ink-subtle bg-v2-card-tinted dark:bg-v2-card-tinted px-1.5 rounded">
              {assignments.length}
            </span>
            <div className="flex-1" />
            <ChevronDown
              className={`h-3.5 w-3.5 text-v2-ink-subtle transition-transform ${
                isOpen ? "" : "-rotate-90"
              }`}
            />
          </button>
        </CollapsibleTrigger>

        {/* Rows flow directly under the header */}
        <CollapsibleContent>
          {/* Column labels */}
          <div className="flex items-center gap-3 px-2.5 py-1 text-[10px] text-v2-ink-subtle uppercase tracking-wider border-t border-v2-ring dark:border-v2-ring">
            <div className="w-1.5 flex-shrink-0" />
            <div className="flex-1">Title</div>
            <div className="w-20 flex-shrink-0 hidden sm:block">Level</div>
            <div className="w-24 flex-shrink-0">Progress</div>
            <div className="w-12 flex-shrink-0 text-right hidden md:block">
              Lessons
            </div>
            <div className="w-16 flex-shrink-0 text-right">Due</div>
            <div className="w-10 flex-shrink-0 text-right hidden lg:block">
              XP
            </div>
            <div className="w-3 flex-shrink-0" />
          </div>

          {/* Assignment rows */}
          <div className="divide-y divide-zinc-50 dark:divide-v2-ring/50">
            {assignments.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
