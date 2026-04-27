// src/features/admin/components/lead-vendors/LeadIntelligenceDashboard.tsx

import { useState, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLeadVendorAdminOverview,
  useLeadPackList,
  usePackHeatScores,
  useLeadRecentPolicies,
} from "@/hooks/lead-purchases";
import type {
  LeadPackRow,
  HeatScoreV2,
  HeatLevel,
} from "@/types/lead-purchase.types";
import { IntelligenceCommandBar } from "./IntelligenceCommandBar";
import { LeadKpiTabs } from "./LeadKpiTabs";
import { VendorIntelligenceTable } from "./VendorIntelligenceTable";
import { PackPurchaseTable } from "./PackPurchaseTable";
import { LeadPoliciesTable } from "./LeadPoliciesTable";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------
export interface IntelligenceFilterState {
  search: string;
  startDate: string;
  endDate: string;
  freshness: "all" | "fresh" | "aged";
  heatLevels: HeatLevel[];
  roiRange: "all" | "profitable" | "breakeven" | "losing";
  vendorId: string | null;
  agentId: string | null;
}

const DEFAULT_FILTERS: IntelligenceFilterState = {
  search: "",
  startDate: "",
  endDate: "",
  freshness: "all",
  heatLevels: [],
  roiRange: "all",
  vendorId: null,
  agentId: null,
};

// ---------------------------------------------------------------------------
// Computed data types
// ---------------------------------------------------------------------------
export interface FreshAgedAggregates {
  fresh: {
    spend: number;
    convRate: number;
    roi: number;
    cpl: number;
    count: number;
  };
  aged: {
    spend: number;
    convRate: number;
    roi: number;
    cpl: number;
    count: number;
  };
}

