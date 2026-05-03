// src/features/underwriting/components/RuleEngine/PredicateJsonEditor.tsx
// Advanced JSON editor for predicates with validation

import { useState, useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type { PredicateGroup } from "@/services/underwriting/core/ruleEngineDSL";
// eslint-disable-next-line no-restricted-imports
import { validatePredicate } from "@/services/underwriting/core/ruleEngineDSL";

// ============================================================================
// Types
// ============================================================================

interface PredicateJsonEditorProps {
  predicate: PredicateGroup;
  onChange: (predicate: PredicateGroup) => void;
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PredicateJsonEditor({
  predicate,
  onChange,
  disabled,
}: PredicateJsonEditorProps) {
  // Local JSON text state
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(predicate, null, 2),
  );
  const [isDirty, setIsDirty] = useState(false);

  // Sync external changes to local state
  useEffect(() => {
    if (!isDirty) {
      setJsonText(JSON.stringify(predicate, null, 2));
    }
  }, [predicate, isDirty]);

  // Validation state
  const validation = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      return validatePredicate(parsed);
    } catch {
      return { valid: false, errors: ["Invalid JSON syntax"] };
    }
  }, [jsonText]);

  // Handle text change
  const handleChange = (text: string) => {
    setJsonText(text);
    setIsDirty(true);
  };

  // Apply changes
  const handleApply = () => {
    if (!validation.valid) return;

    try {
      const parsed = JSON.parse(jsonText) as PredicateGroup;
      onChange(parsed);
      setIsDirty(false);
    } catch {
      // Should not happen if validation passed
    }
  };

  // Reset to original
  const handleReset = () => {
    setJsonText(JSON.stringify(predicate, null, 2));
    setIsDirty(false);
  };

  return (
    <div className="space-y-2">
      {/* JSON Editor */}
      <Textarea
        className="font-mono text-[11px] h-48 resize-y bg-card text-v2-canvas dark:bg-v2-canvas"
        value={jsonText}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder='{"all": [...]}'
      />

      {/* Validation Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {validation.valid ? (
            <>
              <Check className="h-3 w-3 text-success" />
              <span className="text-[10px] text-success">Valid predicate</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-destructive" />
              <span className="text-[10px] text-destructive">
                {validation.errors[0]}
              </span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        {isDirty && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={disabled}
              className="h-6 px-2 text-[10px]"
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleApply}
              disabled={disabled || !validation.valid}
              className="h-6 px-2 text-[10px]"
            >
              Apply
            </Button>
          </div>
        )}
      </div>

      {/* Validation Errors (if more than one) */}
      {!validation.valid && validation.errors.length > 1 && (
        <div className="text-[10px] text-destructive space-y-0.5 max-h-20 overflow-y-auto">
          {validation.errors.map((error, i) => (
            <div key={i}>• {error}</div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="text-[10px] text-v2-ink-subtle">
        <details>
          <summary className="cursor-pointer hover:text-v2-ink-subtle">
            JSON Schema Reference
          </summary>
          <pre className="mt-1 p-2 bg-muted rounded text-[9px] overflow-x-auto">
            {`// Example predicate:
{
  "all": [
    { "type": "numeric", "field": "client.age", "operator": "gte", "value": 18 },
    {
      "any": [
        { "type": "boolean", "field": "client.tobacco", "operator": "eq", "value": false },
        { "type": "numeric", "field": "client.bmi", "operator": "lt", "value": 30 }
      ]
    }
  ]
}

// Operators by type:
// numeric: eq, neq, gt, gte, lt, lte, between
// date: years_since_gte, years_since_lte, months_since_gte, months_since_lte
// boolean: eq, neq
// string: eq, neq, contains, starts_with, ends_with
// set: in, not_in
// array: includes_any, includes_all, is_empty, is_not_empty
// null_check: is_null, is_not_null`}
          </pre>
        </details>
      </div>
    </div>
  );
}
