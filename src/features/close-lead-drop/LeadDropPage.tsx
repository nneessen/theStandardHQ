// src/features/close-lead-drop/LeadDropPage.tsx
// Lead Drop wizard: bulk-transfer leads from the user's Close CRM to a teammate's.
//
// Tabs: Drop (wizard) | History
// Wizard steps: smart-view → preview → configure → confirm → progress → results

import { useState } from "react";
import { Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCloseAiConnectionStatus,
  NotConnectedPrompt,
} from "@/features/close-ai-builder";
import { SmartViewStep } from "./components/SmartViewStep";
import { LeadPreviewStep } from "./components/LeadPreviewStep";
import { ConfigureStep } from "./components/ConfigureStep";
import { ConfirmStep } from "./components/ConfirmStep";
import { ProgressStep } from "./components/ProgressStep";
import { ResultsStep } from "./components/ResultsStep";
import { HistoryTab } from "./components/HistoryTab";
import {
  useCreateLeadDrop,
  useInvalidateLeadDropHistory,
  useLeadDropJobStatus,
} from "./hooks/useLeadDrop";
import type {
  DropJob,
  DropRecipient,
  LeadPreviewItem,
  RecipientSequence,
  SmartView,
  WizardStep,
} from "./types/lead-drop.types";

// ─── Wizard step breadcrumb labels ────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  "smart-view": "Smart View",
  preview: "Preview",
  configure: "Configure",
  confirm: "Confirm",
  progress: "Dropping",
  results: "Complete",
};

