// src/features/channel-orchestration/components/rules/RulesTab.tsx
import { useState, useCallback } from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Power, Loader2, Trash2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useOrchestrationRuleset,
  usePatchRuleset,
  useDeleteRuleset,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
  useReorderRules,
} from "../../hooks/useOrchestration";
import type {
  CreateRulePayload,
  FallbackAction,
  ChannelType,
} from "../../types/orchestration.types";
import { RuleRow } from "./RuleRow";
import { RuleEditor } from "./RuleEditor";
import { TemplateSelector } from "./TemplateSelector";
import { RuleTester } from "./RuleTester";

export function RulesTab() {
  const { data: ruleset, isLoading } = useOrchestrationRuleset();
  const patchRuleset = usePatchRuleset();
  const deleteRuleset = useDeleteRuleset();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const toggleRule = useToggleRule();
  const reorderRules = useReorderRules();

  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [addingRule, setAddingRule] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !ruleset) return;

      const rules = ruleset.rules;
      const oldIndex = rules.findIndex((r) => r.id === active.id);
      const newIndex = rules.findIndex((r) => r.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(rules, oldIndex, newIndex);
        reorderRules.mutate(reordered.map((r) => r.id));
      }
    },
    [ruleset, reorderRules],
  );

  const handleCreateRule = (payload: CreateRulePayload) => {
    createRule.mutate(payload, {
      onSuccess: () => setAddingRule(false),
    });
  };

  const handleUpdateRule = (ruleId: string, payload: CreateRulePayload) => {
    updateRule.mutate(
      { ruleId, patch: payload },
      { onSuccess: () => setExpandedRuleId(null) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  // No ruleset — show empty state
  if (!ruleset) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Power className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            No orchestration rules configured
          </p>
          <p className="text-[10px] text-zinc-500 mb-3 max-w-xs">
            Rules control which channel (SMS or Voice) is used for each lead.
            Start from a template or build your own.
          </p>
          <TemplateSelector hasExistingRules={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Ruleset Identity */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-md p-2 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="h-4 w-4 text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {ruleset.name}
              </span>
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[8px] shrink-0"
              >
                {ruleset.rules.length} rule
                {ruleset.rules.length !== 1 ? "s" : ""}
              </Badge>
              {ruleset.templateKey && (
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[8px] shrink-0"
                >
                  {ruleset.templateKey}
                </Badge>
              )}
            </div>
            <div className="text-[9px] text-zinc-400 mt-0.5">
              v{ruleset.version} · Updated{" "}
              {new Date(ruleset.updatedAt).toLocaleDateString()}
            </div>
          </div>

          {/* Master Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              checked={ruleset.isActive}
              onCheckedChange={(isActive) => patchRuleset.mutate({ isActive })}
              className="h-4 w-7"
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                ruleset.isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-400",
              )}
            >
              {ruleset.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <TemplateSelector hasExistingRules={ruleset.rules.length > 0} />

          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => deleteRuleset.mutate()}
            disabled={deleteRuleset.isPending}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Rules List */}
      <p className="text-[9px] text-zinc-400">
        Rules are evaluated top-to-bottom. The first rule that matches wins.
        Drag to reorder.
      </p>
      {ruleset.rules.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ruleset.rules.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {ruleset.rules.map((rule, index) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  index={index}
                  isExpanded={expandedRuleId === rule.id}
                  onToggleEnabled={(ruleId, enabled) =>
                    toggleRule.mutate({ ruleId, enabled })
                  }
                  onToggleExpand={(ruleId) =>
                    setExpandedRuleId(expandedRuleId === ruleId ? null : ruleId)
                  }
                  onUpdate={handleUpdateRule}
                  onDelete={(ruleId) => deleteRule.mutate(ruleId)}
                  updating={updateRule.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-[10px] text-zinc-500 text-center py-4">
          No rules yet. Add one below or apply a template.
        </div>
      )}

      {/* Add Rule */}
      {addingRule ? (
        <RuleEditor
          rule={null}
          onSave={handleCreateRule}
          onCancel={() => setAddingRule(false)}
          saving={createRule.isPending}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => setAddingRule(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Rule
        </Button>
      )}

      {/* Fallback Action */}
      <FallbackEditor
        fallback={ruleset.fallbackAction}
        onSave={(fallbackAction) => patchRuleset.mutate({ fallbackAction })}
        saving={patchRuleset.isPending}
      />

      {/* Rule Tester */}
      <RuleTester
        rules={ruleset.rules}
        fallbackAction={ruleset.fallbackAction}
      />
    </div>
  );
}

function FallbackEditor({
  fallback,
  onSave,
  saving,
}: {
  fallback: FallbackAction;
  onSave: (fallback: FallbackAction) => void;
  saving?: boolean;
}) {
  const toggleChannel = (ch: ChannelType) => {
    const current = fallback.allowedChannels;
    const next = current.includes(ch)
      ? current.filter((c) => c !== ch)
      : [...current, ch];
    if (next.length === 0) return;
    const newFallback: FallbackAction = {
      ...fallback,
      allowedChannels: next,
    };
    if (!next.includes(fallback.preferredChannel)) {
      newFallback.preferredChannel = next[0];
    }
    onSave(newFallback);
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-md p-2 bg-zinc-50 dark:bg-zinc-900/50">
      <div className="flex items-center gap-2 mb-0.5">
        <Label className="text-[10px] font-medium text-zinc-500">
          Fallback Action
        </Label>
        <span className="text-[9px] text-zinc-400">(when no rule matches)</span>
      </div>
      <p className="text-[9px] text-zinc-400 mb-1.5">
        When no rule matches (e.g., deep night hours), these defaults apply.
      </p>
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {(["sms", "voice"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              disabled={saving}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded border transition-colors",
                fallback.allowedChannels.includes(ch)
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-400",
              )}
            >
              {ch === "sms" ? "SMS" : "Voice"}
            </button>
          ))}
        </div>
        {fallback.allowedChannels.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-500">Prefer:</span>
            {fallback.allowedChannels.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => onSave({ ...fallback, preferredChannel: ch })}
                disabled={saving}
                className={cn(
                  "px-1.5 py-0.5 text-[9px] rounded border transition-colors",
                  fallback.preferredChannel === ch
                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-400",
                )}
              >
                {ch === "sms" ? "SMS" : "Voice"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
