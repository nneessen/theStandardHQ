// src/features/underwriting/components/RuleEngine/RuleEditor.tsx
// Dialog for creating/editing a single rule with insurance-friendly layout

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ChevronDown, ChevronRight, Code2, Eye } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type { PredicateGroup } from "@/services/underwriting/core/ruleEngineDSL";
// eslint-disable-next-line no-restricted-imports
import { validatePredicate } from "@/services/underwriting/core/ruleEngineDSL";
import { RuleConditionBuilder } from "./RuleConditionBuilder";
import { PredicateJsonEditor } from "./PredicateJsonEditor";
import {
  OutcomeEditor,
  type RuleOutcomeValues,
  DEFAULT_OUTCOME,
} from "./OutcomeEditor";
import { ProvenanceTooltip } from "./ProvenanceTooltip";

// ============================================================================
// Types
// ============================================================================

export interface RuleFormData {
  name: string;
  description: string;
  priority: number;
  ageBandMin: number | null;
  ageBandMax: number | null;
  gender: "male" | "female" | null;
  predicate: PredicateGroup;
  outcome: RuleOutcomeValues;
  // Provenance (read-only for AI-extracted)
  extractionConfidence?: number | null;
  sourcePages?: number[] | null;
  sourceSnippet?: string | null;
}

interface RuleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: RuleFormData | null;
  conditionCode?: string;
  onSave: (data: RuleFormData) => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FORM_DATA: RuleFormData = {
  name: "",
  description: "",
  priority: 10,
  ageBandMin: null,
  ageBandMax: null,
  gender: null,
  predicate: {},
  outcome: DEFAULT_OUTCOME,
};

// ============================================================================
// Helper: Format condition name
// ============================================================================

