import { Badge } from "@/components/ui/badge";
import {
  MODULE_CATEGORY_LABELS,
  type ModuleCategory,
} from "../../types/training-module.types";

const CATEGORY_COLORS: Record<ModuleCategory, string> = {
  script_training:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  objections_rebuttals:
    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  product_knowledge:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  carrier_training:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  compliance: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  sales_techniques:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  onboarding:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  custom:
    "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle",
};

export function CategoryBadge({ category }: { category: ModuleCategory }) {
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] px-1.5 py-0 h-4 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.custom}`}
    >
      {MODULE_CATEGORY_LABELS[category] || category}
    </Badge>
  );
}
