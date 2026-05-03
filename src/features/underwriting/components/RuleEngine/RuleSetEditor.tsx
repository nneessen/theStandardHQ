// src/features/underwriting/components/RuleEngine/RuleSetEditor.tsx
// Sheet for creating/editing a rule set with its rules
// Uses ConditionRuleSetView for condition-scoped rule sets

import { useState, useMemo, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type {
  RuleSetWithRules,
  RuleSetScope,
} from "../../hooks/rules/useRuleSets";
import { useHealthConditions } from "../../hooks/rules/useAcceptance";
import { RuleEditor, type RuleFormData } from "./RuleEditor";
import { ConditionRuleSetView } from "./ConditionRuleSetView";
import { getAvailableConditionCodes } from "./fieldRegistry";

// ============================================================================
// Types
// ============================================================================

interface RuleSetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleSet?: RuleSetWithRules | null;
  carrierId: string;
  carrierName?: string;
  // Callbacks
  onSaveRuleSet: (data: RuleSetFormData) => Promise<void>;
  onCreateRule: (data: RuleFormData) => Promise<void>;
  onUpdateRule: (ruleId: string, data: RuleFormData) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onReorderRules: (ruleIds: string[]) => Promise<void>;
  onDeleteRuleSet?: () => Promise<void>;
  // State
  isLoading?: boolean;
}

