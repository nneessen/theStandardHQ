import { BarChart3, Building2, Package, TrendingUp } from "lucide-react";
import { useComps } from "../../hooks/comps";
import { SoftCard } from "@/components/v2";

export function CompStats() {
  const { data: comps, isLoading, error } = useComps();

  // Calculate statistics from comps data
  const stats = comps
    ? {
        totalProducts: comps.length,
        avgCommission:
          comps.reduce((sum, c) => sum + c.commission_percentage, 0) /
            comps.length || 0,
        activeCarriers: new Set(comps.map((c) => c.carrier_id)).size,
        productTypes: new Set(comps.map((c) => c.product_type)).size,
        topRate: Math.max(...comps.map((c) => c.commission_percentage), 0),
      }
    : null;

  if (isLoading) {
    return (
      <SoftCard padding="md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] animate-pulse">
          <div className="h-3 w-32 bg-v2-ring rounded" />
          <div className="h-3 w-32 bg-v2-ring rounded" />
          <div className="h-3 w-32 bg-v2-ring rounded" />
          <div className="h-3 w-32 bg-v2-ring rounded" />
        </div>
      </SoftCard>
    );
  }

  if (error || !stats) {
    return (
      <SoftCard
        padding="md"
        className="border-destructive/40 dark:border-destructive"
      >
        <p className="text-sm text-destructive">
          Failed to load comp statistics
        </p>
      </SoftCard>
    );
  }

  // Inline metric chips — preserves density rule (no 4-up gradient cards).
  // Right-aligned info note about typical commission range.
  return (
    <SoftCard padding="md">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-x-3 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-v2-ink-subtle" />
            <span className="text-v2-ink font-semibold">
              {stats.totalProducts.toLocaleString()}
            </span>
            products
          </span>
          <span className="text-v2-ink-subtle">·</span>
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3 text-success" />
            <span className="text-v2-ink font-semibold">
              {stats.activeCarriers.toLocaleString()}
            </span>
            carriers
          </span>
          <span className="text-v2-ink-subtle">·</span>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3 text-info" />
            <span className="text-v2-ink font-semibold">
              {stats.productTypes.toLocaleString()}
            </span>
            product types
          </span>
          <span className="text-v2-ink-subtle">·</span>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-warning" />
            <span className="text-v2-ink font-semibold">
              {stats.avgCommission.toFixed(1)}%
            </span>
            avg commission
          </span>
          <span className="text-v2-ink-subtle">·</span>
          <span>
            <span className="text-v2-ink font-semibold">
              {stats.topRate.toFixed(0)}%
            </span>{" "}
            top rate
          </span>
        </div>
        <p className="text-[10px] text-v2-ink-subtle italic max-w-md">
          Commission rates typically range 50–150% by carrier, product, and
          contract level. Rates update regularly.
        </p>
      </div>
    </SoftCard>
  );
}

export default CompStats;
