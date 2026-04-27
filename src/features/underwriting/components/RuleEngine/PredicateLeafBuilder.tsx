// src/features/underwriting/components/RuleEngine/PredicateLeafBuilder.tsx
// Single condition row builder for predicates

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type {
  FieldCondition,
  NullHandler,
} from "@/services/underwriting/core/ruleEngineDSL";
import {
  type AllOperators,
  getFieldsByCategory,
  getOperatorsForType,
  getOperatorLabel,
  getFieldDefinition,
} from "./fieldRegistry";

// ============================================================================
// Types
// ============================================================================

interface PredicateLeafBuilderProps {
  condition: FieldCondition;
  onChange: (condition: FieldCondition) => void;
  onDelete: () => void;
  conditionCode?: string;
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PredicateLeafBuilder({
  condition,
  onChange,
  onDelete,
  conditionCode,
  disabled,
}: PredicateLeafBuilderProps) {
  // Get available fields
  const fieldGroups = useMemo(
    () => getFieldsByCategory(conditionCode),
    [conditionCode],
  );

  // Get current field definition
  const fieldDef = useMemo(
    () => getFieldDefinition(condition.field),
    [condition.field],
  );

  // Get operators for current field type
  const operators = useMemo(
    () => (fieldDef ? getOperatorsForType(fieldDef.type) : []),
    [fieldDef],
  );

  // Handle field change
  const handleFieldChange = (newField: string) => {
    const newFieldDef = getFieldDefinition(newField);
    if (!newFieldDef) return;

    // Reset to appropriate defaults for new field type
    // Note: condition_presence type doesn't have treatNullAs
    const treatNullAs =
      "treatNullAs" in condition ? condition.treatNullAs : undefined;
    const baseCondition = {
      field: newField,
      treatNullAs,
    };

    let newCondition: FieldCondition;
    switch (newFieldDef.type) {
      case "numeric":
        newCondition = {
          ...baseCondition,
          type: "numeric",
          operator: "eq",
          value: 0,
        };
        break;
      case "date":
        newCondition = {
          ...baseCondition,
          type: "date",
          operator: "years_since_gte",
          value: 0,
        };
        break;
      case "boolean":
        newCondition = {
          ...baseCondition,
          type: "boolean",
          operator: "eq",
          value: true,
        };
        break;
      case "string":
        newCondition = {
          ...baseCondition,
          type: "string",
          operator: "eq",
          value: "",
        };
        break;
      case "set":
        newCondition = {
          ...baseCondition,
          type: "set",
          operator: "in",
          value: [],
        };
        break;
      case "array":
        newCondition = {
          ...baseCondition,
          type: "array",
          operator: "includes_any",
          value: [],
        };
        break;
      case "null_check":
        newCondition = {
          ...baseCondition,
          type: "null_check",
          operator: "is_null",
        };
        break;
      default:
        return;
    }

    onChange(newCondition);
  };

  // Handle operator change
  const handleOperatorChange = (newOperator: AllOperators) => {
    // Update operator, keeping other values
    const updated = { ...condition, operator: newOperator } as FieldCondition;

    // Handle special cases for 'between' operator
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

  // Render value input based on condition type
  const renderValueInput = () => {
    if (condition.type === "null_check") {
      return null; // No value for null checks
    }

    if (condition.type === "numeric") {
      if (condition.operator === "between" && Array.isArray(condition.value)) {
        const [minVal, maxVal] = condition.value as [number, number];
        return (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="h-6 w-16 text-[11px]"
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
            <span className="text-[10px] text-v2-ink-muted">to</span>
            <Input
              type="number"
              className="h-6 w-16 text-[11px]"
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
          className="h-6 w-20 text-[11px]"
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
        <Input
          type="number"
          className="h-6 w-16 text-[11px]"
          value={condition.value}
          onChange={(e) =>
            onChange({ ...condition, value: parseInt(e.target.value, 10) || 0 })
          }
          disabled={disabled}
          min={0}
        />
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
            {condition.value ? "True" : "False"}
          </span>
        </div>
      );
    }

    if (condition.type === "string") {
      return (
        <Input
          className="h-6 w-32 text-[11px]"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value"
          disabled={disabled}
        />
      );
    }

    if (condition.type === "set" || condition.type === "array") {
      // For set/array, use field options if available
      const options = fieldDef?.options;
      if (options && options.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
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
                    // Type assertion needed for discriminated union
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
                  className={`px-1.5 py-0.5 text-[10px] rounded ${
                    isSelected
                      ? "bg-blue-500 text-white"
                      : "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink dark:text-v2-ink-muted"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }

      // Fallback to comma-separated input
      return (
        <Input
          className="h-6 w-32 text-[11px]"
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
    <div className="flex items-center gap-2 py-1">
      {/* Field selector */}
      <Select
        value={condition.field}
        onValueChange={handleFieldChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-6 w-40 text-[11px]">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(fieldGroups.client).length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px]">Client</SelectLabel>
              {Object.entries(fieldGroups.client).map(([key, def]) => (
                <SelectItem key={key} value={key} className="text-[11px]">
                  {def.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {Object.keys(fieldGroups.condition).length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px]">
                {conditionCode?.replace(/_/g, " ") || "Condition"}
              </SelectLabel>
              {Object.entries(fieldGroups.condition).map(([key, def]) => (
                <SelectItem key={key} value={key} className="text-[11px]">
                  {def.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select
        value={"operator" in condition ? condition.operator : ""}
        onValueChange={handleOperatorChange}
        disabled={disabled || operators.length === 0}
      >
        <SelectTrigger className="h-6 w-32 text-[11px]">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op} className="text-[11px]">
              {getOperatorLabel(op)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {renderValueInput()}

      {/* Unit display */}
      {fieldDef?.unit && (
        <span className="text-[10px] text-v2-ink-subtle">{fieldDef.unit}</span>
      )}

      {/* Treat null as (not available for condition_presence) */}
      {condition.type !== "condition_presence" && (
        <Select
          value={
            ("treatNullAs" in condition ? condition.treatNullAs : undefined) ||
            "unknown"
          }
          onValueChange={(v) =>
            onChange({
              ...condition,
              treatNullAs: v as NullHandler,
            } as FieldCondition)
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-6 w-20 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unknown" className="text-[10px]">
              Null→?
            </SelectItem>
            <SelectItem value="fail" className="text-[10px]">
              Null→Fail
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={disabled}
        className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-red-500"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Create a default condition
export function createDefaultCondition(
  _conditionCode?: string,
): FieldCondition {
  // Default to age if no condition-specific fields
  return {
    type: "numeric",
    field: "client.age",
    operator: "gte",
    value: 18,
  };
}
