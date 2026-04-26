// src/features/policies/components/PolicyDialog.tsx

import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { PolicyForm } from "../PolicyForm";
import type { NewPolicyForm, Policy } from "../../../types/policy.types";

interface PolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (formData: NewPolicyForm) => Promise<Policy | null>;
  policyId?: string;
  policy?: Policy | null;
  isLoadingPolicy?: boolean;
  /** External validation errors to display on form fields (e.g., duplicate policy number) */
  externalErrors?: Record<string, string>;
  /** Parent mutation pending state */
  isPending?: boolean;
}

/**
 * PolicyDialog - Wraps PolicyForm in a shadcn/ui Dialog component.
 *
 * Sizing is locked to the viewport on every device: the outer card sits
 * 12px / 24px in from the edge and the form body is the only scrollable
 * region (header + footer stay fixed). Prevents the dialog from ever
 * exceeding the viewport on landscape phones or short desktop windows.
 */
export function PolicyDialog({
  open,
  onOpenChange,
  onSave,
  policyId,
  policy,
  isLoadingPolicy = false,
  externalErrors = {},
  isPending = false,
}: PolicyDialogProps) {
  // Track form submission state locally (from PolicyForm callback)
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  // Combined loading state - true if either form is submitting or mutation is pending
  const isLoading = isFormSubmitting || isPending;

  // Block dialog close during submission
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      // If trying to close while loading, block it
      if (!newOpen && isLoading) {
        return; // Do nothing - don't close
      }
      onOpenChange(newOpen);
    },
    [isLoading, onOpenChange],
  );

  const handleClose = () => {
    if (isLoading) return; // Block close during submission
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="theme-v2 font-display p-0 gap-0 overflow-hidden rounded-v2-lg bg-v2-card text-v2-ink border border-v2-ring shadow-v2-lift ring-0 outline-none w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-3rem)] max-w-3xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col"
        hideCloseButton
        // Block ESC key and click-outside during submission
        onPointerDownOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">
          {policyId ? "Edit Policy" : "New Policy"}
        </DialogTitle>

        {/* Header — fixed, no scroll */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-v2-ring bg-v2-card-tinted flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-v2-accent" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
                {policyId ? "Edit" : "New"}
              </span>
              <span className="text-base font-semibold tracking-tight text-v2-ink">
                {policyId ? "Edit Policy" : "New Policy"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-v2-pill text-v2-ink hover:bg-v2-accent-soft disabled:opacity-40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content — only this region scrolls */}
        {isLoadingPolicy && policyId ? (
          <div className="flex-1 flex items-center justify-center p-8 text-v2-ink-muted text-sm">
            Loading policy data…
          </div>
        ) : (
          <PolicyForm
            // CRITICAL: key prop forces remount when policyId changes
            // This ensures fresh useState initialization for each policy
            key={policyId || "new"}
            policyId={policyId}
            policy={policy}
            onClose={handleClose}
            addPolicy={onSave}
            updatePolicy={async (
              _id: string,
              updates: Partial<NewPolicyForm>,
            ) => {
              // For updates, pass the formData through onSave which handles both create and update
              await onSave(updates as NewPolicyForm);
            }}
            externalErrors={externalErrors}
            isPending={isPending}
            onSubmittingChange={setIsFormSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
