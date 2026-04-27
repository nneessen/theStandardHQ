// src/features/settings/carriers/components/CarrierDeleteDialog.tsx
// Redesigned with zinc palette and compact design patterns

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Carrier } from "../hooks/useCarriers";

interface CarrierDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier: Carrier | null;
  productCount?: number;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function CarrierDeleteDialog({
  open,
  onOpenChange,
  carrier,
  productCount = 0,
  onConfirm,
  isDeleting = false,
}: CarrierDeleteDialogProps) {
  if (!carrier) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm p-3 bg-v2-card border-v2-ring">
        <AlertDialogHeader className="space-y-1">
          <AlertDialogTitle className="text-sm font-semibold text-v2-ink">
            Delete Carrier?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-[11px]">
            <p className="text-v2-ink-muted dark:text-v2-ink-subtle">
              Are you sure you want to delete{" "}
              <strong className="text-v2-ink">{carrier.name}</strong>?
            </p>
            {productCount > 0 && (
              <p className="text-red-600 dark:text-red-400 font-medium">
                Warning: This carrier has {productCount} associated product
                {productCount !== 1 ? "s" : ""}. Deleting this carrier may
                affect those products.
              </p>
            )}
            <p className="text-[10px] text-v2-ink-muted">
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-1 pt-3">
          <AlertDialogCancel
            disabled={isDeleting}
            className="h-7 px-2 text-[10px] border-v2-ring bg-v2-card"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="h-7 px-2 text-[10px] bg-red-600 text-white hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Delete Carrier"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
