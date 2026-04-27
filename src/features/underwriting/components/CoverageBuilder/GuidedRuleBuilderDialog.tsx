// src/features/underwriting/components/CoverageBuilder/GuidedRuleBuilderDialog.tsx
// Multi-step guided dialog for creating condition acceptance rules with flexible multi-criteria tiers

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Minus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateRuleSet,
  useUpdateRuleSet,
  ruleEngineKeys,
  deleteRuleSet,
} from "../../hooks/rules/useRuleSets";
import { useCreateRule } from "../../hooks/rules/useRules";
import { coverageStatsKeys } from "../../hooks/coverage/useCoverageStats";
import type {
  PredicateGroup,
  HealthClass,
  TableRating,
} from "../../hooks/rules/useRuleSets";
import type {
  FollowUpSchema,
  FollowUpQuestion,
} from "../../types/underwriting.types";

// ============================================================================
// Types
// ============================================================================

type Decision =
  | "always_decline"
  | "tiered_acceptance"
  | "case_by_case"
  | "always_accept";

type CatchAllOutcome = "decline" | "refer";

type DslType = "numeric" | "date" | "boolean" | "string" | "array";

interface CriteriaFieldDef {
  fieldId: string;
  label: string;
  dslType: DslType;
  operators: { value: string; label: string }[];
  options?: string[];
}

interface CriterionEntry {
  fieldId: string;
  dslType: DslType;
  operator: string;
  value: number | string | boolean | string[];
}

type CriteriaLogic = "all" | "any";

interface TierRow {
  criteria: CriterionEntry[];
  criteriaLogic: CriteriaLogic;
  healthClass: HealthClass;
  tableRating: TableRating;
}

interface GuidedRuleBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrierId: string;
  carrierName: string;
  productId: string;
  productName: string;
  conditionCode: string;
  conditionName: string;
  followUpSchema: FollowUpSchema | null;
}

// ============================================================================
// Constants
// ============================================================================

const HEALTH_CLASS_OPTIONS: { value: HealthClass; label: string }[] = [
  { value: "preferred_plus", label: "Preferred Plus" },
  { value: "preferred", label: "Preferred" },
  { value: "standard_plus", label: "Standard Plus" },
  { value: "standard", label: "Standard" },
  { value: "substandard", label: "Substandard" },
  { value: "graded", label: "Graded Benefit" },
  { value: "modified", label: "Modified Benefit" },
  { value: "guaranteed_issue", label: "Guaranteed Issue" },
];

const TABLE_RATING_OPTIONS: { value: TableRating; label: string }[] = [
  { value: "none", label: "None" },
  { value: "A", label: "A (+25%)" },
  { value: "B", label: "B (+50%)" },
  { value: "C", label: "C (+75%)" },
  { value: "D", label: "D (+100%)" },
  { value: "E", label: "E (+125%)" },
  { value: "F", label: "F (+150%)" },
  { value: "G", label: "G (+175%)" },
  { value: "H", label: "H (+200%)" },
];

const DATE_OPERATORS = [
  { value: "years_since_gte", label: "at least X years ago" },
  { value: "years_since_lte", label: "at most X years ago" },
  { value: "months_since_gte", label: "at least X months ago" },
  { value: "months_since_lte", label: "at most X months ago" },
];

const NUMERIC_OPERATORS = [
  { value: "gte", label: "at least" },
  { value: "lte", label: "at most" },
  { value: "eq", label: "equals" },
];

const STRING_OPERATORS = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
];

