import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCarrierRuleCoverage } from "./useUnderwritingAdmin";

interface CarrierRailProps {
  selectedCarrierId: string | null;
  onSelect: (carrierId: string) => void;
}

export function CarrierRail({ selectedCarrierId, onSelect }: CarrierRailProps) {
  const { data: rows = [], isLoading } = useCarrierRuleCoverage();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.carrierName.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="flex flex-col h-full border-r border-v2-ring bg-v2-card">
      <div className="px-3 py-2 border-b border-v2-ring/60">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted">
          Carriers
        </div>
        <div className="mt-2 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-7 pl-7 text-[11px]"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-2 space-y-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <ul>
            {filtered.map((row) => {
              const isZero = row.approvedRuleSets === 0;
              const isSelected = row.carrierId === selectedCarrierId;
              return (
                <li key={row.carrierId}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.carrierId)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] border-l-2 ${
                      isSelected
                        ? "border-v2-accent bg-v2-card-tinted text-v2-ink"
                        : "border-transparent text-v2-ink-muted hover:bg-v2-card-tinted/60 hover:text-v2-ink"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {isZero ? (
                        <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                      ) : null}
                      <span className="truncate">{row.carrierName}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0 tabular-nums">
                      <span
                        className={
                          isZero
                            ? "text-warning font-semibold"
                            : "text-v2-ink-muted"
                        }
                      >
                        {row.approvedRuleSets}
                      </span>
                      {row.pendingReviewRuleSets > 0 ? (
                        <span className="text-info">
                          +{row.pendingReviewRuleSets}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[11px] text-v2-ink-muted">
                No carriers match.
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
