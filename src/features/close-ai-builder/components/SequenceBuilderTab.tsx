// Sequence (Workflow) builder tab. The "elaborate" one — lets the user:
//   1. Describe the sequence in natural language
//   2. Set structured options (audience, channels, cadence, timezone)
//   3. Review the generated multi-step plan
//   4. Edit each step inline (name/subject/body/day)
//   5. Save — the backend creates N templates then the sequence

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Sparkles,
  RotateCw,
  Check,
  Info,
  Mail,
  MessageSquare,
  Trash2,
  Plus,
  GitBranch,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useGenerateSequence,
  useSaveSequence,
} from "../hooks/useCloseAiBuilder";
import { CloseAiBuilderError } from "../services/closeAiBuilderService";
import type {
  GeneratedSequence,
  GeneratedSequenceStep,
  SequencePromptOptions,
} from "../types/close-ai-builder.types";
import { countStepsByChannel, gapFromPrevious } from "../lib/sequence-utils";

// Fixed operating window — mirrors FIXED_SEQUENCE_SCHEDULE / FIXED_SEQUENCE_TIMEZONE
// in supabase/functions/close-ai-builder/close/endpoints.ts. Every generated
// workflow uses this schedule regardless of what the user sees in the UI.
const FIXED_SCHEDULE_LABEL = "Mon–Sat · 8:00 AM – 8:00 PM EST (no Sundays)";
const FIXED_TIMEZONE_LABEL = "America/New_York (EST/EDT)";

