// src/features/recruiting/components/PostAddRecruitWizard.tsx
// Shows AFTER a recruit is successfully added. Walks the user through:
//   1. Picking a pipeline template (or skipping)
//   2. Explaining the two Slack notification buttons (and optionally posting "new recruit" now)
//   3. Recap + handoff to the recruit's profile

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
  ArrowLeft,
  ArrowRight,
  Check,
  Hash,
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
import { filterUserSelectableTemplates } from "../utils/template-filters";
import { useInitializeRecruitProgress } from "../hooks/useRecruitProgress";
import { useCurrentUserProfile } from "@/hooks/admin";
import {
  buildNewRecruitMessage,
  findRecruitChannel,
  findRecruitIntegration,
  useSendRecruitSlackNotification,
  useSlackChannelsById,
  useSlackIntegrations,
} from "@/hooks/slack";
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

type Step = 1 | 2 | 3;

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
  const [slackPosted, setSlackPosted] = useState(false);

  const { data: allTemplates, isLoading: templatesLoading } = useTemplates();
  const initializeProgress = useInitializeRecruitProgress();

  const { data: currentUserProfile } = useCurrentUserProfile();
  const isSuperAdmin = currentUserProfile?.is_super_admin === true;
  // Only the two DEFAULT-named templates are user-pickable; everything else is
  // legacy / system-only and stays hidden from the picker. Super-admins see
  // every template.
  const templates = useMemo(
    () =>
      filterUserSelectableTemplates(allTemplates, { includeAll: isSuperAdmin }),
    [allTemplates, isSuperAdmin],
  );
  const { data: slackIntegrations = [] } = useSlackIntegrations();
  const recruitIntegration = findRecruitIntegration(slackIntegrations);
  const { data: slackChannels = [] } = useSlackChannelsById(
    recruitIntegration?.id,
  );
  const recruitChannel = findRecruitChannel(recruitIntegration, slackChannels);
  const sendSlack = useSendRecruitSlackNotification();
  const slackReady = !!recruitIntegration && !!recruitChannel;

  // Default to the "default" template once templates load. For an already-
  // licensed recruit, prefer the DEFAULT Licensed Agent Pipeline; otherwise
  // prefer the DEFAULT Non-Licensed Recruit Pipeline.
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      const licensedTpl = templates.find((t) =>
        t.name.toLowerCase().includes("licensed agent"),
      );
      const nonLicensedTpl = templates.find((t) =>
        t.name.toLowerCase().includes("non-licensed"),
      );
      const preferred = isLicensed ? licensedTpl : nonLicensedTpl;
      const flagged = templates.find((t) => t.is_default);
      setSelectedTemplateId(preferred?.id ?? flagged?.id ?? templates[0].id);
    }
  }, [templates, selectedTemplateId, isLicensed]);

  // Reset on each open so re-adding multiple recruits works clean.
  useEffect(() => {
    if (open) {
      setStep(1);
      setPipelineSkipped(skippedPipeline);
      setEnrolledTemplateName(null);
      setSlackPosted(false);
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

  const handlePostSlackNow = async () => {
    if (!recruitId || !slackReady || !currentUserProfile?.imo_id) return;
    const msg = buildNewRecruitMessage({
      first_name: recruitName.split(" ")[0] ?? recruitName,
      last_name: recruitName.split(" ").slice(1).join(" ") || null,
      email: null,
      upline_name: null,
    });
    try {
      await sendSlack.mutateAsync({
        integrationId: recruitIntegration!.id,
        channelId: recruitChannel!.id,
        text: msg.text,
        blocks: msg.blocks,
        notificationType: "new_recruit",
        recruitId,
        imoId: currentUserProfile.imo_id,
      });
      setSlackPosted(true);
    } catch (err) {
      console.error("[PostAddRecruitWizard] slack send failed", err);
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
            <Step2Slack
              recruitName={recruitName}
              isLicensed={isLicensed}
              slackReady={slackReady}
              slackPosted={slackPosted}
              slackPending={sendSlack.isPending}
              onPostNow={handlePostSlackNow}
            />
          )}
          {step === 3 && (
            <Step3Done
              recruitName={recruitName}
              isLicensed={isLicensed}
              pipelineRecap={finalRecapPipeline}
              slackPosted={slackPosted}
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
            {step > 1 && step < 3 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => setStep((s) => (s - 1) as Step)}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back
              </Button>
            )}
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
                onClick={() => setStep(3)}
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
            {step === 3 && (
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
    { id: 2, label: "Slack" },
    { id: 3, label: "Done" },
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
          You can still send Slack notifications and manage them like any other
          user — that&apos;s up next.
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

// ─── Step 2: Slack ──────────────────────────────────────────────────────

function Step2Slack({
  recruitName,
  isLicensed,
  slackReady,
  slackPosted,
  slackPending,
  onPostNow,
}: {
  recruitName: string;
  isLicensed: boolean;
  slackReady: boolean;
  slackPosted: boolean;
  slackPending: boolean;
  onPostNow: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Hash className="h-4 w-4 text-foreground" />
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
            Tell your team in Slack
          </h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          On {recruitName.split(" ")[0] || "their"}&apos;s profile you&apos;ll
          see two Slack buttons under <strong>Actions → Communications</strong>.
          Here&apos;s when to use each one:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Slack: new recruit */}
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-6 w-6 rounded-md bg-info/10 text-info ring-1 ring-info/30 items-center justify-center">
                <Hash className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12px] font-semibold text-foreground">
                Slack: new recruit
              </span>
            </div>
            {slackPosted && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 bg-success/10 text-success border-success/40"
              >
                <Check className="h-2.5 w-2.5 mr-0.5" />
                Sent
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Click this to <strong>announce a new recruit</strong> in your
            recruiting Slack channel. Post it now even if they aren&apos;t
            licensed yet — it just lets the team know someone joined the
            pipeline.
          </p>
          {slackReady ? (
            <Button
              size="sm"
              variant={slackPosted ? "outline" : "default"}
              className="h-7 text-[11px] mt-auto"
              disabled={slackPosted || slackPending}
              onClick={onPostNow}
            >
              {slackPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Posting…
                </>
              ) : slackPosted ? (
                <>
                  <Check className="h-3 w-3 mr-1.5" />
                  Posted to Slack
                </>
              ) : (
                <>
                  <Hash className="h-3 w-3 mr-1.5" />
                  Post to Slack now
                </>
              )}
            </Button>
          ) : (
            <Link
              to="/settings"
              className="mt-auto inline-flex items-center justify-center gap-1.5 h-7 text-[11px] rounded-md border border-warning/40 text-warning hover:bg-warning/10 px-2"
            >
              Set up Slack in Settings
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Slack: NPN */}
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-6 w-6 rounded-md bg-success/10 text-success ring-1 ring-success/30 items-center justify-center">
                <Hash className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12px] font-semibold text-foreground">
                Slack: NPN
              </span>
            </div>
            {isLicensed && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 bg-success/10 text-success border-success/40"
              >
                NPN ready
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Click this <strong>once they get their NPN</strong> (National
            Producer Number). Announces they&apos;re licensed and ready to write
            business.{" "}
            <strong>Requires NPN to be set on their profile first</strong> —
            until then this button is disabled.
          </p>
          <div className="mt-auto text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
            {isLicensed
              ? "Available from their profile"
              : "Available once NPN is added"}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        Both buttons post once per recruit — they flip to a green &ldquo;Sent ✓
        &rdquo; state after firing.
      </p>
    </div>
  );
}

// ─── Step 3: Done / handoff ─────────────────────────────────────────────

function Step3Done({
  recruitName,
  isLicensed,
  pipelineRecap,
  slackPosted,
}: {
  recruitName: string;
  isLicensed: boolean;
  pipelineRecap: string | null;
  slackPosted: boolean;
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
        {slackPosted && (
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-2 bg-info/10 text-info border-info/40"
          >
            <Hash className="h-3 w-3 mr-1" />
            Slack: new recruit posted
          </Badge>
        )}
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
          {!isLicensed && (
            <DoneLine
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Add NPN, then post the NPN announcement"
              hint="Edit NPN inline on the profile to unlock the Slack: NPN button"
            />
          )}
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
