import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
    <div className="rounded-lg border border-border bg-white p-4 dark:border-border dark:bg-card">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card-tinted text-foreground dark:bg-card-tinted dark:text-foreground">
          {icon}
        </div>
        <div>
          <h2 className="text-[12px] font-semibold text-foreground dark:text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-muted-foreground">
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
        <span className="text-[9px] text-muted-foreground dark:text-muted-foreground">
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
        <span className="text-[9px] text-muted-foreground dark:text-muted-foreground">
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
        <span className="text-[9px] text-muted-foreground dark:text-muted-foreground">
          mins
        </span>
      </div>
    </div>
  );
}

// ─── Step color coding ──────────────────────────────────────────

const STEP_COLORS = [
  {
    bg: "bg-info/10 dark:bg-info/20",
    border: "border-l-blue-400 dark:border-l-blue-500",
    hoverBorder: "hover:border-l-blue-500 dark:hover:border-l-blue-400",
    circle: "bg-info/20 text-info dark:bg-info/60 dark:text-info",
    editCircle: "bg-info text-white",
    badge: "bg-info/20 text-info dark:bg-info/50 dark:text-info",
  },
  {
    bg: "bg-warning/10 dark:bg-warning/20",
    border: "border-l-amber-400 dark:border-l-amber-500",
    hoverBorder: "hover:border-l-amber-500 dark:hover:border-l-amber-400",
    circle: "bg-warning/20 text-warning dark:bg-warning/60 dark:text-warning",
    editCircle: "bg-warning text-white",
    badge: "bg-warning/20 text-warning dark:bg-warning/50 dark:text-warning",
  },
  {
    bg: "bg-success/10 dark:bg-success/20",
    border: "border-l-emerald-400 dark:border-l-emerald-500",
    hoverBorder: "hover:border-l-emerald-500 dark:hover:border-l-emerald-400",
    circle: "bg-success/20 text-success dark:bg-success/60 dark:text-success",
    editCircle: "bg-success text-white",
    badge: "bg-success/20 text-success dark:bg-success/50 dark:text-success",
  },
] as const;

// ─── Step Summary Row (compact, read-only) ──────────────────────

