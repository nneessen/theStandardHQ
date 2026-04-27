// src/features/settings/products/components/ProductBuildTableEditor.tsx
// Simple build chart selector for products - selects from carrier's available charts

import React from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ruler, AlertCircle } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import { useBuildChartOptions } from "@/features/settings/carriers/hooks/useBuildChartOptions";
import { BUILD_TABLE_TYPE_LABELS } from "@/features/underwriting";

interface ProductBuildChartSelectorProps {
  carrierId: string | null;
  carrierName: string;
  value: string | null;
  onChange: (chartId: string | null) => void;
  disabled?: boolean;
}

/**
 * Simple select dropdown for choosing which build chart a product uses.
 * Options come from the carrier's available build charts.
 */
export function ProductBuildChartSelector({
  carrierId,
  carrierName,
  value,
  onChange,
  disabled = false,
}: ProductBuildChartSelectorProps) {
  const { data: options = [], isLoading } = useBuildChartOptions(carrierId);

  // No carrier selected
  if (!carrierId) {
    return (
      <div className="space-y-1">
        <Label className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide flex items-center gap-1">
          <Ruler className="h-3 w-3" />
          Build Chart
        </Label>
        <p className="text-[10px] text-v2-ink-subtle">
          Select a carrier first to choose a build chart.
        </p>
      </div>
    );
  }

  // No build charts available for carrier
  if (!isLoading && options.length === 0) {
    return (
      <div className="space-y-1">
        <Label className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide flex items-center gap-1">
          <Ruler className="h-3 w-3" />
          Build Chart
        </Label>
        <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-[10px] text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>
            No build charts configured for {carrierName}. Add build charts in
            the Carriers tab.
          </p>
        </div>
      </div>
    );
  }

  const defaultChart = options.find((o) => o.isDefault);
  const selectedChart = options.find((o) => o.id === value);

  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide flex items-center gap-1">
        <Ruler className="h-3 w-3" />
        Build Chart
      </Label>
      <Select
        value={value || "default"}
        onValueChange={(v) => onChange(v === "default" ? null : v)}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="h-7 text-[11px] bg-v2-card border-v2-ring">
          <SelectValue placeholder="Select build chart..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default" className="text-[11px]">
            <span className="flex items-center gap-2">
              Use Carrier Default
              {defaultChart && (
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[9px] rounded-sm"
                >
                  {defaultChart.name}
                </Badge>
              )}
            </span>
          </SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.id}
              value={option.id}
              className="text-[11px]"
            >
              <span className="flex items-center gap-2">
                {option.name}
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] rounded-sm"
                >
                  {BUILD_TABLE_TYPE_LABELS[option.tableType]}
                </Badge>
                {option.isDefault && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] rounded-sm text-blue-600"
                  >
                    Default
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!value && defaultChart && (
        <p className="text-[10px] text-v2-ink-subtle">
          Will use carrier default: {defaultChart.name} (
          {BUILD_TABLE_TYPE_LABELS[defaultChart.tableType]})
        </p>
      )}
      {value && selectedChart && (
        <p className="text-[10px] text-v2-ink-subtle">
          Using: {selectedChart.name} (
          {BUILD_TABLE_TYPE_LABELS[selectedChart.tableType]})
        </p>
      )}
    </div>
  );
}

// Re-export with old name for backward compatibility during transition
export const ProductBuildTableEditor = ProductBuildChartSelector;
