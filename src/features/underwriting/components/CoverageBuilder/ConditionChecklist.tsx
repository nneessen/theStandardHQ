// src/features/underwriting/components/CoverageBuilder/ConditionChecklist.tsx
// Per-carrier per-product condition checklist grouped by category

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useHealthConditions,
  groupConditionsByCategory,
} from "../../hooks/shared/useHealthConditions";
import { useRuleSets, useDeleteRuleSet } from "../../hooks/rules/useRuleSets";
import {
  useCoverageStats,
  getProductCoverage,
} from "../../hooks/coverage/useCoverageStats";
import {
  CONDITION_CATEGORY_LABELS,
  type ConditionCategory,
  type HealthCondition,
  type FollowUpSchema,
} from "../../types/underwriting.types";
import type { RuleSetWithRules } from "../../hooks/rules/useRuleSets";
import { GuidedRuleBuilderDialog } from "./GuidedRuleBuilderDialog";
import { RuleSetEditor } from "../RuleEngine/RuleSetEditor";
import {
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useReorderRules,
} from "../../hooks/rules/useRules";
import { useUpdateRuleSet } from "../../hooks/rules/useRuleSets";

interface ConditionChecklistProps {
  carrierId: string;
  carrierName: string;
  productId: string;
  productName: string;
  onBack: () => void;
}

