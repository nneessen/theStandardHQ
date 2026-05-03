import { Badge } from "@/components/ui/badge";
import {
  MODULE_CATEGORY_LABELS,
  type ModuleCategory,
} from "../../types/training-module.types";

const CATEGORY_COLORS: Record<ModuleCategory, string> = {
  script_training: "bg-info/20 text-info dark:bg-info/30 dark:text-info",
  objections_rebuttals:
    "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
  product_knowledge: "bg-info/20 text-info dark:bg-info/30 dark:text-info",
  carrier_training:
    "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning",
  compliance:
    "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
  sales_techniques:
    "bg-success/20 text-success dark:bg-success/30 dark:text-success",
  onboarding: "bg-info/20 text-info dark:bg-info/30 dark:text-info",
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