function formatConditionName(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ============================================================================
// Component
// ============================================================================

export function RuleEditor({
  open,
  onOpenChange,
  rule,
  conditionCode,
  onSave,
  isLoading,
}: RuleEditorProps) {
  const [formData, setFormData] = useState<RuleFormData>(DEFAULT_FORM_DATA);
  const [predicateMode, setPredicateMode] = useState<"visual" | "json">(
    "visual",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync form data when rule prop changes
  useEffect(() => {
    setFormData(rule || DEFAULT_FORM_DATA);
    setValidationError(null);
  }, [rule]);

  // Reset form when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setFormData(rule || DEFAULT_FORM_DATA);
      setPredicateMode("visual");
      setFiltersOpen(false);
      setProvenanceOpen(false);
      setValidationError(null);
    }
    onOpenChange(open);
  };

  // Handle save
  const handleSave = async () => {
    // Validate predicate
    const validation = validatePredicate(formData.predicate);
    if (!validation.valid) {
      setValidationError(validation.errors[0] || "Invalid rule conditions");
      return;
    }

    // Validate required fields
    if (!formData.name.trim()) {
      setValidationError("Rule name is required");
      return;
    }

    if (!formData.outcome.reason.trim()) {
      setValidationError("Outcome reason is required");
      return;
    }

    setValidationError(null);
    await onSave(formData);
    handleOpenChange(false);
  };

  const isEditing = !!rule;
  const hasProvenance =
    formData.extractionConfidence !== null ||
    (formData.sourcePages && formData.sourcePages.length > 0) ||
    formData.sourceSnippet;

  const hasFilters =
    formData.ageBandMin !== null ||
    formData.ageBandMax !== null ||
    formData.gender !== null;

  const conditionName = conditionCode
    ? formatConditionName(conditionCode)
    : "Condition";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-v2-ring dark:border-v2-ring">
          <DialogTitle className="text-sm font-semibold">
            {isEditing ? "Edit Rule" : "Add Rule"}
            {conditionCode && (
              <span className="text-v2-ink-subtle font-normal ml-2">
                for {conditionName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 space-y-4">
          {/* Basic Info Section */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3 space-y-1">
                <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                  Rule Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  className="h-7 text-[11px]"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Well Controlled - Standard Rate"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                  Priority
                </Label>
                <Input
                  type="number"
                  className="h-7 text-[11px]"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  min={1}
                  title="Lower numbers = evaluated first"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                Description
              </Label>
              <Textarea
                className="h-10 text-[11px] resize-none"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of when this rule applies..."
              />
            </div>
          </div>

          {/* Conditions Section */}
          <div className="border border-blue-200 dark:border-blue-800/50 rounded-lg overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  When These Conditions Are Met
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={predicateMode === "visual" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPredicateMode("visual")}
                  className="h-5 px-2 text-[9px] gap-1"
                >
                  <Eye className="h-2.5 w-2.5" />
                  Visual
                </Button>
                <Button
                  type="button"
                  variant={predicateMode === "json" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPredicateMode("json")}
                  className="h-5 px-2 text-[9px] gap-1"
                >
                  <Code2 className="h-2.5 w-2.5" />
                  JSON
                </Button>
              </div>
            </div>
            <div className="p-3">
              {predicateMode === "visual" ? (
                <RuleConditionBuilder
                  predicate={formData.predicate}
                  onChange={(predicate) =>
                    setFormData({ ...formData, predicate })
                  }
                  conditionCode={conditionCode}
                />
              ) : (
                <PredicateJsonEditor
                  predicate={formData.predicate}
                  onChange={(predicate) =>
                    setFormData({ ...formData, predicate })
                  }
                />
              )}
            </div>
          </div>

          {/* Decision/Outcome Section */}
          <div className="border border-green-200 dark:border-green-800/50 rounded-lg overflow-hidden">
            <div className="bg-green-50 dark:bg-green-900/20 px-3 py-2">
              <span className="text-[11px] font-semibold text-green-700 dark:text-green-300 uppercase tracking-wider">
                Then Apply This Decision
              </span>
            </div>
            <div className="p-3">
              <OutcomeEditor
                value={formData.outcome}
                onChange={(outcome) => setFormData({ ...formData, outcome })}
              />
            </div>
          </div>

          {/* Client Filters (Collapsible) */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden">
              <CollapsibleTrigger className="flex items-center gap-2 w-full bg-v2-canvas dark:bg-v2-card-tinted/50 px-3 py-2 text-left">
                {filtersOpen ? (
                  <ChevronDown className="h-3 w-3 text-v2-ink-subtle" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-v2-ink-subtle" />
                )}
                <span className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider">
                  Client Filters
                </span>
                <span className="text-[9px] text-v2-ink-subtle ml-1">
                  (optional - age, gender restrictions)
                </span>
                {hasFilters && !filtersOpen && (
                  <span className="text-[9px] bg-v2-ring dark:bg-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-muted px-1.5 py-0.5 rounded ml-auto">
                    Active
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 space-y-3">
                  <p className="text-[10px] text-v2-ink-subtle">
                    Optionally restrict this rule to specific client
                    demographics. Leave blank to apply to all clients.
                  </p>

                  {/* Age Band */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                      Age Range
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="h-6 w-16 text-[10px]"
                        value={formData.ageBandMin ?? ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ageBandMin: e.target.value
                              ? parseInt(e.target.value, 10)
                              : null,
                          })
                        }
                        placeholder="Min"
                        min={0}
                        max={120}
                      />
                      <span className="text-[10px] text-v2-ink-subtle">to</span>
                      <Input
                        type="number"
                        className="h-6 w-16 text-[10px]"
                        value={formData.ageBandMax ?? ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ageBandMax: e.target.value
                              ? parseInt(e.target.value, 10)
                              : null,
                          })
                        }
                        placeholder="Max"
                        min={0}
                        max={120}
                      />
                      <span className="text-[10px] text-v2-ink-subtle">
                        years
                      </span>
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                      Gender
                    </Label>
                    <Select
                      value={formData.gender || "any"}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          gender: v === "any" ? null : (v as "male" | "female"),
                        })
                      }
                    >
                      <SelectTrigger className="h-6 w-28 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any" className="text-[10px]">
                          Any
                        </SelectItem>
                        <SelectItem value="male" className="text-[10px]">
                          Male Only
                        </SelectItem>
                        <SelectItem value="female" className="text-[10px]">
                          Female Only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Provenance (if AI-extracted) */}
          {hasProvenance && (
            <Collapsible open={provenanceOpen} onOpenChange={setProvenanceOpen}>
              <div className="border border-amber-200 dark:border-amber-800/50 rounded-lg overflow-hidden">
                <CollapsibleTrigger className="flex items-center gap-2 w-full bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-left">
                  {provenanceOpen ? (
                    <ChevronDown className="h-3 w-3 text-amber-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-amber-500" />
                  )}
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                    Source Information
                  </span>
                  <span className="text-[9px] text-amber-500 ml-1">
                    (AI-extracted from carrier document)
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3">
                    <ProvenanceTooltip
                      confidence={formData.extractionConfidence}
                      sourcePages={formData.sourcePages}
                      sourceSnippet={formData.sourceSnippet}
                      inline
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Validation Error */}
          {validationError && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-[10px] text-red-600 dark:text-red-400">
              {validationError}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 py-3 border-t border-v2-ring dark:border-v2-ring gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="h-7 text-[10px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={
              isLoading ||
              !formData.name.trim() ||
              !formData.outcome.reason.trim()
            }
            className="h-7 text-[10px]"
          >
            {isLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
