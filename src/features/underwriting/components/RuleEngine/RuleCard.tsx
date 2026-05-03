// src/features/underwriting/components/RuleEngine/RuleCard.tsx
// Visual card for displaying an individual rule with human-readable summary

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, ChevronUp, ChevronDown, FileText } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type {
  PredicateGroup,
  FieldCondition,
} from "@/services/underwriting/core/ruleEngineDSL";
// eslint-disable-next-line no-restricted-imports
import {
  isFieldCondition,
  parsePredicate,
} from "@/services/underwriting/core/ruleEngineDSL";
import {
  getFieldDefinition,
  getOperatorLabel,
  type AllOperators,
} from "./fieldRegistry";

// ============================================================================
// Types
// ============================================================================

interface RuleCardProps {
  rule: {
    id: string;
    name: string;
    description?: string | null;
    priority: number;
    predicate: unknown; // Raw JSON from database, will be parsed
    age_band_min?: number | null;
    age_band_max?: number | null;
    gender?: string | null;
    outcome_eligibility: string;
    outcome_health_class?: string | null;
    outcome_table_rating?: string | null;
    outcome_reason?: string | null;
    source_type?: string | null;
    extraction_confidence?: number | null;
  };
  index: number;
  totalRules: number;
  conditionCode?: string;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isLoading?: boolean;
}

// ============================================================================
// Helpers: Human-readable predicate summary
// ============================================================================

function formatValue(
  value: unknown,
  fieldDef?: ReturnType<typeof getFieldDefinition>,
): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    if (fieldDef?.options) {
      return value
        .map((v) => fieldDef.options?.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    return value.join(", ");
  }
  if (value === null || value === undefined) {
    return "null";
  }
  return String(value);
}

function formatCondition(condition: FieldCondition): string {
  const fieldDef = getFieldDefinition(condition.field);
  const fieldLabel = fieldDef?.label ?? condition.field;

  if (condition.type === "null_check") {
    const op = condition.operator === "is_null" ? "is empty" : "has value";
    return `${fieldLabel} ${op}`;
  }

  const operatorLabel = getOperatorLabel(condition.operator as AllOperators);

  if (condition.type === "numeric" && condition.operator === "between") {
    const [min, max] = condition.value as [number, number];
    return `${fieldLabel} between ${min} and ${max}${fieldDef?.unit ? ` ${fieldDef.unit}` : ""}`;
  }

  const valueStr = formatValue(condition.value, fieldDef);
  const unit = fieldDef?.unit ? ` ${fieldDef.unit}` : "";

  return `${fieldLabel} ${operatorLabel} ${valueStr}${unit}`;
}

function summarizePredicate(predicate: PredicateGroup, depth = 0): string {
  if (Object.keys(predicate).length === 0) {
    return "Always match";
  }

  if (predicate.all) {
    const conditions = predicate.all.map((child) =>
      isFieldCondition(child)
        ? formatCondition(child)
        : summarizePredicate(child as PredicateGroup, depth + 1),
    );
    if (conditions.length === 0) return "Always match";
    if (conditions.length === 1) return conditions[0];
    return conditions.join(" AND ");
  }

  if (predicate.any) {
    const conditions = predicate.any.map((child) =>
      isFieldCondition(child)
        ? formatCondition(child)
        : summarizePredicate(child as PredicateGroup, depth + 1),
    );
    if (conditions.length === 0) return "Always match";
    if (conditions.length === 1) return conditions[0];
    return `(${conditions.join(" OR ")})`;
  }

  if (predicate.not) {
    const inner = isFieldCondition(predicate.not)
      ? formatCondition(predicate.not)
      : summarizePredicate(predicate.not as PredicateGroup, depth + 1);
    return `NOT (${inner})`;
  }

  return "No conditions";
}

// ============================================================================
// Helpers: Outcome badge styling
// ============================================================================

function getOutcomeBadgeVariant(
  eligibility: string,
): "success" | "destructive" | "warning" | "secondary" {
  switch (eligibility) {
    case "eligible":
      return "success";
    case "ineligible":
      return "destructive";
    case "refer":
      return "warning";
    default:
      return "secondary";
  }
}

function getOutcomeLabel(eligibility: string): string {
  switch (eligibility) {
    case "eligible":
      return "ELIGIBLE";
    case "ineligible":
      return "DECLINE";
    case "refer":
      return "REFER";
    default:
      return eligibility.toUpperCase();
  }
}