export function ConditionChecklist({
  carrierId,
  carrierName,
  productId,
  productName,
  onBack,
}: ConditionChecklistProps) {
  const { data: conditions } = useHealthConditions();
  const { data: coverageMap } = useCoverageStats();
  const { data: ruleSets } = useRuleSets(carrierId, {
    includeInactive: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [builderCondition, setBuilderCondition] =
    useState<HealthCondition | null>(null);
  // Track editing by rule set ID so we always derive from fresh query data
  const [editingRuleSetId, setEditingRuleSetId] = useState<string | null>(null);

  // Mutation hooks
  const createRuleMutation = useCreateRule();
  const updateRuleMutation = useUpdateRule();
  const deleteRuleMutation = useDeleteRule();
  const reorderRulesMutation = useReorderRules();
  const updateRuleSetMutation = useUpdateRuleSet();
  const deleteRuleSetMutation = useDeleteRuleSet();

  const configuredCodes = getProductCoverage(coverageMap, carrierId, productId);

  const totalConditions = conditions?.length ?? 0;
  const configuredCount = configuredCodes.size;
  const pct =
    totalConditions > 0
      ? Math.round((configuredCount / totalConditions) * 100)
      : 0;

  // Filter rule sets to only those matching this product
  const productRuleSets = useMemo(() => {
    if (!ruleSets) return [];
    return ruleSets.filter((rs) => rs.product_id === productId);
  }, [ruleSets, productId]);

  // Derive editingRuleSet from fresh query data (reactive to cache updates)
  const editingRuleSet = useMemo((): RuleSetWithRules | null => {
    if (!editingRuleSetId || !productRuleSets.length) return null;
    return productRuleSets.find((rs) => rs.id === editingRuleSetId) ?? null;
  }, [editingRuleSetId, productRuleSets]);

  // Group conditions by category and filter by search
  type GroupedConditions = Partial<
    Record<ConditionCategory, HealthCondition[]>
  >;
  const groupedConditions = useMemo((): GroupedConditions => {
    if (!conditions) return {};
    const grouped = groupConditionsByCategory(conditions);
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    const filtered: GroupedConditions = {};
    for (const [cat, items] of Object.entries(grouped) as [
      ConditionCategory,
      HealthCondition[],
    ][]) {
      const matches = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      );
      if (matches.length > 0) {
        filtered[cat] = matches;
      }
    }
    return filtered;
  }, [conditions, searchQuery]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // Find the rule set for a given condition code (product-specific)
  const findRuleSetForCondition = (
    conditionCode: string,
  ): RuleSetWithRules | undefined => {
    return productRuleSets.find(
      (rs) => rs.scope === "condition" && rs.condition_code === conditionCode,
    );
  };

  const handleConditionClick = (condition: HealthCondition) => {
    if (configuredCodes.has(condition.code)) {
      // Open existing rule set for editing
      const rs = findRuleSetForCondition(condition.code);
      if (rs) {
        setEditingRuleSetId(rs.id);
      }
    } else {
      // Open guided builder for creating
      setBuilderCondition(condition);
    }
  };

  const isMutating =
    createRuleMutation.isPending ||
    updateRuleMutation.isPending ||
    deleteRuleMutation.isPending ||
    reorderRulesMutation.isPending ||
    updateRuleSetMutation.isPending ||
    deleteRuleSetMutation.isPending;

  return (
    <div className="space-y-2">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-6 w-6 p-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-semibold text-foreground truncate">
            <span className="text-muted-foreground font-normal">
              {carrierName}
            </span>{" "}
            / {productName}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {configuredCount}/{totalConditions} conditions configured ({pct}%)
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor:
              pct <= 20
                ? "var(--destructive)"
                : pct <= 60
                  ? "var(--warning)"
                  : "var(--success)",
          }}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          className="h-7 text-[11px] pl-7"
          placeholder="Search conditions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Category groups */}
      <div className="space-y-1">
        {Object.entries(groupedConditions).map(([category, items]) => {
          const isCollapsed = collapsedCategories.has(category);
          const catConfigured = items.filter((c) =>
            configuredCodes.has(c.code),
          ).length;
          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-1 px-1 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span>
                  {CONDITION_CATEGORY_LABELS[category as ConditionCategory] ??
                    category}
                </span>
                <span className="ml-auto text-[9px] font-normal tabular-nums">
                  {catConfigured}/{items.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 pl-4">
                  {items.map((condition) => {
                    const isConfigured = configuredCodes.has(condition.code);
                    return (
                      <button
                        key={condition.code}
                        onClick={() => handleConditionClick(condition)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/50 transition-colors text-left group"
                      >
                        {isConfigured ? (
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--success)]" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-[var(--destructive)]" />
                        )}
                        <span className="text-[11px] text-foreground truncate">
                          {condition.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Guided Rule Builder Dialog */}
      <GuidedRuleBuilderDialog
        open={!!builderCondition}
        onOpenChange={(open) => !open && setBuilderCondition(null)}
        carrierId={carrierId}
        carrierName={carrierName}
        productId={productId}
        productName={productName}
        conditionCode={builderCondition?.code ?? ""}
        conditionName={builderCondition?.name ?? ""}
        followUpSchema={
          builderCondition?.follow_up_schema
            ? (builderCondition.follow_up_schema as unknown as FollowUpSchema)
            : null
        }
      />

      {/* RuleSetEditor for editing existing condition rules */}
      <RuleSetEditor
        open={!!editingRuleSetId}
        onOpenChange={(open) => !open && setEditingRuleSetId(null)}
        ruleSet={editingRuleSet}
        carrierId={carrierId}
        carrierName={carrierName}
        onSaveRuleSet={async (data) => {
          if (!editingRuleSet) return;
          await updateRuleSetMutation.mutateAsync({
            id: editingRuleSet.id,
            updates: {
              name: data.name,
              description: data.description || null,
              is_active: data.isActive,
            },
          });
        }}
        onCreateRule={async (data) => {
          if (!editingRuleSet) return;
          await createRuleMutation.mutateAsync({
            ruleSetId: editingRuleSet.id,
            priority: (editingRuleSet.rules?.length ?? 0) + 1,
            name: data.name,
            description: data.description,
            ageBandMin: data.ageBandMin,
            ageBandMax: data.ageBandMax,
            gender: data.gender,
            predicate: data.predicate,
            outcomeEligibility: data.outcome.eligibility,
            outcomeHealthClass: data.outcome.healthClass,
            outcomeTableRating: data.outcome.tableRating,
            outcomeFlatExtraPerThousand: data.outcome.flatExtraPerThousand,
            outcomeFlatExtraYears: data.outcome.flatExtraYears,
            outcomeReason: data.outcome.reason,
            outcomeConcerns: data.outcome.concerns,
          });
        }}
        onUpdateRule={async (ruleId, data) => {
          if (!editingRuleSet) return;
          await updateRuleMutation.mutateAsync({
            id: ruleId,
            carrierId,
            ruleSetId: editingRuleSet.id,
            updates: {
              name: data.name,
              description: data.description ?? null,
              ageBandMin: data.ageBandMin,
              ageBandMax: data.ageBandMax,
              gender: data.gender,
              predicate: data.predicate,
              outcomeEligibility: data.outcome.eligibility,
              outcomeHealthClass: data.outcome.healthClass,
              outcomeTableRating: data.outcome.tableRating,
              outcomeFlatExtraPerThousand: data.outcome.flatExtraPerThousand,
              outcomeFlatExtraYears: data.outcome.flatExtraYears,
              outcomeReason: data.outcome.reason,
              outcomeConcerns: data.outcome.concerns,
            },
          });
        }}
        onDeleteRule={async (ruleId) => {
          if (!editingRuleSet) return;
          await deleteRuleMutation.mutateAsync({
            id: ruleId,
            carrierId,
            ruleSetId: editingRuleSet.id,
          });
        }}
        onReorderRules={async (ruleIds) => {
          if (!editingRuleSet) return;
          await reorderRulesMutation.mutateAsync({
            ruleSetId: editingRuleSet.id,
            carrierId,
            ruleIds,
          });
        }}
        onDeleteRuleSet={async () => {
          if (!editingRuleSet) return;
          await deleteRuleSetMutation.mutateAsync({
            id: editingRuleSet.id,
            carrierId,
          });
          setEditingRuleSetId(null);
        }}
        isLoading={isMutating}
      />
    </div>
  );
}
