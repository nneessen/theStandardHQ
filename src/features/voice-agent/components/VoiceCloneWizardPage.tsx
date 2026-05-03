import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useChatBotVoiceCloneStatus,
  useVoiceCloneSession,
  useCancelVoiceClone,
} from "@/features/chat-bot";
import { ConsentStep } from "./clone-wizard/ConsentStep";
import { ScriptEditorStep } from "./clone-wizard/ScriptEditorStep";
import { RecordingStep } from "./clone-wizard/RecordingStep";
import { ProcessingStep } from "./clone-wizard/ProcessingStep";
import { ResultStep } from "./clone-wizard/ResultStep";

type WizardStep = "consent" | "scripts" | "recording" | "processing" | "result";

const STEP_LABELS: { key: WizardStep; label: string }[] = [
  { key: "consent", label: "Consent" },
  { key: "scripts", label: "Scripts" },
  { key: "recording", label: "Record" },
  { key: "processing", label: "Process" },
  { key: "result", label: "Activate" },
];

const CLONE_SESSION_KEY = "voice_clone_session";

function saveCloneSession(cloneId: string) {
  try {
    localStorage.setItem(
      CLONE_SESSION_KEY,
      JSON.stringify({ cloneId, startedAt: Date.now() }),
    );
  } catch {
    // localStorage unavailable — non-critical
  }
}

function loadCloneSession(): string | null {
  try {
    const raw = localStorage.getItem(CLONE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cloneId: string; startedAt: number };
    // Expire after 7 days
    if (Date.now() - parsed.startedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CLONE_SESSION_KEY);
      return null;
    }
    return parsed.cloneId;
  } catch {
    return null;
  }
}

function clearCloneSession() {
  try {
    localStorage.removeItem(CLONE_SESSION_KEY);
  } catch {
    // noop
  }
}

export function VoiceCloneWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("consent");
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<"ready" | "failed">("ready");

  const cancelMutation = useCancelVoiceClone();

  // Fetch clone status to detect in-progress session
  const { data: cloneStatus, isLoading: statusLoading } =
    useChatBotVoiceCloneStatus();

  // Fetch session detail if we have a cloneId (for resume)
  const { data: sessionDetail } = useVoiceCloneSession(cloneId);

  // Resume logic: detect in-progress session on mount
  // Priority: backend inProgressCloneId > localStorage fallback
  useEffect(() => {
    if (!cloneStatus || cloneId) return;

    if (cloneStatus.inProgressCloneId) {
      setCloneId(cloneStatus.inProgressCloneId);
      saveCloneSession(cloneStatus.inProgressCloneId);
    } else {
      // Fallback: recover from localStorage if backend lost track
      const savedId = loadCloneSession();
      if (savedId) {
        setCloneId(savedId);
      }
    }
  }, [cloneStatus, cloneId]);

  // Once we have session detail, skip to the right step
  useEffect(() => {
    if (!sessionDetail || !cloneId) return;
    // Only auto-navigate on initial load, not during active use
    if (step !== "consent") return;

    switch (sessionDetail.status) {
      case "recording":
        setStep("scripts");
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
        clearCloneSession();
        void navigate({ to: "/voice-agent" });
        break;
    }
  }, [sessionDetail, cloneId, step, navigate]);

  const handleSessionStarted = useCallback((newCloneId: string) => {
    setCloneId(newCloneId);
    saveCloneSession(newCloneId);
    setStep("scripts");
  }, []);

  const handleScriptsContinue = useCallback(() => {
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
    clearCloneSession();
    void navigate({ to: "/voice-agent" });
  }, [navigate]);

  const handleRetry = useCallback(() => {
    clearCloneSession();
    setCloneId(null);
    setStep("consent");
  }, []);

  const handleCancelClone = useCallback(() => {
    if (!cloneId) return;
    if (
      !window.confirm(
        "Cancel this voice clone session? Your recordings will be lost.",
      )
    )
      return;
    cancelMutation.mutate(cloneId, {
      onSuccess: () => {
        clearCloneSession();
        void navigate({ to: "/voice-agent" });
      },
    });
  }, [cloneId, cancelMutation, navigate]);

  const currentStepIndex = STEP_LABELS.findIndex((s) => s.key === step);
  const showCancelButton = cloneId && step !== "consent" && step !== "result";

  if (statusLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white dark:bg-v2-canvas">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-v2-ring px-4 py-2.5 dark:border-v2-ring">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-v2-ink-muted"
          onClick={() => navigate({ to: "/voice-agent" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[13px] font-semibold text-v2-ink dark:text-v2-ink">
          Voice Clone Recording
        </h1>

        {/* Cancel clone button */}
        {showCancelButton && (
          <button
            type="button"
            onClick={handleCancelClone}
            disabled={cancelMutation.isPending}
            className="ml-2 text-[10px] text-v2-ink-subtle hover:text-destructive dark:text-v2-ink-muted dark:hover:text-destructive transition-colors"
          >
            {cancelMutation.isPending ? (
              "Canceling..."
            ) : (
              <span className="flex items-center gap-0.5">
                <X className="h-3 w-3" />
                Cancel Clone
              </span>
            )}
          </button>
        )}

        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          {STEP_LABELS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                  i < currentStepIndex
                    ? "bg-success/20 text-success dark:bg-success/20 dark:text-success"
                    : i === currentStepIndex
                      ? "bg-info/20 text-info dark:bg-info/10/40 dark:text-info"
                      : "bg-v2-card-tinted text-v2-ink-subtle dark:bg-v2-card-tinted dark:text-v2-ink-muted",
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-[10px] sm:inline",
                  i === currentStepIndex
                    ? "font-medium text-v2-ink dark:text-v2-ink"
                    : "text-v2-ink-subtle dark:text-v2-ink-muted",
                )}
              >
                {s.label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div className="mx-0.5 h-px w-4 bg-v2-ring dark:bg-v2-ring-strong" />
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

        {step === "scripts" && (
          <ScriptEditorStep onContinue={handleScriptsContinue} />
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
