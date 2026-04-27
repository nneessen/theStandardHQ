// src/features/underwriting/components/RuleEngine/ConditionRuleSetView.tsx
// Main redesigned view for condition-specific rule sets

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
// Select components imported but reserved for future use
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  Plus,
  Loader2,
  Settings2,
  FileText,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  parsePredicate,
  type RuleSetWithRules,
} from "../../hooks/rules/useRuleSets";
import { ConditionInfoPanel } from "./ConditionInfoPanel";
import { RuleCard } from "./RuleCard";
import type { RuleFormData } from "./RuleEditor";

// ============================================================================
// Types
// ============================================================================

interface ConditionRuleSetViewProps {
  ruleSet: RuleSetWithRules;
  conditionName?: string;
  carrierName?: string;
  // Metadata editing
  onUpdateMetadata: (updates: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) => Promise<void>;
  // Rule operations
  onAddRule: () => void;
  onEditRule: (ruleId: string, data: RuleFormData) => void;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onReorderRules: (ruleIds: string[]) => Promise<void>;
  onDeleteRuleSet?: () => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatConditionName(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getSourceBadge(sourceType?: string | null) {
  if (!sourceType) return null;

  switch (sourceType) {
    case "generic_template":
      return (
        <Badge variant="warning" className="text-[9px] h-4 gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />
          Template
        </Badge>
      );
    case "carrier_document":
      return (
        <Badge variant="success" className="text-[9px] h-4 gap-1">
          <FileText className="h-2.5 w-2.5" />
          Carrier Sourced
        </Badge>
      );
    case "manual":
      return (
        <Badge variant="secondary" className="text-[9px] h-4">
          Manual
        </Badge>
      );
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export function ConditionRuleSetView({
  ruleSet,
  conditionName,
  carrierName,
  onUpdateMetadata,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onReorderRules,
  onDeleteRuleSet,
  isLoading,
}: ConditionRuleSetViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [editedName, setEditedName] = useState(ruleSet.name);
  const [editedDescription, setEditedDescription] = useState(
    ruleSet.description || "",
  );
  const [editedActive, setEditedActive] = useState(ruleSet.is_active ?? true);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [confirmDeleteRuleSet, setConfirmDeleteRuleSet] = useState(false);
  const [isDeletingRuleSet, setIsDeletingRuleSet] = useState(false);

  const displayConditionName =
    conditionName ||
    (ruleSet.condition_code
      ? formatConditionName(ruleSet.condition_code)
      : "Unknown");

  const rules = ruleSet.rules || [];

  // Handle rule edit
  const handleEditRule = (rule: RuleSetWithRules["rules"][0]) => {
    const predicate = parsePredicate(rule.predicate);
    onEditRule(rule.id, {
      name: rule.name,
      description: rule.description || "",
      priority: rule.priority,
      ageBandMin: rule.age_band_min,
      ageBandMax: rule.age_band_max,
      gender: rule.gender as "male" | "female" | null,
      predicate,
      outcome: {
        eligibility: rule.outcome_eligibility as
          | "eligible"
          | "ineligible"
          | "refer",
        healthClass: rule.outcome_health_class,
        tableRating: rule.outcome_table_rating ?? "none",
        flatExtraPerThousand: rule.outcome_flat_extra_per_thousand,
        flatExtraYears: rule.outcome_flat_extra_years,
        reason: rule.outcome_reason,
        concerns: rule.outcome_concerns || [],
      },
      extractionConfidence: rule.extraction_confidence,
      sourcePages: rule.source_pages,
      sourceSnippet: rule.source_snippet,
    });
  };

  // Handle move rule
  const handleMoveRule = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) return;

    const newRules = [...rules];
    [newRules[index], newRules[newIndex]] = [
      newRules[newIndex],
      newRules[index],
    ];
    await onReorderRules(newRules.map((r) => r.id));
  };

  // Handle save metadata
  const handleSaveMetadata = async () => {
    setIsSavingMetadata(true);
    try {
      await onUpdateMetadata({
        name: editedName,
        description: editedDescription,
        isActive: editedActive,
      });
      setShowSettings(false);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const hasMetadataChanges =
    editedName !== ruleSet.name ||
    editedDescription !== (ruleSet.description || "") ||
    editedActive !== (ruleSet.is_active ?? true);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-v2-ring dark:border-v2-ring-strong pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-bold text-v2-ink dark:text-v2-ink uppercase tracking-wide">
                {displayConditionName}
              </h2>
              {getSourceBadge(ruleSet.source_type)}
              <Badge
                variant={ruleSet.is_active ? "success" : "secondary"}
                className="text-[9px] h-4"
              >
                {ruleSet.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {carrierName && (
              <p className="text-[11px] text-v2-ink-muted">
                Carrier: <span className="font-medium">{carrierName}</span>
              </p>
            )}
            {ruleSet.description && (
              <p className="text-[10px] text-v2-ink-subtle mt-1">
                {ruleSet.description}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="h-7 px-2 text-[10px] text-v2-ink-muted"
          >
            <Settings2 className="h-3 w-3 mr-1" />
            Settings
          </Button>
        </div>

        {/* Template Warning */}
        {ruleSet.source_type === "generic_template" && (
          <Alert variant="warning" className="mt-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertTitle className="text-[10px] font-semibold">
              Template Rule Set
            </AlertTitle>
            <AlertDescription className="text-[9px]">
              These rules are based on industry-standard templates, NOT
              carrier-specific guidelines. Review and customize for accuracy.
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-3 pt-3 border-t border-v2-ring dark:border-v2-ring-strong space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-v2-ink-muted">Name</Label>
                <Input
                  className="h-7 text-[11px]"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                />
              </div>
              <div className="space-y-1 flex items-end">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editedActive}
                    onCheckedChange={setEditedActive}
                    className="h-4 w-7"
                  />
                  <Label className="text-[10px] text-v2-ink-muted">
                    Active
                  </Label>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-v2-ink-muted">
                Description
              </Label>
              <Textarea
                className="h-12 text-[11px] resize-none"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Optional description..."
              />
            </div>
            {hasMetadataChanges && (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditedName(ruleSet.name);
                    setEditedDescription(ruleSet.description || "");
                    setEditedActive(ruleSet.is_active ?? true);
                  }}
                  className="h-6 text-[10px]"
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveMetadata}
                  disabled={isSavingMetadata || !editedName.trim()}
                  className="h-6 text-[10px]"
                >
                  {isSavingMetadata && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}

            {onDeleteRuleSet && (
              <div className="pt-3 mt-3 border-t border-v2-ring dark:border-v2-ring-strong">
                {!confirmDeleteRuleSet ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDeleteRuleSet(true)}
                    className="h-6 text-[10px]"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete Rule Set
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-red-600 dark:text-red-400">
                      Delete this rule set and all its rules?
                    </span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isDeletingRuleSet}
                      onClick={async () => {
                        setIsDeletingRuleSet(true);
                        try {
                          await onDeleteRuleSet();
                        } finally {
                          setIsDeletingRuleSet(false);
                          setConfirmDeleteRuleSet(false);
                        }
                      }}
                      className="h-6 text-[10px]"
                    >
                      {isDeletingRuleSet ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteRuleSet(false)}
                      className="h-6 text-[10px]"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Follow-Up Questions Reference */}
      {ruleSet.condition_code && (
        <ConditionInfoPanel
          conditionCode={ruleSet.condition_code}
          conditionName={displayConditionName}
        />
      )}

      {/* Acceptance Rules Section */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden">
        <div className="bg-v2-canvas dark:bg-v2-card-tinted/50 px-3 py-2 border-b border-v2-ring dark:border-v2-ring-strong flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wider">
              Acceptance Rules
            </span>
            <span className="text-[9px] text-v2-ink-subtle ml-2">
              Evaluated in priority order (top to bottom)
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddRule}
            disabled={isLoading}
            className="h-6 px-2 text-[10px] text-blue-600 dark:text-blue-400"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Rule
          </Button>
        </div>

        <div className="p-2">
          {rules.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[11px] text-v2-ink-subtle mb-3">
                No acceptance rules defined yet.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddRule}
                disabled={isLoading}
                className="h-7 px-3 text-[10px]"
              >
                <Plus className="h-3 w-3 mr-1" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  index={index}
                  totalRules={rules.length}
                  conditionCode={ruleSet.condition_code || undefined}
                  onEdit={() => handleEditRule(rule)}
                  onDelete={() => onDeleteRule(rule.id)}
                  onMoveUp={() => handleMoveRule(index, "up")}
                  onMoveDown={() => handleMoveRule(index, "down")}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Default Outcome Section */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden">
        <div className="bg-v2-canvas dark:bg-v2-card-tinted/50 px-3 py-2 border-b border-v2-ring dark:border-v2-ring-strong">
          <span className="text-[11px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted uppercase tracking-wider">
            Default Outcome
          </span>
          <span className="text-[9px] text-v2-ink-subtle ml-2">
            Applied when no rules match
          </span>
        </div>
        <div className="p-3 flex items-center gap-2">
          <Badge variant="warning" className="text-[9px] h-4">
            REFER
          </Badge>
          <span className="text-[10px] text-v2-ink-muted">
            → Refer for manual underwriting review
          </span>
        </div>
      </div>
    </div>
  );
}
