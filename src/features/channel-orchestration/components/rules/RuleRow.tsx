// src/features/channel-orchestration/components/rules/RuleRow.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  OrchestrationRule,
  CreateRulePayload,
} from "../../types/orchestration.types";
import { RuleEditor } from "./RuleEditor";

interface Props {
  rule: OrchestrationRule;
  index: number;
  isExpanded: boolean;
  onToggleEnabled: (ruleId: string, enabled: boolean) => void;
  onToggleExpand: (ruleId: string) => void;
  onUpdate: (ruleId: string, payload: CreateRulePayload) => void;
  onDelete: (ruleId: string) => void;
  updating?: boolean;
}

function conditionSummary(rule: OrchestrationRule): string[] {
  const tags: string[] = [];
  const c = rule.conditions;
  if (c.leadStatuses?.length) {
    tags.push(
      c.leadStatuses.length <= 2
        ? c.leadStatuses.join(", ")
        : `${c.leadStatuses.length} statuses`,
    );
  }
  if (c.leadSources?.length) {
    tags.push(
      c.leadSources.length <= 2
        ? c.leadSources.join(", ")
        : `${c.leadSources.length} sources`,
    );
  }
  if (c.conversationStatuses?.length) {
    tags.push(c.conversationStatuses.join(", "));
  }
  if (c.timeWindow) {
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const days = c.timeWindow.days.map((d) => dayNames[d]).join("");
    tags.push(`${c.timeWindow.startTime}–${c.timeWindow.endTime} ${days}`);
  }
  if (c.customFieldConditions?.length) {
    tags.push(`${c.customFieldConditions.length} custom field(s)`);
  }
  if (c.channelHistory) {
    const parts: string[] = [];
    if (c.channelHistory.smsAttempts)
      parts.push(
        `SMS${c.channelHistory.smsAttempts.operator}${c.channelHistory.smsAttempts.value}`,
      );
    if (c.channelHistory.voiceAttempts)
      parts.push(
        `Voice${c.channelHistory.voiceAttempts.operator}${c.channelHistory.voiceAttempts.value}`,
      );
    if (c.channelHistory.lastVoiceOutcome?.length)
      parts.push(c.channelHistory.lastVoiceOutcome.join("/"));
    tags.push(parts.join(", ") || "history");
  }
  return tags;
}

function actionSummary(rule: OrchestrationRule): string {
  const channels = rule.action.allowedChannels
    .map((c) => (c === "sms" ? "SMS" : "Voice"))
    .join(" + ");
  const pref = rule.action.preferredChannel
    ? ` (prefer ${rule.action.preferredChannel === "sms" ? "SMS" : "Voice"})`
    : "";
  return `${channels}${pref}`;
}

export function RuleRow({
  rule,
  index,
  isExpanded,
  onToggleEnabled,
  onToggleExpand,
  onUpdate,
  onDelete,
  updating,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const tags = conditionSummary(rule);

  return (
    <div ref={setNodeRef} style={style} className="space-y-0">
      {/* Row */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-1.5 py-1 rounded border transition-colors",
          isExpanded
            ? "border-info/30 bg-info/10/20 dark:bg-info/10/10"
            : "border-v2-ring dark:border-v2-ring-strong bg-v2-card",
          !rule.enabled && "opacity-50",
        )}
      >
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 text-v2-ink-subtle dark:text-v2-ink-muted hover:text-v2-ink-muted"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Index */}
        <span className="text-[9px] text-v2-ink-subtle w-4 text-center shrink-0">
          {index + 1}
        </span>

        {/* Toggle */}
        <Switch
          checked={rule.enabled}
          onCheckedChange={(checked) => onToggleEnabled(rule.id, checked)}
          className="h-4 w-7 shrink-0"
        />

        {/* Name */}
        <button
          onClick={() => onToggleExpand(rule.id)}
          className="flex items-center gap-1 flex-1 min-w-0 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-v2-ink-subtle shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-v2-ink-subtle shrink-0" />
          )}
          <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate">
            {rule.name}
          </span>
        </button>

        {/* Condition Tags */}
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="h-4 px-1 text-[8px] bg-v2-card-tinted dark:bg-v2-card-tinted"
            >
              {tag}
            </Badge>
          ))}
        </div>

        {/* Action Summary */}
        <span className="text-[9px] text-v2-ink-muted shrink-0 hidden md:block">
          {actionSummary(rule)}
        </span>

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={() => onDelete(rule.id)}
        >
          <Trash2 className="h-3 w-3 text-v2-ink-subtle hover:text-destructive" />
        </Button>
      </div>

      {/* Expanded Editor */}
      {isExpanded && (
        <div className="ml-6 mt-1">
          <RuleEditor
            rule={rule}
            onSave={(payload) => onUpdate(rule.id, payload)}
            onCancel={() => onToggleExpand(rule.id)}
            saving={updating}
          />
        </div>
      )}
    </div>
  );
}