// ============================================================================
// Component
// ============================================================================

export function RuleCard({
  rule,
  index,
  totalRules,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isLoading,
}: RuleCardProps) {
  // Parse predicate and generate human-readable summary
  const predicateGroup = useMemo(
    () => parsePredicate(rule.predicate),
    [rule.predicate],
  );

  const conditionSummary = useMemo(() => {
    return summarizePredicate(predicateGroup);
  }, [predicateGroup]);

  // Format outcome summary
  const outcomeSummary = useMemo(() => {
    const parts: string[] = [];

    if (rule.outcome_health_class && rule.outcome_health_class !== "unknown") {
      const classLabel = rule.outcome_health_class
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      parts.push(classLabel);
    }

    if (rule.outcome_table_rating && rule.outcome_table_rating !== "none") {
      parts.push(`Table ${rule.outcome_table_rating.toUpperCase()}`);
    }

    return parts.length > 0 ? parts.join(", ") : null;
  }, [rule.outcome_health_class, rule.outcome_table_rating]);

  // Check for filters
  const hasFilters =
    rule.age_band_min !== null ||
    rule.age_band_max !== null ||
    rule.gender !== null;

  const filterSummary = useMemo(() => {
    if (!hasFilters) return null;
    const parts: string[] = [];
    if (rule.age_band_min !== null || rule.age_band_max !== null) {
      const min = rule.age_band_min ?? 0;
      const max = rule.age_band_max ?? 120;
      parts.push(`Age ${min}-${max}`);
    }
    if (rule.gender) {
      parts.push(rule.gender === "male" ? "Male" : "Female");
    }
    return parts.join(", ");
  }, [hasFilters, rule.age_band_min, rule.age_band_max, rule.gender]);

  const isFromDocument = rule.source_type === "carrier_document";

  return (
    <div className="border border-border dark:border-border rounded-lg bg-card hover:border-border dark:hover:border-border transition-colors group">
      {/* Header */}
      <div className="flex items-start gap-2 p-2 border-b border-border dark:border-border">
        {/* Priority & Move Controls */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0 || isLoading}
            className="text-muted-foreground hover:text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">
            {index + 1}
          </span>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalRules - 1 || isLoading}
            className="text-muted-foreground hover:text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Rule Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge
              variant={getOutcomeBadgeVariant(rule.outcome_eligibility)}
              className="text-[9px] h-4 font-semibold"
            >
              {getOutcomeLabel(rule.outcome_eligibility)}
            </Badge>
            <span className="text-[11px] font-medium text-foreground dark:text-foreground truncate">
              {rule.name}
            </span>
            {isFromDocument && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <FileText className="h-3 w-3 text-success flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[9px]">
                  Extracted from carrier document
                </TooltipContent>
              </Tooltip>
            )}
            {rule.extraction_confidence !== null &&
              rule.extraction_confidence !== undefined && (
                <span
                  className="text-[9px] text-muted-foreground"
                  title={`AI extraction confidence: ${Math.round(rule.extraction_confidence * 100)}%`}
                >
                  {Math.round(rule.extraction_confidence * 100)}%
                </span>
              )}
          </div>
          {rule.description && (
            <p className="text-[10px] text-muted-foreground truncate">
              {rule.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            disabled={isLoading}
            className="h-6 w-6 p-0"
            title="Edit rule"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            title="Delete rule"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-2 space-y-1.5">
        {/* Condition Summary */}
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide flex-shrink-0 w-8 pt-0.5">
            IF
          </span>
          <p className="text-[10px] text-muted-foreground dark:text-muted-foreground leading-relaxed">
            {conditionSummary}
          </p>
        </div>

        {/* Filters */}
        {hasFilters && filterSummary && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide flex-shrink-0 w-8 pt-0.5">
              FOR
            </span>
            <p className="text-[10px] text-muted-foreground">{filterSummary}</p>
          </div>
        )}

        {/* Outcome Summary */}
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide flex-shrink-0 w-8 pt-0.5">
            →
          </span>
          <div className="flex-1">
            {outcomeSummary && (
              <span className="text-[10px] font-medium text-foreground dark:text-muted-foreground">
                {outcomeSummary}
              </span>
            )}
            {rule.outcome_reason && (
              <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                "{rule.outcome_reason}"
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
