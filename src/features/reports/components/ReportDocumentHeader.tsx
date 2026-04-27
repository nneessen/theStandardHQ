// src/features/reports/components/ReportDocumentHeader.tsx

import type { ReportFilters } from "../../../types/reports.types";

interface ReportDocumentHeaderProps {
  title: string;
  filters: ReportFilters;
}

/**
 * Header section within the report document itself.
 * Shows report title and date range.
 */
export function ReportDocumentHeader({
  title,
  filters,
}: ReportDocumentHeaderProps) {
  return (
    <div className="px-3 py-2 border-b border-v2-ring bg-v2-canvas">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-v2-ink">{title}</h1>
          <p className="text-[10px] text-v2-ink-muted">
            {filters.startDate.toLocaleDateString()} -{" "}
            {filters.endDate.toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
