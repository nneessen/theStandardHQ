// src/features/underwriting/components/CriteriaReview/CreateCriteriaDialog.tsx

import { useState, useEffect } from "react";
import {
  Plus,
  Loader2,
  Building,
  Package,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useCarriers } from "@/hooks/carriers";
import { useProducts } from "@/hooks/products";
import { useCreateCriteria } from "@/hooks/underwriting";
import type { ExtractedCriteria } from "../../types/underwriting.types";

interface CreateCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Sentinel value for "all products" selection (empty string is invalid for Radix Select)
const CARRIER_WIDE_VALUE = "__carrier_wide__";

// Medication categories for organized display
const MEDICATION_CATEGORIES = {
  cardiovascular: {
    label: "Cardiovascular & Diabetes",
    meds: [
      { key: "insulin", label: "Insulin", hasRatingImpact: true },
      { key: "bloodThinners", label: "Blood Thinners" },
      { key: "heartMeds", label: "Heart Medications" },
      { key: "oralDiabetesMeds", label: "Oral Diabetes Meds" },
      { key: "bpMedications", label: "BP Medications", isCount: true },
      {
        key: "cholesterolMedications",
        label: "Cholesterol Medications",
        isCount: true,
      },
    ],
  },
  mentalHealth: {
    label: "Mental Health & Sleep",
    meds: [
      { key: "antidepressants", label: "Antidepressants" },
      { key: "antianxiety", label: "Anti-Anxiety Meds" },
      { key: "antipsychotics", label: "Antipsychotics" },
      { key: "moodStabilizers", label: "Mood Stabilizers" },
      { key: "sleepAids", label: "Sleep Aids" },
      { key: "adhdMeds", label: "ADHD Medications" },
    ],
  },
  painNeuro: {
    label: "Pain & Neurological",
    meds: [
      { key: "opioids", label: "Opioids", hasTimeSinceUse: true },
      { key: "seizureMeds", label: "Seizure Medications" },
      { key: "migraineMeds", label: "Migraine Medications" },
    ],
  },
  respiratory: {
    label: "Respiratory",
    meds: [
      { key: "inhalers", label: "Inhalers" },
      { key: "copdMeds", label: "COPD Medications" },
    ],
  },
  hormonal: {
    label: "Thyroid & Hormonal",
    meds: [
      { key: "thyroidMeds", label: "Thyroid Medications" },
      { key: "hormonalTherapy", label: "Hormonal Therapy" },
      { key: "steroids", label: "Steroids" },
    ],
  },
  immune: {
    label: "Immune & Autoimmune",
    meds: [
      { key: "immunosuppressants", label: "Immunosuppressants" },
      { key: "biologics", label: "Biologics" },
      { key: "dmards", label: "DMARDs" },
    ],
  },
  specialty: {
    label: "Specialty & High-Risk",
    meds: [
      { key: "cancerTreatment", label: "Cancer Treatment" },
      { key: "antivirals", label: "Antivirals (HIV/Hepatitis)" },
      { key: "osteoporosisMeds", label: "Osteoporosis Meds" },
      { key: "kidneyMeds", label: "Kidney Medications" },
      { key: "liverMeds", label: "Liver Medications" },
    ],
  },
} as const;

type MedicationKey = string;

interface MedicationRestriction {
  allowed: boolean;
  ratingImpact?: string;
  timeSinceUse?: number;
  maxCount?: number;
}

const getDefaultRestrictions = (): Record<
  MedicationKey,
  MedicationRestriction
> => ({});

