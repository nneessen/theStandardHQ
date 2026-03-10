// src/features/underwriting/components/CoverageBuilder/ProductCoverageList.tsx
// Shows all products for a carrier with per-product condition coverage progress bars

import { useMemo } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCarriersWithProducts } from "../../hooks/coverage/useCarriersWithProducts";
import { useHealthConditions } from "../../hooks/shared/useHealthConditions";
import {
  useCoverageStats,
  getProductCoverage,
} from "../../hooks/coverage/useCoverageStats";

interface ProductCoverageListProps {
  carrierId: string;
  carrierName: string;
  onBack: () => void;
  onSelectProduct: (productId: string, productName: string) => void;
}

export function ProductCoverageList({
  carrierId,
  carrierName,
  onBack,
  onSelectProduct,
}: ProductCoverageListProps) {
  const { data: carriers, isLoading: carriersLoading } =
    useCarriersWithProducts();
  const { data: conditions, isLoading: conditionsLoading } =
    useHealthConditions();
  const { data: coverageMap, isLoading: coverageLoading } = useCoverageStats();

  const totalConditions = conditions?.length ?? 0;

  const carrier = useMemo(
    () => carriers?.find((c) => c.id === carrierId),
    [carriers, carrierId],
  );

  const productRows = useMemo(() => {
    if (!carrier) return [];
    return carrier.products
      .map((product) => {
        const configured = getProductCoverage(
          coverageMap,
          carrierId,
          product.id,
        ).size;
        const pct =
          totalConditions > 0
            ? Math.round((configured / totalConditions) * 100)
            : 0;
        return {
          id: product.id,
          name: product.name,
          productType: product.product_type,
          configured,
          pct,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [carrier, coverageMap, carrierId, totalConditions]);

  const isLoading = carriersLoading || conditionsLoading || coverageLoading;

  if (isLoading) {
    return (
      <div className="text-[11px] text-muted-foreground py-6 text-center">
        Loading products...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-6 w-6 p-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-semibold text-foreground truncate">
            {carrierName}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {productRows.length} product{productRows.length !== 1 ? "s" : ""} —
            Select a product to configure conditions
          </p>
        </div>
      </div>

      {/* Product list */}
      {!productRows.length ? (
        <div className="text-[11px] text-muted-foreground py-6 text-center">
          No products found for this carrier.
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Product
            </span>
            <span className="ml-auto text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Coverage
            </span>
          </div>
          {productRows.map((row) => (
            <button
              key={row.id}
              onClick={() => onSelectProduct(row.id, row.name)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 transition-colors text-left group"
            >
              <div className="min-w-0 flex-shrink flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-foreground truncate">
                  {row.name}
                </span>
                <Badge
                  variant="outline"
                  className="text-[8px] px-1 py-0 h-3.5 flex-shrink-0"
                >
                  {row.productType}
                </Badge>
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
      )}
    </div>
  );
}

function getBarColor(pct: number): string {
  if (pct <= 20) return "var(--destructive)";
  if (pct <= 60) return "var(--warning)";
  return "var(--success)";
}
