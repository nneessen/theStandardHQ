import { useEffect, useState } from "react";
import { useCanManageUnderwriting } from "../hooks/wizard/useUnderwritingFeatureFlag";
import { CarrierRail } from "./CarrierRail";
import { CarrierPanel } from "./CarrierPanel";
import { useCarrierRuleCoverage } from "./useUnderwritingAdmin";

export function UnderwritingAdminPage() {
  const { canManage, isLoading: gateLoading } = useCanManageUnderwriting();
  const { data: coverage = [], isLoading: coverageLoading } =
    useCarrierRuleCoverage();
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(
    null,
  );

  // Auto-select the first carrier with zero approved rules — that's the
  // one most likely to need attention. Falls back to the first carrier.
  useEffect(() => {
    if (selectedCarrierId) return;
    if (coverage.length === 0) return;
    const zeroRule = coverage.find((c) => c.approvedRuleSets === 0);
    setSelectedCarrierId((zeroRule ?? coverage[0]).carrierId);
  }, [coverage, selectedCarrierId]);

  if (gateLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-[11px] text-v2-ink-muted">
        Loading…
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="rounded border border-v2-ring bg-v2-card px-4 py-3 text-center max-w-md">
          <div className="text-[12px] font-medium text-v2-ink">
            Underwriting admin access required
          </div>
          <p className="text-[11px] text-v2-ink-muted mt-1">
            You don&apos;t have permission to manage carrier underwriting rules.
            Ask an administrator to grant access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-v2-canvas">
      <aside className="w-[260px] flex-shrink-0">
        <CarrierRail
          selectedCarrierId={selectedCarrierId}
          onSelect={setSelectedCarrierId}
        />
      </aside>
      <main className="flex-1 min-w-0">
        {selectedCarrierId ? (
          <CarrierPanel carrierId={selectedCarrierId} />
        ) : coverageLoading ? (
          <div className="flex items-center justify-center h-full text-[11px] text-v2-ink-muted">
            Loading carriers…
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[11px] text-v2-ink-muted">
            Select a carrier to begin.
          </div>
        )}
      </main>
    </div>
  );
}

export default UnderwritingAdminPage;