export function CreateCriteriaDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCriteriaDialogProps) {
  const { user } = useAuth();
  const createMutation = useCreateCriteria();

  // Form state
  const [carrierId, setCarrierId] = useState("");
  const [productId, setProductId] = useState(CARRIER_WIDE_VALUE);
  const [notes, setNotes] = useState("");
  const [restrictions, setRestrictions] = useState<
    Record<MedicationKey, MedicationRestriction>
  >(getDefaultRestrictions);

  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["cardiovascular"]),
  );

  // Fetch carriers and products
  const {
    data: carriers,
    isLoading: carriersLoading,
    error: carriersError,
  } = useCarriers();
  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useProducts(carrierId || undefined);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCarrierId("");
      setProductId(CARRIER_WIDE_VALUE);
      setNotes("");
      setRestrictions(getDefaultRestrictions());
      setExpandedCategories(new Set(["cardiovascular"]));
    }
  }, [open]);

  // Reset product when carrier changes
  useEffect(() => {
    setProductId(CARRIER_WIDE_VALUE);
  }, [carrierId]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const updateRestriction = (
    key: MedicationKey,
    updates: Partial<MedicationRestriction>,
  ) => {
    setRestrictions((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  };

  const toggleMedAllowed = (key: MedicationKey) => {
    setRestrictions((prev) => {
      const current = prev[key];
      if (current && !current.allowed) {
        // Removing restriction
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      // Adding restriction (not allowed)
      return { ...prev, [key]: { allowed: false } };
    });
  };

  const setCountRestriction = (key: MedicationKey, maxCount: number | "") => {
    setRestrictions((prev) => {
      if (maxCount === "" || maxCount <= 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { allowed: true, maxCount } };
    });
  };

  const handleSubmit = async () => {
    if (!carrierId || !user?.imo_id) return;

    // Build criteria object from restrictions
    const criteria: ExtractedCriteria = {};
    const medRestrictions: ExtractedCriteria["medicationRestrictions"] = {};

    Object.entries(restrictions).forEach(([key, restriction]) => {
      if (restriction.maxCount !== undefined) {
        // Count-based restriction
        (medRestrictions as Record<string, { maxCount: number }>)[key] = {
          maxCount: restriction.maxCount,
        };
      } else if (!restriction.allowed) {
        // Boolean restriction
        const entry: {
          allowed: boolean;
          ratingImpact?: string;
          timeSinceUse?: number;
        } = {
          allowed: false,
        };
        if (restriction.ratingImpact) {
          entry.ratingImpact = restriction.ratingImpact;
        }
        if (restriction.timeSinceUse) {
          entry.timeSinceUse = restriction.timeSinceUse;
        }
        (medRestrictions as Record<string, typeof entry>)[key] = entry;
      }
    });

    if (Object.keys(medRestrictions).length > 0) {
      criteria.medicationRestrictions = medRestrictions;
    }

    const actualProductId =
      productId === CARRIER_WIDE_VALUE ? undefined : productId;

    try {
      await createMutation.mutateAsync({
        imoId: user.imo_id,
        carrierId,
        productId: actualProductId,
        criteria,
        notes: notes || undefined,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  const hasAnyRestriction = Object.keys(restrictions).length > 0;
  const isValid = !!carrierId && hasAnyRestriction;
  const selectedCarrier = carriers?.find((c) => c.id === carrierId);

  const isRestricted = (key: MedicationKey) => {
    const r = restrictions[key];
    return r && (!r.allowed || r.maxCount !== undefined);
  };

  const getCountValue = (key: MedicationKey): number | "" => {
    const r = restrictions[key];
    return r?.maxCount ?? "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Manual Criteria
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Manually define underwriting criteria for a carrier or product.
            Toggle medications to NOT ALLOWED to create restrictions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Carrier Selection */}
          <div className="space-y-1.5">
            <Label className="text-[10px] flex items-center gap-1">
              <Building className="h-3 w-3" />
              Carrier <span className="text-destructive">*</span>
            </Label>
            <Select value={carrierId} onValueChange={setCarrierId}>
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue placeholder="Select a carrier..." />
              </SelectTrigger>
              <SelectContent>
                {carriersLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : carriersError ? (
                  <div className="py-4 px-2 text-[10px] text-destructive">
                    Failed to load carriers
                  </div>
                ) : (
                  carriers?.map((carrier) => (
                    <SelectItem
                      key={carrier.id}
                      value={carrier.id}
                      className="text-[11px]"
                    >
                      {carrier.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          <div className="space-y-1.5">
            <Label className="text-[10px] flex items-center gap-1">
              <Package className="h-3 w-3" />
              Product
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="text-[10px] max-w-[200px]"
                  >
                    Leave as carrier-wide to apply to all products.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={productId}
              onValueChange={setProductId}
              disabled={!carrierId}
            >
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue
                  placeholder={
                    carrierId
                      ? "All products (carrier-wide)"
                      : "Select carrier first..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value={CARRIER_WIDE_VALUE}
                  className="text-[11px] text-muted-foreground"
                >
                  All products (carrier-wide)
                </SelectItem>
                {productsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : productsError ? (
                  <div className="py-4 px-2 text-[10px] text-destructive">
                    Failed to load products
                  </div>
                ) : (
                  products?.map((product) => (
                    <SelectItem
                      key={product.id}
                      value={product.id}
                      className="text-[11px]"
                    >
                      {product.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Medication Restrictions */}
          <div className="space-y-2 pt-2 border-t border-border dark:border-border">
            <Label className="text-[10px] font-semibold text-foreground dark:text-muted-foreground">
              Medication Restrictions
            </Label>
            <p className="text-[9px] text-muted-foreground">
              Toggle switches OFF to mark medications as NOT ALLOWED for this
              carrier.
            </p>

            {Object.entries(MEDICATION_CATEGORIES).map(
              ([categoryKey, category]) => (
                <Collapsible
                  key={categoryKey}
                  open={expandedCategories.has(categoryKey)}
                  onOpenChange={() => toggleCategory(categoryKey)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between h-7 text-[10px] font-medium px-2 hover:bg-card-tinted dark:hover:bg-card-tinted"
                    >
                      <span>{category.label}</span>
                      <div className="flex items-center gap-2">
                        {category.meds.some((m) => isRestricted(m.key)) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive">
                            {
                              category.meds.filter((m) => isRestricted(m.key))
                                .length
                            }{" "}
                            restricted
                          </span>
                        )}
                        {expandedCategories.has(categoryKey) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pl-2 pt-1">
                    {category.meds.map((med) => (
                      <div
                        key={med.key}
                        className={`p-2 rounded-md ${
                          isRestricted(med.key)
                            ? "bg-destructive/10 border border-destructive/30"
                            : "bg-background dark:bg-card-tinted/50"
                        }`}
                      >
                        {"isCount" in med && med.isCount ? (
                          // Count-based restriction
                          <div className="space-y-1">
                            <Label className="text-[10px] font-medium">
                              {med.label} Max Count
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={getCountValue(med.key)}
                                onChange={(e) =>
                                  setCountRestriction(
                                    med.key,
                                    e.target.value
                                      ? parseInt(e.target.value)
                                      : "",
                                  )
                                }
                                placeholder="No limit"
                                className="h-7 text-[10px] w-20"
                                min={0}
                              />
                              <span className="text-[9px] text-muted-foreground">
                                max allowed
                              </span>
                            </div>
                          </div>
                        ) : (
                          // Boolean restriction
                          <>
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] font-medium">
                                {med.label} Allowed
                              </Label>
                              <Switch
                                checked={!isRestricted(med.key)}
                                onCheckedChange={() =>
                                  toggleMedAllowed(med.key)
                                }
                              />
                            </div>
                            {"hasRatingImpact" in med &&
                              med.hasRatingImpact &&
                              isRestricted(med.key) && (
                                <div className="mt-2 space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">
                                    Rating Impact
                                  </Label>
                                  <Input
                                    value={
                                      restrictions[med.key]?.ratingImpact || ""
                                    }
                                    onChange={(e) =>
                                      updateRestriction(med.key, {
                                        ratingImpact: e.target.value,
                                      })
                                    }
                                    placeholder="e.g., Table B or Decline"
                                    className="h-6 text-[10px]"
                                  />
                                </div>
                              )}
                            {"hasTimeSinceUse" in med &&
                              med.hasTimeSinceUse &&
                              isRestricted(med.key) && (
                                <div className="mt-2 space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">
                                    Months since last use required
                                  </Label>
                                  <Input
                                    type="number"
                                    value={
                                      restrictions[med.key]?.timeSinceUse || ""
                                    }
                                    onChange={(e) =>
                                      updateRestriction(med.key, {
                                        timeSinceUse: e.target.value
                                          ? parseInt(e.target.value)
                                          : undefined,
                                      })
                                    }
                                    placeholder="e.g., 24"
                                    className="h-6 text-[10px] w-20"
                                    min={0}
                                  />
                                </div>
                              )}
                          </>
                        )}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ),
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2 border-t border-border dark:border-border">
            <Label className="text-[10px]">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about these criteria..."
              className="min-h-[60px] text-[11px] resize-none"
            />
          </div>
        </div>

        {/* Validation message */}
        {carrierId && !hasAnyRestriction && (
          <div className="p-2.5 bg-warning/10 border border-warning/30 rounded-md">
            <p className="text-[10px] text-warning">
              Please configure at least one medication restriction to create
              criteria.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            onClick={handleSubmit}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                Create Criteria
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Summary */}
        {carrierId && (
          <div className="mt-2 p-2.5 bg-info/10 border border-info/30 rounded-md">
            <p className="text-[10px] text-info dark:text-info">
              <strong>Summary:</strong> Creating criteria for{" "}
              <strong>{selectedCarrier?.name}</strong>
              {productId !== CARRIER_WIDE_VALUE &&
                products?.find((p) => p.id === productId) && (
                  <> - {products.find((p) => p.id === productId)?.name}</>
                )}
              {productId === CARRIER_WIDE_VALUE && " (all products)"}
            </p>
            {hasAnyRestriction && (
              <p className="text-[9px] text-info mt-1">
                {Object.keys(restrictions).length} medication restriction(s)
                configured.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
