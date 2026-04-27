// src/features/recruiting/components/contracting/AddCarrierDialog.tsx
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { carrierContractRequestService } from "@/services/recruiting/carrierContractRequestService";
import { AlertCircle, Plus, Loader2, Info, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddCarrierDialogProps {
  recruitId: string;
  open: boolean;
  onClose: () => void;
  onAdd: (carrierId: string) => Promise<void>;
  uplineId?: string | null;
  uplineName?: string;
}

export function AddCarrierDialog({
  recruitId,
  open,
  onClose,
  onAdd,
  uplineId,
  uplineName,
}: AddCarrierDialogProps) {
  const [selectedCarrierIds, setSelectedCarrierIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: availableCarriers,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["available-carriers", recruitId],
    queryFn: () =>
      carrierContractRequestService.getAvailableCarriers(recruitId),
    enabled: open,
  });

  const handleToggleCarrier = (carrierId: string) => {
    setSelectedCarrierIds((prev) =>
      prev.includes(carrierId)
        ? prev.filter((id) => id !== carrierId)
        : [...prev, carrierId],
    );
  };

  const handleAddSelectedCarriers = async () => {
    if (selectedCarrierIds.length === 0) return;

    setError(null);
    setIsAdding(true);

    try {
      for (const carrierId of selectedCarrierIds) {
        await onAdd(carrierId);
      }
      onClose();
      setSelectedCarrierIds([]);
    } catch (err) {
      console.error("Failed to add carriers:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add carriers. Please try again.",
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen && !isAdding) {
      setError(null);
      setSelectedCarrierIds([]);
      onClose();
    }
  };

  // Sort: upline-contracted first, then non-contracted (disabled) at bottom
  const sortedCarriers = useMemo(() => {
    const carriers = availableCarriers || [];
    return [...carriers].sort((a, b) => {
      if (a.upline_has_contract !== b.upline_has_contract) {
        return a.upline_has_contract ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [availableCarriers]);

  const hasUpline = uplineId != null;
  const uplineContractedCount = sortedCarriers.filter(
    (c) => c.upline_has_contract,
  ).length;
  const allBlocked =
    hasUpline && sortedCarriers.length > 0 && uplineContractedCount === 0;

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-5 py-3.5 border-b">
          <DialogTitle className="text-base font-semibold">
            Add Carrier Contracts
          </DialogTitle>
          <p className="text-xs text-v2-ink-muted mt-1">
            Select carriers to request contracts for this recruit
          </p>
        </DialogHeader>

        {/* Upline Context Banner */}
        {hasUpline && !isLoading && !queryError && (
          <div className="px-5 pt-3">
            {allBlocked ? (
              <Alert className="py-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-medium">{uplineName || "Upline"}</span>{" "}
                  has no active carrier contracts configured. All carriers are
                  blocked until the upline adds contracts in their profile.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-v2-ink-muted">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span>
                  Carriers available through{" "}
                  <span className="font-medium text-v2-ink-muted">
                    {uplineName || "upline"}
                  </span>
                  &apos;s contracts ({uplineContractedCount} active)
                </span>
              </div>
            )}
          </div>
        )}

        {/* No upline info */}
        {!hasUpline &&
          !isLoading &&
          !queryError &&
          sortedCarriers.length > 0 && (
            <div className="px-5 pt-3">
              <div className="flex items-center gap-1.5 text-[10px] text-v2-ink-muted">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span>No upline assigned — all carriers available</span>
              </div>
            </div>
          )}

        {/* Error Alert */}
        {error && (
          <div className="px-5 pt-4">
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Query Error Alert */}
        {queryError && (
          <div className="px-5 pt-4">
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Failed to load carriers. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Carrier Grid */}
        <div className="px-5 py-4">
          {isLoading && (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle mx-auto mb-2" />
              <p className="text-sm text-v2-ink-muted">Loading carriers...</p>
            </div>
          )}

          {!isLoading && !queryError && sortedCarriers.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {sortedCarriers.map((carrier) => {
                const isSelected = selectedCarrierIds.includes(carrier.id);
                const isBlocked = hasUpline && !carrier.upline_has_contract;

                return (
                  <label
                    key={carrier.id}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded border-2 transition-all
                      ${
                        isBlocked
                          ? "border-v2-ring/60 bg-v2-canvas /50 cursor-not-allowed opacity-60"
                          : isSelected
                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 cursor-pointer"
                            : "border-v2-ring hover:border-v2-ring  bg-v2-card cursor-pointer"
                      }
                      ${isAdding ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isAdding || isBlocked}
                      onCheckedChange={() =>
                        !isAdding &&
                        !isBlocked &&
                        handleToggleCarrier(carrier.id)
                      }
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-medium block truncate ${
                          isBlocked
                            ? "text-v2-ink-subtle -muted"
                            : isSelected
                              ? "text-emerald-900 dark:text-emerald-100"
                              : "text-v2-ink"
                        }`}
                      >
                        {carrier.name}
                      </span>
                      {isBlocked && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          Upline not contracted
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {!isLoading && !queryError && sortedCarriers.length === 0 && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-v2-ring mb-3">
                <AlertCircle className="h-5 w-5 text-v2-ink-subtle" />
              </div>
              <p className="text-sm font-medium text-v2-ink mb-1">
                All Carriers Requested
              </p>
              <p className="text-xs text-v2-ink-muted">
                This recruit has already requested contracts for all available
                carriers
              </p>
            </div>
          )}
        </div>

        {/* Footer with Add Button */}
        {!isLoading && !queryError && sortedCarriers.length > 0 && (
          <DialogFooter className="px-5 py-3.5 border-t bg-v2-canvas /50">
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-v2-ink-muted">
                  {selectedCarrierIds.length} carrier
                  {selectedCarrierIds.length !== 1 ? "s" : ""} selected
                </span>
                {selectedCarrierIds.length > 0 && (
                  <button
                    onClick={() => setSelectedCarrierIds([])}
                    disabled={isAdding}
                    className="text-xs text-v2-ink-muted hover:text-v2-ink -subtle dark:hover:text-v2-ink-subtle underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDialogClose(false)}
                  disabled={isAdding}
                  size="sm"
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSelectedCarriers}
                  disabled={selectedCarrierIds.length === 0 || isAdding}
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add{" "}
                      {selectedCarrierIds.length > 0
                        ? `(${selectedCarrierIds.length})`
                        : ""}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
