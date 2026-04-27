import { useState } from "react";
import { logger } from "../../services/base/logger";
import { Download, Calculator } from "lucide-react";
import { useComps } from "../../hooks/comps";
import { CompFilters } from "../../types/commission.types";
import { UserContractSettings } from "./UserContractSettings";
import { CompTable } from "./CompTable";
import { CompFiltersComponent } from "./CompFilters";
import { CompStats } from "./CompStats";
import { PillButton, PillNav, SoftCard } from "@/components/v2";

export function CompGuide() {
  const [activeTab, setActiveTab] = useState<"guide" | "settings">("guide");
  const [filters, setFilters] = useState<CompFilters>({});

  const { data: comps, isLoading, error } = useComps(filters);

  const handleFilterChange = (newFilters: CompFilters) => {
    setFilters(newFilters);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    logger.info("Export comp guide data", undefined, "CompGuide");
  };

  // Get unique carrier IDs and product types from data for filter options
  const carrierIds = comps
    ? Array.from(
        new Set(
          comps
            .map((c) => c.carrier_id)
            .filter((id): id is string => id !== null),
        ),
      )
    : [];
  const productTypes = comps
    ? Array.from(new Set(comps.map((c) => c.product_type)))
    : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Compact header — title + description + tab nav + export pill */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Calculator className="h-4 w-4 text-v2-ink" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              Comp Guide
            </h1>
          </div>
          <p className="text-[11px] text-v2-ink-muted">
            {activeTab === "guide"
              ? "FFG compensation rates by carrier and product."
              : "Your contract commission percentage."}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PillNav
            size="sm"
            activeValue={activeTab}
            onChange={(v) => setActiveTab(v as "guide" | "settings")}
            items={[
              { label: "Comp Guide", value: "guide" },
              { label: "Contract Settings", value: "settings" },
            ]}
          />
          <PillButton
            tone="ghost"
            size="sm"
            onClick={handleExport}
            className="h-7 px-2.5 text-[11px]"
          >
            <Download className="h-3 w-3" />
            Export
          </PillButton>
        </div>
      </header>

      {/* Active tab content */}
      {activeTab === "guide" ? (
        <div className="flex flex-col gap-3 min-w-0">
          {/* Statistics */}
          <CompStats />

          {/* Filters */}
          <CompFiltersComponent
            filters={filters}
            carrierIds={carrierIds}
            productTypes={productTypes}
            onFilterChange={handleFilterChange}
          />

          {/* Comp Table */}
          <SoftCard padding="none" className="overflow-hidden">
            <CompTable
              data={comps || []}
              isLoading={isLoading}
              error={error?.message}
            />
          </SoftCard>
        </div>
      ) : (
        <SoftCard padding="lg">
          <UserContractSettings />
        </SoftCard>
      )}
    </div>
  );
}

export default CompGuide;
