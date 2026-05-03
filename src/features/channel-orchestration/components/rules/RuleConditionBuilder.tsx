// src/features/channel-orchestration/components/rules/RuleConditionBuilder.tsx
import { useState } from "react";
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChatBotCloseLeadStatuses } from "@/features/chat-bot";
import {
  useCloseLeadSources,
  useCloseCustomFields,
} from "../../hooks/useOrchestration";
import type {
  RuleConditions,
  ConversationStatus,
  CustomFieldCondition,
  CustomFieldOperator,
  ComparisonOperator,
  TimeWindow,
  ChannelHistoryCondition,
} from "../../types/orchestration.types";
import {
  CONVERSATION_STATUSES,
  VOICE_OUTCOMES,
} from "../../types/orchestration.types";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const COMPARISON_OPS: { value: ComparisonOperator; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
];

const CUSTOM_FIELD_OPS: { value: CustomFieldOperator; label: string }[] = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "not_empty", label: "Not empty" },
];

interface Props {
  conditions: RuleConditions;
  onChange: (conditions: RuleConditions) => void;
}

function CollapsibleSection({
  label,
  description,
  active,
  children,
}: {
  label: string;
  description?: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(active);
  return (
    <div className="border border-border dark:border-border rounded-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-medium text-muted-foreground dark:text-muted-foreground hover:bg-background dark:hover:bg-card-tinted/50 rounded-t-md"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {label}
        {active && (
          <Badge
            variant="secondary"
            className="ml-auto h-4 px-1 text-[8px] bg-info/15 text-info"
          >
            Active
          </Badge>
        )}
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1.5">
          {description && (
            <p className="text-[9px] text-muted-foreground">{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  loading,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  loading?: boolean;
}) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {loading ? (
          <span className="text-[10px] text-muted-foreground">Loading...</span>
        ) : (
          options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={cn(
                "px-1.5 py-0.5 text-[10px] rounded border transition-colors",
                selected.includes(opt.value)
                  ? "bg-info/10 dark:bg-info/30 border-info/40 text-info"
                  : "border-border dark:border-border text-muted-foreground hover:border-border",
              )}
            >
              {opt.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function RuleConditionBuilder({ conditions, onChange }: Props) {
  const { data: leadStatuses = [], isLoading: statusesLoading } =
    useChatBotCloseLeadStatuses();
  const { data: leadSources = [], isLoading: sourcesLoading } =
    useCloseLeadSources();
  const { data: customFields = [], isLoading: fieldsLoading } =
    useCloseCustomFields();

  const update = (patch: Partial<RuleConditions>) =>
    onChange({ ...conditions, ...patch });

  return (
    <div className="space-y-1.5">
      {/* Lead Statuses */}
      <CollapsibleSection
        label="Lead Statuses"
        description="Only apply this rule when the lead is in one of these statuses. Leave empty to match all statuses."
        active={(conditions.leadStatuses?.length ?? 0) > 0}
      >
        <MultiSelect
          label="Match leads with these statuses"
          options={leadStatuses.map((s) => ({
            value: s.label ?? s.id,
            label: s.label ?? s.id,
          }))}
          selected={conditions.leadStatuses ?? []}
          onChange={(leadStatuses) => update({ leadStatuses })}
          loading={statusesLoading}
        />
      </CollapsibleSection>

      {/* Lead Sources */}
      <CollapsibleSection
        label="Lead Sources"
        description="Only apply this rule for leads from specific sources (e.g., 'GOAT Realtime Veterans'). Leave empty to match all sources."
        active={(conditions.leadSources?.length ?? 0) > 0}
      >
        <MultiSelect
          label="Match leads from these sources"
          options={leadSources.map((s) => ({
            value: s.label,
            label: s.label,
          }))}
          selected={conditions.leadSources ?? []}
          onChange={(leadSources) => update({ leadSources })}
          loading={sourcesLoading}
        />
      </CollapsibleSection>

      {/* Conversation Statuses */}
      <CollapsibleSection
        label="Conversation Status"
        description="Match based on where the conversation is in the pipeline — e.g., 'scheduling' means the lead is actively booking."
        active={(conditions.conversationStatuses?.length ?? 0) > 0}
      >
        <MultiSelect
          label="Match conversations with these statuses"
          options={CONVERSATION_STATUSES.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
          selected={conditions.conversationStatuses ?? []}
          onChange={(vals) =>
            update({
              conversationStatuses: vals as ConversationStatus[],
            })
          }
        />
      </CollapsibleSection>

      {/* Time Window */}
      <CollapsibleSection
        label="Time Window"
        description="Restrict this rule to specific hours and days. For example, Mon-Fri 9am-5pm ET for business hours only."
        active={!!conditions.timeWindow}
      >
        <TimeWindowEditor
          timeWindow={conditions.timeWindow ?? null}
          onChange={(timeWindow) => update({ timeWindow })}
        />
      </CollapsibleSection>

      {/* Custom Field Conditions */}
      <CollapsibleSection
        label="Custom Fields"
        description="Match leads based on custom CRM fields. Use this for advanced targeting beyond status and source."
        active={(conditions.customFieldConditions?.length ?? 0) > 0}
      >
        <CustomFieldConditionsEditor
          conditions={conditions.customFieldConditions ?? []}
          onChange={(customFieldConditions) =>
            update({ customFieldConditions })
          }
          fields={customFields}
          loading={fieldsLoading}
        />
      </CollapsibleSection>

      {/* Channel History */}
      <CollapsibleSection
        label="Channel History"
        description="Match based on previous outreach attempts — e.g., 'after 2 failed SMS attempts' or 'if last voice call was no-answer'."
        active={!!conditions.channelHistory}
      >
        <ChannelHistoryEditor
          history={conditions.channelHistory ?? {}}
          onChange={(channelHistory) => update({ channelHistory })}
        />
      </CollapsibleSection>
    </div>
  );
}

function TimeWindowEditor({
  timeWindow,
  onChange,
}: {
  timeWindow: TimeWindow | null;
  onChange: (tw: TimeWindow | null) => void;
}) {
  if (!timeWindow) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-[10px]"
        onClick={() =>
          onChange({
            startTime: "09:00",
            endTime: "17:00",
            days: [1, 2, 3, 4, 5],
            timezone: "America/New_York",
          })
        }
      >
        <Plus className="h-3 w-3 mr-1" />
        Add time window
      </Button>
    );
  }

  const update = (patch: Partial<TimeWindow>) =>
    onChange({ ...timeWindow, ...patch });

  const toggleDay = (day: number) => {
    const days = timeWindow.days.includes(day)
      ? timeWindow.days.filter((d) => d !== day)
      : [...timeWindow.days, day].sort();
    update({ days });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Start</Label>
          <Input
            type="time"
            value={timeWindow.startTime}
            onChange={(e) => update({ startTime: e.target.value })}
            className="h-7 text-[10px] w-24"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">End</Label>
          <Input
            type="time"
            value={timeWindow.endTime}
            onChange={(e) => update({ endTime: e.target.value })}
            className="h-7 text-[10px] w-24"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Timezone</Label>
          <Input
            value={timeWindow.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            className="h-7 text-[10px] w-40"
            placeholder="America/New_York"
          />
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Days</Label>
        <div className="flex gap-1 mt-0.5">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={cn(
                "w-7 h-6 text-[9px] rounded border transition-colors",
                timeWindow.days.includes(d.value)
                  ? "bg-info/10 dark:bg-info/30 border-info/40 text-info"
                  : "border-border dark:border-border text-muted-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 text-[9px] text-destructive hover:text-destructive px-1"
        onClick={() => onChange(null)}
      >
        <X className="h-2.5 w-2.5 mr-0.5" />
        Remove
      </Button>
    </div>
  );
}

function CustomFieldConditionsEditor({
  conditions,
  onChange,
  fields,
  loading,
}: {
  conditions: CustomFieldCondition[];
  onChange: (conditions: CustomFieldCondition[]) => void;
  fields: { key: string; name: string; type: string }[];
  loading: boolean;
}) {
  const addRow = () =>
    onChange([
      ...conditions,
      { fieldKey: "", operator: "eq" as CustomFieldOperator, value: "" },
    ]);

  const updateRow = (idx: number, patch: Partial<CustomFieldCondition>) =>
    onChange(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const removeRow = (idx: number) =>
    onChange(conditions.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1">
      {conditions.map((cond, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <Select
            value={cond.fieldKey}
            onValueChange={(fieldKey) => updateRow(idx, { fieldKey })}
          >
            <SelectTrigger className="h-7 text-[10px] w-36">
              <SelectValue placeholder={loading ? "Loading..." : "Field"} />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.key} value={f.key} className="text-[10px]">
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={cond.operator}
            onValueChange={(op) =>
              updateRow(idx, { operator: op as CustomFieldOperator })
            }
          >
            <SelectTrigger className="h-7 text-[10px] w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_FIELD_OPS.map((op) => (
                <SelectItem
                  key={op.value}
                  value={op.value}
                  className="text-[10px]"
                >
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cond.operator !== "not_empty" && (
            <Input
              value={cond.value ?? ""}
              onChange={(e) => updateRow(idx, { value: e.target.value })}
              className="h-7 text-[10px] flex-1"
              placeholder="Value"
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => removeRow(idx)}
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-[10px]"
        onClick={addRow}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add field condition
      </Button>
    </div>
  );
}

function ChannelHistoryEditor({
  history,
  onChange,
}: {
  history: ChannelHistoryCondition;
  onChange: (h: ChannelHistoryCondition) => void;
}) {
  const update = (patch: Partial<ChannelHistoryCondition>) =>
    onChange({ ...history, ...patch });

  const renderNumericCondition = (
    label: string,
    key: keyof Pick<
      ChannelHistoryCondition,
      | "smsAttempts"
      | "voiceAttempts"
      | "lastSmsAgeMinutes"
      | "lastVoiceAgeMinutes"
    >,
  ) => {
    const current = history[key];
    if (!current) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px]"
          onClick={() => update({ [key]: { operator: "gte", value: 1 } })}
        >
          <Plus className="h-3 w-3 mr-1" />
          {label}
        </Button>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-28 shrink-0">
          {label}
        </span>
        <Select
          value={current.operator}
          onValueChange={(op) =>
            update({
              [key]: { ...current, operator: op as ComparisonOperator },
            })
          }
        >
          <SelectTrigger className="h-7 text-[10px] w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARISON_OPS.map((op) => (
              <SelectItem
                key={op.value}
                value={op.value}
                className="text-[10px]"
              >
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          value={current.value}
          onChange={(e) =>
            update({ [key]: { ...current, value: Number(e.target.value) } })
          }
          className="h-7 text-[10px] w-16"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => {
            const next = { ...history };
            delete next[key];
            onChange(next);
          }}
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      {renderNumericCondition("SMS attempts", "smsAttempts")}
      {renderNumericCondition("Voice attempts", "voiceAttempts")}
      {renderNumericCondition("Last SMS age (min)", "lastSmsAgeMinutes")}
      {renderNumericCondition("Last voice age (min)", "lastVoiceAgeMinutes")}

      {/* Voice outcome filter */}
      <MultiSelect
        label="Last voice outcome"
        options={VOICE_OUTCOMES}
        selected={history.lastVoiceOutcome ?? []}
        onChange={(lastVoiceOutcome) => update({ lastVoiceOutcome })}
      />
    </div>
  );
}
