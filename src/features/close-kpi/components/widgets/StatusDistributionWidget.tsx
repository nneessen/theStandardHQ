// src/features/close-kpi/components/widgets/StatusDistributionWidget.tsx

import React from "react";
import type { StatusDistributionResult } from "../../types/close-kpi.types";

interface StatusDistributionWidgetProps {
  data: StatusDistributionResult;
  label?: string;
}

export const StatusDistributionWidget: React.FC<
  StatusDistributionWidgetProps
> = ({ data, label }) => {
  const maxCount = Math.max(...data.items.map((i) => i.count), 1);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label ?? "Lead Pipeline"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {data.total.toLocaleString()} total
        </span>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {data.items.map((item) => {
          const pct =
            data.total > 0 ? Math.round((item.count / data.total) * 100) : 0;
          return (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground">
                {item.label}
              </span>
              <div className="flex-1">
                <div
                  className="h-4 rounded-sm bg-foreground/70"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    minWidth: item.count > 0 ? "2px" : "0",
                  }}
                />
              </div>
              <span className="w-14 text-right font-mono text-[11px] text-foreground">
                <span className="font-semibold">
                  {item.count.toLocaleString()}
                </span>
                <span className="ml-0.5 text-[9px] text-muted-foreground">
                  {pct}%
                </span>
              </span>
            </div>
          );
        })}
        {data.items.length === 0 && (
          <p className="py-4 text-center text-[10px] text-muted-foreground">
            No data
          </p>
        )}
      </div>
    </div>
  );
};
