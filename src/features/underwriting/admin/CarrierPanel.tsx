import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCarrierRuleCoverage,
  useUnderwritingGuides,
} from "./useUnderwritingAdmin";
import { GuideRow } from "./GuideRow";
import { UploadDropZone } from "./UploadDropZone";
import { RuleSetEditorDialog } from "./RuleSetEditorDialog";

interface CarrierPanelProps {
  carrierId: string;
}

export function CarrierPanel({ carrierId }: CarrierPanelProps) {
  const { data: coverage = [] } = useCarrierRuleCoverage();
  const { data: guides = [], isLoading: guidesLoading } =
    useUnderwritingGuides();
  const [createOpen, setCreateOpen] = useState(false);

  const carrier = useMemo(
    () => coverage.find((c) => c.carrierId === carrierId),
    [coverage, carrierId],
  );

  const carrierGuides = useMemo(
    () => guides.filter((g) => g.carrier_id === carrierId),
    [guides, carrierId],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-v2-ring bg-v2-card flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-v2-ink truncate">
            {carrier?.carrierName ?? "—"}
          </div>
          <div className="text-[10px] text-v2-ink-muted">
            {carrier
              ? `${carrier.guideCount} guide${carrier.guideCount === 1 ? "" : "s"} · ${carrier.approvedRuleSets} approved · ${carrier.pendingReviewRuleSets} pending`
              : "Carrier details loading…"}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCreateOpen(true)}
          className="h-7 text-[11px]"
        >
          <Plus className="h-3 w-3 mr-1" /> New rule set
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <UploadDropZone carrierId={carrierId} />

        {guidesLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : carrierGuides.length === 0 ? (
          <div className="rounded border border-v2-ring bg-v2-card-tinted/40 px-4 py-6 text-center">
            <div className="text-[12px] font-medium text-v2-ink">
              No guides uploaded yet
            </div>
            <p className="text-[11px] text-v2-ink-muted mt-1">
              Drop a UW guide PDF above to get this carrier into the engine.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {carrierGuides.map((guide, idx) => (
              <GuideRow
                key={guide.id}
                guide={guide}
                defaultOpen={idx === 0 && carrierGuides.length === 1}
              />
            ))}
          </div>
        )}
      </div>

      <RuleSetEditorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        carrierId={carrierId}
      />
    </div>
  );
}
