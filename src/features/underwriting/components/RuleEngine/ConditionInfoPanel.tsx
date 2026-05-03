// src/features/underwriting/components/RuleEngine/ConditionInfoPanel.tsx
// Displays follow-up questions collected for a health condition

import { useMemo } from "react";
import { Info } from "lucide-react";
import { CONDITION_FIELDS, type FieldDefinition } from "./fieldRegistry";

// ============================================================================
// Types
// ============================================================================

interface ConditionInfoPanelProps {
  conditionCode: string;
  conditionName?: string;
}

// ============================================================================
// Helper: Format condition name from code
// ============================================================================

function formatConditionName(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ============================================================================
// Helper: Get field type label
// ============================================================================

function getFieldTypeLabel(field: FieldDefinition): string {
  switch (field.type) {
    case "numeric":
      return field.unit ? `Number (${field.unit})` : "Number";
    case "date":
      return "Date";
    case "boolean":
      return "Yes/No";
    case "string":
      return "Text";
    case "set":
      return "Select One";
    case "array":
      return "Select Multiple";
    default:
      return "";
  }
}

// ============================================================================
// Component
// ============================================================================

export function ConditionInfoPanel({
  conditionCode,
  conditionName,
}: ConditionInfoPanelProps) {
  // Get condition fields
  const conditionFields = useMemo(() => {
    return CONDITION_FIELDS[conditionCode] ?? {};
  }, [conditionCode]);

  const fieldEntries = Object.entries(conditionFields);
  const displayName = conditionName || formatConditionName(conditionCode);

  if (fieldEntries.length === 0) {
    return (
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg p-3 bg-v2-canvas dark:bg-v2-card/50">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-3.5 w-3.5 text-v2-ink-subtle" />
          <span className="text-[11px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wider">
            Follow-Up Questions
          </span>
        </div>
        <p className="text-[10px] text-v2-ink-subtle">
          No specific follow-up questions defined for this condition. Rules will
          use client demographics only.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-info/30/50 rounded-lg p-3 bg-info/10/50 dark:bg-info/10">
      <div className="flex items-center gap-2 mb-2">
        <Info className="h-3.5 w-3.5 text-info" />
        <span className="text-[11px] font-semibold text-info uppercase tracking-wider">
          Follow-Up Questions
        </span>
      </div>
      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mb-3">
        When an applicant discloses{" "}
        <span className="font-medium text-v2-ink dark:text-v2-ink-muted">
          {displayName}
        </span>
        , collect the following information:
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {fieldEntries.map(([key, field]) => (
          <div key={key} className="flex items-center gap-2 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-info/70 flex-shrink-0" />
            <span className="text-v2-ink dark:text-v2-ink-muted font-medium">
              {field.label}
            </span>
            <span className="text-v2-ink-subtle">
              ({getFieldTypeLabel(field)})
            </span>
          </div>
        ))}
      </div>

      {/* Show options for set/array fields */}
      {fieldEntries.some(([_, f]) => f.options && f.options.length > 0) && (
        <div className="mt-3 pt-2 border-t border-info/30/50 dark:border-info/30">
          <p className="text-[9px] text-v2-ink-subtle uppercase tracking-wide mb-1.5">
            Available Options
          </p>
          {fieldEntries
            .filter(([_, f]) => f.options && f.options.length > 0)
            .map(([key, field]) => (
              <div key={key} className="mb-2 last:mb-0">
                <span className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                  {field.label}:
                </span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {field.options!.map((opt) => (
                    <span
                      key={opt.value}
                      className="px-1.5 py-0.5 text-[9px] bg-v2-card-tinted border border-info/30/50 rounded text-v2-ink-muted dark:text-v2-ink-muted"
                    >
                      {opt.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
