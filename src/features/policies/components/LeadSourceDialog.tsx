// src/features/policies/components/LeadSourceDialog.tsx
// Dialog shown after policy submission to track lead source for ROI

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/v2";
import { Package, Gift, HelpCircle, Plus, Loader2, Check } from "lucide-react";
import { LeadPurchaseSelector } from "./LeadPurchaseSelector";
import { ManageLeadPurchaseDialog } from "@/features/expenses";
import { useUpdatePolicyLeadSource } from "../hooks";
import {
  useCreateLeadPurchase,
  useLeadPurchases,
} from "@/hooks/lead-purchases";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  LeadPurchase,
  CreateLeadPurchaseData,
} from "@/types/lead-purchase.types";
import type { LeadSourceType } from "@/types/policy.types";

interface LeadSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
  policyNumber: string | null;
  onComplete: () => void;
}

type SourceOption = "lead_purchase" | "free_lead" | "other" | "skip";

export function LeadSourceDialog({
  open,
  onOpenChange: _onOpenChange,
  policyId,
  policyNumber,
  onComplete,
}: LeadSourceDialogProps) {
  const [sourceOption, setSourceOption] = useState<SourceOption | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<LeadPurchase | null>(
    null,
  );
  const [showAddPurchaseDialog, setShowAddPurchaseDialog] = useState(false);

  const updateLeadSource = useUpdatePolicyLeadSource();
  const createLeadPurchase = useCreateLeadPurchase();
  // Prefetch purchases for child components
  useLeadPurchases();

  const isSubmitting = updateLeadSource.isPending;

  const handleSave = async () => {
    if (!sourceOption || sourceOption === "skip") {
      onComplete();
      return;
    }

    try {
      let leadSourceType: LeadSourceType | null = null;
      let leadPurchaseId: string | null = null;

      if (sourceOption === "lead_purchase") {
        if (!selectedPurchase) {
          toast.error("Please select a lead purchase");
          return;
        }
        leadSourceType = "lead_purchase";
        leadPurchaseId = selectedPurchase.id;
      } else if (sourceOption === "free_lead") {
        leadSourceType = "free_lead";
      } else if (sourceOption === "other") {
        leadSourceType = "other";
      }

      await updateLeadSource.mutateAsync({
        policyId,
        leadSourceType,
        leadPurchaseId,
      });

      if (leadSourceType === "lead_purchase") {
        toast.success("Policy linked to lead purchase for ROI tracking");
      } else {
        toast.success("Lead source recorded");
      }

      onComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update lead source",
      );
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleAddPurchase = async (data: CreateLeadPurchaseData) => {
    try {
      const newPurchase = await createLeadPurchase.mutateAsync(data);
      setSelectedPurchase(newPurchase);
      setSourceOption("lead_purchase");
      setShowAddPurchaseDialog(false);
      toast.success("Lead purchase added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add lead purchase",
      );
    }
  };

  const handleDismiss = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      onComplete();
    }
  };

  const handleOptionSelect = (option: SourceOption) => {
    setSourceOption(option);
    if (option !== "lead_purchase") {
      setSelectedPurchase(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDismiss}>
        <DialogContent className="theme-v2 font-display max-w-sm w-[calc(100vw-1.5rem)] sm:w-auto max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] p-0 gap-0 overflow-hidden bg-card text-foreground border border-border rounded-v2-lg shadow-v2-lift flex flex-col">
          <DialogHeader className="px-5 py-3 border-b border-border bg-card-tinted flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                  Lead source
                </span>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground text-left">
                  Track lead source
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-[11px] text-muted-foreground text-left">
              {policyNumber
                ? `Link policy ${policyNumber} to its lead source`
                : "Link this policy to its lead source"}
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 py-3 space-y-1.5 overflow-y-auto flex-1 min-h-0">
            {/* Option: From Lead Purchase */}
            <OptionButton
              selected={sourceOption === "lead_purchase"}
              onClick={() => handleOptionSelect("lead_purchase")}
              icon={Package}
              label="Lead Purchase"
              description="From a purchased lead pack"
            />

            {/* Expanded section for lead purchase selection */}
            {sourceOption === "lead_purchase" && (
              <div className="ml-6 pl-3 border-l-2 border-accent">
                <LeadPurchaseSelector
                  selectedId={selectedPurchase?.id}
                  onSelect={setSelectedPurchase}
                  className="mt-1"
                />
                <PillButton
                  type="button"
                  tone="ghost"
                  size="sm"
                  className="mt-2 h-7 px-3 text-[11px] w-full justify-start"
                  onClick={() => setShowAddPurchaseDialog(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add new lead pack
                </PillButton>
              </div>
            )}

            {/* Option: Free / Hand-me-down */}
            <OptionButton
              selected={sourceOption === "free_lead"}
              onClick={() => handleOptionSelect("free_lead")}
              icon={Gift}
              label="Free Lead"
              description="Hand-me-down from upline/agent"
            />

            {/* Option: Other */}
            <OptionButton
              selected={sourceOption === "other"}
              onClick={() => handleOptionSelect("other")}
              icon={HelpCircle}
              label="Other Source"
              description="Referral, organic, etc."
            />
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border bg-card-tinted flex-row justify-between sm:justify-between flex-shrink-0">
            <PillButton
              type="button"
              tone="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              Skip
            </PillButton>
            <PillButton
              type="button"
              tone="black"
              size="sm"
              onClick={handleSave}
              disabled={
                isSubmitting ||
                !sourceOption ||
                (sourceOption === "lead_purchase" && !selectedPurchase)
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead Purchase Dialog */}
      <ManageLeadPurchaseDialog
        open={showAddPurchaseDialog}
        onOpenChange={setShowAddPurchaseDialog}
        onSave={handleAddPurchase}
        isLoading={createLeadPurchase.isPending}
      />
    </>
  );
}

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

function OptionButton({
  selected,
  onClick,
  icon: Icon,
  label,
  description,
}: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-v2-md text-left border transition-colors duration-150",
        selected
          ? "bg-accent/40 border-accent text-foreground"
          : "bg-card border-border text-foreground hover:bg-background",
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
          selected
            ? "bg-foreground border-foreground text-white"
            : "bg-transparent border-border",
        )}
      >
        {selected && <Check className="h-2.5 w-2.5" />}
      </div>

      {/* Icon in tinted pill */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-v2-pill flex items-center justify-center",
          selected
            ? "bg-accent text-foreground"
            : "bg-background text-muted-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {description}
        </div>
      </div>
    </button>
  );
}
