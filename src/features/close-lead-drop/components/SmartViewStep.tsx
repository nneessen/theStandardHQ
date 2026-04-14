// Step 1: Pick a Smart View from the user's Close CRM.

import { Layers, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadDropSmartViews } from "../hooks/useLeadDrop";
import type { SmartView } from "../types/lead-drop.types";

interface SmartViewStepProps {
  selected: SmartView | null;
  onSelect: (sv: SmartView) => void;
  onNext: () => void;
}

export function SmartViewStep({
  selected,
  onSelect,
  onNext,
}: SmartViewStepProps) {
  const { data, isLoading, error } = useLeadDropSmartViews();
  const smartViews = data?.smart_views ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Select a Smart View</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Leads from this Smart View will be available to preview and drop.
          Create and save Smart Views in Close CRM first.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your Smart Views…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error.message}
        </div>
      )}

      {!isLoading && !error && smartViews.length === 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-4 text-center">
          No Smart Views found. Create one in Close CRM and sync your
          connection.
        </div>
      )}

      {!isLoading && smartViews.length > 0 && (
        <div className="border rounded-md divide-y divide-border overflow-hidden">
          {smartViews.map((sv) => (
            <button
              key={sv.id}
              onClick={() => onSelect(sv)}
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
                selected?.id === sv.id ? "bg-muted" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                  selected?.id === sv.id
                    ? "border-green-500 bg-green-500"
                    : "border-border",
                ].join(" ")}
              />
              <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-xs font-medium">
                {sv.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          size="sm"
          onClick={onNext}
          disabled={!selected}
          className="gap-1.5 text-xs"
        >
          Load Leads
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
