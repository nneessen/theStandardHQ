// src/features/underwriting/components/CoverageBuilder/CarrierCoverageList.tsx
// Table showing all carriers with aggregate condition coverage progress bars

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useCarriersWithProducts } from "../../hooks/coverage/useCarriersWithProducts";
import { useHealthConditions } from "../../hooks/shared/useHealthConditions";
import {
  useCoverageStats,
  getCarrierAggregateCoverage,
} from "../../hooks/coverage/useCoverageStats";

interface CarrierCoverageListProps {
  onSelectCarrier: (carrierId: string, carrierName: string) => void;
}

export function CarrierCoverageList({
  onSelectCarrier,
}: CarrierCoverageListProps) {
  const { data: carriers, isLoading: carriersLoading } =
    useCarriersWithProducts();
  const { data: conditions, isLoading: conditionsLoading } =
    useHealthConditions();
  const { data: coverageMap, isLoading: coverageLoading } = useCoverageStats();

  const totalConditions = conditions?.length ?? 0;

  const carrierRows = useMemo(() => {
    if (!carriers) return [];
    return carriers
      .map((carrier) => {
        const configured = getCarrierAggregateCoverage(
          coverageMap,
          carrier.id,
        ).size;
        const pct =
          totalConditions > 0
            ? Math.round((configured / totalConditions) * 100)
            : 0;
        return {
          id: carrier.id,
          name: carrier.name,
          productCount: carrier.products.length,
          configured,
          pct,
        };
      })
      .sort((a, b) => b.configured - a.configured);
  }, [carriers, coverageMap, totalConditions]);

  const isLoading = carriersLoading || conditionsLoading || coverageLoading;

  if (isLoading) {
    return (
      <div className="text-[11px] text-muted-foreground py-6 text-center">
        Loading coverage data...
      </div>
    );
  }

  if (!carrierRows.length) {
    return (
      <div className="text-[11px] text-muted-foreground py-6 text-center">
        No carriers found.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Carrier
        </span>
        <span className="ml-auto text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Coverage
        </span>
      </div>
      {carrierRows.map((row) => (
        <button
          key={row.id}
          onClick={() => onSelectCarrier(row.id, row.name)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 transition-colors text-left group"
        >
          <div className="min-w-0 flex-shrink">
            <span className="text-[11px] font-medium text-foreground truncate block">
              {row.name}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {row.productCount} product{row.productCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] tabular-nums text-muted-foreground w-14 text-right">
              {row.configured}/{totalConditions}
            </span>
            <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${row.pct}%`,
                  backgroundColor: getBarColor(row.pct),
                }}
              />
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      ))}
    </div>
  );
}

function getBarColor(pct: number): string {
  if (pct <= 20) return "var(--destructive)";
  if (pct <= 60) return "var(--warning)";
  return "var(--success)";
}
