// src/features/underwriting/components/QuickQuote/quick-options-presets.tsx

import { useState, useCallback, useMemo } from "react";
import { Settings, X, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useQuickQuotePresets,
  useUpdatePresets,
} from "../../hooks/quotes/useQuickQuote";
// eslint-disable-next-line no-restricted-imports
import type { PresetTuple } from "@/services/underwriting/repositories/quickQuotePresetsService";

// =============================================================================
// System Default Presets
// =============================================================================

/** Term Life coverage presets (higher amounts — term is cheaper) */
export const TERM_COVERAGE_PRESETS: PresetTuple[] = [
  [50000, 100000, 150000],
  [100000, 200000, 300000],
  [250000, 500000, 1000000],
];

/** Whole Life / Perm coverage presets (lower amounts — perm is more expensive) */
export const PERM_COVERAGE_PRESETS: PresetTuple[] = [
  [10000, 20000, 30000],
  [25000, 50000, 75000],
  [50000, 100000, 150000],
];

/** Default mixed coverage presets */
const DEFAULT_COVERAGE_PRESETS: PresetTuple[] = [
  [25000, 50000, 100000],
  [50000, 100000, 250000],
  [100000, 250000, 500000],
  [250000, 500000, 1000000],
];

/** Default budget presets */
const DEFAULT_BUDGET_PRESETS: PresetTuple[] = [
  [25, 50, 100],
  [50, 100, 200],
  [100, 200, 300],
  [150, 250, 400],
];

// =============================================================================
// Helpers
// =============================================================================

const MAX_PRESETS = 5;

function formatPresetChip(
  values: PresetTuple,
  mode: "coverage" | "budget",
): string {
  if (mode === "budget") {
    return `$${values[0]}/$${values[1]}/$${values[2]}`;
  }
  const fmt = (v: number) => {
    if (v >= 1000000) return `${v / 1000000}M`;
    if (v >= 1000) return `${v / 1000}k`;
    return `${v}`;
  };
  return `${fmt(values[0])}/${fmt(values[1])}/${fmt(values[2])}`;
}

function tuplesEqual(a: PresetTuple, b: PresetTuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// =============================================================================
// Preset Config Popover
// =============================================================================

function PresetConfigPopover({
  presets,
  mode,
  currentAmounts,
  onSave,
  onDelete,
  onReset,
  isSaving,
}: {
  presets: PresetTuple[];
  mode: "coverage" | "budget";
  currentAmounts: PresetTuple;
  onSave: () => void;
  onDelete: (index: number) => void;
  onReset: () => void;
  isSaving: boolean;
}) {
  const canAdd = presets.length < MAX_PRESETS;
  const alreadyExists = presets.some((p) => tuplesEqual(p, currentAmounts));

  return (
    <div className="w-56 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Configure Presets
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          ({presets.length}/{MAX_PRESETS})
        </span>
      </div>

      {/* Preset list */}
      {presets.length > 0 ? (
        <div className="space-y-1">
          {presets.map((preset, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-md px-2 py-1 bg-zinc-50 dark:bg-zinc-800/50"
            >
              <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                {formatPresetChip(preset, mode)}
              </span>
              <button
                type="button"
                onClick={() => onDelete(idx)}
                disabled={isSaving}
                className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-1">
          No custom presets
        </p>
      )}

      {/* Save current */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs"
        onClick={onSave}
        disabled={isSaving || !canAdd || alreadyExists}
      >
        <Plus className="h-3 w-3 mr-1" />
        {alreadyExists ? "Already saved" : "Save Current"}
      </Button>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        disabled={isSaving}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors mx-auto disabled:opacity-50"
      >
        <RotateCcw className="h-2.5 w-2.5" />
        Reset to Defaults
      </button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface QuickOptionsPresetsProps {
  mode: "coverage" | "budget";
  currentAmounts: PresetTuple;
  onPresetSelect: (values: PresetTuple) => void;
  /** Override system defaults based on product selection */
  systemDefaults?: PresetTuple[];
}

export function QuickOptionsPresets({
  mode,
  currentAmounts,
  onPresetSelect,
  systemDefaults,
}: QuickOptionsPresetsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { data: savedPresets } = useQuickQuotePresets();
  const updateMutation = useUpdatePresets();

  // Resolve which presets to show
  const defaults = useMemo(() => {
    if (systemDefaults) return systemDefaults;
    return mode === "coverage"
      ? DEFAULT_COVERAGE_PRESETS
      : DEFAULT_BUDGET_PRESETS;
  }, [mode, systemDefaults]);

  const userPresets = useMemo((): PresetTuple[] => {
    if (!savedPresets) return [];
    return mode === "coverage"
      ? savedPresets.coveragePresets
      : savedPresets.budgetPresets;
  }, [savedPresets, mode]);

  // Show user presets if they have any, otherwise system defaults
  const activePresets = userPresets.length > 0 ? userPresets : defaults;

  const handleSaveCurrent = useCallback(() => {
    const existing = userPresets.length > 0 ? userPresets : [];
    if (existing.length >= MAX_PRESETS) return;
    if (existing.some((p) => tuplesEqual(p, currentAmounts))) return;

    const newPresets = [...existing, currentAmounts] as PresetTuple[];
    const payload =
      mode === "coverage"
        ? { coveragePresets: newPresets }
        : { budgetPresets: newPresets };
    updateMutation.mutate(payload);
  }, [userPresets, currentAmounts, mode, updateMutation]);

  const handleDelete = useCallback(
    (index: number) => {
      const existing = [...userPresets];
      existing.splice(index, 1);

      const payload =
        mode === "coverage"
          ? { coveragePresets: existing }
          : { budgetPresets: existing };
      updateMutation.mutate(payload);
    },
    [userPresets, mode, updateMutation],
  );

  const handleReset = useCallback(() => {
    const payload =
      mode === "coverage"
        ? { coveragePresets: [] as PresetTuple[] }
        : { budgetPresets: [] as PresetTuple[] };
    updateMutation.mutate(payload);
    setPopoverOpen(false);
  }, [mode, updateMutation]);

  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">Quick Options</Label>

      {/* Segmented preset group with gear button */}
      <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden h-7">
        {activePresets.map((preset, idx) => {
          const isActive = tuplesEqual(preset, currentAmounts);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onPresetSelect(preset)}
              className={cn(
                "px-2.5 text-[11px] font-medium tabular-nums transition-colors whitespace-nowrap",
                isActive
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "bg-white text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
                idx > 0 && "border-l border-zinc-200 dark:border-zinc-700",
              )}
            >
              {formatPresetChip(preset, mode)}
            </button>
          );
        })}

        {/* Gear button at end of group */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "px-2 flex items-center justify-center transition-colors border-l border-zinc-200 dark:border-zinc-700",
                "bg-white text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
              )}
            >
              <Settings className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-3" sideOffset={8}>
            <PresetConfigPopover
              presets={userPresets}
              mode={mode}
              currentAmounts={currentAmounts}
              onSave={handleSaveCurrent}
              onDelete={handleDelete}
              onReset={handleReset}
              isSaving={updateMutation.isPending}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