const WIZARD_STEPS: WizardStep[] = [
  "smart-view",
  "preview",
  "configure",
  "confirm",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadDropPage() {
  const { data: connection, isLoading } = useCloseAiConnectionStatus();

  // Wizard state
  const [step, setStep] = useState<WizardStep>("smart-view");
  const [smartView, setSmartView] = useState<SmartView | null>(null);
  const [allLeads, setAllLeads] = useState<LeadPreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recipient, setRecipient] = useState<DropRecipient | null>(null);
  const [leadSourceLabel, setLeadSourceLabel] = useState("");
  const [sequence, setSequence] = useState<RecipientSequence | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<DropJob | null>(null);

  const createDrop = useCreateLeadDrop();
  const invalidateHistory = useInvalidateLeadDropHistory();
  const { data: jobStatusData } = useLeadDropJobStatus(
    step === "progress" ? jobId : null,
  );

  // ── Lead preview handlers ───────────────────────────────────────────────────

  function handleLeadsLoaded(newLeads: LeadPreviewItem[]) {
    setAllLeads((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const fresh = newLeads.filter((l) => !existingIds.has(l.id));
      return [...prev, ...fresh];
    });
    // Auto-select newly loaded leads
    setSelectedIds((prev) => {
      const next = new Set(prev);
      newLeads.forEach((l) => next.add(l.id));
      return next;
    });
  }

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(allLeads.map((l) => l.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  // ── Drop submission ─────────────────────────────────────────────────────────

  async function handleConfirmDrop() {
    if (!smartView || !recipient || !leadSourceLabel.trim()) return;

    try {
      const { job_id } = await createDrop.mutateAsync({
        smartViewId: smartView.id,
        smartViewName: smartView.name,
        leadIds: Array.from(selectedIds),
        recipientUserId: recipient.id,
        leadSourceLabel: leadSourceLabel.trim(),
        sequenceId: sequence?.id,
        sequenceName: sequence?.name,
      });
      setJobId(job_id);
      setStep("progress");
    } catch {
      // Error is handled by mutation state
    }
  }

  // ── Progress → results transition ──────────────────────────────────────────

  function handleProgressComplete() {
    const job = jobStatusData?.job;
    if (job) {
      setCompletedJob(job as DropJob);
      setStep("results");
      // History tab should reflect the newly completed job.
      invalidateHistory();
    }
  }

  // ── Reset for a new drop ────────────────────────────────────────────────────

  function handleNewDrop() {
    setStep("smart-view");
    setSmartView(null);
    setAllLeads([]);
    setSelectedIds(new Set());
    setRecipient(null);
    setLeadSourceLabel("");
    setSequence(null);
    setJobId(null);
    setCompletedJob(null);
    createDrop.reset();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-2">
          <Zap className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Lead Drop</h1>
          <p className="text-xs text-muted-foreground">
            Bulk-transfer leads from your Close CRM to a teammate's — with Smart
            View auto-created on delivery
          </p>
        </div>
      </div>

      {/* Not connected guard */}
      {!isLoading && !connection?.connected && <NotConnectedPrompt />}

      {connection?.connected && (
        <Tabs defaultValue="drop" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800/70">
            <TabsTrigger value="drop" className="text-xs">
              Drop
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
            </TabsTrigger>
          </TabsList>

          {/* ── Drop tab (wizard) ────────────────────────────────────── */}
          <TabsContent value="drop">
            <div className="border rounded-xl p-5 space-y-5 bg-card">
              {/* Step breadcrumb */}
              {step !== "progress" && step !== "results" && (
                <div className="flex items-center gap-1">
                  {WIZARD_STEPS.map((s, i) => (
                    <span key={s} className="flex items-center gap-1">
                      <span
                        className={[
                          "text-[10px] font-medium",
                          s === step
                            ? "text-foreground"
                            : WIZARD_STEPS.indexOf(step) > i
                              ? "text-green-500"
                              : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {STEP_LABELS[s]}
                      </span>
                      {i < WIZARD_STEPS.length - 1 && (
                        <span className="text-[10px] text-muted-foreground">
                          ›
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Step: Smart View */}
              {step === "smart-view" && (
                <SmartViewStep
                  selected={smartView}
                  onSelect={setSmartView}
                  onNext={() => {
                    setAllLeads([]);
                    setSelectedIds(new Set());
                    setStep("preview");
                  }}
                />
              )}

              {/* Step: Preview */}
              {step === "preview" && smartView && (
                <LeadPreviewStep
                  smartView={smartView}
                  allLeads={allLeads}
                  selectedIds={selectedIds}
                  onLeadsLoaded={handleLeadsLoaded}
                  onToggle={handleToggle}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  onNext={() => setStep("configure")}
                  onBack={() => setStep("smart-view")}
                />
              )}

              {/* Step: Configure */}
              {step === "configure" && (
                <ConfigureStep
                  recipient={recipient}
                  leadSourceLabel={leadSourceLabel}
                  sequence={sequence}
                  selectedCount={selectedIds.size}
                  onRecipientChange={setRecipient}
                  onLeadSourceChange={setLeadSourceLabel}
                  onSequenceChange={setSequence}
                  onNext={() => setStep("confirm")}
                  onBack={() => setStep("preview")}
                />
              )}

              {/* Step: Confirm */}
              {step === "confirm" && smartView && recipient && (
                <ConfirmStep
                  smartView={smartView}
                  selectedCount={selectedIds.size}
                  recipient={recipient}
                  leadSourceLabel={leadSourceLabel}
                  sequence={sequence}
                  isDropping={createDrop.isPending}
                  onConfirm={handleConfirmDrop}
                  onBack={() => setStep("configure")}
                />
              )}

              {/* Step: Progress */}
              {step === "progress" && jobId && (
                <ProgressStep
                  jobId={jobId}
                  totalLeads={selectedIds.size}
                  onComplete={handleProgressComplete}
                />
              )}

              {/* Step: Results */}
              {step === "results" && completedJob && (
                <ResultsStep job={completedJob} onNewDrop={handleNewDrop} />
              )}

              {/* Drop mutation error (if create_drop_job itself fails) */}
              {createDrop.isError && step === "confirm" && (
                <p className="text-xs text-destructive text-center">
                  {createDrop.error?.message ??
                    "Failed to start drop. Please try again."}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── History tab ───────────────────────────────────────────── */}
          <TabsContent value="history">
            <div className="border rounded-xl p-4 bg-card">
              <HistoryTab />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
