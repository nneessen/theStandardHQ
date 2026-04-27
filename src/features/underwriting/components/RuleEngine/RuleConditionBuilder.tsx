// src/features/underwriting/components/RuleEngine/RuleConditionBuilder.tsx
// Simplified condition-first predicate builder with insurance-friendly UI

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type {
  PredicateGroup,
  FieldCondition,
  NullHandler,
} from "@/services/underwriting/core/ruleEngineDSL";
// eslint-disable-next-line no-restricted-imports
import { isFieldCondition } from "@/services/underwriting/core/ruleEngineDSL";
import {
  type FieldDefinition,
  type AllOperators,
  CONDITION_FIELDS,
  CLIENT_FIELDS,
  getOperatorsForType,
  getOperatorLabel,
  getFieldDefinition,
} from "./fieldRegistry";

// ============================================================================
// Types
// ============================================================================

interface RuleConditionBuilderProps {
  predicate: PredicateGroup;
  onChange: (predicate: PredicateGroup) => void;
  conditionCode?: string;
  disabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatConditionName(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Extract conditions from predicate group
function extractConditions(predicate: PredicateGroup): FieldCondition[] {
  if (predicate.all) {
    return predicate.all.flatMap((child) =>
      isFieldCondition(child)
        ? [child]
        : extractConditions(child as PredicateGroup),
    );
  }
  if (predicate.any) {
    return predicate.any.flatMap((child) =>
      isFieldCondition(child)
        ? [child]
        : extractConditions(child as PredicateGroup),
    );
  }
  if (predicate.not && isFieldCondition(predicate.not)) {
    return [predicate.not];
  }
  return [];
}

// Build predicate from conditions array
function buildPredicate(
  conditions: FieldCondition[],
  logic: "all" | "any",
): PredicateGroup {
  if (conditions.length === 0) {
    return {};
  }
  return { [logic]: conditions };
}

// ============================================================================
// Single Condition Row
// ============================================================================

interface ConditionRowProps {
  condition: FieldCondition;
  onChange: (condition: FieldCondition) => void;
  onDelete: () => void;
  fields: Record<string, FieldDefinition>;
  categoryLabel: string;
  disabled?: boolean;
}

function ConditionRow({
  condition,
  onChange,
  onDelete,
  fields,
  categoryLabel: _categoryLabel,
  disabled,
}: ConditionRowProps) {
  const fieldDef = getFieldDefinition(condition.field);
  const operators = fieldDef ? getOperatorsForType(fieldDef.type) : [];

  const handleFieldChange = (newField: string) => {
    const newFieldDef = getFieldDefinition(newField);
    if (!newFieldDef) return;

    let newCondition: FieldCondition;
    switch (newFieldDef.type) {
      case "numeric":
        newCondition = {
          type: "numeric",
          field: newField,
          operator: "gte",
          value: 0,
        };
        break;
      case "date":
        newCondition = {
          type: "date",
          field: newField,
          operator: "years_since_gte",
          value: 0,
        };
        break;
      case "boolean":
        newCondition = {
          type: "boolean",
          field: newField,
          operator: "eq",
          value: true,
        };
        break;
      case "string":
        newCondition = {
          type: "string",
          field: newField,
          operator: "eq",
          value: "",
        };
        break;
      case "set":
        newCondition = {
          type: "set",
          field: newField,
          operator: "in",
          value: [],
        };
        break;
      case "array":
        newCondition = {
          type: "array",
          field: newField,
          operator: "includes_any",
          value: [],
        };
        break;
      case "null_check":
        newCondition = {
          type: "null_check",
          field: newField,
          operator: "is_null",
        };
        break;
      default:
        return;
    }
    onChange(newCondition);
  };

  const handleOperatorChange = (newOperator: AllOperators) => {
    const updated = { ...condition, operator: newOperator } as FieldCondition;

    // Handle 'between' operator special case
    if (newOperator === "between" && condition.type === "numeric") {
      const currentValue =
        typeof condition.value === "number" ? condition.value : 0;
      (updated as { value: [number, number] }).value = [
        currentValue,
        currentValue + 10,
      ];
    } else if (
      condition.type === "numeric" &&
      "operator" in condition &&
      condition.operator === "between" &&
      newOperator !== "between"
    ) {
      const value = Array.isArray(condition.value) ? condition.value[0] : 0;
      (updated as { value: number }).value = value;
    }

    onChange(updated);
  };

  const renderValueInput = () => {
    if (condition.type === "null_check") {
      return null;
    }

    if (condition.type === "numeric") {
      if (condition.operator === "between" && Array.isArray(condition.value)) {
        const [minVal, maxVal] = condition.value as [number, number];
        return (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="h-6 w-14 text-[10px]"
              value={minVal}
              onChange={(e) =>
                onChange({
                  ...condition,
                  value: [parseFloat(e.target.value) || 0, maxVal] as [
                    number,
                    number,
                  ],
                })
              }
              disabled={disabled}
            />
            <span className="text-[9px] text-v2-ink-subtle">to</span>
            <Input
              type="number"
              className="h-6 w-14 text-[10px]"
              value={maxVal}
              onChange={(e) =>
                onChange({
                  ...condition,
                  value: [minVal, parseFloat(e.target.value) || 0] as [
                    number,
                    number,
                  ],
                })
              }
              disabled={disabled}
            />
          </div>
        );
      }
      return (
        <Input
          type="number"
          className="h-6 w-16 text-[10px]"
          value={typeof condition.value === "number" ? condition.value : 0}
          onChange={(e) =>
            onChange({ ...condition, value: parseFloat(e.target.value) || 0 })
          }
          disabled={disabled}
        />
      );
    }

    if (condition.type === "date") {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            className="h-6 w-14 text-[10px]"
            value={condition.value}
            onChange={(e) =>
              onChange({
                ...condition,
                value: parseInt(e.target.value, 10) || 0,
              })
            }
            disabled={disabled}
            min={0}
          />
          <span className="text-[9px] text-v2-ink-subtle">
            {condition.operator.includes("years") ? "years" : "months"}
          </span>
        </div>
      );
    }

    if (condition.type === "boolean") {
      return (
        <div className="flex items-center gap-1.5">
          <Checkbox
            checked={condition.value}
            onCheckedChange={(checked) =>
              onChange({ ...condition, value: !!checked })
            }
            disabled={disabled}
            className="h-3.5 w-3.5"
          />
          <span className="text-[10px] text-v2-ink-muted">
            {condition.value ? "Yes" : "No"}
          </span>
        </div>
      );
    }

    if (condition.type === "string") {
      return (
        <Input
          className="h-6 w-24 text-[10px]"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value"
          disabled={disabled}
        />
      );
    }

    if (condition.type === "set" || condition.type === "array") {
      const options = fieldDef?.options;
      if (options && options.length > 0) {
        return (
          <div className="flex flex-wrap gap-0.5 max-w-48">
            {options.map((opt) => {
              const isSelected = condition.value?.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const current = (condition.value || []) as (
                      | string
                      | number
                    )[];
                    const updated = isSelected
                      ? current.filter((v) => v !== opt.value)
                      : [...current, opt.value];
                    if (condition.type === "set") {
                      onChange({
                        ...condition,
                        value: updated,
                      } as FieldCondition);
                    } else if (condition.type === "array") {
                      onChange({
                        ...condition,
                        value: updated as string[],
                      } as FieldCondition);
                    }
                  }}
                  disabled={disabled}
                  className={`px-1 py-0.5 text-[9px] rounded transition-colors ${
                    isSelected
                      ? "bg-blue-500 text-white"
                      : "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink-muted dark:text-v2-ink-muted hover:bg-v2-ring dark:hover:bg-v2-ring-strong"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }

      return (
        <Input
          className="h-6 w-32 text-[10px]"
          value={(condition.value || []).join(", ")}
          onChange={(e) => {
            const values = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s);
            onChange({ ...condition, value: values });
          }}
          placeholder="Values (comma-sep)"
          disabled={disabled}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex items-center gap-1.5 py-1 px-2 bg-v2-card rounded border border-v2-ring dark:border-v2-ring-strong">
      {/* Field */}
      <Select
        value={condition.field}
        onValueChange={handleFieldChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-6 w-32 text-[10px] border-0 bg-v2-canvas dark:bg-v2-card-tinted">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(fields).map(([key, def]) => (
            <SelectItem key={key} value={key} className="text-[10px]">
              {def.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select
        value={"operator" in condition ? condition.operator : ""}
        onValueChange={handleOperatorChange}
        disabled={disabled || operators.length === 0}
      >
        <SelectTrigger className="h-6 w-28 text-[10px] border-0 bg-v2-canvas dark:bg-v2-card-tinted">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op} className="text-[10px]">
              {getOperatorLabel(op)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value */}
      {renderValueInput()}

      {/* Unit */}
      {fieldDef?.unit && condition.type !== "date" && (
        <span className="text-[9px] text-v2-ink-subtle">{fieldDef.unit}</span>
      )}

      {/* If Unknown dropdown - only show for condition types that support it */}
      {condition.type !== "condition_presence" &&
        condition.type !== "null_check" && (
          <Select
            value={
              ("treatNullAs" in condition
                ? condition.treatNullAs
                : undefined) || "unknown"
            }
            onValueChange={(v) =>
              onChange({
                ...condition,
                treatNullAs: v as NullHandler,
              } as FieldCondition)
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-6 w-16 text-[9px] border-0 bg-transparent text-v2-ink-subtle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown" className="text-[9px]">
                ?→Refer
              </SelectItem>
              <SelectItem value="fail" className="text-[9px]">
                ?→Fail
              </SelectItem>
            </SelectContent>
          </Select>
        )}

      {/* Delete */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={disabled}
        className="h-5 w-5 p-0 text-v2-ink-subtle hover:text-red-500 ml-auto"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RuleConditionBuilder({
  predicate,
  onChange,
  conditionCode,
  disabled,
}: RuleConditionBuilderProps) {
  const [clientSectionOpen, setClientSectionOpen] = useState(false);
  const [logic, setLogic] = useState<"all" | "any">(
    predicate.any ? "any" : "all",
  );

  // Get condition-specific fields
  const conditionFields = useMemo(() => {
    return conditionCode ? (CONDITION_FIELDS[conditionCode] ?? {}) : {};
  }, [conditionCode]);

  // Extract current conditions
  const conditions = useMemo(() => extractConditions(predicate), [predicate]);

  // Separate condition fields from client fields
  const conditionConditions = useMemo(() => {
    return conditions.filter((c) => c.field.startsWith(conditionCode + "."));
  }, [conditions, conditionCode]);

  const clientConditions = useMemo(() => {
    return conditions.filter(
      (c) => c.field.startsWith("client.") || c.field === "conditions",
    );
  }, [conditions]);

  // Update the predicate when conditions change
  const updateConditions = (
    newConditionConditions: FieldCondition[],
    newClientConditions: FieldCondition[],
  ) => {
    const allConditions = [...newConditionConditions, ...newClientConditions];
    onChange(buildPredicate(allConditions, logic));
  };

  // Update logic
  const handleLogicChange = (newLogic: "all" | "any") => {
    setLogic(newLogic);
    const allConditions = [...conditionConditions, ...clientConditions];
    onChange(buildPredicate(allConditions, newLogic));
  };

  // Add condition field
  const addConditionField = () => {
    const firstFieldKey = Object.keys(conditionFields)[0];
    if (!firstFieldKey) return;

    const fieldDef = conditionFields[firstFieldKey];
    let newCondition: FieldCondition;

    switch (fieldDef.type) {
      case "numeric":
        newCondition = {
          type: "numeric",
          field: firstFieldKey,
          operator: "gte",
          value: 0,
        };
        break;
      case "date":
        newCondition = {
          type: "date",
          field: firstFieldKey,
          operator: "years_since_gte",
          value: 0,
        };
        break;
      case "boolean":
        newCondition = {
          type: "boolean",
          field: firstFieldKey,
          operator: "eq",
          value: true,
        };
        break;
      case "array":
        newCondition = {
          type: "array",
          field: firstFieldKey,
          operator: "includes_any",
          value: [],
        };
        break;
      default:
        newCondition = {
          type: "numeric",
          field: firstFieldKey,
          operator: "gte",
          value: 0,
        };
    }

    updateConditions([...conditionConditions, newCondition], clientConditions);
  };

  // Add client field
  const addClientField = () => {
    const newCondition: FieldCondition = {
      type: "numeric",
      field: "client.age",
      operator: "gte",
      value: 18,
    };
    updateConditions(conditionConditions, [...clientConditions, newCondition]);
  };

  // Update a specific condition
  const updateCondition = (
    isConditionField: boolean,
    index: number,
    newCondition: FieldCondition,
  ) => {
    if (isConditionField) {
      const updated = [...conditionConditions];
      updated[index] = newCondition;
      updateConditions(updated, clientConditions);
    } else {
      const updated = [...clientConditions];
      updated[index] = newCondition;
      updateConditions(conditionConditions, updated);
    }
  };

  // Delete a condition
  const deleteCondition = (isConditionField: boolean, index: number) => {
    if (isConditionField) {
      const updated = conditionConditions.filter((_, i) => i !== index);
      updateConditions(updated, clientConditions);
    } else {
      const updated = clientConditions.filter((_, i) => i !== index);
      updateConditions(conditionConditions, updated);
    }
  };

  const conditionName = conditionCode
    ? formatConditionName(conditionCode)
    : "Condition";

  return (
    <div className="space-y-3">
      {/* Logic Selector */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-v2-ink-muted">When</span>
        <Select
          value={logic}
          onValueChange={handleLogicChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-6 w-28 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[10px]">
              ALL conditions
            </SelectItem>
            <SelectItem value="any" className="text-[10px]">
              ANY condition
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-v2-ink-muted">are met:</span>
      </div>

      {/* Condition-Specific Fields Section */}
      {Object.keys(conditionFields).length > 0 && (
        <div className="border border-blue-200 dark:border-blue-800/50 rounded-lg overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 border-b border-blue-200 dark:border-blue-800/50">
            <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              {conditionName} Answers
            </span>
          </div>
          <div className="p-2 space-y-1.5">
            {conditionConditions.length === 0 ? (
              <p className="text-[10px] text-v2-ink-subtle py-2 text-center">
                No conditions from {conditionName.toLowerCase()} answers yet
              </p>
            ) : (
              conditionConditions.map((cond, index) => (
                <ConditionRow
                  key={`condition-${index}`}
                  condition={cond}
                  onChange={(updated) => updateCondition(true, index, updated)}
                  onDelete={() => deleteCondition(true, index)}
                  fields={conditionFields}
                  categoryLabel={conditionName}
                  disabled={disabled}
                />
              ))
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addConditionField}
              disabled={disabled}
              className="h-6 px-2 text-[10px] text-blue-600 dark:text-blue-400 w-full justify-start"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add condition from {conditionName.toLowerCase()} answers
            </Button>
          </div>
        </div>
      )}

      {/* Client Demographics Section (Collapsible) */}
      <Collapsible open={clientSectionOpen} onOpenChange={setClientSectionOpen}>
        <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden">
          <CollapsibleTrigger className="flex items-center gap-2 w-full bg-v2-canvas dark:bg-v2-card-tinted/50 px-3 py-1.5 border-b border-v2-ring dark:border-v2-ring-strong text-left">
            {clientSectionOpen ? (
              <ChevronDown className="h-3 w-3 text-v2-ink-subtle" />
            ) : (
              <ChevronRight className="h-3 w-3 text-v2-ink-subtle" />
            )}
            <span className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider">
              Client Demographics
            </span>
            <span className="text-[9px] text-v2-ink-subtle ml-1">
              (optional)
            </span>
            {clientConditions.length > 0 && (
              <span className="text-[9px] bg-v2-ring dark:bg-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-muted px-1.5 py-0.5 rounded ml-auto">
                {clientConditions.length}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-2 space-y-1.5">
              {clientConditions.length === 0 ? (
                <p className="text-[10px] text-v2-ink-subtle py-2 text-center">
                  No client demographic filters
                </p>
              ) : (
                clientConditions.map((cond, index) => (
                  <ConditionRow
                    key={`client-${index}`}
                    condition={cond}
                    onChange={(updated) =>
                      updateCondition(false, index, updated)
                    }
                    onDelete={() => deleteCondition(false, index)}
                    fields={CLIENT_FIELDS}
                    categoryLabel="Client"
                    disabled={disabled}
                  />
                ))
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addClientField}
                disabled={disabled}
                className="h-6 px-2 text-[10px] text-v2-ink-muted w-full justify-start"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add client filter (age, gender, BMI, etc.)
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Empty State */}
      {Object.keys(conditionFields).length === 0 && conditions.length === 0 && (
        <div className="border border-dashed border-v2-ring-strong dark:border-v2-ring-strong rounded-lg p-4 text-center">
          <p className="text-[10px] text-v2-ink-subtle mb-2">
            No conditions defined. This rule will always match.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addClientField}
            disabled={disabled}
            className="h-6 px-3 text-[10px]"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Condition
          </Button>
        </div>
      )}
    </div>
  );
}
