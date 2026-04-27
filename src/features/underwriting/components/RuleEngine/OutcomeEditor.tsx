// src/features/underwriting/components/RuleEngine/OutcomeEditor.tsx
// Editor for rule outcome fields (eligibility, health class, table rating, etc.)

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import {
  ELIGIBILITY_STATUSES,
  HEALTH_CLASSES,
  TABLE_RATINGS,
  type EligibilityStatus,
  type HealthClass,
  type TableRating,
} from "@/services/underwriting/core/ruleEngineDSL";

// ============================================================================
// Types
// ============================================================================

export interface RuleOutcomeValues {
  eligibility: EligibilityStatus;
  healthClass: HealthClass;
  tableRating: TableRating;
  flatExtraPerThousand: number | null;
  flatExtraYears: number | null;
  reason: string;
  concerns: string[];
}

interface OutcomeEditorProps {
  value: RuleOutcomeValues;
  onChange: (value: RuleOutcomeValues) => void;
  disabled?: boolean;
}

// ============================================================================
// Display Labels
// ============================================================================

const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  eligible: "Eligible",
  ineligible: "Ineligible",
  refer: "Refer",
};

const HEALTH_CLASS_LABELS: Record<HealthClass, string> = {
  preferred_plus: "Preferred Plus",
  preferred: "Preferred",
  standard_plus: "Standard Plus",
  standard: "Standard",
  substandard: "Substandard",
  graded: "Graded Benefit",
  modified: "Modified Benefit",
  guaranteed_issue: "Guaranteed Issue",
  refer: "Refer",
  decline: "Decline",
  unknown: "Unknown",
};

// ============================================================================
// Component
// ============================================================================

export function OutcomeEditor({
  value,
  onChange,
  disabled,
}: OutcomeEditorProps) {
  // Concerns as comma-separated tags
  const concernsText = useMemo(
    () => value.concerns.join(", "),
    [value.concerns],
  );

  const handleConcernsChange = (text: string) => {
    const concerns = text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    onChange({ ...value, concerns });
  };

  const removeConcern = (index: number) => {
    const newConcerns = [...value.concerns];
    newConcerns.splice(index, 1);
    onChange({ ...value, concerns: newConcerns });
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Eligibility + Health Class */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Eligibility
          </Label>
          <Select
            value={value.eligibility}
            onValueChange={(v) =>
              onChange({ ...value, eligibility: v as EligibilityStatus })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELIGIBILITY_STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="text-[11px]">
                  {ELIGIBILITY_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Health Class
          </Label>
          <Select
            value={value.healthClass}
            onValueChange={(v) =>
              onChange({ ...value, healthClass: v as HealthClass })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEALTH_CLASSES.map((hc) => (
                <SelectItem key={hc} value={hc} className="text-[11px]">
                  {HEALTH_CLASS_LABELS[hc]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Table Rating */}
      <div className="space-y-1">
        <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Table Rating
        </Label>
        <Select
          value={value.tableRating}
          onValueChange={(v) =>
            onChange({ ...value, tableRating: v as TableRating })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-7 text-[11px] w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLE_RATINGS.map((rating) => (
              <SelectItem key={rating} value={rating} className="text-[11px]">
                {rating === "none" ? "None" : `Table ${rating}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 3: Flat Extra */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Flat Extra ($/1000)
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="h-7 text-[11px]"
            value={value.flatExtraPerThousand ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                flatExtraPerThousand: e.target.value
                  ? parseFloat(e.target.value)
                  : null,
              })
            }
            placeholder="0.00"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Duration (years)
          </Label>
          <Input
            type="number"
            step="1"
            min="1"
            className="h-7 text-[11px]"
            value={value.flatExtraYears ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                flatExtraYears: e.target.value
                  ? parseInt(e.target.value, 10)
                  : null,
              })
            }
            placeholder="Years"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Row 4: Reason */}
      <div className="space-y-1">
        <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Reason <span className="text-red-500">*</span>
        </Label>
        <Textarea
          className="h-16 text-[11px] resize-none"
          value={value.reason}
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
          placeholder="Explanation for this outcome..."
          disabled={disabled}
        />
      </div>

      {/* Row 5: Concerns */}
      <div className="space-y-1">
        <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Concerns
        </Label>
        {value.concerns.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {value.concerns.map((concern, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-v2-card-tinted dark:bg-v2-card-tinted rounded"
              >
                {concern}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeConcern(index)}
                    className="text-v2-ink-subtle hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <Input
          className="h-7 text-[11px]"
          value={concernsText}
          onChange={(e) => handleConcernsChange(e.target.value)}
          placeholder="Add concerns (comma-separated)"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// Default empty outcome
export const DEFAULT_OUTCOME: RuleOutcomeValues = {
  eligibility: "refer",
  healthClass: "unknown",
  tableRating: "none",
  flatExtraPerThousand: null,
  flatExtraYears: null,
  reason: "",
  concerns: [],
};
