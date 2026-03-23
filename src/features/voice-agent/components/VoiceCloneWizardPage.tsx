import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useChatBotVoiceCloneStatus,
  useVoiceCloneSession,
} from "@/features/chat-bot";
import { ConsentStep } from "./clone-wizard/ConsentStep";
import { RecordingStep } from "./clone-wizard/RecordingStep";
import { ProcessingStep } from "./clone-wizard/ProcessingStep";
import { ResultStep } from "./clone-wizard/ResultStep";

type WizardStep = "consent" | "recording" | "processing" | "result";

const STEP_LABELS: { key: WizardStep; label: string }[] = [
  { key: "consent", label: "Consent" },
  { key: "recording", label: "Record" },
  { key: "processing", label: "Process" },
  { key: "result", label: "Activate" },
];

export function VoiceCloneWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("consent");
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<"ready" | "failed">("ready");

  // Fetch clone status to detect in-progress session
  const { data: cloneStatus, isLoading: statusLoading } =
    useChatBotVoiceCloneStatus();

  // Fetch session detail if we have a cloneId (for resume)
  const { data: sessionDetail } = useVoiceCloneSession(cloneId);

  // Resume logic: detect in-progress session on mount
  useEffect(() => {
    if (!cloneStatus || cloneId) return;

    if (cloneStatus.inProgressCloneId) {
      setCloneId(cloneStatus.inProgressCloneId);
    }
  }, [cloneStatus, cloneId]);

  // Once we have session detail, skip to the right step
  useEffect(() => {
    if (!sessionDetail || !cloneId) return;
    // Only auto-navigate on initial load, not during active use
    if (step !== "consent") return;

    switch (sessionDetail.status) {
      case "recording":
        setStep("recording");
        break;
      case "processing":
        setStep("processing");
        break;
      case "ready":
        setResultStatus("ready");
        setStep("result");
        break;
      case "failed":
        setResultStatus("failed");
        setStep("result");
        break;
      case "active":
        // Already active — go back to voice agent page
        void navigate({ to: "/voice-agent" });
        break;
    }
  }, [sessionDetail, cloneId, step, navigate]);

  const handleSessionStarted = useCallback((newCloneId: string) => {
    setCloneId(newCloneId);
    setStep("recording");
  }, []);

  const handleReadyToSubmit = useCallback(() => {
    setStep("processing");
  }, []);

  const handleProcessingComplete = useCallback((status: "ready" | "failed") => {
    setResultStatus(status);
    setStep("result");
  }, []);

  const handleActivated = useCallback(() => {
    void navigate({ to: "/voice-agent" });
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setCloneId(null);
    setStep("consent");
  }, []);

  const currentStepIndex = STEP_LABELS.findIndex((s) => s.key === step);

  if (statusLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-zinc-500"
          onClick={() => navigate({ to: "/voice-agent" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
          Voice Clone Recording
        </h1>

        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          {STEP_LABELS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                  i < currentStepIndex
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : i === currentStepIndex
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-[10px] sm:inline",
                  i === currentStepIndex
                    ? "font-medium text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-500",
                )}
              >
                {s.label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div className="mx-0.5 h-px w-4 bg-zinc-200 dark:bg-zinc-700" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-hidden">
        {step === "consent" && (
          <div className="flex h-full items-center justify-center p-4">
            <ConsentStep
              remainingAttempts={cloneStatus?.remainingAttempts ?? 0}
              onSessionStarted={handleSessionStarted}
            />
          </div>
        )}

        {step === "recording" && cloneId && (
          <RecordingStep
            cloneId={cloneId}
            onReadyToSubmit={handleReadyToSubmit}
          />
        )}

        {step === "processing" && cloneId && (
          <ProcessingStep
            cloneId={cloneId}
            onComplete={handleProcessingComplete}
          />
        )}

        {step === "result" && cloneId && (
          <ResultStep
            cloneId={cloneId}
            status={resultStatus}
            remainingAttempts={cloneStatus?.remainingAttempts ?? 0}
            onActivated={handleActivated}
            onRetry={handleRetry}
          />
        )}
      </div>
    </div>
  );
}
