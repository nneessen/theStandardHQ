// src/features/underwriting/components/QuickQuote/BudgetModeToggle.tsx

import { Button } from "@/components/ui/button";
import { DollarSign, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
// eslint-disable-next-line no-restricted-imports
import type { QuoteMode } from "@/services/underwriting/workflows/quotingService";

interface BudgetModeToggleProps {
  mode: QuoteMode;
  onChange: (mode: QuoteMode) => void;
}

export default function BudgetModeToggle({
  mode,
  onChange,
}: BudgetModeToggleProps) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted">
        Quote Mode
      </label>
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange("coverage")}
          className={cn(
            "text-[10px] h-7 px-2.5 gap-1",
            mode === "coverage"
              ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white"
              : "hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted",
          )}
        >
          <Shield className="h-3 w-3" />I need specific coverage
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange("budget")}
          className={cn(
            "text-[10px] h-7 px-2.5 gap-1",
            mode === "budget"
              ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white"
              : "hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted",
          )}
        >
          <DollarSign className="h-3 w-3" />I have a budget
        </Button>
      </div>
      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        {mode === "coverage"
          ? "Find the cheapest quotes for your desired coverage amount"
          : "Find the maximum coverage that fits within your monthly budget"}
      </p>
    </div>
  );
}