/** Vendor-level row for the main intelligence table */
export interface VendorIntelligenceRow {
  vendorId: string;
  vendorName: string;
  heat: HeatScoreV2 | undefined;
  totalPacks: number;
  uniqueUsers: number;
  winRate: number;
  conversionRate: number;
  avgRoi: number;
  avgPremPerUser: number;
  freshCount: number;
  agedCount: number;
  // Additional metrics for expanded row
  totalSpent: number;
  totalLeads: number;
  totalPolicies: number;
  totalPremium: number;
  totalCommission: number;
  avgCostPerLead: number;
  lastPurchaseDate: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function LeadIntelligenceDashboard() {
  const [filters, setFilters] =
    useState<IntelligenceFilterState>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<"vendor" | "purchases" | "policies">(
    "vendor",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Data hooks ──────────────────────────────────────────────────────────
  const { data: allPacks, isLoading: packsLoading } = useLeadPackList(
    undefined,
    filters.startDate || undefined,
    filters.endDate || undefined,
  );

  const {
    vendorScores,
    packMetrics,
    isLoading: heatLoading,
  } = usePackHeatScores();

  const { data: vendors, isLoading: vendorsLoading } =
    useLeadVendorAdminOverview(
      filters.startDate || undefined,
      filters.endDate || undefined,
    );

  const { data: recentPolicies, isLoading: policiesLoading } =
    useLeadRecentPolicies();

  const isLoading =
    packsLoading || heatLoading || vendorsLoading || policiesLoading;

  // ── Unique vendor / agent options for filter dropdowns ──────────────────
  const vendorOptions = useMemo(() => {
    if (!vendors) return [];
    return vendors
      .map((v) => ({ id: v.vendorId, name: v.vendorName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors]);

  const agentOptions = useMemo(() => {
    if (!allPacks) return [];
    const map = new Map<string, string>();
    for (const p of allPacks) {
      if (!map.has(p.agentId)) map.set(p.agentId, p.agentName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPacks]);

  // ── Client-side filtered packs (used for freshness/agent/search filtering) ─
  const filteredPacks = useMemo(() => {
    if (!allPacks) return [];
    let result = allPacks;

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.vendorName.toLowerCase().includes(term) ||
          p.agentName.toLowerCase().includes(term) ||
          p.purchaseName?.toLowerCase().includes(term),
      );
    }

    if (filters.freshness !== "all") {
      result = result.filter((p) => p.leadFreshness === filters.freshness);
    }

    if (filters.vendorId) {
      result = result.filter((p) => p.vendorId === filters.vendorId);
    }

    if (filters.agentId) {
      result = result.filter((p) => p.agentId === filters.agentId);
    }

    return result;
  }, [allPacks, filters]);

  // ── Build vendor intelligence rows from pack data ───────────────────────
  // Aggregate pack-level data per vendor so heat/win-rate reflects all purchases
  const vendorIntelligenceRows = useMemo((): VendorIntelligenceRow[] => {
    if (!vendors) return [];

    // Build a map of vendor packs from filteredPacks for win rate & user counts
    const packsByVendor = new Map<string, LeadPackRow[]>();
    for (const p of filteredPacks) {
      let arr = packsByVendor.get(p.vendorId);
      if (!arr) {
        arr = [];
        packsByVendor.set(p.vendorId, arr);
      }
      arr.push(p);
    }

    // Use VendorAdminOverview as the base, enriched with pack-level computations
    let rows = vendors
      .filter((v) => {
        // If agent filter is active, only show vendors that have packs matching that agent
        if (filters.agentId) {
          return packsByVendor.has(v.vendorId);
        }
        // If freshness filter is active, only show vendors that have matching packs
        if (filters.freshness !== "all") {
          return packsByVendor.has(v.vendorId);
        }
        // If search filter is active, check vendor name or pack data
        if (filters.search) {
          const term = filters.search.toLowerCase();
          if (v.vendorName.toLowerCase().includes(term)) return true;
          return packsByVendor.has(v.vendorId);
        }
        // If vendor filter is active
        if (filters.vendorId) {
          return v.vendorId === filters.vendorId;
        }
        return true;
      })
      .map((v): VendorIntelligenceRow => {
        const vendorPacks = packsByVendor.get(v.vendorId) ?? [];
        const uniqueAgents = new Set(vendorPacks.map((p) => p.agentId));
        const profitablePacks = vendorPacks.filter(
          (p) => p.roiPercentage > 0,
        ).length;
        const freshPacks = vendorPacks.filter(
          (p) => p.leadFreshness === "fresh",
        ).length;
        const agedPacks = vendorPacks.length - freshPacks;

        // Compute all metrics from filtered vendorPacks so filters are respected
        const totalSpent = vendorPacks.reduce((s, p) => s + p.totalCost, 0);
        const totalLeads = vendorPacks.reduce((s, p) => s + p.leadCount, 0);
        const totalPolicies = vendorPacks.reduce(
          (s, p) => s + p.policiesSold,
          0,
        );
        const totalCommission = vendorPacks.reduce(
          (s, p) => s + p.commissionEarned,
          0,
        );
        const totalPremium = vendorPacks.reduce(
          (s, p) => s + p.totalPremium,
          0,
        );

        return {
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          heat: vendorScores.get(v.vendorId),
          totalPacks: vendorPacks.length,
          uniqueUsers: uniqueAgents.size,
          winRate:
            vendorPacks.length > 0
              ? (profitablePacks / vendorPacks.length) * 100
              : 0,
          conversionRate:
            totalLeads > 0 ? (totalPolicies / totalLeads) * 100 : 0,
          avgRoi:
            totalSpent > 0
              ? ((totalCommission - totalSpent) / totalSpent) * 100
              : 0,
          avgPremPerUser:
            uniqueAgents.size > 0 ? totalPremium / uniqueAgents.size : 0,
          freshCount: freshPacks,
          agedCount: agedPacks,
          totalSpent,
          totalLeads,
          totalPolicies,
          totalPremium,
          totalCommission,
          avgCostPerLead: totalLeads > 0 ? totalSpent / totalLeads : 0,
          lastPurchaseDate: v.lastPurchaseDate,
        };
      });

    // Apply heat level filter
    if (filters.heatLevels.length > 0) {
      rows = rows.filter((r) => {
        return r.heat ? filters.heatLevels.includes(r.heat.level) : false;
      });
    }

    // Apply ROI range filter
    if (filters.roiRange !== "all") {
      rows = rows.filter((r) => {
        switch (filters.roiRange) {
          case "profitable":
            return r.avgRoi > 5;
          case "breakeven":
            return r.avgRoi >= -5 && r.avgRoi <= 5;
          case "losing":
            return r.avgRoi < -5;
          default:
            return true;
        }
      });
    }

    return rows;
  }, [vendors, filteredPacks, vendorScores, filters]);

  // ── Heat distribution counts (vendor-level) ─────────────────────────────
  const heatDistribution = useMemo(() => {
    const counts: Record<HeatLevel, number> = {
      hot: 0,
      warming: 0,
      neutral: 0,
      cooling: 0,
      cold: 0,
    };
    for (const r of vendorIntelligenceRows) {
      if (r.heat) counts[r.heat.level]++;
      else counts.neutral++;
    }
    return counts;
  }, [vendorIntelligenceRows]);

  // ── Fresh vs Aged aggregates ────────────────────────────────────────────
  const freshAgedAggregates = useMemo((): FreshAgedAggregates => {
    const fresh = { spend: 0, leads: 0, policies: 0, commission: 0, count: 0 };
    const aged = { spend: 0, leads: 0, policies: 0, commission: 0, count: 0 };

    for (const p of filteredPacks) {
      const bucket = p.leadFreshness === "fresh" ? fresh : aged;
      bucket.spend += p.totalCost;
      bucket.leads += p.leadCount;
      bucket.policies += p.policiesSold;
      bucket.commission += p.commissionEarned;
      bucket.count++;
    }

    const calcMetrics = (b: typeof fresh) => ({
      spend: b.spend,
      convRate: b.leads > 0 ? (b.policies / b.leads) * 100 : 0,
      roi: b.spend > 0 ? ((b.commission - b.spend) / b.spend) * 100 : 0,
      cpl: b.leads > 0 ? b.spend / b.leads : 0,
      count: b.count,
    });

    return { fresh: calcMetrics(fresh), aged: calcMetrics(aged) };
  }, [filteredPacks]);

  // ── Portfolio metrics for MarketPulse ────────────────────────────────────
  const portfolioMetrics = useMemo(() => {
    const totalSpend = vendorIntelligenceRows.reduce(
      (s, v) => s + v.totalSpent,
      0,
    );
    const totalLeads = vendorIntelligenceRows.reduce(
      (s, v) => s + v.totalLeads,
      0,
    );
    const totalPolicies = vendorIntelligenceRows.reduce(
      (s, v) => s + v.totalPolicies,
      0,
    );
    const totalCommission = vendorIntelligenceRows.reduce(
      (s, v) => s + v.totalCommission,
      0,
    );
    const totalPremium = vendorIntelligenceRows.reduce(
      (s, v) => s + v.totalPremium,
      0,
    );
    const convRate = totalLeads > 0 ? (totalPolicies / totalLeads) * 100 : 0;
    const roi =
      totalSpend > 0 ? ((totalCommission - totalSpend) / totalSpend) * 100 : 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    return {
      totalSpend,
      totalLeads,
      totalPolicies,
      totalCommission,
      totalPremium,
      convRate,
      roi,
      cpl,
    };
  }, [vendorIntelligenceRows]);

  // ── Filtered packMetrics & recentPolicies (respect active filters) ──────
  const filteredPackIds = useMemo(
    () => new Set(filteredPacks.map((p) => p.packId)),
    [filteredPacks],
  );

  const filteredPackMetrics = useMemo(
    () => packMetrics.filter((pm) => filteredPackIds.has(pm.packId)),
    [packMetrics, filteredPackIds],
  );

  const filteredRecentPolicies = useMemo(
    () => (recentPolicies ?? []).filter((p) => filteredPackIds.has(p.packId)),
    [recentPolicies, filteredPackIds],
  );

  // ── Filter handlers ─────────────────────────────────────────────────────
  const updateFilter = useCallback(
    <K extends keyof IntelligenceFilterState>(
      key: K,
      value: IntelligenceFilterState[K],
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.startDate || filters.endDate) count++;
    if (filters.freshness !== "all") count++;
    if (filters.heatLevels.length > 0) count++;
    if (filters.roiRange !== "all") count++;
    if (filters.vendorId) count++;
    if (filters.agentId) count++;
    return count;
  }, [filters]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (isLoading && !vendors) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Command Bar */}
      <IntelligenceCommandBar
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        vendorOptions={vendorOptions}
        agentOptions={agentOptions}
      />

      {/* Intelligence Pulse */}
      <LeadKpiTabs
        portfolioMetrics={portfolioMetrics}
        packCount={filteredPacks.length}
        heatDistribution={heatDistribution}
        vendorRowCount={vendorIntelligenceRows.length}
        freshAgedAggregates={freshAgedAggregates}
        filteredPacks={filteredPacks}
        recentPolicies={filteredRecentPolicies}
        vendors={vendors ?? []}
        packMetrics={filteredPackMetrics}
        vendorIntelligenceRows={vendorIntelligenceRows}
      />

      {/* View Toggle */}
      <div className="flex items-center gap-0.5 border border-v2-ring rounded overflow-hidden w-fit">
        <button
          onClick={() => setViewMode("vendor")}
          className={cn(
            "px-2 py-1 text-[11px] font-medium transition-colors",
            viewMode === "vendor"
              ? "bg-v2-ring text-white dark:bg-v2-ring dark:text-v2-ink"
              : "text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring",
          )}
        >
          By Vendor
        </button>
        <button
          onClick={() => setViewMode("purchases")}
          className={cn(
            "px-2 py-1 text-[11px] font-medium transition-colors",
            viewMode === "purchases"
              ? "bg-v2-ring text-white dark:bg-v2-ring dark:text-v2-ink"
              : "text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring",
          )}
        >
          All Purchases
        </button>
        <button
          onClick={() => setViewMode("policies")}
          className={cn(
            "px-2 py-1 text-[11px] font-medium transition-colors",
            viewMode === "policies"
              ? "bg-v2-ring text-white dark:bg-v2-ring dark:text-v2-ink"
              : "text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring",
          )}
        >
          Sold Policies
        </button>
      </div>

      {/* Table */}
      {viewMode === "vendor" ? (
        <VendorIntelligenceTable
          rows={vendorIntelligenceRows}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          startDate={filters.startDate || undefined}
          endDate={filters.endDate || undefined}
        />
      ) : viewMode === "purchases" ? (
        <PackPurchaseTable
          packs={filteredPacks}
          packMetrics={packMetrics}
          isLoading={isLoading}
        />
      ) : (
        <LeadPoliciesTable
          policies={filteredRecentPolicies}
          packs={allPacks ?? []}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
