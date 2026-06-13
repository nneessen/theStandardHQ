import { useState } from "react";
import { logger } from "../../services/base/logger";
import { Download } from "lucide-react";
import { useComps } from "../../hooks/comps";
import { CompFilters } from "../../types/commission.types";
import { UserContractSettings } from "./UserContractSettings";
import { CompTable } from "./CompTable";
import { CompFiltersComponent } from "./CompFilters";
import { CompStats } from "./CompStats";
import { PillButton, PillNav, SoftCard, SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";

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
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* header */}
          <header
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>CARRIER CONTRACTS</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Comp Guide
              </h1>
            </div>
            {/* keep existing action buttons on the right */}
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
      </div>
    </SectionShell>
  );
}

export default CompGuide;
