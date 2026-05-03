// src/features/admin/components/lead-vendors/IntelligenceCommandBar.tsx

import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { HeatLevel } from "@/types/lead-purchase.types";
import type { IntelligenceFilterState } from "./LeadIntelligenceDashboard";

const HEAT_LEVELS: { key: HeatLevel; label: string; color: string }[] = [
  { key: "hot", label: "Hot", color: "bg-destructive" },
  { key: "warming", label: "Warm", color: "bg-warning/70" },
  { key: "neutral", label: "Neutral", color: "bg-muted" },
  { key: "cooling", label: "Cool", color: "bg-info/70" },
  { key: "cold", label: "Cold", color: "bg-info" },
];

interface IntelligenceCommandBarProps {
  filters: IntelligenceFilterState;
  updateFilter: <K extends keyof IntelligenceFilterState>(
    key: K,
    value: IntelligenceFilterState[K],
  ) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  vendorOptions: { id: string; name: string }[];
  agentOptions: { id: string; name: string }[];
}

export function IntelligenceCommandBar({
  filters,
  updateFilter,
  clearFilters,
  activeFilterCount,
  vendorOptions,
  agentOptions,
}: IntelligenceCommandBarProps) {
  const toggleHeatLevel = (level: HeatLevel) => {
    const current = filters.heatLevels;
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    updateFilter("heatLevels", next);
  };

  return (
    <div className="sticky top-0 z-10 bg-card/95 dark:bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-sm px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter icon + count badge */}
        <div className="flex items-center gap-1 mr-1">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          {activeFilterCount > 0 && (
            <Badge className="h-4 min-w-[16px] px-1 text-[9px] bg-info text-white">
              {activeFilterCount}
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search packs..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="h-7 text-[11px] w-[140px] pl-6"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilter("startDate", e.target.value)}
            className="h-7 text-[11px] w-[120px] px-1.5"
          />
          <span className="text-[10px] text-muted-foreground">&ndash;</span>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilter("endDate", e.target.value)}
            className="h-7 text-[11px] w-[120px] px-1.5"
          />
        </div>

        {/* Freshness */}
        <Select
          value={filters.freshness}
          onValueChange={(v) =>
            updateFilter("freshness", v as "all" | "fresh" | "aged")
          }
        >
          <SelectTrigger className="h-7 text-[11px] w-[90px]">
            <SelectValue placeholder="Freshness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All Types
            </SelectItem>
            <SelectItem value="fresh" className="text-[11px]">
              Fresh
            </SelectItem>
            <SelectItem value="aged" className="text-[11px]">
              Aged
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Heat level multi-toggle */}
        <div className="flex items-center gap-0.5 border border-border rounded-md overflow-hidden">
          {HEAT_LEVELS.map((h) => (
            <button
              key={h.key}
              onClick={() => toggleHeatLevel(h.key)}
              className={cn(
                "px-1.5 py-1 text-[10px] font-medium transition-colors flex items-center gap-0.5",
                filters.heatLevels.includes(h.key)
                  ? "bg-muted text-white dark:bg-muted dark:text-foreground"
                  : "text-muted-foreground hover:bg-muted dark:hover:bg-muted",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", h.color)} />
              {h.label}
            </button>
          ))}
        </div>

        {/* ROI Range */}
        <Select
          value={filters.roiRange}
          onValueChange={(v) =>
            updateFilter(
              "roiRange",
              v as "all" | "profitable" | "breakeven" | "losing",
            )
          }
        >
          <SelectTrigger className="h-7 text-[11px] w-[100px]">
            <SelectValue placeholder="ROI" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All ROI
            </SelectItem>
            <SelectItem value="profitable" className="text-[11px]">
              Profitable
            </SelectItem>
            <SelectItem value="breakeven" className="text-[11px]">
              Breakeven
            </SelectItem>
            <SelectItem value="losing" className="text-[11px]">
              Losing
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Vendor */}
        <Select
          value={filters.vendorId ?? "all"}
          onValueChange={(v) =>
            updateFilter("vendorId", v === "all" ? null : v)
          }
        >
          <SelectTrigger className="h-7 text-[11px] w-[110px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All Vendors
            </SelectItem>
            {vendorOptions.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-[11px]">
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agent */}
        <Select
          value={filters.agentId ?? "all"}
          onValueChange={(v) => updateFilter("agentId", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-7 text-[11px] w-[110px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All Agents
            </SelectItem>
            {agentOptions.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-[11px]">
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
