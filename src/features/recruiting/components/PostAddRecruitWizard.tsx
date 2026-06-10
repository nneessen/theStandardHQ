// src/features/recruiting/components/PostAddRecruitWizard.tsx
// Shows AFTER a recruit is successfully added. Walks the user through:
//   1. Picking a pipeline template (or skipping)
//   2. Recap + handoff to the recruit's profile

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowRight,
  Check,
  ListChecks,
  Loader2,
  Mail,
  PartyPopper,
  SkipForward,
  Slash,
  Upload,
  Workflow,
} from "lucide-react";
import { useTemplates } from "../hooks/usePipeline";
import {
  filterUserSelectableTemplates,
  selectDefaultRecruitTemplate,
} from "../utils/template-filters";
import { useInitializeRecruitProgress } from "../hooks/useRecruitProgress";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { PipelineTemplate } from "@/types/recruiting.types";

interface PostAddRecruitWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitId: string | null;
  recruitName: string;
  isLicensed: boolean;
  /** Pipeline step is auto-skipped when the recruit was created with skip_pipeline (admin/office staff). */
  skippedPipeline?: boolean;
  /** Called when the user finishes the wizard and wants to navigate to the recruit's profile. */
  onComplete: () => void;
}

type Step = 1 | 2;

export function PostAddRecruitWizard({
  open,
  onOpenChange,
  recruitId,
  recruitName,
  isLicensed,
  skippedPipeline = false,
  onComplete,
}: PostAddRecruitWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [pipelineSkipped, setPipelineSkipped] = useState(skippedPipeline);
  const [enrolledTemplateName, setEnrolledTemplateName] = useState<
    string | null
  >(null);

  const { data: allTemplates, isLoading: templatesLoading } = useTemplates();
  const initializeProgress = useInitializeRecruitProgress();

  // Only the two DEFAULT-named templates are user-pickable; everything else is
  // legacy / system-only and stays hidden from the picker.
  const templates = useMemo(
    () => filterUserSelectableTemplates(allTemplates, { includeAll: false }),
    [allTemplates],
  );

  // Default to the "default" template once templates load. For an already-
  // licensed recruit, prefer the DEFAULT Licensed Agent Pipeline; otherwise
  // prefer the DEFAULT Non-Licensed Recruit Pipeline.
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      const template = selectDefaultRecruitTemplate(templates, isLicensed);
      if (template) setSelectedTemplateId(template.id);
    }
  }, [templates, selectedTemplateId, isLicensed]);

  // Reset on each open so re-adding multiple recruits works clean.
  useEffect(() => {
    if (open) {
      setStep(1);
      setPipelineSkipped(skippedPipeline);
      setEnrolledTemplateName(null);
    }
  }, [open, skippedPipeline]);

  const noTemplates = !templatesLoading && templates.length === 0;

  const handleContinueFromStep1 = async () => {
    if (skippedPipeline) {
      // Admin/office-staff recruits are intentionally out of the pipeline.
      setStep(2);
      return;
    }
    if (pipelineSkipped || noTemplates || !recruitId || !selectedTemplateId) {
      setStep(2);
      return;
    }
    try {
      await initializeProgress.mutateAsync({
        userId: recruitId,
        templateId: selectedTemplateId,
      });
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      setEnrolledTemplateName(tpl?.name ?? null);
      setStep(2);
    } catch (err) {
      // Hook fires its own toast on error
      console.error("[PostAddRecruitWizard] initialize failed", err);
    }
  };

  const finalRecapPipeline = useMemo(() => {
    if (skippedPipeline) return "Skipped pipeline (admin / office staff)";
    if (pipelineSkipped)
      return "Not enrolled yet — initialize from their profile";
    if (enrolledTemplateName) return `Enrolled in ${enrolledTemplateName}`;
    return null;
  }, [skippedPipeline, pipelineSkipped, enrolledTemplateName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header w/ step indicator */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-foreground" />
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              Recruit added · Next steps
            </span>
          </div>
          <DialogTitle className="text-base font-semibold tracking-tight text-foreground mt-1">
            Let&apos;s get {recruitName || "your recruit"} set up
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            Two quick things to know before you head to their profile.
          </DialogDescription>
          <StepIndicator current={step} skippedPipeline={skippedPipeline} />
        </DialogHeader>

        {/* Step body */}
        <div className="px-6 py-5 min-h-[320px]">
          {step === 1 && (
            <Step1Pipeline
              templates={templates}
              templatesLoading={templatesLoading}
              selectedTemplateId={selectedTemplateId}
              setSelectedTemplateId={setSelectedTemplateId}
              pipelineSkipped={pipelineSkipped}
              setPipelineSkipped={setPipelineSkipped}
              noTemplates={noTemplates}
              recruitName={recruitName}
              isLicensed={isLicensed}
              forceSkipped={skippedPipeline}
            />
          )}
          {step === 2 && (
            <Step2Done
              recruitName={recruitName}
              isLicensed={isLicensed}
              pipelineRecap={finalRecapPipeline}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              onOpenChange(false);
              onComplete();
            }}
          >
            <SkipForward className="h-3.5 w-3.5 mr-1.5" />
            Skip — open profile
          </Button>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <Button
                size="sm"
                className="h-8 text-[11px]"
                onClick={handleContinueFromStep1}
                disabled={initializeProgress.isPending}
              >
                {initializeProgress.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : null}
                Continue
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
            {step === 2 && (
              <Button
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => {
                  onOpenChange(false);
                  onComplete();
                }}
              >
                Open {recruitName.split(" ")[0] || "their"}&apos;s profile
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step indicator ─────────────────────────────────────────────────────

function StepIndicator({
  current,
  skippedPipeline,
}: {
  current: Step;
  skippedPipeline: boolean;
}) {
  const steps: { id: Step; label: string }[] = [
    { id: 1, label: skippedPipeline ? "Pipeline (skipped)" : "Pipeline" },
    { id: 2, label: "Done" },
  ];
  return (
    <ol className="mt-3 flex items-center gap-2">
      {steps.map((s, idx) => {
        const isCurrent = s.id === current;
        const isComplete = s.id < current;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono font-semibold ring-1",
                isComplete && "bg-success text-success-foreground ring-success",
                isCurrent &&
                  !isComplete &&
                  "bg-foreground text-background ring-foreground",
                !isCurrent &&
                  !isComplete &&
                  "bg-background text-muted-foreground ring-border",
              )}
            >
              {isComplete ? <Check className="h-3 w-3" /> : s.id}
            </span>
            <span
              className={cn(
                "text-[10px] uppercase tracking-[0.16em] font-semibold",
                isCurrent ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <span className="h-px w-6 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step 1: Pipeline pick ──────────────────────────────────────────────

function Step1Pipeline({
  templates,
  templatesLoading,
  selectedTemplateId,
  setSelectedTemplateId,
  pipelineSkipped,
  setPipelineSkipped,
  noTemplates,
  recruitName,
  isLicensed,
  forceSkipped,
}: {
  templates: PipelineTemplate[];
  templatesLoading: boolean;
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string) => void;
  pipelineSkipped: boolean;
  setPipelineSkipped: (b: boolean) => void;
  noTemplates: boolean;
  recruitName: string;
  isLicensed: boolean;
  forceSkipped: boolean;
}) {
  if (forceSkipped) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-2">
          <Slash className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
            Pipeline skipped
          </h3>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          You added <strong>{recruitName}</strong> as admin / office staff, so
          they&apos;re intentionally not on the recruiting pipeline. They
          won&apos;t appear in pipeline reports or get phase-based reminders.
        </p>
        <p className="text-[12px] text-muted-foreground">
          You can still manage them like any other user from their profile.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <ListChecks className="h-4 w-4 text-foreground" />
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
            Pick a pipeline for {recruitName}
          </h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          A <strong>pipeline</strong> is the set of phases your recruit moves
          through — usually something like{" "}
          <em>Onboarding → Pre-Contract → Licensed → Writing</em>. Picking one
          turns on phase tracking, task checklists, and progress reporting for
          this person.
          {isLicensed && (
            <>
              {" "}
              Since they&apos;re already licensed, the pipeline will skip the
              licensing phase automatically.
            </>
          )}
        </p>
      </div>

      {templatesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : noTemplates ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
          <p className="text-[12px] font-medium text-foreground">
            No pipeline templates yet
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Create one in{" "}
            <Link
              to="/recruiting/admin/pipelines"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Pipeline Admin
            </Link>{" "}
            so future recruits can be enrolled automatically.
          </p>
        </div>
      ) : (
        <RadioGroup
          value={pipelineSkipped ? "__skip__" : (selectedTemplateId ?? "")}
          onValueChange={(value) => {
            if (value === "__skip__") {
              setPipelineSkipped(true);
            } else {
              setPipelineSkipped(false);
              setSelectedTemplateId(value);
            }
          }}
          className="space-y-2"
        >
          {templates.map((template) => {
            const isSelected =
              !pipelineSkipped && selectedTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  setPipelineSkipped(false);
                  setSelectedTemplateId(template.id);
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                  isSelected
                    ? "border-foreground bg-accent"
                    : "border-border hover:border-foreground/30 hover:bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/50",
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </span>
                <RadioGroupItem
                  value={template.id}
                  id={`pipeline-${template.id}`}
                  className="sr-only"
                />
                <Label
                  htmlFor={`pipeline-${template.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-foreground">
                      {template.name}
                    </span>
                    {template.is_default && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1.5"
                      >
                        Default
                      </Badge>
                    )}
                  </div>
                  {template.description && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </Label>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setPipelineSkipped(true)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
              pipelineSkipped
                ? "border-foreground bg-accent"
                : "border-dashed border-border hover:border-foreground/30 hover:bg-accent/50",
            )}
          >
            <span
              className={cn(
                "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                pipelineSkipped
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/50",
              )}
            >
              {pipelineSkipped && <Check className="h-2.5 w-2.5" />}
            </span>
            <RadioGroupItem
              value="__skip__"
              id="pipeline-skip"
              className="sr-only"
            />
            <Label
              htmlFor="pipeline-skip"
              className="flex-1 cursor-pointer text-[12px] text-muted-foreground"
            >
              <span className="font-medium text-foreground">
                Don&apos;t enroll right now
              </span>{" "}
              · I&apos;ll initialize the pipeline later from their profile
            </Label>
          </button>
        </RadioGroup>
      )}
    </div>
  );
}

// ─── Step 2: Done / handoff ─────────────────────────────────────────────

function Step2Done({
  recruitName,
  isLicensed,
  pipelineRecap,
}: {
  recruitName: string;
  isLicensed: boolean;
  pipelineRecap: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <PartyPopper className="h-5 w-5 text-success" />
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {recruitName || "Your recruit"} is all set
        </h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {pipelineRecap && (
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-2 bg-card border-border text-foreground"
          >
            <ListChecks className="h-3 w-3 mr-1" />
            {pipelineRecap}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] h-5 px-2",
            isLicensed
              ? "bg-success/10 text-success border-success/40"
              : "bg-warning/10 text-warning border-warning/40",
          )}
        >
          {isLicensed ? "Licensed" : "Unlicensed"}
        </Badge>
      </div>

      <div>
        <p className="text-[12px] text-muted-foreground mb-2">
          Next, on their profile you can:
        </p>
        <ul className="space-y-1.5">
          <DoneLine
            icon={<Upload className="h-3.5 w-3.5" />}
            label="Upload documents"
            hint="W-9, license copy, signed agreements"
          />
          <DoneLine
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Send email or SMS"
            hint="From the Communications card on their profile"
          />
          <DoneLine
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            label="Advance them through phases"
            hint="As they finish tasks in the current phase"
          />
        </ul>
      </div>
    </div>
  );
}

function DoneLine({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
    </li>
  );
}

export default PostAddRecruitWizard;