export function SequenceBuilderTab() {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("professional");
  const [totalDays, setTotalDays] = useState(14);
  const [touchCount, setTouchCount] = useState(5);
  const [channels, setChannels] = useState<Array<"email" | "sms">>([
    "email",
    "sms",
  ]);
  const [threading, setThreading] = useState<"new_thread" | "old_thread">(
    "old_thread",
  );
  const [runMode, setRunMode] = useState<"once" | "multiple">("once");
  const [constraints, setConstraints] = useState("");

  const [draft, setDraft] = useState<GeneratedSequence | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [savedSeqId, setSavedSeqId] = useState<string | null>(null);

  const generate = useGenerateSequence();
  const save = useSaveSequence();

  const channelToggle = (ch: "email" | "sms") => {
    setChannels((prev) => {
      if (prev.includes(ch)) {
        return prev.length > 1 ? prev.filter((c) => c !== ch) : prev;
      }
      return [...prev, ch];
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the sequence you want to build");
      return;
    }
    const options: SequencePromptOptions = {
      audience: audience || undefined,
      tone,
      totalDays,
      touchCount,
      channels,
      // Timezone is always America/New_York (EST/EDT) — hardcoded at save
      // time. We pass it to the AI so generated copy can reference time
      // windows correctly (e.g. "Tuesday morning").
      timezone: "America/New_York",
      threading,
      runMode,
      constraints: constraints || undefined,
    };
    try {
      const result = await generate.mutateAsync({ prompt, options });
      setDraft(result.sequence);
      setGenerationId(result.generation_id);
      setSavedSeqId(null);
      toast.success(
        `Generated ${result.sequence.steps.length}-step workflow — review and save`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate workflow",
      );
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      const result = await save.mutateAsync({
        sequence: draft,
        generationId: generationId ?? undefined,
      });
      setSavedSeqId(result.sequence.id);
      toast.success(
        `Saved workflow + ${result.created_template_ids.length} templates to Close`,
      );
    } catch (err) {
      // Surface detailed save-flow errors. If this is a CloseAiBuilderError
      // from a partial-failure path, the edge function tells us whether
      // templates were rolled back so we can reassure the user (or warn them
      // about manual cleanup).
      if (err instanceof CloseAiBuilderError) {
        const body = err.closeErrorBody as {
          rolled_back?: boolean;
          cleanup_failures?: unknown[];
        } | null;
        if (body?.rolled_back === false) {
          toast.error(
            `${err.message} — some templates could not be rolled back, check Close manually`,
          );
        } else {
          toast.error(err.message);
        }
        if (err.closeErrorBody) {
          console.error(
            "[close-ai-builder] close error body:",
            err.closeErrorBody,
          );
        }
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to save workflow",
        );
      }
    }
  };

  const handleReset = () => {
    setDraft(null);
    setGenerationId(null);
    setSavedSeqId(null);
  };

  const updateStep = (index: number, patch: Partial<GeneratedSequenceStep>) => {
    if (!draft) return;
    const nextSteps = [...draft.steps];
    nextSteps[index] = { ...nextSteps[index], ...patch };
    setDraft({ ...draft, steps: nextSteps });
  };

  const removeStep = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) });
  };

  const addStep = (kind: "email" | "sms") => {
    if (!draft) return;
    const lastDay = draft.steps.at(-1)?.day ?? 0;
    const newStep: GeneratedSequenceStep =
      kind === "email"
        ? {
            step_type: "email",
            day: lastDay + 2,
            generated_email: {
              name: `${draft.name} - Step ${draft.steps.length + 1}`,
              subject: "",
              body: "",
            },
            threading: "new_thread",
          }
        : {
            step_type: "sms",
            day: lastDay + 2,
            generated_sms: {
              name: `${draft.name} - Step ${draft.steps.length + 1}`,
              text: "",
            },
          };
    setDraft({ ...draft, steps: [...draft.steps, newStep] });
  };

  const stepCounts = useMemo(
    () => (draft ? countStepsByChannel(draft) : { emailCount: 0, smsCount: 0 }),
    [draft],
  );

  return (
    <div className="space-y-4">
      {/* "Triggers" clarification banner */}
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs dark:border-blue-900/50 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">
            How enrollment works:
          </span>{" "}
          Close workflows don't auto-trigger on events. After saving, subscribe
          leads from Close manually, from a Smart View, or via Bulk Enrollment.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Prompt + options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 text-violet-500" />
              Describe the workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="seq-prompt" className="text-xs">
                What should this workflow accomplish? *
              </Label>
              <Textarea
                id="seq-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. 5-touch sequence for new IUL leads who requested a quote but haven't booked a call. Progressively more direct, ending with a 'last call' touch."
                className="min-h-[120px] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="seq-audience" className="text-xs">
                  Audience
                </Label>
                <Input
                  id="seq-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="New IUL quote requests"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seq-tone" className="text-xs">
                  Tone
                </Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="seq-tone" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="empathetic">Empathetic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="seq-days" className="text-xs">
                  Duration (days)
                </Label>
                <Input
                  id="seq-days"
                  type="number"
                  min={1}
                  max={90}
                  value={totalDays}
                  onChange={(e) => setTotalDays(Number(e.target.value) || 14)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seq-touches" className="text-xs">
                  Touches
                </Label>
                <Input
                  id="seq-touches"
                  type="number"
                  min={1}
                  max={20}
                  value={touchCount}
                  onChange={(e) => setTouchCount(Number(e.target.value) || 5)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Channels</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={channels.includes("email") ? "default" : "outline"}
                  size="sm"
                  onClick={() => channelToggle("email")}
                  className="flex-1"
                >
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={channels.includes("sms") ? "default" : "outline"}
                  size="sm"
                  onClick={() => channelToggle("sms")}
                  className="flex-1"
                >
                  <MessageSquare className="mr-2 h-3.5 w-3.5" />
                  SMS
                </Button>
              </div>
            </div>

            {/* Fixed schedule info — not user-editable, same for every workflow */}
            <div className="space-y-1.5">
              <Label className="text-xs">Send window (fixed)</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{FIXED_SCHEDULE_LABEL}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {FIXED_TIMEZONE_LABEL}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="seq-runmode"
                  className="flex items-center gap-1.5 text-xs"
                >
                  Run mode
                  <span className="rounded bg-v2-card-tinted px-1 py-[1px] text-[9px] font-medium uppercase tracking-wide text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle">
                    copy hint
                  </span>
                </Label>
                <Select
                  value={runMode}
                  onValueChange={(v) => setRunMode(v as "once" | "multiple")}
                >
                  <SelectTrigger id="seq-runmode" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Run once per lead</SelectItem>
                    <SelectItem value="multiple">
                      Allow re-enrollment
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  Tunes AI copy. Set for real in Close after save (see banner
                  below).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seq-thread" className="text-xs">
                  Email threading
                </Label>
                <Select
                  value={threading}
                  onValueChange={(v) => setThreading(v as typeof threading)}
                >
                  <SelectTrigger id="seq-thread" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="old_thread">Reply-chain</SelectItem>
                    <SelectItem value="new_thread">New thread</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seq-constraints" className="text-xs">
                Extra constraints (optional)
              </Label>
              <Textarea
                id="seq-constraints"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g. Avoid premium talk. Mention case studies in touch 3."
                className="min-h-[50px] text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleGenerate}
                disabled={generate.isPending || !prompt.trim()}
                size="sm"
                className="flex-1"
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    Generate workflow
                  </>
                )}
              </Button>
              {draft && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generate.isPending}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview / editor */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Workflow plan</CardTitle>
              {savedSeqId && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                >
                  <Check className="mr-1 h-3 w-3" />
                  Saved
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!draft ? (
              <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-center">
                <p className="text-sm text-muted-foreground">
                  Generate a workflow to see the step plan here.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="seq-name" className="text-xs">
                    Workflow name
                  </Label>
                  <Input
                    id="seq-name"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>

                {draft.rationale && (
                  <div className="rounded-md border-l-2 border-emerald-500 bg-v2-canvas px-3 py-2 dark:border-emerald-400 dark:bg-v2-card/60">
                    <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-v2-ink-muted dark:text-v2-ink-subtle">
                      Strategy
                    </div>
                    <div className="text-xs leading-relaxed text-v2-ink dark:text-v2-ink">
                      {draft.rationale}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
                      Timeline · {draft.steps.length} step
                      {draft.steps.length !== 1 ? "s" : ""}
                    </Label>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      Day 1 = immediate on enrollment
                    </div>
                  </div>
                  <div className="space-y-2">
                    {draft.steps.map((step, i) => (
                      <StepCard
                        key={i}
                        index={i}
                        step={step}
                        previousDay={i > 0 ? draft.steps[i - 1].day : null}
                        onChange={(patch) => updateStep(i, patch)}
                        onRemove={() => removeStep(i)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addStep("email")}
                    disabled={!!savedSeqId}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addStep("sms")}
                    disabled={!!savedSeqId}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    SMS
                  </Button>
                </div>

                {/* Save-info banner: split into "auto" vs "manual" so users
                    know exactly what will and won't happen when they click save.
                    Run mode + pause-on-meeting-booked both require manual steps
                    in Close's UI because the public API doesn't expose them. */}
                <div className="space-y-2">
                  <div className="rounded-md border border-v2-ring bg-v2-canvas p-3 text-xs dark:border-v2-ring dark:bg-v2-card/60">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      Auto-configured on save
                    </div>
                    <ul className="space-y-1 text-v2-ink dark:text-v2-ink">
                      <li className="flex gap-2">
                        <span className="text-v2-ink-subtle">→</span>
                        <span>
                          {stepCounts.emailCount} email template
                          {stepCounts.emailCount !== 1 ? "s" : ""} +{" "}
                          {stepCounts.smsCount} SMS template
                          {stepCounts.smsCount !== 1 ? "s" : ""}, all prefixed
                          with{" "}
                          <code className="rounded bg-v2-ring px-1 text-[10px] dark:bg-v2-card-tinted">
                            [{draft.name || "workflow"}]
                          </code>
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-v2-ink-subtle">→</span>
                        <span>1 workflow · {FIXED_SCHEDULE_LABEL}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      Manual setup in Close after save
                    </div>
                    <ul className="space-y-1.5 text-amber-900 dark:text-amber-200">
                      <li className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        <span>
                          <strong className="font-semibold">Run mode</strong> (
                          {runMode === "once" ? "Run once" : "Run multiple"}) —
                          open the saved workflow in Close, click{" "}
                          <em>
                            Communication Settings → Recipient and schedule
                          </em>
                          , set Run Once / Run Multiple. Close's public API
                          doesn't expose this field, so it can't be set
                          automatically.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        <span>
                          <strong className="font-semibold">
                            Pause on meeting booked
                          </strong>{" "}
                          — configure a Close Workflow Rule to pause
                          subscriptions when lead status changes, or unenroll
                          manually when bookings come in.
                        </span>
                      </li>
                    </ul>
                  </div>

                  {savedSeqId && (
                    <a
                      href="https://app.close.com/sequences/"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                    >
                      <span>
                        Open workflow in Close to finish Run mode setup
                      </span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={save.isPending || !!savedSeqId}
                    size="sm"
                    className="flex-1"
                  >
                    {save.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Saving…
                      </>
                    ) : savedSeqId ? (
                      <>
                        <Check className="mr-2 h-3.5 w-3.5" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-3.5 w-3.5" />
                        Save workflow to Close
                      </>
                    )}
                  </Button>
                  {savedSeqId && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      New
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── StepCard (inline editor for a single sequence step) ──────────

function StepCard({
  index,
  step,
  previousDay,
  onChange,
  onRemove,
}: {
  index: number;
  step: GeneratedSequenceStep;
  previousDay: number | null;
  onChange: (patch: Partial<GeneratedSequenceStep>) => void;
  onRemove: () => void;
}) {
  const isEmail = step.step_type === "email";
  const gap = gapFromPrevious(step.day, previousDay);
  const gapLabel =
    previousDay == null
      ? "immediate on enrollment"
      : gap === 0
        ? "same day as previous"
        : `+${gap} day${gap !== 1 ? "s" : ""} after previous`;

  // Channel-specific color accents (kept within the muted zinc aesthetic —
  // just a single hue per channel for quick visual scanning).
  const accentBar = isEmail ? "bg-emerald-500" : "bg-sky-500";
  const iconColor = isEmail
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-sky-600 dark:text-sky-400";
  const channelLabelColor = isEmail
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-sky-700 dark:text-sky-300";

  return (
    <div className="relative overflow-hidden rounded-md border border-v2-ring bg-card shadow-sm dark:border-v2-ring">
      {/* Channel accent bar */}
      <div
        className={cn("absolute left-0 top-0 h-full w-[3px]", accentBar)}
        aria-hidden="true"
      />

      <div className="flex gap-3 p-3 pl-4">
        {/* Step number badge */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-v2-card-tinted text-xs font-semibold tabular-nums text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Header row: channel + day + gap + delete */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {isEmail ? (
                <Mail className={cn("h-4 w-4 shrink-0", iconColor)} />
              ) : (
                <MessageSquare className={cn("h-4 w-4 shrink-0", iconColor)} />
              )}
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  channelLabelColor,
                )}
              >
                {isEmail ? "Email" : "SMS"}
              </span>
              <span className="text-v2-ink-subtle dark:text-v2-ink">·</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Day</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={step.day}
                  onChange={(e) =>
                    onChange({
                      day: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="h-7 w-14 text-xs tabular-nums"
                  title="Day from sequence start (Day 1 = immediate)"
                />
              </div>
              <span className="truncate text-[11px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                {gapLabel}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              onClick={onRemove}
              title="Remove step"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Body */}
          {isEmail && step.generated_email && (
            <div className="space-y-1.5 border-t border-v2-ring pt-2 dark:border-v2-ring/80">
              <div className="space-y-0.5">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Template name
                </div>
                <Input
                  value={step.generated_email.name}
                  onChange={(e) =>
                    onChange({
                      generated_email: {
                        ...step.generated_email!,
                        name: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. Day 1 intro"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Subject
                </div>
                <Input
                  value={step.generated_email.subject}
                  onChange={(e) =>
                    onChange({
                      generated_email: {
                        ...step.generated_email!,
                        subject: e.target.value,
                      },
                    })
                  }
                  placeholder="Subject line"
                  className="h-8 text-sm font-medium"
                />
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Body
                </div>
                <Textarea
                  value={step.generated_email.body}
                  onChange={(e) =>
                    onChange({
                      generated_email: {
                        ...step.generated_email!,
                        body: e.target.value,
                      },
                    })
                  }
                  placeholder="Email body"
                  className="min-h-[110px] text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {!isEmail && step.generated_sms && (
            <div className="space-y-1.5 border-t border-v2-ring pt-2 dark:border-v2-ring/80">
              <div className="space-y-0.5">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Template name
                </div>
                <Input
                  value={step.generated_sms.name}
                  onChange={(e) =>
                    onChange({
                      generated_sms: {
                        ...step.generated_sms!,
                        name: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. Day 3 SMS nudge"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Message
                  </div>
                  <div
                    className={cn(
                      "text-[10px] tabular-nums",
                      step.generated_sms.text.length > 320
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.generated_sms.text.length}/320
                  </div>
                </div>
                <Textarea
                  value={step.generated_sms.text}
                  onChange={(e) =>
                    onChange({
                      generated_sms: {
                        ...step.generated_sms!,
                        text: e.target.value,
                      },
                    })
                  }
                  placeholder="SMS text"
                  className="min-h-[70px] text-xs leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
