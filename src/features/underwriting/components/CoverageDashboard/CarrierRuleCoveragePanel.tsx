import { useMemo } from "react";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCarrierRuleCoverage } from "../../hooks/coverage/useCarrierRuleCoverage";

const LOW_COVERAGE_THRESHOLD = 50;

export function CarrierRuleCoveragePanel() {
  const { data: rows = [], isLoading } = useCarrierRuleCoverage();

  const stats = useMemo(() => {
    const total = rows.length;
    const lowCoverage = rows.filter(
      (r) => r.approvedRuleSets < LOW_COVERAGE_THRESHOLD,
    ).length;
    const zeroCoverage = rows.filter((r) => r.approvedRuleSets === 0).length;
    const withPending = rows.filter((r) => r.pendingReviewRuleSets > 0).length;
    return { total, lowCoverage, zeroCoverage, withPending };
  }, [rows]);

  if (isLoading) {
    return (
      <div className="rounded-v2-md border border-v2-ring bg-v2-card p-3 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-v2-ink-muted" />
        <span className="text-xs text-v2-ink-muted">
          Loading carrier rule coverage...
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-v2-md border border-v2-ring bg-v2-card p-3">
        <span className="text-xs text-v2-ink-muted">
          No active carriers visible to your IMO.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-v2-md border border-v2-ring bg-v2-card overflow-hidden">
      <header className="px-3 py-2 border-b border-v2-ring bg-v2-card-tinted flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-v2-ink-muted" />
          <h3 className="text-xs font-semibold text-v2-ink">
            Carrier Rule Coverage
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-v2-ink-muted ml-auto">
          <span>
            <span className="font-semibold text-v2-ink tabular-nums">
              {stats.total}
            </span>{" "}
            carriers
          </span>
          {stats.zeroCoverage > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              <span className="font-semibold text-destructive tabular-nums">
                {stats.zeroCoverage}
              </span>{" "}
              at zero
            </span>
          )}
          {stats.lowCoverage > 0 && (
            <span>
              <span className="font-semibold text-warning tabular-nums">
                {stats.lowCoverage}
              </span>{" "}
              under {LOW_COVERAGE_THRESHOLD}
            </span>
          )}
          {stats.withPending > 0 && (
            <span>
              <span className="font-semibold text-v2-ink tabular-nums">
                {stats.withPending}
              </span>{" "}
              awaiting review
            </span>
          )}
        </div>
      </header>

      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider font-semibold text-v2-ink-muted bg-v2-card-tinted/40">
            <th className="px-3 py-1.5">Carrier</th>
            <th className="px-3 py-1.5 text-right">Approved Sets</th>
            <th className="px-3 py-1.5 text-right">Pending Review</th>
            <th className="px-3 py-1.5 text-right">Guides</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isZero = row.approvedRuleSets === 0;
            const isLow =
              !isZero && row.approvedRuleSets < LOW_COVERAGE_THRESHOLD;
            return (
              <tr
                key={row.carrierId}
                className="border-t border-v2-ring/60 hover:bg-v2-card-tinted/40 transition-colors"
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    {isZero && (
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                    )}
                    {isLow && (
                      <AlertTriangle className="h-3 w-3 text-warning" />
                    )}
                    <span className="font-medium text-v2-ink">
                      {row.carrierName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  <span
                    className={
                      isZero
                        ? "text-destructive font-semibold"
                        : isLow
                          ? "text-warning font-semibold"
                          : "text-v2-ink"
                    }
                  >
                    {row.approvedRuleSets}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {row.pendingReviewRuleSets > 0 ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1.5 font-normal"
                    >
                      {row.pendingReviewRuleSets}
                    </Badge>
                  ) : (
                    <span className="text-v2-ink-subtle">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-v2-ink-muted">
                  {row.guideCount === 0 ? (
                    <span className="text-v2-ink-subtle">—</span>
                  ) : (
                    <span>
                      {row.parsedGuideCount}/{row.guideCount}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CarrierRuleCoveragePanel;