function StepSummaryRow({
  step,
  index,
  canRemove,
  onEdit,
  onRemove,
  disabled,
}: {
  step: StatusTriggerStep;
  index: number;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const instructions = step.aiInstructions.trim();
  const colors = STEP_COLORS[index] ?? STEP_COLORS[0];

  return (
    <div
      onClick={disabled ? undefined : onEdit}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
        "border-l-2",
        colors.border,
        colors.bg,
        !disabled && cn("cursor-pointer", colors.hoverBorder),
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          colors.circle,
        )}
      >
        {index + 1}
      </span>

      <Badge variant="ghost" size="sm" className={cn("shrink-0", colors.badge)}>
        {formatDelay(step.delayMinutes)}
      </Badge>

      <span className="text-[9px] text-muted-foreground dark:text-muted-foreground">
        ·
      </span>

      <span className="min-w-0 flex-1 truncate text-[11px] text-foreground dark:text-muted-foreground">
        {instructions ? (
          <>
            &ldquo;{instructions.slice(0, 80)}
            {instructions.length > 80 ? "..." : ""}&rdquo;
          </>
        ) : (
          <span className="italic text-muted-foreground dark:text-muted-foreground">
            No instructions yet
          </span>
        )}
      </span>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Pencil className="h-3 w-3 text-muted-foreground dark:text-muted-foreground" />
        {canRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive disabled:opacity-50 dark:text-muted-foreground dark:hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step Edit Form (expanded, one at a time) ───────────────────

function StepEditForm({
  step,
  index,
  canRemove,
  onChange,
  onRemove,
  onClose,
  disabled,
}: {
  step: StatusTriggerStep;
  index: number;
  canRemove: boolean;
  onChange: (updated: StatusTriggerStep) => void;
  onRemove: () => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const colors = STEP_COLORS[index] ?? STEP_COLORS[0];

  return (
    <div
      className={cn(
        "rounded-md border border-border p-2.5 dark:border-border",
        colors.bg,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
              colors.editCircle,
            )}
          >
            {index + 1}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
            Step {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="rounded p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50 dark:text-muted-foreground dark:hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-background"
          >
            <Check className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground">
            Delay
          </label>
          <DelayPicker
            value={step.delayMinutes}
            onChange={(delayMinutes) => onChange({ ...step, delayMinutes })}
            disabled={disabled}
          />
          <p className="mt-0.5 text-[9px] text-muted-foreground dark:text-muted-foreground">
            {formatDelay(step.delayMinutes)} after trigger
          </p>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground">
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
                ? "text-destructive"
                : "text-muted-foreground dark:text-muted-foreground",
            )}
          >
            {step.aiInstructions.length}/{MAX_AI_INSTRUCTIONS_LENGTH}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sequence Row (replaces SequenceCard) ───────────────────────

function SequenceRow({
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
  const [open, setOpen] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);

  // Reset editing when collapsed
  useEffect(() => {
    if (!open) setEditingStepIndex(null);
  }, [open]);

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
    if (editingStepIndex === stepIndex) {
      setEditingStepIndex(null);
    } else if (editingStepIndex !== null && editingStepIndex > stepIndex) {
      setEditingStepIndex(editingStepIndex - 1);
    }
  }

  function addStep() {
    if (sequence.steps.length >= MAX_STEPS_PER_SEQUENCE) return;
    const newSteps = [...sequence.steps, createEmptyStep()];
    onChange({ ...sequence, steps: newSteps });
    setEditingStepIndex(newSteps.length - 1);
  }

  const availableForThis = availableStatuses.filter(
    (s) =>
      s.label.toLowerCase() === sequence.statusLabel.toLowerCase() ||
      !usedLabels.has(s.label.toLowerCase()),
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-white dark:border-border dark:bg-card">
        {/* Header row */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-muted-foreground"
            >
              {open ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </CollapsibleTrigger>

          <div className="shrink-0">
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
                  <SelectItem
                    key={s.id}
                    value={s.label}
                    className="text-[11px]"
                  >
                    {s.label}
                  </SelectItem>
                ))}
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

          {/* Delay badges — color-coded summary of step timings */}
          <div className="flex items-center gap-1">
            {sequence.steps.map((step, i) => {
              const c = STEP_COLORS[i] ?? STEP_COLORS[0];
              return (
                <Badge key={i} variant="ghost" size="sm" className={c.badge}>
                  {formatDelay(step.delayMinutes)}
                </Badge>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
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
              className="text-muted-foreground hover:text-destructive disabled:opacity-50 dark:text-muted-foreground dark:hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible steps area */}
        <CollapsibleContent>
          <div className="border-t border-border bg-background/50 px-2 pb-2 pt-1.5 dark:border-border dark:bg-card-tinted/30">
            <div className="space-y-0.5">
              {sequence.steps.map((step, stepIdx) =>
                editingStepIndex === stepIdx ? (
                  <StepEditForm
                    key={stepIdx}
                    step={step}
                    index={stepIdx}
                    canRemove={sequence.steps.length > 1}
                    onChange={(updated) => updateStep(stepIdx, updated)}
                    onRemove={() => removeStep(stepIdx)}
                    onClose={() => setEditingStepIndex(null)}
                    disabled={disabled}
                  />
                ) : (
                  <StepSummaryRow
                    key={stepIdx}
                    step={step}
                    index={stepIdx}
                    canRemove={sequence.steps.length > 1}
                    onEdit={() => setEditingStepIndex(stepIdx)}
                    onRemove={() => removeStep(stepIdx)}
                    disabled={disabled}
                  />
                ),
              )}
            </div>

            {sequence.steps.length < MAX_STEPS_PER_SEQUENCE && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 gap-1 text-[10px] text-muted-foreground"
                onClick={addStep}
                disabled={disabled}
              >
                <Plus className="h-3 w-3" />
                Add Step
              </Button>
            )}

            <p className="mt-0.5 text-[9px] text-muted-foreground dark:text-muted-foreground">
              {sequence.steps.length}/{MAX_STEPS_PER_SEQUENCE} steps
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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

  const [localSequences, setLocalSequences] = useState<
    StatusTriggerSequence[] | null
  >(null);
  const [dirty, setDirty] = useState(false);

  const displayedSequences =
    localSequences ?? agent?.statusTriggerSequences ?? [];

  useEffect(() => {
    if (!dirty) {
      setLocalSequences(null);
    }
  }, [agent?.statusTriggerSequences, dirty]);

  const errors = validateSequences(displayedSequences);

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
        <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
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
          <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
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
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center dark:border-border">
            <MessageSquare className="mx-auto h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
            <p className="mt-2 text-[11px] text-muted-foreground dark:text-muted-foreground">
              No sequences configured. Add one to start automated outreach when
              a lead enters a specific status.
            </p>
          </div>
        )}

        {/* Sequence list */}
        <div className="space-y-1.5">
          {displayedSequences.map((seq, idx) => (
            <SequenceRow
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
              <p key={i} className="text-[10px] text-destructive">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Save / Discard bar */}
        {dirty && (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 dark:border-border">
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
