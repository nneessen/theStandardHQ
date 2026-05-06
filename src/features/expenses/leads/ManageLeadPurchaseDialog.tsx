// src/features/expenses/leads/ManageLeadPurchaseDialog.tsx

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PillButton } from "@/components/v2";
import {
  DollarSign,
  User,
  Link2,
  TrendingUp,
  TrendingDown,
  Unlink,
} from "lucide-react";
import { VendorCombobox } from "./VendorCombobox";
import { PolicySelector } from "./PolicySelector";
import { useLeadVendors } from "@/hooks/lead-purchases";
import {
  usePoliciesByLeadPurchase,
  policyKeys,
  useUpdatePolicyLeadSource,
} from "@/features/policies";
import { useQueryClient } from "@tanstack/react-query";
import { leadPurchaseKeys } from "@/hooks/lead-purchases";
import { useAuth } from "@/contexts/AuthContext";
import type {
  LeadPurchase,
  CreateLeadPurchaseData,
  LeadFreshness,
} from "@/types/lead-purchase.types";
import { LeadVendorDialog } from "./LeadVendorDialog";
import { useCreateLeadVendor } from "@/hooks/lead-purchases";
import { toast } from "sonner";
import { getTodayString } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ManageLeadPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase?: LeadPurchase | null;
  onSave: (data: CreateLeadPurchaseData) => Promise<void>;
  isLoading?: boolean;
}

