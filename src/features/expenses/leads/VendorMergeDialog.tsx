// src/features/expenses/leads/VendorMergeDialog.tsx

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Merge, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useMergeVendors } from "@/hooks/lead-purchases";
import type { VendorWithStats } from "@/types/lead-purchase.types";
import { toast } from "sonner";

interface VendorMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: VendorWithStats[];
  onMergeComplete: () => void;
}

export function VendorMergeDialog({
  open,
  onOpenChange,
  vendors,
  onMergeComplete,
}: VendorMergeDialogProps) {
  const [keepVendorId, setKeepVendorId] = useState<string>("");
  const mergeVendors = useMergeVendors();

  // Reset selection when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setKeepVendorId("");
    }
    onOpenChange(isOpen);
  };

  const keepVendor = vendors.find((v) => v.id === keepVendorId);
  const mergeVendorIds = vendors
    .filter((v) => v.id !== keepVendorId)
    .map((v) => v.id);

  // Calculate totals for preview
  const totalPurchases = vendors.reduce((sum, v) => sum + v.totalPurchases, 0);
  const totalSpent = vendors.reduce((sum, v) => sum + v.totalSpent, 0);
  const purchasesToReassign =
    totalPurchases - (keepVendor?.totalPurchases || 0);

  const handleMerge = async () => {
    if (!keepVendorId || mergeVendorIds.length === 0) {
      toast.error("Please select a vendor to keep");
      return;
    }

    try {
      const result = await mergeVendors.mutateAsync({
        keepVendorId,
        mergeVendorIds,
      });
      toast.success(
        `Merged ${result.mergedVendorCount} vendor(s), reassigned ${result.reassignedCount} purchase(s)`,
      );
      onMergeComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to merge vendors",
      );
    }
  };

  if (vendors.length < 2) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Merge className="h-4 w-4" />
            Merge Vendors
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Combine {vendors.length} vendors into one. All purchases will be
            reassigned to the selected vendor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vendors being merged */}
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Vendors to merge
            </Label>
            <div className="mt-1 space-y-1">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-v2-canvas text-xs"
                >
                  <span className="font-medium">{vendor.name}</span>
                  <span className="text-muted-foreground">
                    {vendor.totalPurchases} purchases •{" "}
                    {formatCurrency(vendor.totalSpent)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Keep vendor selection */}
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Keep vendor (others will be merged into this)
            </Label>
            <Select value={keepVendorId} onValueChange={setKeepVendorId}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Select vendor to keep" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {keepVendorId && (
            <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Merge Preview
                  </p>
                  <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">
                    <li>
                      • {mergeVendorIds.length} vendor(s) will be deactivated
                    </li>
                    <li>
                      • {purchasesToReassign} purchase(s) will be reassigned to{" "}
                      <span className="font-medium">{keepVendor?.name}</span>
                    </li>
                    <li>
                      • Combined total: {totalPurchases} purchases,{" "}
                      {formatCurrency(totalSpent)}
                    </li>
                  </ul>
                  <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={mergeVendors.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleMerge}
            disabled={!keepVendorId || mergeVendors.isPending}
            variant="destructive"
          >
            {mergeVendors.isPending && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            Merge Vendors
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
