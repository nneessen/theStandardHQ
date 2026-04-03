// src/features/close-kpi/components/widgets/CrossReferenceWidget.tsx
// Transposed matrix: statuses as rows, smart views as columns.
// Fits any number of statuses (vertical scroll) with max 5 smart view columns.

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
          No smart view data available. Configure smart views in Close CRM.
        </p>
      </div>
    );
  }

  // Max cell for heat coloring
  const maxCell = Math.max(
    ...statusLabels.flatMap((s) => rows.map((r) => r.cells[s.id] ?? 0)),
    1,
  );

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Grid3X3 className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Smart View × Status
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {grandTotal.toLocaleString()} leads
        </span>
      </div>

      {/* Transposed table: statuses = rows, smart views = columns */}
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-border">
            <th className="py-0.5 text-left font-medium text-muted-foreground">
              Status
            </th>
            {rows.map((sv) => (
              <th
                key={sv.smartViewId}
                className="px-1 py-0.5 text-right font-medium text-muted-foreground"
                title={sv.smartViewName}
              >
                {sv.smartViewName.length > 14
                  ? sv.smartViewName.slice(0, 14) + "…"
                  : sv.smartViewName}
              </th>
            ))}
            <th className="px-1 py-0.5 text-right font-semibold text-muted-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {statusLabels.map((status) => {
            const total = totals[status.id] ?? 0;
            return (
              <tr key={status.id} className="border-b border-border/30">
                <td
                  className="max-w-[130px] truncate py-0.5 text-foreground"
                  title={status.label}
                >
                  {status.label}
                </td>
                {rows.map((sv) => {
                  const count = sv.cells[status.id] ?? 0;
                  const intensity = count / maxCell;
                  return (
                    <td
                      key={sv.smartViewId}
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
                  {total > 0 ? total : "—"}
                </td>
              </tr>
            );
          })}
          {/* Smart view totals row */}
          <tr className="border-t border-border font-semibold">
            <td className="py-0.5 text-muted-foreground">Total</td>
            {rows.map((sv) => (
              <td
                key={sv.smartViewId}
                className="px-1 py-0.5 text-right font-mono text-foreground"
              >
                {sv.total}
              </td>
            ))}
            <td className="px-1 py-0.5 text-right font-mono text-foreground">
              {grandTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
