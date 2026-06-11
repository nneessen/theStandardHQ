import { Plus } from "lucide-react";
import { PillButton } from "@/components/v2";
import { GuideCard } from "./GuideCard";
import type {
  CarrierGuideGroup,
  GuideWithCarrier,
} from "./groupGuidesByCarrier";

interface CarrierGuidesSectionProps {
  group: CarrierGuideGroup;
  canManage: boolean;
  onAdd: (carrierId: string) => void;
  onDeleteGuide: (guide: GuideWithCarrier) => void;
}

export function CarrierGuidesSection({
  group,
  canManage,
  onAdd,
  onDeleteGuide,
}: CarrierGuidesSectionProps) {
  const single = group.guides.length === 1;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 border-b border-v2-ring/50 pb-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[13px] font-bold uppercase tracking-[0.04em] text-v2-ink">
            {group.carrierName}
          </h2>
          <span className="shrink-0 rounded-full bg-v2-card-tinted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-v2-ink-muted">
            {group.guides.length} guide{single ? "" : "s"}
          </span>
        </div>
        {canManage ? (
          <PillButton
            tone="ghost"
            size="sm"
            onClick={() => onAdd(group.carrierId)}
            leadingIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Add
          </PillButton>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.guides.map((guide) => (
          <div
            key={guide.id}
            className={single ? "sm:col-span-2 xl:col-span-3" : undefined}
          >
            <GuideCard
              guide={guide}
              canManage={canManage}
              onDelete={onDeleteGuide}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
