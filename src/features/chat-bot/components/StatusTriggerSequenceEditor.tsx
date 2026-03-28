import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  useChatBotAgent,
  useChatBotCloseLeadStatuses,
  useChatBotCloseStatus,
  useUpdateBotConfig,
} from "../hooks/useChatBot";
import { resolveConnectionState } from "../lib/connection-state";
import {
  createEmptySequence,
  createEmptyStep,
  delayPartsToMinutes,
  MAX_AI_INSTRUCTIONS_LENGTH,
  MAX_DELAY_MINUTES,
  MAX_SEQUENCES,
  MAX_STEPS_PER_SEQUENCE,
  minutesToDelayParts,
  validateSequences,
  type StatusTriggerSequence,
  type StatusTriggerStep,
} from "../lib/status-trigger-sequences";

// ─── Local helpers ──────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {icon}
        </div>
        <div>
          <h2 className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return "Immediate";
  const { days, hours, minutes: mins } = minutesToDelayParts(minutes);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

// ─── Delay Picker ───────────────────────────────────────────────

function DelayPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  const parts = minutesToDelayParts(value);

  function update(field: "days" | "hours" | "minutes", raw: string) {
    const num = Math.max(0, parseInt(raw) || 0);
    const d = field === "days" ? num : parts.days;
    const h = field === "hours" ? Math.min(num, 23) : parts.hours;
    const m = field === "minutes" ? Math.min(num, 59) : parts.minutes;
    const total = delayPartsToMinutes(d, h, m);
    onChange(Math.min(total, MAX_DELAY_MINUTES));
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <div>
        <Input
          type="number"
          value={parts.days}
          onChange={(e) => update("days", e.target.value)}
          className="h-7 text-[11px]"
          min={0}
          max={7}
          disabled={disabled}
        />
        <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
          days
        </span>
      </div>
      <div>
        <Input
          type="number"
          value={parts.hours}
          onChange={(e) => update("hours", e.target.value)}
          className="h-7 text-[11px]"
          min={0}
          max={23}
          disabled={disabled}
        />
        <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
          hours
        </span>
      </div>
      <div>
        <Input
          type="number"
          value={parts.minutes}
          onChange={(e) => update("minutes", e.target.value)}
          className="h-7 text-[11px]"
          min={0}
          max={59}
          disabled={disabled}
        />
        <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
          mins
        </span>
      </div>
    </div>
  );
}

