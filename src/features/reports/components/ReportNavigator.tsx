// src/features/reports/components/ReportNavigator.tsx

import type { ReportType } from "../../../types/reports.types";
import { REPORT_CATEGORIES } from "../config";

interface ReportNavigatorProps {
  selectedType: ReportType;
  onSelectType: (type: ReportType) => void;
}

/**
 * Left sidebar navigation for selecting report types.
 * Desktop: shows as sidebar
 * Mobile: hidden (use ReportMobileSelector instead)
 */
export function ReportNavigator({
  selectedType,
  onSelectType,
}: ReportNavigatorProps) {
  return (
    <div className="hidden md:block w-48 lg:w-52 border-r border-v2-ring bg-v2-card flex-shrink-0">
      <div className="p-3 space-y-3">
        {Object.entries(REPORT_CATEGORIES).map(([key, category]) => (
          <div key={key}>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-v2-ink-muted mb-2 px-2">
              {category.name}
            </h3>
            <div className="space-y-1">
              {category.reports.map((report) => (
                <button
                  key={report.type}
                  onClick={() => onSelectType(report.type)}
                  className={`w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors ${
                    selectedType === report.type
                      ? "bg-blue-600 text-white font-medium"
                      : "hover:bg-v2-canvas text-v2-ink"
                  }`}
                >
                  <span className="mr-1.5">{report.icon}</span>
                  {report.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ReportMobileSelectorProps {
  selectedType: ReportType;
  onSelectType: (type: ReportType) => void;
}

/**
 * Mobile dropdown selector for report types.
 * Only visible on mobile screens.
 */
export function ReportMobileSelector({
  selectedType,
  onSelectType,
}: ReportMobileSelectorProps) {
  return (
    <div className="md:hidden mb-4">
      <select
        value={selectedType}
        onChange={(e) => onSelectType(e.target.value as ReportType)}
        className="w-full px-3 py-2 text-sm border border-v2-ring rounded-md bg-v2-card text-v2-ink"
      >
        {Object.entries(REPORT_CATEGORIES).map(([key, category]) => (
          <optgroup key={key} label={category.name}>
            {category.reports.map((report) => (
              <option key={report.type} value={report.type}>
                {report.icon} {report.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