export interface RuleSetFormData {
  name: string;
  description: string;
  scope: RuleSetScope;
  conditionCode: string | null;
  productId: string | null;
  isActive: boolean;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_RULESET_DATA: RuleSetFormData = {
  name: "",
  description: "",
  scope: "condition",
  conditionCode: null,
  productId: null,
  isActive: true,
};

// ============================================================================
// Component
// ============================================================================

export function RuleSetEditor({
  open,
  onOpenChange,
  ruleSet,
  carrierId: _carrierId,
  carrierName,
  onSaveRuleSet,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onReorderRules,
  onDeleteRuleSet,
  isLoading,
}: RuleSetEditorProps) {
  const { data: healthConditions } = useHealthConditions();

  // Form state (for creating new rule sets)
  const [formData, setFormData] =
    useState<RuleSetFormData>(DEFAULT_RULESET_DATA);
  const [isDirty, setIsDirty] = useState(false);

  // Sync form data when ruleSet prop changes
  useEffect(() => {
    if (ruleSet) {
      setFormData({
        name: ruleSet.name,
        description: ruleSet.description || "",
        scope: ruleSet.scope as RuleSetScope,
        conditionCode: ruleSet.condition_code,
        productId: ruleSet.product_id,
        isActive: ruleSet.is_active ?? true,
      });
      setIsDirty(false);
    } else {
      setFormData(DEFAULT_RULESET_DATA);
      setIsDirty(false);
    }
  }, [ruleSet]);

  // Rule editor state
  const [editingRule, setEditingRule] = useState<{
    ruleId?: string;
    data?: RuleFormData;
  } | null>(null);

  // Available condition codes
  const availableConditions = useMemo(() => {
    const registryConditions = getAvailableConditionCodes();
    const dbConditions =
      healthConditions?.map((c) => ({
        code: c.code,
        name: c.name,
        category: c.category,
      })) || [];
    return dbConditions.length > 0
      ? dbConditions
      : registryConditions.map((code) => ({
          code,
          name: code
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          category: "General",
        }));
  }, [healthConditions]);

  // Group conditions by category
  const conditionsByCategory = useMemo(() => {
    const grouped: Record<string, typeof availableConditions> = {};
    availableConditions.forEach((c) => {
      const cat = c.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    });
    return grouped;
  }, [availableConditions]);

  // Get condition name for display
  const conditionName = useMemo(() => {
    if (!ruleSet?.condition_code) return undefined;
    const condition = availableConditions.find(
      (c) => c.code === ruleSet.condition_code,
    );
    return condition?.name;
  }, [ruleSet?.condition_code, availableConditions]);

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && ruleSet) {
      setFormData({
        name: ruleSet.name,
        description: ruleSet.description || "",
        scope: ruleSet.scope as RuleSetScope,
        conditionCode: ruleSet.condition_code,
        productId: ruleSet.product_id,
        isActive: ruleSet.is_active ?? true,
      });
      setIsDirty(false);
    } else if (open) {
      setFormData(DEFAULT_RULESET_DATA);
      setIsDirty(false);
    }
    onOpenChange(open);
  };

  // Handle form changes
  const updateForm = (updates: Partial<RuleSetFormData>) => {
    setFormData({ ...formData, ...updates });
    setIsDirty(true);
  };

  // Handle save (for new rule sets)
  const handleSave = async () => {
    if (!formData.name.trim()) return;
    await onSaveRuleSet(formData);
    setIsDirty(false);
  };

  // Handle metadata update (for existing rule sets)
  const handleUpdateMetadata = async (updates: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) => {
    await onSaveRuleSet({
      ...formData,
      name: updates.name ?? formData.name,
      description: updates.description ?? formData.description,
      isActive: updates.isActive ?? formData.isActive,
    });
  };

  // Rule operations
  const handleAddRule = () => {
    setEditingRule({ data: undefined });
  };

  const handleEditRule = (ruleId: string, data: RuleFormData) => {
    setEditingRule({ ruleId, data });
  };

  const handleSaveRule = async (data: RuleFormData) => {
    if (editingRule?.ruleId) {
      await onUpdateRule(editingRule.ruleId, data);
    } else {
      await onCreateRule(data);
    }
    setEditingRule(null);
  };

  const isEditing = !!ruleSet;
  const isConditionScope =
    ruleSet?.scope === "condition" && ruleSet.condition_code;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className={`${
            isConditionScope
              ? "w-[700px] sm:max-w-[700px]"
              : "w-[500px] sm:max-w-[500px]"
          } p-3 overflow-y-auto`}
        >
          {/* Creating New Rule Set */}
          {!isEditing && (
            <>
              <SheetHeader className="space-y-1 pb-3">
                <SheetTitle className="text-sm font-semibold">
                  Create Rule Set
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-3">
                {/* Name */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="h-7 text-[11px]"
                    value={formData.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="Rule set name..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    className="h-12 text-[11px] resize-none"
                    value={formData.description}
                    onChange={(e) =>
                      updateForm({ description: e.target.value })
                    }
                    placeholder="Optional description..."
                  />
                </div>

                {/* Scope + Condition */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                      Scope
                    </Label>
                    <Select
                      value={formData.scope}
                      onValueChange={(v) =>
                        updateForm({ scope: v as RuleSetScope })
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="condition" className="text-[11px]">
                          Condition-Specific
                        </SelectItem>
                        <SelectItem value="global" className="text-[11px]">
                          Global
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.scope === "condition" && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                        Health Condition
                      </Label>
                      <Select
                        value={formData.conditionCode || ""}
                        onValueChange={(v) =>
                          updateForm({ conditionCode: v || null })
                        }
                      >
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {Object.entries(conditionsByCategory).map(
                            ([category, conditions]) => (
                              <div key={category}>
                                <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1">
                                  {category}
                                </div>
                                {conditions.map((c) => (
                                  <SelectItem
                                    key={c.code}
                                    value={c.code}
                                    className="text-[11px]"
                                  >
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </div>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      updateForm({ isActive: checked })
                    }
                    className="h-4 w-7"
                  />
                  <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Active
                  </Label>
                </div>

                {/* Create Button */}
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      isLoading ||
                      !formData.name.trim() ||
                      (formData.scope === "condition" &&
                        !formData.conditionCode)
                    }
                    className="h-7 text-[11px]"
                  >
                    {isLoading && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    Create Rule Set
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Editing Existing Condition Rule Set */}
          {isEditing && isConditionScope && (
            <ConditionRuleSetView
              ruleSet={ruleSet}
              conditionName={conditionName}
              carrierName={carrierName}
              onUpdateMetadata={handleUpdateMetadata}
              onAddRule={handleAddRule}
              onEditRule={handleEditRule}
              onDeleteRule={onDeleteRule}
              onReorderRules={onReorderRules}
              onDeleteRuleSet={onDeleteRuleSet}
              isLoading={isLoading}
            />
          )}

          {/* Editing Existing Global Rule Set (legacy view) */}
          {isEditing && !isConditionScope && (
            <>
              <SheetHeader className="space-y-1 pb-3">
                <SheetTitle className="text-sm font-semibold">
                  Edit Global Rule Set
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-3 pb-4">
                {/* Name */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="h-7 text-[11px]"
                    value={formData.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="Rule set name..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    className="h-12 text-[11px] resize-none"
                    value={formData.description}
                    onChange={(e) =>
                      updateForm({ description: e.target.value })
                    }
                    placeholder="Optional description..."
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      updateForm({ isActive: checked })
                    }
                    className="h-4 w-7"
                  />
                  <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Active
                  </Label>
                </div>

                {/* Save Button */}
                {isDirty && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={isLoading || !formData.name.trim()}
                    className="h-6 text-[10px]"
                  >
                    {isLoading && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                )}
              </div>

              {/* Rules for global scope would go here - keeping simple for now */}
              <div className="text-[10px] text-muted-foreground text-center py-4">
                Global rule sets are for knockout conditions that apply
                regardless of specific health conditions.
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Rule Editor Dialog */}
      <RuleEditor
        open={editingRule !== null}
        onOpenChange={(open) => !open && setEditingRule(null)}
        rule={editingRule?.data}
        conditionCode={formData.conditionCode || undefined}
        onSave={handleSaveRule}
        isLoading={isLoading}
      />
    </>
  );
}
