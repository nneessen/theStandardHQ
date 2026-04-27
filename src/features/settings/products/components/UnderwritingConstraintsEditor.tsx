// src/features/settings/products/components/UnderwritingConstraintsEditor.tsx

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  Shield,
  DollarSign,
} from "lucide-react";
import {
  useHealthConditions,
  groupConditionsByCategory,
  formatCurrency,
} from "@/features/underwriting";
import type {
  ProductUnderwritingConstraints,
  AgeTier,
  FullUnderwritingAgeBand,
} from "@/features/underwriting";
import { cn } from "@/lib/utils";

interface UnderwritingConstraintsEditorProps {
  value: ProductUnderwritingConstraints | null;
  onChange: (constraints: ProductUnderwritingConstraints | null) => void;
  disabled?: boolean;
}

/**
 * Editor component for product underwriting constraints
 * Allows editing age-tiered face amounts, knockout conditions, and full underwriting thresholds
 */
export function UnderwritingConstraintsEditor({
  value,
  onChange,
  disabled = false,
}: UnderwritingConstraintsEditorProps) {
  const [isOpen, setIsOpen] = useState(!!value);
  const { data: healthConditions = [], isLoading: conditionsLoading } =
    useHealthConditions();

  // Group conditions by category for display
  const groupedConditions = groupConditionsByCategory(healthConditions);

  // Parse constraints from value
  const constraints = value ?? {};
  const ageTiers = constraints.ageTieredFaceAmounts?.tiers ?? [];
  const knockoutCodes = constraints.knockoutConditions?.conditionCodes ?? [];
  const fullUnderwritingThreshold =
    constraints.fullUnderwritingThreshold?.faceAmountThreshold ?? 0;
  const fullUnderwritingAgeBands =
    constraints.fullUnderwritingThreshold?.ageBands ?? [];

  // Update entire constraints object
  const updateConstraints = (
    updates: Partial<ProductUnderwritingConstraints>,
  ) => {
    const newConstraints = { ...constraints, ...updates };
    // Clean up empty nested objects
    if (newConstraints.ageTieredFaceAmounts?.tiers?.length === 0) {
      delete newConstraints.ageTieredFaceAmounts;
    }
    if (newConstraints.knockoutConditions?.conditionCodes?.length === 0) {
      delete newConstraints.knockoutConditions;
    }
    if (
      !newConstraints.fullUnderwritingThreshold?.faceAmountThreshold &&
      (!newConstraints.fullUnderwritingThreshold?.ageBands ||
        newConstraints.fullUnderwritingThreshold.ageBands.length === 0)
    ) {
      delete newConstraints.fullUnderwritingThreshold;
    }
    // If all constraints are empty, set to null
    if (Object.keys(newConstraints).length === 0) {
      onChange(null);
    } else {
      onChange(newConstraints);
    }
  };

  // Age tier handlers
  const addAgeTier = () => {
    const newTiers = [
      ...ageTiers,
      { minAge: 0, maxAge: 100, maxFaceAmount: 100000 } as AgeTier,
    ];
    updateConstraints({
      ageTieredFaceAmounts: { tiers: newTiers },
    });
  };

  const updateAgeTier = (index: number, updates: Partial<AgeTier>) => {
    const newTiers = ageTiers.map((tier, i) =>
      i === index ? { ...tier, ...updates } : tier,
    );
    updateConstraints({
      ageTieredFaceAmounts: { tiers: newTiers },
    });
  };

  const removeAgeTier = (index: number) => {
    const newTiers = ageTiers.filter((_, i) => i !== index);
    updateConstraints({
      ageTieredFaceAmounts: { tiers: newTiers },
    });
  };

  // Knockout condition handlers
  const toggleKnockoutCondition = (code: string) => {
    const newCodes = knockoutCodes.includes(code)
      ? knockoutCodes.filter((c) => c !== code)
      : [...knockoutCodes, code];
    updateConstraints({
      knockoutConditions: { conditionCodes: newCodes },
    });
  };

  const clearKnockoutConditions = () => {
    updateConstraints({
      knockoutConditions: { conditionCodes: [] },
    });
  };

  // Full underwriting threshold handlers
  const updateFullUnderwritingThresholdValue = (amount: number) => {
    updateConstraints({
      fullUnderwritingThreshold: {
        faceAmountThreshold: amount,
        ageBands: fullUnderwritingAgeBands,
      },
    });
  };

  const addFullUnderwritingAgeBand = () => {
    const newBands = [
      ...fullUnderwritingAgeBands,
      { minAge: 0, maxAge: 100, threshold: 50000 } as FullUnderwritingAgeBand,
    ];
    updateConstraints({
      fullUnderwritingThreshold: {
        faceAmountThreshold: fullUnderwritingThreshold,
        ageBands: newBands,
      },
    });
  };

  const updateFullUnderwritingAgeBand = (
    index: number,
    updates: Partial<FullUnderwritingAgeBand>,
  ) => {
    const newBands = fullUnderwritingAgeBands.map((band, i) =>
      i === index ? { ...band, ...updates } : band,
    );
    updateConstraints({
      fullUnderwritingThreshold: {
        faceAmountThreshold: fullUnderwritingThreshold,
        ageBands: newBands,
      },
    });
  };

  const removeFullUnderwritingAgeBand = (index: number) => {
    const newBands = fullUnderwritingAgeBands.filter((_, i) => i !== index);
    updateConstraints({
      fullUnderwritingThreshold: {
        faceAmountThreshold: fullUnderwritingThreshold,
        ageBands: newBands,
      },
    });
  };

  // Get condition name by code
  const getConditionName = (code: string) => {
    const condition = healthConditions.find((c) => c.code === code);
    return condition?.name ?? code;
  };

  const hasConstraints =
    ageTiers.length > 0 ||
    knockoutCodes.length > 0 ||
    fullUnderwritingThreshold > 0 ||
    fullUnderwritingAgeBands.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "w-full justify-between h-8 px-2 text-[11px] font-medium",
            hasConstraints && "text-primary",
          )}
          disabled={disabled}
        >
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Underwriting Constraints
            {hasConstraints && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[10px] rounded-sm"
              >
                {ageTiers.length +
                  knockoutCodes.length +
                  (fullUnderwritingThreshold > 0 ? 1 : 0)}
              </Badge>
            )}
          </span>
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pt-2">
        {/* Age-Tiered Face Amounts */}
        <div className="space-y-2 rounded-md border border-v2-ring p-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Age-Tiered Face Amount Limits
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAgeTier}
              disabled={disabled}
              className="h-5 px-1.5 text-[10px]"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              Add Tier
            </Button>
          </div>

          {ageTiers.length === 0 ? (
            <p className="text-[10px] text-v2-ink-subtle italic py-1">
              No age-based limits configured
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1 text-[9px] font-medium text-v2-ink-muted uppercase">
                <span>Min Age</span>
                <span>Max Age</span>
                <span>Max Face Amount</span>
                <span></span>
              </div>
              {ageTiers.map((tier, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1 items-center"
                >
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={tier.minAge}
                    onChange={(e) =>
                      updateAgeTier(index, {
                        minAge: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={disabled}
                    className="h-6 text-[11px] px-1.5"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={tier.maxAge}
                    onChange={(e) =>
                      updateAgeTier(index, {
                        maxAge: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={disabled}
                    className="h-6 text-[11px] px-1.5"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={tier.maxFaceAmount}
                    onChange={(e) =>
                      updateAgeTier(index, {
                        maxFaceAmount: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={disabled}
                    className="h-6 text-[11px] px-1.5"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAgeTier(index)}
                    disabled={disabled}
                    className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Knockout Conditions */}
        <div className="space-y-2 rounded-md border border-v2-ring p-2">
          <Label className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Knockout Conditions
          </Label>
          <p className="text-[10px] text-v2-ink-subtle">
            Health conditions that automatically disqualify clients from this
            product
          </p>

          <KnockoutConditionSelector
            selectedCodes={knockoutCodes}
            onToggle={toggleKnockoutCondition}
            onClear={clearKnockoutConditions}
            healthConditions={healthConditions}
            groupedConditions={groupedConditions}
            isLoading={conditionsLoading}
            disabled={disabled}
          />

          {knockoutCodes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {knockoutCodes.map((code) => (
                <Badge
                  key={code}
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                >
                  {getConditionName(code)}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-red-900"
                    onClick={() => toggleKnockoutCondition(code)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Full Underwriting Threshold */}
        <div className="space-y-2 rounded-md border border-v2-ring p-2">
          <Label className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Full Underwriting Threshold
          </Label>
          <p className="text-[10px] text-v2-ink-subtle">
            Face amounts above this threshold require full medical underwriting
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-v2-ink-muted w-24">
                Base Threshold:
              </Label>
              <Input
                type="number"
                min={0}
                value={fullUnderwritingThreshold || ""}
                onChange={(e) =>
                  updateFullUnderwritingThresholdValue(
                    parseInt(e.target.value) || 0,
                  )
                }
                placeholder="e.g., 250000"
                disabled={disabled}
                className="h-6 text-[11px] px-1.5 flex-1"
              />
              {fullUnderwritingThreshold > 0 && (
                <span className="text-[10px] text-v2-ink-muted w-24 text-right">
                  {formatCurrency(fullUnderwritingThreshold)}
                </span>
              )}
            </div>

            {/* Age-specific thresholds */}
            <div className="pt-1 border-t border-v2-ring/60">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-[10px] text-v2-ink-muted">
                  Age-Specific Overrides (optional):
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFullUnderwritingAgeBand}
                  disabled={disabled}
                  className="h-5 px-1.5 text-[10px]"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add Override
                </Button>
              </div>

              {fullUnderwritingAgeBands.length === 0 ? (
                <p className="text-[10px] text-v2-ink-subtle italic">
                  Base threshold applies to all ages
                </p>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1 text-[9px] font-medium text-v2-ink-muted uppercase">
                    <span>Min Age</span>
                    <span>Max Age</span>
                    <span>Threshold</span>
                    <span></span>
                  </div>
                  {fullUnderwritingAgeBands.map((band, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1 items-center"
                    >
                      <Input
                        type="number"
                        min={0}
                        max={120}
                        value={band.minAge}
                        onChange={(e) =>
                          updateFullUnderwritingAgeBand(index, {
                            minAge: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={disabled}
                        className="h-6 text-[11px] px-1.5"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={120}
                        value={band.maxAge}
                        onChange={(e) =>
                          updateFullUnderwritingAgeBand(index, {
                            maxAge: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={disabled}
                        className="h-6 text-[11px] px-1.5"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={band.threshold}
                        onChange={(e) =>
                          updateFullUnderwritingAgeBand(index, {
                            threshold: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={disabled}
                        className="h-6 text-[11px] px-1.5"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFullUnderwritingAgeBand(index)}
                        disabled={disabled}
                        className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Multi-select component for knockout conditions
 */
interface KnockoutConditionSelectorProps {
  selectedCodes: string[];
  onToggle: (code: string) => void;
  onClear: () => void;
  healthConditions: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
  }>;
  groupedConditions: Record<
    string,
    Array<{ id: string; code: string; name: string; category: string }>
  >;
  isLoading: boolean;
  disabled: boolean;
}

function KnockoutConditionSelector({
  selectedCodes,
  onToggle,
  onClear,
  healthConditions: _healthConditions,
  groupedConditions,
  isLoading,
  disabled,
}: KnockoutConditionSelectorProps) {
  const [open, setOpen] = useState(false);
  const categories = Object.keys(groupedConditions).sort();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "w-full justify-between h-7 px-2 text-[11px]",
            selectedCodes.length > 0 && "border-red-300 dark:border-red-700",
          )}
        >
          <span className="truncate flex items-center gap-1.5">
            {isLoading ? (
              "Loading conditions..."
            ) : selectedCodes.length === 0 ? (
              "Select knockout conditions..."
            ) : (
              <>
                {selectedCodes.length} condition
                {selectedCodes.length !== 1 && "s"} selected
              </>
            )}
          </span>
          {selectedCodes.length > 0 ? (
            <X
              className="h-3 w-3 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search conditions..."
            className="h-8 text-[11px]"
          />
          <CommandList>
            <CommandEmpty className="text-[11px] py-4 text-center text-v2-ink-muted">
              No conditions found.
            </CommandEmpty>
            {categories.map((category) => (
              <CommandGroup
                key={category}
                heading={
                  <span className="text-[10px] font-semibold uppercase text-v2-ink-subtle">
                    {category.replace(/_/g, " ")}
                  </span>
                }
              >
                {groupedConditions[category]?.map((condition) => {
                  const isSelected = selectedCodes.includes(condition.code);
                  return (
                    <CommandItem
                      key={condition.code}
                      value={`${condition.name} ${condition.code}`}
                      onSelect={() => onToggle(condition.code)}
                      className="text-[11px] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox
                          checked={isSelected}
                          className="h-3.5 w-3.5"
                        />
                        <span className="flex-1 truncate">
                          {condition.name}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
