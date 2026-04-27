// src/features/settings/commission-rates/components/RateEditDialog.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductWithRates, CONTRACT_LEVELS } from "../hooks/useCommissionRates";
// eslint-disable-next-line no-restricted-imports
import { compGuideService } from "@/services/settings/comp-guide";
import { capitalizeWords } from "@/utils/stringUtils";

interface RateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithRates | null;
  onSave: (productId: string, rates: Record<number, number>) => void;
  isSaving?: boolean;
}

export function RateEditDialog({
  open,
  onOpenChange,
  product,
  onSave,
  isSaving = false,
}: RateEditDialogProps) {
  const [rates, setRates] = useState<Record<number, string>>({});
  const [_rateIds, setRateIds] = useState<Record<number, string>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Load existing rates when product changes
  useEffect(() => {
    const loadRates = async () => {
      if (!product || !product.productId) return;

      setIsLoadingDetails(true);
      try {
        // Fetch full rate details to get IDs
        const { data } = await compGuideService.getEntriesByProduct(
          product.productId,
        );

        const newRates: Record<number, string> = {};
        const newRateIds: Record<number, string> = {};

        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rate data type
          data.forEach((entry: any) => {
            const level = entry.contract_level;
            const percentage = entry.commission_percentage * 100;
            // Fix floating-point precision issues by rounding to 2 decimal places
            newRates[level] = percentage.toFixed(2);
            newRateIds[level] = entry.id;
          });
        }

        setRates(newRates);
        setRateIds(newRateIds);
      } catch (error) {
        console.error("Failed to load rates:", error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    if (open && product) {
      loadRates();
    } else {
      setRates({});
      setRateIds({});
    }
  }, [product, open]);

  const handleRateChange = (level: number, value: string) => {
    setRates((prev) => ({ ...prev, [level]: value }));
  };

  const handleFillAll = () => {
    const value = prompt(
      "Enter commission percentage to apply to all levels (0-200):",
    );
    if (!value) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 200) {
      alert("Please enter a valid percentage between 0 and 200");
      return;
    }

    const newRates: Record<number, string> = {};
    CONTRACT_LEVELS.forEach((level) => {
      newRates[level] = value;
    });
    setRates(newRates);
  };

  const handleClearAll = () => {
    if (
      !confirm(
        "Clear all commission rates? This will not delete saved rates until you click Save.",
      )
    )
      return;
    setRates({});
  };

  const handleSave = () => {
    if (!product) return;

    // Convert string rates to numbers and validate
    const validRates: Record<number, number> = {};
    let hasError = false;

    Object.entries(rates).forEach(([level, value]) => {
      if (!value.trim()) return; // Skip empty values

      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0 || numValue > 200) {
        alert(`Invalid rate for level ${level}%: must be between 0 and 200`);
        hasError = true;
        return;
      }

      validRates[Number(level)] = numValue;
    });

    if (hasError) return;

    onSave(product.productId, validRates);
  };

  if (!product) return null;

  const filledCount = Object.keys(rates).filter((k) =>
    rates[Number(k)]?.trim(),
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-3 bg-v2-card border-v2-ring">
        <DialogHeader className="space-y-1 pb-2 border-b border-v2-ring/60">
          <DialogTitle className="text-sm font-semibold text-v2-ink">
            Edit Commission Rates
          </DialogTitle>
          <DialogDescription className="text-[10px] text-v2-ink-muted">
            Set commission percentages for each contract level
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {/* Product Info */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[11px] text-v2-ink">
                {product.productName}
              </span>
              <span className="text-[10px] text-v2-ink-muted">
                {product.carrierName}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1 border-v2-ring dark:border-v2-ring"
              >
                {capitalizeWords(product.productType)}
              </Badge>
            </div>
            <div className="text-[10px] text-v2-ink-muted">
              {filledCount}/{CONTRACT_LEVELS.length} set
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFillAll}
              className="h-6 px-2 text-[10px] border-v2-ring"
            >
              Fill All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-[10px] border-v2-ring"
            >
              Clear All
            </Button>
          </div>

          <Separator className="bg-v2-ring" />

          {/* Rates Table */}
          {isLoadingDetails ? (
            <div className="text-center py-6 text-[11px] text-v2-ink-muted">
              Loading rates...
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden border border-v2-ring max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-v2-canvas z-10">
                  <TableRow className="border-b border-v2-ring hover:bg-transparent">
                    <TableHead className="h-7 text-[10px] font-semibold text-v2-ink-muted w-[140px]">
                      Contract Level
                    </TableHead>
                    <TableHead className="h-7 text-[10px] font-semibold text-v2-ink-muted text-right">
                      Commission Rate (%)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CONTRACT_LEVELS.map((level) => {
                    const value = rates[level] || "";
                    const hasValue = value.trim();

                    return (
                      <TableRow
                        key={level}
                        className="h-8 hover:bg-v2-canvas border-b border-v2-ring/60"
                      >
                        <TableCell className="py-1 text-[11px] font-medium text-v2-ink">
                          {level}%
                        </TableCell>
                        <TableCell className="py-1 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={value}
                              onChange={(e) =>
                                handleRateChange(level, e.target.value)
                              }
                              placeholder="0.0"
                              step="0.01"
                              min="0"
                              max="200"
                              className={`h-6 w-16 text-right text-[11px] rounded-md border bg-v2-card px-2 py-0.5 transition-colors placeholder:text-v2-ink-subtle focus:outline-none focus:ring-1 focus:ring-v2-accent ${
                                hasValue
                                  ? "border-v2-ring dark:border-v2-ring"
                                  : "border-v2-ring"
                              }`}
                            />
                            <span className="text-[10px] text-v2-ink-muted w-3">
                              %
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-1 pt-2 border-t border-v2-ring/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="h-7 px-2 text-[10px] border-v2-ring"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            disabled={isSaving || isLoadingDetails}
            className="h-7 px-2 text-[10px]"
          >
            {isSaving ? "Saving..." : "Save Rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