export function ManageLeadPurchaseDialog({
  open,
  onOpenChange,
  purchase,
  onSave,
  isLoading = false,
}: ManageLeadPurchaseDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: vendors = [] } = useLeadVendors();
  const createVendor = useCreateLeadVendor();
  const updateLeadSource = useUpdatePolicyLeadSource();
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const { data: linkedPolicies = [], isLoading: isLoadingPolicies } =
    usePoliciesByLeadPurchase(purchase?.id);

  const [formData, setFormData] = useState({
    vendorId: "",
    purchaseName: "",
    leadFreshness: "fresh" as LeadFreshness,
    leadCount: "",
    totalCost: "",
    purchaseDate: getTodayString(),
    notes: "",
  });

  useEffect(() => {
    if (purchase) {
      setFormData({
        vendorId: purchase.vendorId,
        purchaseName: purchase.purchaseName || "",
        leadFreshness: purchase.leadFreshness,
        leadCount: String(purchase.leadCount),
        totalCost: String(purchase.totalCost),
        purchaseDate: purchase.purchaseDate,
        notes: purchase.notes || "",
      });
    } else {
      setFormData({
        vendorId: "",
        purchaseName: "",
        leadFreshness: "fresh",
        leadCount: "",
        totalCost: "",
        purchaseDate: getTodayString(),
        notes: "",
      });
    }
  }, [purchase, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      vendorId: formData.vendorId,
      purchaseName: formData.purchaseName.trim() || null,
      leadFreshness: formData.leadFreshness,
      leadCount: parseInt(formData.leadCount, 10),
      totalCost: parseFloat(formData.totalCost),
      purchaseDate: formData.purchaseDate,
      policiesSold: purchase?.policiesSold ?? 0,
      commissionEarned: purchase?.commissionEarned ?? 0,
      notes: formData.notes.trim() || null,
    });
  };

  const handleAddVendor = async (data: { name: string }) => {
    try {
      const newVendor = await createVendor.mutateAsync(data);
      setFormData({ ...formData, vendorId: newVendor.id });
      setShowVendorDialog(false);
      toast.success("Vendor added successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add vendor",
      );
    }
  };

  const leadCount = parseInt(formData.leadCount, 10) || 0;
  const totalCost = parseFloat(formData.totalCost) || 0;
  const costPerLead = leadCount > 0 ? totalCost / leadCount : 0;

  const policiesSold = purchase?.policiesSold ?? 0;
  const commissionEarned = purchase?.commissionEarned ?? 0;
  const netProfit = commissionEarned - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  const isEditing = !!purchase;

  const avgLeadAge =
    linkedPolicies.length > 0 && purchase
      ? Math.round(
          linkedPolicies.reduce((acc, policy) => {
            const purchaseDate = new Date(purchase.purchaseDate);
            const policyDate = new Date(policy.effectiveDate);
            return (
              acc +
              (policyDate.getTime() - purchaseDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );
          }, 0) / linkedPolicies.length,
        )
      : null;

  const invalidatePolicyAttribution = () => {
    queryClient.invalidateQueries({
      queryKey: policyKeys.byLeadPurchase(purchase!.id),
    });
    queryClient.invalidateQueries({
      queryKey: policyKeys.unlinkedRecent(user?.id ?? ""),
    });
    queryClient.invalidateQueries({
      queryKey: leadPurchaseKeys.all,
    });
  };

  const handlePolicyLinked = () => {
    invalidatePolicyAttribution();
  };

  const handleUnlinkPolicy = async (policyId: string, clientName: string) => {
    if (!purchase) return;
    setUnlinkingId(policyId);
    try {
      await updateLeadSource.mutateAsync({
        policyId,
        leadSourceType: null,
      });
      invalidatePolicyAttribution();
      toast.success(`Unlinked ${clientName}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unlink policy",
      );
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "theme-v2 font-display p-0 gap-0 overflow-hidden rounded-v2-lg bg-card text-foreground border border-border shadow-v2-lift w-[calc(100vw-1.5rem)] sm:w-auto max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col",
            isEditing ? "max-w-3xl" : "max-w-md",
          )}
          hideCloseButton
        >
          {/* Header */}
          <DialogHeader className="px-5 py-3 border-b border-border bg-card-tinted flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                  {isEditing ? "Manage" : "New"}
                </span>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground text-left">
                  {isEditing ? "Lead purchase" : "Add lead purchase"}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {/* ROI Metrics Ribbon — edit mode only */}
          {isEditing && (
            <div className="flex items-center gap-3 px-5 py-2 border-b border-border text-[11px] flex-shrink-0">
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">
                  {policiesSold}
                </span>
                <span className="text-muted-foreground">sold</span>
              </div>
              <div className="h-3 w-px bg-muted" />

              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">
                  {formatCurrency(commissionEarned)}
                </span>
                <span className="text-muted-foreground">earned</span>
              </div>
              <div className="h-3 w-px bg-muted" />

              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "font-medium font-mono",
                    netProfit >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {netProfit >= 0 ? "+" : ""}
                  {formatCurrency(Math.abs(netProfit))}
                </span>
                <span className="text-muted-foreground">net</span>
              </div>
              <div className="h-3 w-px bg-muted" />

              <div className="flex items-center gap-1">
                {roi >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={cn(
                    "font-medium font-mono",
                    roi >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {roi >= 0 ? "+" : ""}
                  {roi.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">ROI</span>
              </div>

              {avgLeadAge !== null && (
                <>
                  <div className="h-3 w-px bg-muted" />
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-foreground">
                      {avgLeadAge}d
                    </span>
                    <span className="text-muted-foreground">
                      avg. to convert
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Body — only this region scrolls */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Purchase Details */}
              <section className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                    Purchase Details
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="grid gap-3">
                  {/* Vendor */}
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      Vendor <span className="text-destructive">*</span>
                    </Label>
                    <VendorCombobox
                      vendors={vendors}
                      value={formData.vendorId}
                      onChange={(vendorId) =>
                        setFormData({ ...formData, vendorId })
                      }
                      onAddVendor={() => setShowVendorDialog(true)}
                    />
                  </div>

                  {/* Purchase Name & Lead Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Pack name
                      </Label>
                      <Input
                        value={formData.purchaseName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            purchaseName: e.target.value,
                          })
                        }
                        className="h-7 text-xs"
                        placeholder="e.g., March 2026 Pack"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Lead type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.leadFreshness}
                        onValueChange={(value: LeadFreshness) =>
                          setFormData({ ...formData, leadFreshness: value })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fresh" className="text-xs">
                            Fresh (high-intent)
                          </SelectItem>
                          <SelectItem value="aged" className="text-xs">
                            Aged
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Lead Count, Total Cost, Cost/Lead */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Leads <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.leadCount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            leadCount: e.target.value,
                          })
                        }
                        required
                        className="h-7 text-xs font-mono"
                        placeholder="50"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Total cost <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.totalCost}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              totalCost: e.target.value,
                            })
                          }
                          required
                          className="h-7 text-xs pl-7 font-mono"
                          placeholder="500.00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Cost/lead
                      </Label>
                      <div className="h-7 flex items-center px-2 bg-card-tinted border border-border rounded-md text-xs font-mono text-muted-foreground tabular-nums">
                        ${costPerLead.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Date & Notes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Purchase date{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            purchaseDate: e.target.value,
                          })
                        }
                        required
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Notes
                      </Label>
                      <Input
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        className="h-7 text-xs"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Policies — edit mode only */}
              {isEditing && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Linked Policies */}
                  <section className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                        Linked policies
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        ({linkedPolicies.length})
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="border border-border rounded-md overflow-hidden bg-card-tinted">
                      {isLoadingPolicies ? (
                        <div className="p-2.5 space-y-1.5">
                          {[1, 2].map((i) => (
                            <Skeleton key={i} className="h-9 w-full" />
                          ))}
                        </div>
                      ) : linkedPolicies.length > 0 ? (
                        <ScrollArea className="h-[180px]">
                          <div className="divide-y divide-border/60">
                            {linkedPolicies.map((policy) => {
                              const purchaseDate = new Date(
                                purchase.purchaseDate,
                              );
                              const policyDate = new Date(policy.effectiveDate);
                              const leadAgeDays = Math.round(
                                (policyDate.getTime() -
                                  purchaseDate.getTime()) /
                                  (1000 * 60 * 60 * 24),
                              );
                              const policyCommission =
                                policy.annualPremium *
                                policy.commissionPercentage;

                              const clientName =
                                policy.client?.name || "Unknown";
                              const isUnlinkingThis = unlinkingId === policy.id;
                              return (
                                <div
                                  key={policy.id}
                                  className="group flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-card transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-xs truncate text-foreground">
                                      {clientName}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground tabular-nums">
                                      {policy.policyNumber &&
                                        `#${policy.policyNumber} · `}
                                      {leadAgeDays}d ·{" "}
                                      {policyDate.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </div>
                                  </div>
                                  <div className="text-right font-mono text-xs font-semibold text-success tabular-nums shrink-0">
                                    {formatCurrency(policyCommission)}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUnlinkPolicy(policy.id, clientName)
                                    }
                                    disabled={isUnlinkingThis}
                                    title={`Unlink ${clientName}`}
                                    aria-label={`Unlink ${clientName}`}
                                    className={cn(
                                      "shrink-0 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 transition-colors",
                                      "hover:text-destructive hover:bg-destructive/10 focus-visible:opacity-100 focus-visible:text-destructive",
                                      "opacity-0 group-hover:opacity-100",
                                      isUnlinkingThis &&
                                        "opacity-100 cursor-wait",
                                    )}
                                  >
                                    <Unlink className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="px-3 py-8 text-center">
                          <User className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
                          <p className="text-[11px] text-muted-foreground">
                            No policies linked yet
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Link Policy */}
                  <section className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                        Link a policy
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <PolicySelector
                      leadPurchaseId={purchase.id}
                      onPolicyLinked={handlePolicyLinked}
                    />
                  </section>
                </div>
              )}
            </div>

            {/* Footer — fixed, no scroll */}
            <DialogFooter className="px-5 py-3 border-t border-border bg-card-tinted flex-shrink-0 gap-2 sm:justify-end">
              <PillButton
                type="button"
                tone="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </PillButton>
              <PillButton
                type="submit"
                tone="black"
                size="sm"
                disabled={isLoading}
              >
                {isLoading
                  ? "Saving…"
                  : isEditing
                    ? "Update purchase"
                    : "Add purchase"}
              </PillButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LeadVendorDialog
        open={showVendorDialog}
        onOpenChange={setShowVendorDialog}
        onSave={handleAddVendor}
        isLoading={createVendor.isPending}
      />
    </>
  );
}
