import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActivateVoiceClone } from "@/features/chat-bot";

interface ResultStepProps {
  cloneId: string;
  status: "ready" | "failed";
  remainingAttempts: number;
  onActivated: () => void;
  onRetry: () => void;
}

export function ResultStep({
  cloneId,
  status,
  remainingAttempts,
  onActivated,
  onRetry,
}: ResultStepProps) {
  const activateMutation = useActivateVoiceClone();

  const handleActivate = () => {
    activateMutation.mutate(cloneId, {
      onSuccess: () => onActivated(),
    });
  };

  if (status === "ready") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <CheckCircle2 className="mb-4 h-10 w-10 text-success" />
        <h3 className="text-[14px] font-semibold text-v2-ink dark:text-v2-ink">
          Your Voice Clone is Ready
        </h3>
        <p className="mt-2 text-[12px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Your custom AI voice has been generated successfully. Activate it to
          use on all future voice calls.
        </p>
        <Button
          className="mt-6 h-8 text-[12px] px-5"
          onClick={handleActivate}
          disabled={activateMutation.isPending}
        >
          {activateMutation.isPending ? "Activating..." : "Activate Voice"}
        </Button>
        {activateMutation.isError && (
          <p className="mt-3 text-[11px] text-destructive">
            {activateMutation.error.message}
          </p>
        )}
      </div>
    );
  }

  // Failed state
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <XCircle className="mb-4 h-10 w-10 text-destructive" />
      <h3 className="text-[14px] font-semibold text-v2-ink dark:text-v2-ink">
        Voice Clone Processing Failed
      </h3>
      <p className="mt-2 text-[12px] text-v2-ink-muted dark:text-v2-ink-subtle">
        The voice clone could not be generated from your recordings. This can
        happen if the audio quality is insufficient or recordings are too
        similar.
      </p>
      {remainingAttempts > 0 ? (
        <>
          <Button
            variant="outline"
            className="mt-6 h-8 text-[12px] px-5"
            onClick={onRetry}
          >
            Start New Attempt
          </Button>
          <p className="mt-2 text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
            {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""}{" "}
            remaining
          </p>
        </>
      ) : (
        <p className="mt-4 text-[11px] text-v2-ink-subtle dark:text-v2-ink-muted">
          No attempts remaining. Contact support for assistance.
        </p>
      )}
    </div>
  );
}