const ARRAY_OPERATORS = [
  { value: "includes_any", label: "includes any of" },
  { value: "includes_all", label: "includes all of" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const BOOLEAN_OPERATORS = [{ value: "eq", label: "is" }];

const FALLBACK_DIAGNOSIS_DATE_FIELD: CriteriaFieldDef = {
  fieldId: "diagnosis_date",
  label: "Time since diagnosis",
  dslType: "date",
  operators: DATE_OPERATORS,
};

// ============================================================================
// Helpers
// ============================================================================

function questionToDslType(q: FollowUpQuestion): DslType {
  switch (q.type) {
    case "date":
      return "date";
    case "number":
      return "numeric";
    case "multiselect":
      return "array";
    case "select": {
      // Detect boolean-like selects
      const opts = (q.options ?? []).map((o) => o.toLowerCase());
      if (
        opts.length === 2 &&
        ((opts.includes("yes") && opts.includes("no")) ||
          (opts.includes("true") && opts.includes("false")))
      ) {
        return "boolean";
      }
      return "string";
    }
    case "text":
      return "string";
    default:
      return "string";
  }
}

function operatorsForDslType(dslType: DslType) {
  switch (dslType) {
    case "date":
      return DATE_OPERATORS;
    case "numeric":
      return NUMERIC_OPERATORS;
    case "string":
      return STRING_OPERATORS;
    case "array":
      return ARRAY_OPERATORS;
    case "boolean":
      return BOOLEAN_OPERATORS;
  }
}

function defaultValueForDslType(
  dslType: DslType,
  options?: string[],
): number | string | boolean | string[] {
  switch (dslType) {
    case "date":
      return 5;
    case "numeric":
      return 0;
    case "string":
      return options?.[0] ?? "";
    case "boolean":
      return true;
    case "array":
      return [];
  }
}

function buildCriteriaFields(
  followUpSchema: FollowUpSchema | null,
): CriteriaFieldDef[] {
  if (!followUpSchema?.questions?.length) {
    return [FALLBACK_DIAGNOSIS_DATE_FIELD];
  }

  const fields: CriteriaFieldDef[] = followUpSchema.questions.map((q) => {
    const dslType = questionToDslType(q);
    return {
      fieldId: q.id,
      label: q.label,
      dslType,
      operators: operatorsForDslType(dslType),
      options: q.options,
    };
  });

  // Ensure there's always a date option if none exist
  if (!fields.some((f) => f.dslType === "date")) {
    fields.unshift(FALLBACK_DIAGNOSIS_DATE_FIELD);
  }

  return fields;
}

function defaultCriterion(field: CriteriaFieldDef): CriterionEntry {
  return {
    fieldId: field.fieldId,
    dslType: field.dslType,
    operator: field.operators[0].value,
    value: defaultValueForDslType(field.dslType, field.options),
  };
}

function describeCriteria(criteria: CriterionEntry[]): string {
  return criteria
    .map((c) => {
      if (c.dslType === "date") return `${c.value}+ yrs`;
      if (c.dslType === "boolean") return `${c.fieldId}=${c.value}`;
      return `${c.fieldId} ${c.operator} ${c.value}`;
    })
    .join(", ");
}

// ============================================================================
// Component
// ============================================================================

export function GuidedRuleBuilderDialog({
  open,
  onOpenChange,
  carrierId,
  carrierName,
  productId,
  productName,
  conditionCode,
  conditionName,
  followUpSchema,
}: GuidedRuleBuilderDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const createRuleSetMutation = useCreateRuleSet();
  const createRuleMutation = useCreateRule();
  const updateRuleSetMutation = useUpdateRuleSet();

  const criteriaFields = useMemo(
    () => buildCriteriaFields(followUpSchema),
    [followUpSchema],
  );

  // Step state
  const [step, setStep] = useState<1 | 2>(1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 — Always Accept state
  const [healthClass, setHealthClass] = useState<HealthClass>("standard");
  const [tableRating, setTableRating] = useState<TableRating>("none");
  const [notes, setNotes] = useState("");

  // Step 2 — Tiered Acceptance state
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [catchAllOutcome, setCatchAllOutcome] =
    useState<CatchAllOutcome>("decline");

  const resetState = () => {
    setStep(1);
    setDecision(null);
    setIsSaving(false);
    setError(null);
    setHealthClass("standard");
    setTableRating("none");
    setNotes("");
    setTiers([]);
    setCatchAllOutcome("decline");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleDecisionSelect = (d: Decision) => {
    setDecision(d);
    if (d === "tiered_acceptance" || d === "always_accept") {
      setStep(2);
    }
  };

  // ---- Tier management ----
  const addTier = () => {
    setTiers([
      ...tiers,
      {
        criteria: [defaultCriterion(criteriaFields[0])],
        criteriaLogic: "all",
        healthClass: tiers.length === 0 ? "standard" : "substandard",
        tableRating: "none",
      },
    ]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (
    index: number,
    updates: Partial<
      Pick<TierRow, "healthClass" | "tableRating" | "criteriaLogic">
    >,
  ) => {
    setTiers(
      tiers.map((tier, i) => (i === index ? { ...tier, ...updates } : tier)),
    );
  };

  // ---- Criterion management ----
  const addCriterion = (tierIndex: number) => {
    setTiers(
      tiers.map((tier, i) => {
        if (i !== tierIndex) return tier;
        return {
          ...tier,
          criteria: [...tier.criteria, defaultCriterion(criteriaFields[0])],
        };
      }),
    );
  };

  const removeCriterion = (tierIndex: number, criterionIndex: number) => {
    setTiers(
      tiers.map((tier, i) => {
        if (i !== tierIndex || tier.criteria.length <= 1) return tier;
        return {
          ...tier,
          criteria: tier.criteria.filter((_, ci) => ci !== criterionIndex),
        };
      }),
    );
  };

  const updateCriterion = (
    tierIndex: number,
    criterionIndex: number,
    updates: Partial<CriterionEntry>,
  ) => {
    setTiers(
      tiers.map((tier, i) => {
        if (i !== tierIndex) return tier;
        return {
          ...tier,
          criteria: tier.criteria.map((c, ci) =>
            ci === criterionIndex ? { ...c, ...updates } : c,
          ),
        };
      }),
    );
  };

  const handleFieldChange = (
    tierIndex: number,
    criterionIndex: number,
    fieldId: string,
  ) => {
    const field = criteriaFields.find((f) => f.fieldId === fieldId);
    if (!field) return;
    updateCriterion(tierIndex, criterionIndex, {
      fieldId: field.fieldId,
      dslType: field.dslType,
      operator: field.operators[0].value,
      value: defaultValueForDslType(field.dslType, field.options),
    });
  };

  // ---- Validation ----
  const validateTiers = (): string | null => {
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].criteria.length === 0) {
        return `Tier ${i + 1} must have at least one criterion.`;
      }
    }
    return null;
  };

  // ---- Build rules ----

  const buildSingleRule = (): {
    predicate: PredicateGroup;
    eligibility: "eligible" | "ineligible" | "refer";
    hc: HealthClass;
    tr: TableRating;
    reason: string;
  } => {
    switch (decision) {
      case "always_decline":
        return {
          predicate: {},
          eligibility: "ineligible",
          hc: "decline",
          tr: "none",
          reason: `${conditionName} - Always decline`,
        };
      case "case_by_case":
        return {
          predicate: {},
          eligibility: "refer",
          hc: "unknown",
          tr: "none",
          reason: `${conditionName} - Case by case review required`,
        };
      case "always_accept": {
        const reason = notes.trim()
          ? `${conditionName} - ${notes.trim()}`
          : `${conditionName} - Always accept`;
        return {
          predicate: {},
          eligibility: "eligible",
          hc: healthClass,
          tr: tableRating,
          reason,
        };
      }
      default:
        throw new Error("No decision selected");
    }
  };

  const handleSave = async () => {
    if (!decision) return;

    if (decision === "tiered_acceptance") {
      const validationError = validateTiers();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    let ruleSetId: string | null = null;

    try {
      // 1. Create rule set with productId
      const ruleSet = await createRuleSetMutation.mutateAsync({
        carrierId,
        productId,
        scope: "condition",
        conditionCode,
        name: `${conditionName} - ${productName}`,
        description: notes.trim() || undefined,
        source: "manual",
      });
      ruleSetId = ruleSet.id;

      if (decision === "tiered_acceptance") {
        // Create a rule for each tier (if any)
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i];

          const predicates = tier.criteria.map((c) => ({
            type: c.dslType as string,
            field: `${conditionCode}.${c.fieldId}`,
            operator: c.operator,
            value: c.value,
          }));

          const predicate: PredicateGroup = {
            [tier.criteriaLogic]: predicates,
          };

          const criteriaDesc = describeCriteria(tier.criteria);

          await createRuleMutation.mutateAsync({
            ruleSetId: ruleSet.id,
            priority: i + 1,
            name: `${conditionName} - Tier ${i + 1}`,
            predicate,
            outcomeEligibility: "eligible",
            outcomeHealthClass: tier.healthClass,
            outcomeTableRating: tier.tableRating,
            outcomeReason: `${conditionName} - ${criteriaDesc}`,
            outcomeConcerns: [],
          });
        }

        // Create catch-all rule (always created — sole rule when 0 tiers)
        const catchAllName =
          tiers.length === 0
            ? `${conditionName} rule`
            : `${conditionName} - Default`;
        await createRuleMutation.mutateAsync({
          ruleSetId: ruleSet.id,
          priority: tiers.length + 1,
          name: catchAllName,
          predicate: {},
          outcomeEligibility:
            catchAllOutcome === "decline" ? "ineligible" : "refer",
          outcomeHealthClass:
            catchAllOutcome === "decline" ? "decline" : "unknown",
          outcomeTableRating: "none",
          outcomeReason:
            catchAllOutcome === "decline"
              ? `${conditionName} - Does not meet acceptance criteria`
              : `${conditionName} - Refer for review`,
          outcomeConcerns: [],
        });
      } else {
        // Single-rule decisions
        const { predicate, eligibility, hc, tr, reason } = buildSingleRule();

        await createRuleMutation.mutateAsync({
          ruleSetId: ruleSet.id,
          priority: 1,
          name: `${conditionName} rule`,
          predicate,
          outcomeEligibility: eligibility,
          outcomeHealthClass: hc,
          outcomeTableRating: tr,
          outcomeReason: reason,
          outcomeConcerns: [],
        });
      }

      // Approve rule set
      await updateRuleSetMutation.mutateAsync({
        id: ruleSet.id,
        updates: {
          review_status: "approved",
        },
      });

      // Invalidate caches
      queryClient.invalidateQueries({
        queryKey: coverageStatsKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imoId, carrierId),
      });

      handleOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);

      // Clean up orphan rule set on failure
      if (ruleSetId) {
        try {
          if (imoId) {
            await deleteRuleSet(ruleSetId, imoId);
          }
        } catch {
          // Silently fail cleanup
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const needsStep2 =
    decision === "tiered_acceptance" || decision === "always_accept";

  // ---- Value input renderer ----
  const renderValueInput = (
    tierIndex: number,
    criterionIndex: number,
    criterion: CriterionEntry,
  ) => {
    const field = criteriaFields.find((f) => f.fieldId === criterion.fieldId);

    // For array operators that don't need a value
    if (
      criterion.operator === "is_empty" ||
      criterion.operator === "is_not_empty"
    ) {
      return null;
    }

    switch (criterion.dslType) {
      case "date":
      case "numeric":
        return (
          <Input
            type="number"
            min={field?.fieldId === "diagnosis_date" ? 1 : undefined}
            value={criterion.value as number}
            onChange={(e) =>
              updateCriterion(tierIndex, criterionIndex, {
                value: parseFloat(e.target.value) || 0,
              })
            }
            className="h-6 w-16 text-[10px] px-1.5"
          />
        );
      case "boolean":
        return (
          <Select
            value={String(criterion.value)}
            onValueChange={(v) =>
              updateCriterion(tierIndex, criterionIndex, {
                value: v === "true",
              })
            }
          >
            <SelectTrigger className="h-6 text-[10px] w-16 px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true" className="text-[11px]">
                Yes
              </SelectItem>
              <SelectItem value="false" className="text-[11px]">
                No
              </SelectItem>
            </SelectContent>
          </Select>
        );
      case "string":
        if (field?.options?.length) {
          return (
            <Select
              value={criterion.value as string}
              onValueChange={(v) =>
                updateCriterion(tierIndex, criterionIndex, { value: v })
              }
            >
              <SelectTrigger className="h-6 text-[10px] w-28 px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-[11px]">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            type="text"
            value={criterion.value as string}
            onChange={(e) =>
              updateCriterion(tierIndex, criterionIndex, {
                value: e.target.value,
              })
            }
            className="h-6 w-24 text-[10px] px-1.5"
            placeholder="Value..."
          />
        );
      case "array":
        if (field?.options?.length) {
          const selected = (criterion.value as string[]) ?? [];
          return (
            <div className="flex flex-wrap gap-1">
              {field.options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? selected.filter((s) => s !== opt)
                        : [...selected, opt];
                      updateCriterion(tierIndex, criterionIndex, {
                        value: next,
                      });
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <Input
            type="text"
            value={(criterion.value as string[]).join(", ")}
            onChange={(e) =>
              updateCriterion(tierIndex, criterionIndex, {
                value: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="h-6 w-28 text-[10px] px-1.5"
            placeholder="val1, val2..."
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm font-semibold">
            {conditionName}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            <span className="text-muted-foreground">{carrierName}</span> /{" "}
            {productName} — Set acceptance rule
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Decision */}
        {step === 1 && (
          <div className="space-y-2 py-2">
            <Label className="text-[11px] text-muted-foreground">
              How does this product handle this condition?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => handleDecisionSelect("always_decline")}
              >
                Always Decline
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning)]/10"
                onClick={() => handleDecisionSelect("tiered_acceptance")}
              >
                Tiered Acceptance
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => handleDecisionSelect("case_by_case")}
              >
                Case by Case
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)]/10"
                onClick={() => handleDecisionSelect("always_accept")}
              >
                Always Accept
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Always Accept — simple health class + table rating */}
        {step === 2 && decision === "always_accept" && (
          <div className="space-y-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-muted-foreground -ml-2"
              onClick={() => {
                setStep(1);
                setDecision(null);
              }}
            >
              &larr; Back to decision
            </Button>

            {/* Health Class */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Outcome / Health Class
              </Label>
              <Select
                value={healthClass}
                onValueChange={(v) => setHealthClass(v as HealthClass)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_CLASS_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-[11px]"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table Rating */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Table Rating
              </Label>
              <Select
                value={tableRating}
                onValueChange={(v) => setTableRating(v as TableRating)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_RATING_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-[11px]"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Notes (optional)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-12 text-[11px] resize-none"
                placeholder="Additional context..."
              />
            </div>
          </div>
        )}

        {/* Step 2: Tiered Acceptance — multi-criteria tiers */}
        {step === 2 && decision === "tiered_acceptance" && (
          <div className="space-y-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-muted-foreground -ml-2"
              onClick={() => {
                setStep(1);
                setDecision(null);
              }}
            >
              &larr; Back to decision
            </Button>

            <Label className="text-[11px] text-muted-foreground">
              {tiers.length > 0
                ? "IF → ELSE IF → ELSE (evaluated top to bottom)"
                : "Optionally add tiers for conditional acceptance"}
            </Label>

            {/* Tier cards */}
            <div className="space-y-2">
              {tiers.length === 0 && (
                <div className="py-4 text-center border border-dashed border-v2-ring-strong dark:border-v2-ring-strong rounded">
                  <p className="text-[11px] text-v2-ink-subtle">
                    No tiers — will use default outcome below
                  </p>
                  <p className="text-[9px] text-v2-ink-subtle mt-1">
                    Add tiers for conditional acceptance (IF → ELSE IF → ELSE)
                  </p>
                </div>
              )}
              {tiers.map((tier, tierIndex) => (
                <div
                  key={tierIndex}
                  className="rounded border bg-muted/30 overflow-hidden"
                >
                  {/* Tier header row */}
                  <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/20">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Tier {tierIndex + 1}
                    </span>

                    {/* Logic toggle */}
                    {tier.criteria.length > 1 && (
                      <Select
                        value={tier.criteriaLogic}
                        onValueChange={(v) =>
                          updateTier(tierIndex, {
                            criteriaLogic: v as CriteriaLogic,
                          })
                        }
                      >
                        <SelectTrigger className="h-5 text-[9px] w-14 px-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-[10px]">
                            ALL
                          </SelectItem>
                          <SelectItem value="any" className="text-[10px]">
                            ANY
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex-1" />

                    {/* Health Class */}
                    <Select
                      value={tier.healthClass}
                      onValueChange={(v) =>
                        updateTier(tierIndex, {
                          healthClass: v as HealthClass,
                        })
                      }
                    >
                      <SelectTrigger className="h-5 text-[9px] w-24 px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HEALTH_CLASS_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-[11px]"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Table Rating */}
                    <Select
                      value={tier.tableRating}
                      onValueChange={(v) =>
                        updateTier(tierIndex, {
                          tableRating: v as TableRating,
                        })
                      }
                    >
                      <SelectTrigger className="h-5 text-[9px] w-20 px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLE_RATING_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-[11px]"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Remove tier */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 flex-shrink-0"
                      onClick={() => removeTier(tierIndex)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>

                  {/* Criteria rows */}
                  <div className="px-2 py-1.5 space-y-1">
                    {tier.criteria.map((criterion, criterionIndex) => (
                      <div
                        key={criterionIndex}
                        className="flex items-center gap-1 flex-wrap"
                      >
                        {/* Field dropdown */}
                        <Select
                          value={criterion.fieldId}
                          onValueChange={(v) =>
                            handleFieldChange(tierIndex, criterionIndex, v)
                          }
                        >
                          <SelectTrigger className="h-6 text-[10px] w-32 px-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {criteriaFields.map((f) => (
                              <SelectItem
                                key={f.fieldId}
                                value={f.fieldId}
                                className="text-[11px]"
                              >
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Operator dropdown */}
                        <Select
                          value={criterion.operator}
                          onValueChange={(v) =>
                            updateCriterion(tierIndex, criterionIndex, {
                              operator: v,
                            })
                          }
                        >
                          <SelectTrigger className="h-6 text-[10px] w-36 px-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operatorsForDslType(criterion.dslType).map(
                              (op) => (
                                <SelectItem
                                  key={op.value}
                                  value={op.value}
                                  className="text-[11px]"
                                >
                                  {op.label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>

                        {/* Value input */}
                        {renderValueInput(tierIndex, criterionIndex, criterion)}

                        {/* Remove criterion */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() =>
                            removeCriterion(tierIndex, criterionIndex)
                          }
                          disabled={tier.criteria.length <= 1}
                        >
                          <Minus className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}

                    {/* Add criterion */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[9px] text-muted-foreground px-1"
                      onClick={() => addCriterion(tierIndex)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      Add Criterion
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add tier button */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] w-full"
                onClick={addTier}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Tier
              </Button>
            </div>

            {/* Catch-all / default */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                {tiers.length > 0 ? "ELSE (when no tier matches)" : "Outcome"}
              </Label>
              <Select
                value={catchAllOutcome}
                onValueChange={(v) => setCatchAllOutcome(v as CatchAllOutcome)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decline" className="text-[11px]">
                    Decline
                  </SelectItem>
                  <SelectItem value="refer" className="text-[11px]">
                    Refer for Review
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Notes (optional)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-12 text-[11px] resize-none"
                placeholder="Additional context..."
              />
            </div>
          </div>
        )}

        {error && <p className="text-[11px] text-destructive">{error}</p>}

        {/* Footer: Save buttons for step 1 (decline/case-by-case) and step 2 */}
        {((step === 1 && decision && !needsStep2) || step === 2) && (
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save Rule{decision === "tiered_acceptance" ? "s" : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
