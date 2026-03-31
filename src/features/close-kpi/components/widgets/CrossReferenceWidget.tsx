// src/features/close-kpi/components/widgets/CrossReferenceWidget.tsx

import React from "react";
import { Grid3X3 } from "lucide-react";
import type { CrossReferenceResult } from "../../types/close-kpi.types";

interface CrossReferenceWidgetProps {
  data: CrossReferenceResult;
}

export const CrossReferenceWidget: React.FC<CrossReferenceWidgetProps> = ({
  data,
}) => {
  const { rows, statusLabels, totals, grandTotal } = data;

  if (rows.length === 0 || statusLabels.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1">
        <Grid3X3 className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-[10px] text-muted-foreground">
          Select smart views and statuses in config to see the matrix
        </p>
      </div>
    );
  }

  // Find max cell value for heat coloring
  const maxCell = Math.max(
    ...rows.flatMap((r) => statusLabels.map((s) => r.cells[s.id] ?? 0)),
    1,
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Grid3X3 className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Smart View × Status
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {grandTotal.toLocaleString()} leads
        </span>
      </div>

      <div>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-0.5 text-left font-medium text-muted-foreground">
                Smart View
              </th>
              {statusLabels.map((s) => (
                <th
                  key={s.id}
                  className="px-1 py-0.5 text-right font-medium text-muted-foreground"
                  title={s.label}
                >
                  {s.label.length > 10 ? s.label.slice(0, 10) + "…" : s.label}
                </th>
              ))}
              <th className="px-1 py-0.5 text-right font-semibold text-muted-foreground">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.smartViewId} className="border-b border-border/50">
                <td className="max-w-[120px] truncate py-0.5 text-foreground">
                  {row.smartViewName}
                </td>
                {statusLabels.map((s) => {
                  const count = row.cells[s.id] ?? 0;
                  const intensity = count / maxCell;
                  return (
                    <td
                      key={s.id}
                      className="px-1 py-0.5 text-right font-mono"
                      style={{
                        backgroundColor:
                          count > 0
                            ? `hsl(var(--foreground) / ${Math.max(intensity * 0.15, 0.03)})`
                            : "transparent",
                      }}
                    >
                      {count > 0 ? count : "—"}
                    </td>
                  );
                })}
                <td className="px-1 py-0.5 text-right font-mono font-semibold">
                  {row.total}
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr className="border-t border-border font-semibold">
              <td className="py-0.5 text-muted-foreground">Total</td>
              {statusLabels.map((s) => (
                <td
                  key={s.id}
                  className="px-1 py-0.5 text-right font-mono text-foreground"
                >
                  {totals[s.id] ?? 0}
                </td>
              ))}
              <td className="px-1 py-0.5 text-right font-mono text-foreground">
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
