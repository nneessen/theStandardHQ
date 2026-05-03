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
import { useChatBotAgent } from "@/features/chat-bot";
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
  const { data: agent } = useChatBotAgent(true);
  const smsAvailable = !!agent?.botEnabled;
  const voiceAvailable = !!agent?.voiceEnabled;

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
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  // No ruleset — show empty state
  if (!ruleset) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Power className="h-8 w-8 text-v2-ink-subtle dark:text-v2-ink-muted mb-2" />
          <p className="text-xs font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-1">
            No orchestration rules configured
          </p>
          <p className="text-[10px] text-v2-ink-muted mb-3 max-w-xs">
            Rules control which channel (SMS or Voice) is used for each lead.
            Start from a template or build your own.
          </p>
          <TemplateSelector
            hasExistingRules={false}
            smsAvailable={smsAvailable}
            voiceAvailable={voiceAvailable}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Ruleset Identity */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-md p-2 bg-v2-card">
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="h-4 w-4 text-v2-ink-subtle shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink truncate">
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
            <div className="text-[9px] text-v2-ink-subtle mt-0.5">
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
                ruleset.isActive ? "text-success" : "text-v2-ink-subtle",
              )}
            >
              {ruleset.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <TemplateSelector
            hasExistingRules={ruleset.rules.length > 0}
            smsAvailable={smsAvailable}
            voiceAvailable={voiceAvailable}
          />

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
      <p className="text-[9px] text-v2-ink-subtle">
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
        <div className="text-[10px] text-v2-ink-muted text-center py-4">
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
    <div className="border border-v2-ring dark:border-v2-ring-strong rounded-md p-2 bg-v2-canvas dark:bg-v2-card/50">
      <div className="flex items-center gap-2 mb-0.5">
        <Label className="text-[10px] font-medium text-v2-ink-muted">
          Fallback Action
        </Label>
        <span className="text-[9px] text-v2-ink-subtle">
          (when no rule matches)
        </span>
      </div>
      <p className="text-[9px] text-v2-ink-subtle mb-1.5">
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
                  ? "bg-info/10 dark:bg-info/30 border-info/40 text-info"
                  : "border-v2-ring dark:border-v2-ring-strong text-v2-ink-subtle",
              )}
            >
              {ch === "sms" ? "SMS" : "Voice"}
            </button>
          ))}
        </div>
        {fallback.allowedChannels.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-v2-ink-muted">Prefer:</span>
            {fallback.allowedChannels.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => onSave({ ...fallback, preferredChannel: ch })}
                disabled={saving}
                className={cn(
                  "px-1.5 py-0.5 text-[9px] rounded border transition-colors",
                  fallback.preferredChannel === ch
                    ? "bg-success/10 dark:bg-success/30 border-success/40 text-success"
                    : "border-v2-ring dark:border-v2-ring-strong text-v2-ink-subtle",
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
