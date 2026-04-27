// src/features/underwriting/components/RuleEngine/PredicateGroupBuilder.tsx
// Recursive component for building AND/OR/NOT predicate groups

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Layers } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import type {
  PredicateGroup,
  FieldCondition,
} from "@/services/underwriting/core/ruleEngineDSL";
// eslint-disable-next-line no-restricted-imports
import { isFieldCondition } from "@/services/underwriting/core/ruleEngineDSL";
import {
  PredicateLeafBuilder,
  createDefaultCondition,
} from "./PredicateLeafBuilder";

// ============================================================================
// Types
// ============================================================================

type GroupType = "all" | "any" | "not" | "empty";

interface PredicateGroupBuilderProps {
  group: PredicateGroup;
  onChange: (group: PredicateGroup) => void;
  onDelete?: () => void;
  conditionCode?: string;
  depth?: number;
  disabled?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getGroupType(group: PredicateGroup): GroupType {
  if (group.all) return "all";
  if (group.any) return "any";
  if (group.not) return "not";
  return "empty";
}

function getGroupChildren(
  group: PredicateGroup,
): (FieldCondition | PredicateGroup)[] {
  if (group.all) return group.all;
  if (group.any) return group.any;
  if (group.not) return [group.not];
  return [];
}

// ============================================================================
// Component
// ============================================================================

export function PredicateGroupBuilder({
  group,
  onChange,
  onDelete,
  conditionCode,
  depth = 0,
  disabled,
}: PredicateGroupBuilderProps) {
  const groupType = getGroupType(group);
  const children = getGroupChildren(group);

  // Handle group type change
  const handleTypeChange = (newType: GroupType) => {
    if (newType === groupType) return;

    if (newType === "empty") {
      onChange({});
      return;
    }

    // Convert existing children to new type
    if (newType === "not") {
      // NOT can only have one child - take the first or create a new one
      const firstChild = children[0] || createDefaultCondition(conditionCode);
      onChange({ not: firstChild });
    } else {
      // ALL or ANY - preserve children
      const newChildren = children.length > 0 ? children : [];
      onChange({ [newType]: newChildren });
    }
  };

  // Handle child update
  const handleChildUpdate = (
    index: number,
    newChild: FieldCondition | PredicateGroup,
  ) => {
    if (groupType === "not") {
      onChange({ not: newChild });
      return;
    }

    const newChildren = [...children];
    newChildren[index] = newChild;
    onChange({ [groupType]: newChildren });
  };

  // Handle child delete
  const handleChildDelete = (index: number) => {
    if (groupType === "not") {
      onChange({});
      return;
    }

    const newChildren = children.filter((_, i) => i !== index);
    onChange({ [groupType]: newChildren });
  };

  // Add new condition
  const addCondition = () => {
    const newCondition = createDefaultCondition(conditionCode);

    if (groupType === "empty") {
      // Convert empty to ALL with one condition
      onChange({ all: [newCondition] });
    } else if (groupType === "not") {
      // Can't add to NOT - wrap in ALL first
      onChange({ all: [group, newCondition] });
    } else {
      onChange({ [groupType]: [...children, newCondition] });
    }
  };

  // Add new nested group
  const addGroup = () => {
    const newGroup: PredicateGroup = { all: [] };

    if (groupType === "empty") {
      onChange({ all: [newGroup] });
    } else if (groupType === "not") {
      // Can't add to NOT - wrap in ALL first
      onChange({ all: [group, newGroup] });
    } else {
      onChange({ [groupType]: [...children, newGroup] });
    }
  };

  // Background color for nesting
  const bgColor =
    depth % 2 === 0
      ? "bg-v2-canvas dark:bg-v2-card/50"
      : "bg-v2-card-tinted/50 dark:bg-v2-card-tinted/30";

  return (
    <div className={`rounded-lg p-2 ${bgColor} ${depth > 0 ? "ml-3" : ""}`}>
      {/* Group Header */}
      <div className="flex items-center gap-2 mb-2">
        <Select
          value={groupType}
          onValueChange={(v) => handleTypeChange(v as GroupType)}
          disabled={disabled}
        >
          <SelectTrigger className="h-6 w-24 text-[11px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              ALL (AND)
            </SelectItem>
            <SelectItem value="any" className="text-[11px]">
              ANY (OR)
            </SelectItem>
            <SelectItem value="not" className="text-[11px]">
              NOT
            </SelectItem>
            <SelectItem value="empty" className="text-[11px]">
              Always Match
            </SelectItem>
          </SelectContent>
        </Select>

        <span className="text-[10px] text-v2-ink-subtle">
          {groupType === "all" && "All conditions must match"}
          {groupType === "any" && "At least one must match"}
          {groupType === "not" && "Condition must not match"}
          {groupType === "empty" && "No conditions (always matches)"}
        </span>

        {/* Delete group button (only for nested groups) */}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={disabled}
            className="h-5 w-5 p-0 ml-auto text-v2-ink-subtle hover:text-red-500"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Children */}
      {groupType !== "empty" && (
        <div className="space-y-1">
          {children.map((child, index) => {
            const isLeaf = isFieldCondition(child);
            return (
              <div key={index}>
                {isLeaf ? (
                  <PredicateLeafBuilder
                    condition={child as FieldCondition}
                    onChange={(updated) => handleChildUpdate(index, updated)}
                    onDelete={() => handleChildDelete(index)}
                    conditionCode={conditionCode}
                    disabled={disabled}
                  />
                ) : (
                  <PredicateGroupBuilder
                    group={child as PredicateGroup}
                    onChange={(updated) => handleChildUpdate(index, updated)}
                    onDelete={() => handleChildDelete(index)}
                    conditionCode={conditionCode}
                    depth={depth + 1}
                    disabled={disabled}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add buttons (not for NOT groups or empty) */}
      {groupType !== "not" && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addCondition}
            disabled={disabled}
            className="h-6 px-2 text-[10px] text-blue-600 dark:text-blue-400"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Condition
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addGroup}
            disabled={disabled}
            className="h-6 px-2 text-[10px] text-v2-ink-muted"
          >
            <Layers className="h-3 w-3 mr-1" />
            Add Group
          </Button>
        </div>
      )}
    </div>
  );
}
