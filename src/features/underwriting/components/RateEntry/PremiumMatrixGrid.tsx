// src/features/underwriting/components/RateEntry/PremiumMatrixGrid.tsx
// Grid-based premium entry component (age × face amount) with term support

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Check } from "lucide-react";
import {
  usePremiumMatrixForClassification,
  useBulkUpsertPremiumMatrix,
} from "../../hooks/rates/usePremiumMatrix";
// eslint-disable-next-line no-restricted-imports
import {
  GRID_AGES,
  GENDER_OPTIONS,
  TOBACCO_OPTIONS,
  HEALTH_CLASS_OPTIONS,
  TERM_OPTIONS,
  formatFaceAmount,
  generateFaceAmounts,
  getIncrementOptionsForProductType,
  getDefaultIncrementForProductType,
  getFaceAmountRangeForProductType,
  type GenderType,
  type TobaccoClass,
  type HealthClass,
  type TermYears,
} from "@/services/underwriting/repositories/premiumMatrixService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PremiumMatrixGridProps {
  productId: string;
  productName: string;
  productType: string;
  carrierName: string;
}

// Key format for tracking grid cell state
type CellKey = `${number}-${number}`; // age-faceAmount

export function PremiumMatrixGrid({
  productId,
  productName,
  productType,
  carrierName,
}: PremiumMatrixGridProps) {
  // Is this a term product?
  const isTermProduct = productType === "term_life";

  // Get increment options and default for this product type
  const incrementOptions = useMemo(
    () => getIncrementOptionsForProductType(productType),
    [productType],
  );

  // Selected increment state (persisted to localStorage)
  const [selectedIncrement, setSelectedIncrement] = useState<number>(() => {
    const storageKey = `premiumGrid_increment_${productType}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return getDefaultIncrementForProductType(productType);
  });

  // Persist increment changes to localStorage
  useEffect(() => {
    const storageKey = `premiumGrid_increment_${productType}`;
    localStorage.setItem(storageKey, selectedIncrement.toString());
  }, [selectedIncrement, productType]);

  // Reset increment when product type changes
  useEffect(() => {
    const defaultIncrement = getDefaultIncrementForProductType(productType);
    const storageKey = `premiumGrid_increment_${productType}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        setSelectedIncrement(parsed);
        return;
      }
    }
    setSelectedIncrement(defaultIncrement);
  }, [productType]);

  // Get face amounts based on product type and selected increment
  const faceAmounts = useMemo(() => {
    const range = getFaceAmountRangeForProductType(productType);
    return generateFaceAmounts(
      range.min,
      range.max,
      selectedIncrement,
      range.outliers,
    );
  }, [productType, selectedIncrement]);

  // Filter state
  const [selectedGender, setSelectedGender] = useState<GenderType>("male");
  const [selectedTobacco, setSelectedTobacco] =
    useState<TobaccoClass>("non_tobacco");
  const [selectedHealth, setSelectedHealth] = useState<HealthClass>("standard");
  const [selectedTerm, setSelectedTerm] = useState<TermYears | null>(
    isTermProduct ? 20 : null,
  );

  // Cell input state - tracks user changes before saving
  const [cellInputs, setCellInputs] = useState<Record<CellKey, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Ref for keyboard navigation
  const inputRefs = useRef<Map<CellKey, HTMLInputElement>>(new Map());

  // Ref for virtualized scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Column virtualizer for horizontal virtualization
  const columnVirtualizer = useVirtualizer({
    count: faceAmounts.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 62, // min-w-[60px] + padding
    horizontal: true,
    overscan: 5, // render 5 extra columns on each side for smooth scrolling
  });

  // Fetch existing data
  const { data: existingData, isLoading } = usePremiumMatrixForClassification(
    productId,
    selectedGender,
    selectedTobacco,
    selectedHealth,
    isTermProduct ? selectedTerm : null,
  );

  const bulkUpsert = useBulkUpsertPremiumMatrix();

  // Build lookup map from existing data
  const existingMap = useMemo(() => {
    const map = new Map<CellKey, number>();
    if (existingData) {
      for (const entry of existingData) {
        const key: CellKey = `${entry.age}-${entry.face_amount}`;
        map.set(key, Number(entry.monthly_premium));
      }
    }
    return map;
  }, [existingData]);

  // Compute dynamic ages from DB data (fallback to GRID_AGES for empty products)
  const gridAges = useMemo(() => {
    if (existingData && existingData.length > 0) {
      const ageSet = new Set(existingData.map((entry) => entry.age));
      return [...ageSet].sort((a, b) => a - b);
    }
    return [...GRID_AGES];
  }, [existingData]);

  // Clear cell inputs when classification changes
  useEffect(() => {
    setCellInputs({});
  }, [selectedGender, selectedTobacco, selectedHealth, selectedTerm]);

  // Reset term when product changes
  useEffect(() => {
    setSelectedTerm(isTermProduct ? 20 : null);
  }, [productId, isTermProduct]);

  // Get display value for a cell
  const getCellValue = useCallback(
    (age: number, faceAmount: number): string => {
      const key: CellKey = `${age}-${faceAmount}`;
      // User input takes precedence
      if (cellInputs[key] !== undefined) {
        return cellInputs[key];
      }
      // Fall back to existing data
      const existing = existingMap.get(key);
      return existing !== undefined ? existing.toFixed(2) : "";
    },
    [cellInputs, existingMap],
  );

  // Check if cell has existing saved data
  const cellHasData = useCallback(
    (age: number, faceAmount: number): boolean => {
      const key: CellKey = `${age}-${faceAmount}`;
      return existingMap.has(key);
    },
    [existingMap],
  );

  // Check if cell has unsaved changes
  const cellHasChanges = useCallback(
    (age: number, faceAmount: number): boolean => {
      const key: CellKey = `${age}-${faceAmount}`;
      return cellInputs[key] !== undefined;
    },
    [cellInputs],
  );

  // Handle cell input change
  const handleCellChange = useCallback(
    (age: number, faceAmount: number, value: string) => {
      const key: CellKey = `${age}-${faceAmount}`;
      setCellInputs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      age: number,
      faceAmount: number,
      ageIndex: number,
      faceIndex: number,
    ) => {
      let nextAge = age;
      let nextFace = faceAmount;

      if (e.key === "Tab" && !e.shiftKey) {
        if (faceIndex < faceAmounts.length - 1) {
          nextFace = faceAmounts[faceIndex + 1];
        } else if (ageIndex < gridAges.length - 1) {
          nextAge = gridAges[ageIndex + 1];
          nextFace = faceAmounts[0];
        }
      } else if (e.key === "Tab" && e.shiftKey) {
        if (faceIndex > 0) {
          nextFace = faceAmounts[faceIndex - 1];
        } else if (ageIndex > 0) {
          nextAge = gridAges[ageIndex - 1];
          nextFace = faceAmounts[faceAmounts.length - 1];
        }
      } else if (e.key === "ArrowDown" && ageIndex < gridAges.length - 1) {
        e.preventDefault();
        nextAge = gridAges[ageIndex + 1];
      } else if (e.key === "ArrowUp" && ageIndex > 0) {
        e.preventDefault();
        nextAge = gridAges[ageIndex - 1];
      } else if (e.key === "ArrowRight" && faceIndex < faceAmounts.length - 1) {
        e.preventDefault();
        nextFace = faceAmounts[faceIndex + 1];
      } else if (e.key === "ArrowLeft" && faceIndex > 0) {
        e.preventDefault();
        nextFace = faceAmounts[faceIndex - 1];
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (ageIndex < gridAges.length - 1) {
          nextAge = gridAges[ageIndex + 1];
        }
      } else {
        return;
      }

      if (nextAge !== age || nextFace !== faceAmount) {
        const nextFaceIndex = faceAmounts.indexOf(nextFace);
        // Scroll the virtualizer to ensure the target column is visible
        if (nextFaceIndex !== -1) {
          columnVirtualizer.scrollToIndex(nextFaceIndex, { align: "auto" });
        }
        // Use setTimeout to allow the virtualizer to render the column first
        setTimeout(() => {
          const nextKey: CellKey = `${nextAge}-${nextFace}`;
          const nextInput = inputRefs.current.get(nextKey);
          if (nextInput && e.key !== "Tab") {
            nextInput.focus();
            nextInput.select();
          }
        }, 0);
      }
    },
    [faceAmounts, columnVirtualizer, gridAges],
  );

  // Save all changes
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const entries: {
        age: number;
        faceAmount: number;
        monthlyPremium: number;
      }[] = [];

      for (const [key, value] of Object.entries(cellInputs)) {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && parsed > 0) {
          const [age, faceAmount] = key.split("-").map(Number);
          entries.push({ age, faceAmount, monthlyPremium: parsed });
        }
      }

      if (entries.length === 0) {
        toast.info("No changes to save");
        return;
      }

      await bulkUpsert.mutateAsync({
        productId,
        gender: selectedGender,
        tobaccoClass: selectedTobacco,
        healthClass: selectedHealth,
        termYears: isTermProduct ? selectedTerm : null,
        entries,
      });

      toast.success(`Saved ${entries.length} premium entries`);
      setCellInputs({});
    } catch (error) {
      console.error("Error saving premium matrix:", error);
      toast.error("Failed to save premiums");
    } finally {
      setIsSaving(false);
    }
  };

  // Count statistics
  const stats = useMemo(() => {
    const totalCells = gridAges.length * faceAmounts.length;
    let filledCells = 0;
    let pendingChanges = 0;

    for (const age of gridAges) {
      for (const faceAmount of faceAmounts) {
        const key: CellKey = `${age}-${faceAmount}`;
        if (existingMap.has(key) || cellInputs[key]) {
          filledCells++;
        }
        if (cellInputs[key] !== undefined) {
          pendingChanges++;
        }
      }
    }

    return { totalCells, filledCells, pendingChanges };
  }, [existingMap, cellInputs, faceAmounts, gridAges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="border border-v2-ring dark:border-v2-ring rounded-md">
      {/* Header */}
      <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring bg-v2-canvas dark:bg-v2-card-tinted/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
              {productName}
            </div>
            <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {carrierName}
              {isTermProduct && selectedTerm && (
                <span className="ml-1">• {selectedTerm} Year Term</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
              {stats.filledCells}/{stats.totalCells}
            </Badge>
            {stats.pendingChanges > 0 && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                {stats.pendingChanges} unsaved
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Filter Controls */}
        <div className="flex items-end gap-2 flex-wrap">
          {/* Term Selector - Only for term products */}
          {isTermProduct && (
            <div>
              <label className="text-[9px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5 block">
                Term
              </label>
              <Select
                value={selectedTerm?.toString() || ""}
                onValueChange={(v) => setSelectedTerm(parseInt(v) as TermYears)}
              >
                <SelectTrigger className="h-6 w-20 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value.toString()}
                      className="text-[10px]"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Increment Selector */}
          <div>
            <label className="text-[9px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5 block">
              Increment
            </label>
            <Select
              value={selectedIncrement.toString()}
              onValueChange={(v) => setSelectedIncrement(parseInt(v, 10))}
            >
              <SelectTrigger className="h-6 w-16 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {incrementOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value.toString()}
                    className="text-[10px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[9px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5 block">
              Gender
            </label>
            <Select
              value={selectedGender}
              onValueChange={(v) => setSelectedGender(v as GenderType)}
            >
              <SelectTrigger className="h-6 w-20 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-[10px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[9px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5 block">
              Tobacco
            </label>
            <Select
              value={selectedTobacco}
              onValueChange={(v) => setSelectedTobacco(v as TobaccoClass)}
            >
              <SelectTrigger className="h-6 w-28 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOBACCO_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-[10px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[9px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5 block">
              Health Class
            </label>
            <Select
              value={selectedHealth}
              onValueChange={(v) => setSelectedHealth(v as HealthClass)}
            >
              <SelectTrigger className="h-6 w-28 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_CLASS_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-[10px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || stats.pendingChanges === 0}
            size="sm"
            className="h-6 px-2 text-[10px] ml-auto"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>

        {/* Premium Grid - Virtualized */}
        <div className="border border-v2-ring dark:border-v2-ring-strong rounded">
          {/* Scrollable container */}
          <div ref={scrollContainerRef} className="overflow-x-auto">
            {/* Virtual scroll area */}
            <div
              style={{
                width: `${columnVirtualizer.getTotalSize() + 40}px`, // +40 for age column
                minWidth: "100%",
              }}
            >
              {/* Header row */}
              <div className="flex bg-v2-card-tinted dark:bg-v2-card-tinted">
                {/* Age header - sticky */}
                <div className="sticky left-0 z-20 bg-v2-card-tinted dark:bg-v2-card-tinted px-1.5 py-1 text-[9px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle text-left w-10 flex-shrink-0">
                  Age
                </div>
                {/* Virtualized column headers */}
                <div
                  className="relative flex-1"
                  style={{
                    height: 24,
                    width: columnVirtualizer.getTotalSize(),
                  }}
                >
                  {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
                    const faceAmount = faceAmounts[virtualColumn.index];
                    return (
                      <div
                        key={faceAmount}
                        className="absolute top-0 h-full px-1 py-1 text-[9px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle text-center"
                        style={{
                          left: virtualColumn.start,
                          width: virtualColumn.size,
                        }}
                      >
                        {formatFaceAmount(faceAmount)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data rows */}
              {gridAges.map((age, ageIndex) => (
                <div
                  key={age}
                  className="flex border-t border-v2-ring dark:border-v2-ring"
                >
                  {/* Age cell - sticky */}
                  <div className="sticky left-0 z-10 bg-v2-card px-1.5 py-0.5 text-[10px] font-medium text-v2-ink dark:text-v2-ink-muted w-10 flex-shrink-0 flex items-center">
                    {age}
                  </div>
                  {/* Virtualized data cells */}
                  <div
                    className="relative flex-1"
                    style={{
                      height: 28,
                      width: columnVirtualizer.getTotalSize(),
                    }}
                  >
                    {columnVirtualizer
                      .getVirtualItems()
                      .map((virtualColumn) => {
                        const faceAmount = faceAmounts[virtualColumn.index];
                        const faceIndex = virtualColumn.index;
                        const key: CellKey = `${age}-${faceAmount}`;
                        const value = getCellValue(age, faceAmount);
                        const hasData = cellHasData(age, faceAmount);
                        const hasChanges = cellHasChanges(age, faceAmount);

                        return (
                          <div
                            key={faceAmount}
                            className="absolute top-0 h-full p-0.5"
                            style={{
                              left: virtualColumn.start,
                              width: virtualColumn.size,
                            }}
                          >
                            <div className="relative h-full">
                              <Input
                                ref={(el) => {
                                  if (el) {
                                    inputRefs.current.set(key, el);
                                  } else {
                                    inputRefs.current.delete(key);
                                  }
                                }}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="—"
                                value={value}
                                onChange={(e) =>
                                  handleCellChange(
                                    age,
                                    faceAmount,
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(
                                    e,
                                    age,
                                    faceAmount,
                                    ageIndex,
                                    faceIndex,
                                  )
                                }
                                className={cn(
                                  "h-6 w-full text-center text-[10px] px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                  hasData &&
                                    !hasChanges &&
                                    "bg-green-50 dark:bg-green-950/20",
                                  hasChanges &&
                                    "bg-yellow-50 dark:bg-yellow-950/20",
                                )}
                              />
                              {hasData && !hasChanges && (
                                <Check className="absolute right-0.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-green-500 pointer-events-none" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend & Help */}
        <div className="flex items-center justify-between text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-green-50 dark:bg-green-950/20 rounded border border-v2-ring dark:border-v2-ring-strong" />
              <span>Saved</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-v2-ring dark:border-v2-ring-strong" />
              <span>Unsaved</span>
            </div>
          </div>
          <span>Tab/Arrow keys to navigate • Enter to move down</span>
        </div>
      </div>
    </div>
  );
}
