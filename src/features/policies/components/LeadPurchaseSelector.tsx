// src/features/policies/components/LeadPurchaseSelector.tsx
// Compact selector for choosing from existing lead purchases

import { useLeadPurchases } from "@/hooks/lead-purchases";
import { cn } from "@/lib/utils";
import { Check, Package, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadPurchase } from "@/types/lead-purchase.types";

interface LeadPurchaseSelectorProps {
  selectedId?: string | null;
  onSelect: (purchase: LeadPurchase) => void;
  className?: string;
}

export function LeadPurchaseSelector({
  selectedId,
  onSelect,
  className,
}: LeadPurchaseSelectorProps) {
  const { data: purchases = [], isLoading } = useLeadPurchases();

  // Filter to recent purchases (last 90 days) and sort by date desc
  const recentPurchases = purchases
    .filter((p) => {
      const purchaseDate = new Date(p.purchaseDate);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return purchaseDate >= ninetyDaysAgo;
    })
    .sort(
      (a, b) =>
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
    );

  if (isLoading) {
    return (
      <div className={cn("space-y-1", className)}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (recentPurchases.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-4 text-center",
          className,
        )}
      >
        <Package className="h-5 w-5 text-blue-300 dark:text-blue-700 mb-1" />
        <p className="text-[11px] text-muted-foreground">
          No lead purchases in the last 90 days
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-[140px]", className)}>
      <div className="space-y-1 pr-2">
        {recentPurchases.map((purchase) => (
          <LeadPurchaseItem
            key={purchase.id}
            purchase={purchase}
            isSelected={selectedId === purchase.id}
            onSelect={() => onSelect(purchase)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface LeadPurchaseItemProps {
  purchase: LeadPurchase;
  isSelected: boolean;
  onSelect: () => void;
}

function LeadPurchaseItem({
  purchase,
  isSelected,
  onSelect,
}: LeadPurchaseItemProps) {
  const displayName =
    purchase.purchaseName ||
    purchase.vendor?.name ||
    `Lead Pack (${purchase.leadCount} leads)`;

  const formattedDate = new Date(purchase.purchaseDate).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  );

  const costPerLead = purchase.costPerLead || 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left border transition-all duration-150",
        isSelected
          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
          : "border-transparent hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/40 active:bg-v2-card-tinted dark:active:bg-zinc-800/60",
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "flex-shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors",
          isSelected
            ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500 text-white"
            : "border-muted-foreground/40",
        )}
      >
        {isSelected && <Check className="h-2 w-2" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium truncate">{displayName}</span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {purchase.leadCount} leads
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Calendar className="h-2.5 w-2.5" />
            {formattedDate}
          </span>
          <span className="flex items-center gap-0.5">
            <DollarSign className="h-2.5 w-2.5" />
            {costPerLead.toFixed(2)}/lead
          </span>
          {purchase.policiesSold > 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5",
                purchase.roiPercentage >= 0
                  ? "text-[hsl(var(--success))]"
                  : "text-destructive",
              )}
            >
              <TrendingUp className="h-2.5 w-2.5" />
              {purchase.roiPercentage.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