// ─── Step Editor ────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  canRemove,
  onChange,
  onRemove,
  disabled,
}: {
  step: StatusTriggerStep;
  index: number;
  canRemove: boolean;
  onChange: (updated: StatusTriggerStep) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Step {index + 1}
        </span>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-zinc-400 hover:text-red-500 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            Delay
          </label>
          <DelayPicker
            value={step.delayMinutes}
            onChange={(delayMinutes) => onChange({ ...step, delayMinutes })}
            disabled={disabled}
          />
          <p className="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">
            {formatDelay(step.delayMinutes)} after trigger
          </p>
        </div>

        <div>
          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            AI Instructions
          </label>
          <Textarea
            value={step.aiInstructions}
            onChange={(e) =>
              onChange({ ...step, aiInstructions: e.target.value })
            }
            placeholder="Guide the bot's tone and content for this step..."
            className="mt-0.5 min-h-[60px] resize-y text-[11px]"
            disabled={disabled}
          />
          <p
            className={cn(
              "mt-0.5 text-right text-[9px]",
              step.aiInstructions.length > MAX_AI_INSTRUCTIONS_LENGTH
                ? "text-red-500"
                : "text-zinc-400 dark:text-zinc-500",
            )}
          >
            {step.aiInstructions.length}/{MAX_AI_INSTRUCTIONS_LENGTH}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Single Sequence Card ───────────────────────────────────────

function SequenceCard({
  sequence,
  availableStatuses,
  usedLabels,
  onChange,
  onDelete,
  disabled,
}: {
  sequence: StatusTriggerSequence;
  availableStatuses: { id: string; label: string }[];
  usedLabels: Set<string>;
  onChange: (updated: StatusTriggerSequence) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  function updateStep(stepIndex: number, updated: StatusTriggerStep) {
    const steps = [...sequence.steps];
    steps[stepIndex] = updated;
    onChange({ ...sequence, steps });
  }

  function removeStep(stepIndex: number) {
    onChange({
      ...sequence,
      steps: sequence.steps.filter((_, i) => i !== stepIndex),
    });
  }

  function addStep() {
    if (sequence.steps.length >= MAX_STEPS_PER_SEQUENCE) return;
    onChange({ ...sequence, steps: [...sequence.steps, createEmptyStep()] });
  }

  // Filter out statuses already used by other sequences
  const availableForThis = availableStatuses.filter(
    (s) =>
      s.label.toLowerCase() === sequence.statusLabel.toLowerCase() ||
      !usedLabels.has(s.label.toLowerCase()),
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <Select
            value={sequence.statusLabel}
            onValueChange={(label) =>
              onChange({ ...sequence, statusLabel: label })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              {availableForThis.map((s) => (
                <SelectItem key={s.id} value={s.label} className="text-[11px]">
                  {s.label}
                </SelectItem>
              ))}
              {/* Allow custom entry if the current label isn't in the list */}
              {sequence.statusLabel &&
                !availableStatuses.some(
                  (s) =>
                    s.label.toLowerCase() ===
                    sequence.statusLabel.toLowerCase(),
                ) && (
                  <SelectItem
                    value={sequence.statusLabel}
                    className="text-[11px]"
                  >
                    {sequence.statusLabel} (custom)
                  </SelectItem>
                )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
            {sequence.enabled ? "On" : "Off"}
          </span>
          <Switch
            variant="success"
            size="sm"
            checked={sequence.enabled}
            onCheckedChange={(enabled) => onChange({ ...sequence, enabled })}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="ml-1 text-zinc-400 hover:text-red-500 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Steps (collapsible) */}
      {!collapsed && (
        <div className="border-t border-zinc-100 px-3 pb-3 pt-2 dark:border-zinc-800">
          <div className="space-y-2">
            {sequence.steps.map((step, stepIdx) => (
              <StepEditor
                key={stepIdx}
                step={step}
                index={stepIdx}
                canRemove={sequence.steps.length > 1}
                onChange={(updated) => updateStep(stepIdx, updated)}
                onRemove={() => removeStep(stepIdx)}
                disabled={disabled}
              />
            ))}
          </div>

          {sequence.steps.length < MAX_STEPS_PER_SEQUENCE && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 gap-1 text-[10px] text-zinc-500"
              onClick={addStep}
              disabled={disabled}
            >
              <Plus className="h-3 w-3" />
              Add Step
            </Button>
          )}

          <p className="mt-1 text-[9px] text-zinc-400 dark:text-zinc-500">
            {sequence.steps.length}/{MAX_STEPS_PER_SEQUENCE} steps
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Editor ────────────────────────────────────────────────

export function StatusTriggerSequenceEditor() {
  const { data: agent } = useChatBotAgent();
  const { data: closeStatus, error: closeStatusError } =
    useChatBotCloseStatus();
  const closeConnected =
    resolveConnectionState({
      connected: closeStatus?.connected,
      error: closeStatusError,
    }) === "connected";
  const { data: statuses = [] } = useChatBotCloseLeadStatuses(closeConnected);
  const updateConfig = useUpdateBotConfig();

  // Local form state (null = not dirty, using server data)
  const [localSequences, setLocalSequences] = useState<
    StatusTriggerSequence[] | null
  >(null);
  const [dirty, setDirty] = useState(false);

  const displayedSequences =
    localSequences ?? agent?.statusTriggerSequences ?? [];

  // Reset local state when server data arrives and user hasn't edited
  useEffect(() => {
    if (!dirty) {
      setLocalSequences(null);
    }
  }, [agent?.statusTriggerSequences, dirty]);

  const errors = validateSequences(displayedSequences);

  // Build set of used labels (lowercase) for duplicate detection in dropdowns
  const usedLabels = new Set(
    displayedSequences.map((s) => s.statusLabel.toLowerCase()).filter(Boolean),
  );

  function setSequences(updated: StatusTriggerSequence[]) {
    setLocalSequences(updated);
    setDirty(true);
  }

  function addSequence() {
    if (displayedSequences.length >= MAX_SEQUENCES) return;
    setSequences([...displayedSequences, createEmptySequence()]);
  }

  function updateSequence(index: number, updated: StatusTriggerSequence) {
    const next = [...displayedSequences];
    next[index] = updated;
    setSequences(next);
  }

  function deleteSequence(index: number) {
    setSequences(displayedSequences.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (errors.length > 0) return;
    updateConfig.mutate(
      { statusTriggerSequences: displayedSequences },
      {
        onSuccess: () => {
          setDirty(false);
          setLocalSequences(null);
        },
      },
    );
  }

  function handleDiscard() {
    setLocalSequences(null);
    setDirty(false);
  }

  // Guard: Close not connected
  if (!closeConnected) {
    return (
      <SectionCard
        icon={<MessageSquare className="h-4 w-4" />}
        title="Status-Triggered Sequences"
        description="Automatically send AI-generated SMS outreach when a lead's CRM status changes."
      >
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          Connect Close CRM in the Integrations tab to configure
          status-triggered sequences.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      <SectionCard
        icon={<MessageSquare className="h-4 w-4" />}
        title="Status-Triggered Sequences"
        description="When a lead's Close status changes, the bot sends a series of AI-generated SMS messages. Each step has its own delay and AI instructions. The sequence stops if the lead responds."
      >
        {/* Add button */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {displayedSequences.length}/{MAX_SEQUENCES} sequences
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[10px]"
            onClick={addSequence}
            disabled={
              displayedSequences.length >= MAX_SEQUENCES ||
              updateConfig.isPending
            }
          >
            <Plus className="h-3 w-3" />
            Add Sequence
          </Button>
        </div>

        {/* Empty state */}
        {displayedSequences.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center dark:border-zinc-700">
            <MessageSquare className="mx-auto h-5 w-5 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              No sequences configured. Add one to start automated outreach when
              a lead enters a specific status.
            </p>
          </div>
        )}

        {/* Sequence list */}
        <div className="space-y-2">
          {displayedSequences.map((seq, idx) => (
            <SequenceCard
              key={idx}
              sequence={seq}
              availableStatuses={statuses}
              usedLabels={usedLabels}
              onChange={(updated) => updateSequence(idx, updated)}
              onDelete={() => deleteSequence(idx)}
              disabled={updateConfig.isPending}
            />
          ))}
        </div>

        {/* Validation errors */}
        {dirty && errors.length > 0 && (
          <div className="mt-3 space-y-0.5">
            {errors.map((err, i) => (
              <p key={i} className="text-[10px] text-red-500">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Save / Discard bar */}
        {dirty && (
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={updateConfig.isPending || errors.length > 0}
              onClick={handleSave}
            >
              {updateConfig.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              Save Changes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px]"
              disabled={updateConfig.isPending}
              onClick={handleDiscard}
            >
              Discard
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
