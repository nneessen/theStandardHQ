// src/features/expenses/leads/ManageLeadPurchaseDialog.tsx

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import {
  Loader2,
  DollarSign,
  User,
  Link2,
  X,
  Package,
  Target,
} from "lucide-react";
import { VendorCombobox } from "./VendorCombobox";
import { PolicySelector } from "./PolicySelector";
import { useLeadVendors } from "@/hooks/lead-purchases";
import { usePoliciesByLeadPurchase, policyKeys } from "@/features/policies";
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
  const [showVendorDialog, setShowVendorDialog] = useState(false);

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
    linkedPolicies.length > 0
      ? Math.round(
          linkedPolicies.reduce((acc, policy) => {
            const purchaseDate = new Date(purchase!.purchaseDate);
            const policyDate = new Date(policy.effectiveDate);
            return (
              acc +
              (policyDate.getTime() - purchaseDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );
          }, 0) / linkedPolicies.length,
        )
      : null;

  const handlePolicyLinked = () => {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "p-0 gap-0 overflow-hidden bg-background border-0 shadow-2xl ring-0 outline-none",
            isEditing ? "max-w-4xl w-[90vw]" : "max-w-lg",
          )}
          hideCloseButton
        >
          <DialogTitle className="sr-only">
            {purchase ? "Manage Lead Purchase" : "Add Lead Purchase"}
          </DialogTitle>

          <div
            className={cn("flex overflow-hidden", isEditing ? "h-[70vh]" : "")}
          >
            {/* Left Panel - Branding (only when editing) */}
            {isEditing && (
              <div className="hidden lg:flex lg:w-[220px] bg-foreground relative overflow-hidden flex-shrink-0">
                {/* Grid pattern overlay */}
                <div className="absolute inset-0 opacity-[0.04]">
                  <svg
                    className="w-full h-full"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <pattern
                        id="leadpurchase-grid"
                        width="32"
                        height="32"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 32 0 L 0 0 0 32"
                          fill="none"
                          stroke="white"
                          strokeWidth="0.5"
                        />
                      </pattern>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#leadpurchase-grid)"
                    />
                  </svg>
                </div>

                {/* Animated glow orbs */}
                <div className="absolute top-1/4 -left-16 w-64 h-64 bg-accent/40 rounded-full blur-3xl animate-pulse" />
                <div
                  className="absolute bottom-1/4 -right-16 w-56 h-56 bg-warning/5 rounded-full blur-3xl animate-pulse"
                  style={{ animationDelay: "1s" }}
                />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-6 w-full">
                  {/* Logo */}
                  <div className="flex items-center gap-3 group">
                    <div className="relative">
                      <div className="absolute inset-0 bg-warning/20 rounded-lg blur-lg group-hover:bg-warning/30 transition-all duration-500" />
                      <img
                        src="/logos/Light Letter Logo .png"
                        alt="The Standard"
                        className="relative h-10 w-10 drop-shadow-xl dark:hidden"
                      />
                      <img
                        src="/logos/LetterLogo.png"
                        alt="The Standard"
                        className="relative h-10 w-10 drop-shadow-xl hidden dark:block"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span
                        className="text-white text-lg font-bold tracking-wide"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        Lead ROI
                      </span>
                      <span className="text-warning text-[9px] uppercase tracking-[0.2em] font-medium">
                        Track & Optimize
                      </span>
                    </div>
                  </div>

                  {/* ROI Stats */}
                  <div className="flex-1 flex flex-col justify-center space-y-4 py-8">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          Policies Sold
                        </span>
                        <span className="text-lg font-bold text-white">
                          {policiesSold}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          Commission
                        </span>
                        <span className="text-lg font-bold text-success">
                          $
                          {commissionEarned.toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          Net Profit
                        </span>
                        <span
                          className={cn(
                            "text-lg font-bold",
                            netProfit >= 0
                              ? "text-success"
                              : "text-destructive",
                          )}
                        >
                          {netProfit >= 0 ? "+" : ""}$
                          {Math.abs(netProfit).toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-white/10 dark:border-black/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/60">ROI</span>
                          <span
                            className={cn(
                              "text-xl font-bold",
                              roi >= 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {roi >= 0 ? "+" : ""}
                            {roi.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-[10px] text-white/30">
                    {avgLeadAge !== null
                      ? `Avg. ${avgLeadAge} days from purchase to sale`
                      : "Link policies to track conversion time"}
                  </div>
                </div>
              </div>
            )}

            {/* Right Panel - Form */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-warning" />
                  <span className="text-sm font-semibold">
                    {purchase ? "Manage Lead Purchase" : "Add Lead Purchase"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Form Content */}
              <form
                onSubmit={handleSubmit}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Purchase Details Section */}
                  <div className="p-3 bg-background rounded-lg border border-border/60">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                        Purchase Details
                      </span>
                    </div>

                    <div className="space-y-3">
                      {/* Vendor */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
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
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Purchase Name
                          </Label>
                          <Input
                            value={formData.purchaseName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                purchaseName: e.target.value,
                              })
                            }
                            className="h-8 text-xs bg-background border-border"
                            placeholder="e.g., March 2024 Pack"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Lead Type{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.leadFreshness}
                            onValueChange={(value: LeadFreshness) =>
                              setFormData({ ...formData, leadFreshness: value })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fresh">
                                Fresh (High-Intent)
                              </SelectItem>
                              <SelectItem value="aged">Aged</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Lead Count, Total Cost, Cost/Lead */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            # of Leads{" "}
                            <span className="text-destructive">*</span>
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
                            className="h-8 text-xs bg-background border-border"
                            placeholder="50"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Total Cost{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
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
                              className="h-8 text-xs pl-6 bg-background border-border"
                              placeholder="500.00"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Cost/Lead
                          </Label>
                          <div className="h-8 flex items-center px-2 bg-muted border border-border rounded-md text-xs font-mono text-muted-foreground">
                            ${costPerLead.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Purchase Date & Notes */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Purchase Date{" "}
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
                            className="h-8 text-xs bg-background border-border"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Notes
                          </Label>
                          <Input
                            value={formData.notes}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                notes: e.target.value,
                              })
                            }
                            className="h-8 text-xs bg-background border-border"
                            placeholder="Optional notes..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Policy Linking Section (only when editing) */}
                  {isEditing && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Linked Policies */}
                      <div className="p-3 bg-background rounded-lg border border-border/60">
                        <div className="flex items-center gap-2 mb-3">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                            Linked Policies ({linkedPolicies.length})
                          </span>
                        </div>

                        <div className="border border-border rounded-md overflow-hidden bg-card">
                          {isLoadingPolicies ? (
                            <div className="p-3 space-y-2">
                              {[1, 2].map((i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                              ))}
                            </div>
                          ) : linkedPolicies.length > 0 ? (
                            <ScrollArea className="h-[180px]">
                              <div className="divide-y divide-border/60">
                                {linkedPolicies.map((policy) => {
                                  const purchaseDate = new Date(
                                    purchase.purchaseDate,
                                  );
                                  const policyDate = new Date(
                                    policy.effectiveDate,
                                  );
                                  const leadAgeDays = Math.round(
                                    (policyDate.getTime() -
                                      purchaseDate.getTime()) /
                                      (1000 * 60 * 60 * 24),
                                  );
                                  const policyCommission =
                                    policy.annualPremium *
                                    policy.commissionPercentage;

                                  return (
                                    <div
                                      key={policy.id}
                                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-background transition-colors"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-xs truncate">
                                          {policy.client?.name || "Unknown"}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          {policy.policyNumber &&
                                            `#${policy.policyNumber} · `}
                                          {leadAgeDays}d ·{" "}
                                          {policyDate.toLocaleDateString(
                                            "en-US",
                                            {
                                              month: "short",
                                              day: "numeric",
                                            },
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right font-mono text-xs font-semibold text-success">
                                        $
                                        {policyCommission.toLocaleString(
                                          "en-US",
                                          { maximumFractionDigits: 0 },
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="px-3 py-6 text-center">
                              <User className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1" />
                              <p className="text-[10px] text-muted-foreground">
                                No policies linked yet
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Link Policy */}
                      <div className="p-3 bg-background rounded-lg border border-border/60">
                        <div className="flex items-center gap-2 mb-3">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                            Link Policy
                          </span>
                        </div>
                        <PolicySelector
                          leadPurchaseId={purchase.id}
                          onPolicyLinked={handlePolicyLinked}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/50 bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    disabled={isLoading}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading}
                    className="h-8 text-xs bg-warning hover:bg-warning text-white"
                  >
                    {isLoading && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    {purchase ? "Update Purchase" : "Add Purchase"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
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
