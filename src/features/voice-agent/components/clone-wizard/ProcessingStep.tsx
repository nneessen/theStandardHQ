import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useSubmitVoiceClone, useVoiceCloneSession } from "@/features/chat-bot";

interface ProcessingStepProps {
  cloneId: string;
  onComplete: (status: "ready" | "failed") => void;
}

export function ProcessingStep({ cloneId, onComplete }: ProcessingStepProps) {
  const submitMutation = useSubmitVoiceClone();
  const { data: session } = useVoiceCloneSession(cloneId);
  const submittedRef = useRef(false);

  // Submit on mount if session is still in "recording" status
  useEffect(() => {
    if (submittedRef.current) return;
    if (!session) return;

    if (session.status === "recording") {
      submittedRef.current = true;
      submitMutation.mutate(cloneId);
    } else if (session.status === "processing") {
      submittedRef.current = true; // Already submitted, just wait
    }
  }, [session, cloneId, submitMutation]);

  // Watch for status transition to ready/failed
  useEffect(() => {
    if (session?.status === "ready" || session?.status === "failed") {
      onComplete(session.status);
    }
  }, [session?.status, onComplete]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-500" />
      <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
        Processing Your Voice Clone
      </h3>
      <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
        Your recordings are being analyzed and processed to create your custom
        AI voice. This typically takes 5-15 minutes.
      </p>
      {session && (
        <p className="mt-3 text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {session.completedSegments} segments |{" "}
          {session.totalAudioMinutes.toFixed(1)} minutes of audio
        </p>
      )}
      {submitMutation.isError && (
        <p className="mt-4 text-[11px] text-red-600 dark:text-red-400">
          {submitMutation.error.message}
        </p>
      )}
    </div>
  );
}
