import { useState } from "react";
import { AlertTriangle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useStartVoiceClone } from "@/features/chat-bot";

interface ConsentStepProps {
  remainingAttempts: number;
  onSessionStarted: (cloneId: string) => void;
}

export function ConsentStep({
  remainingAttempts,
  onSessionStarted,
}: ConsentStepProps) {
  const [voiceName, setVoiceName] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  const startMutation = useStartVoiceClone();

  const handleStart = () => {
    if (!voiceName.trim() || !consentChecked) return;
    startMutation.mutate(
      { voiceName: voiceName.trim(), consentAccepted: true },
      {
        onSuccess: (data) => {
          onSessionStarted(data.id);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-v2-ring bg-white p-6 dark:border-v2-ring dark:bg-v2-card">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="h-5 w-5 text-v2-ink-muted dark:text-v2-ink-subtle" />
          <h2 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Clone Your Voice
          </h2>
        </div>

        <p className="text-[12px] text-v2-ink-muted dark:text-v2-ink-subtle mb-5">
          Record 25 guided audio segments to create a custom AI voice that
          sounds like you on all calls. This takes about 60-90 minutes total and
          can be completed across multiple sessions.
        </p>

        <div className="space-y-4">
          <div>
            <Label
              htmlFor="voice-name"
              className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted"
            >
              Voice Name
            </Label>
            <Input
              id="voice-name"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g. My Voice"
              className="mt-1 h-8 text-[12px]"
              maxLength={50}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="consent"
              checked={consentChecked}
              onCheckedChange={(v) => setConsentChecked(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="consent"
              className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle leading-tight cursor-pointer"
            >
              I consent to having my voice recorded and used to generate a
              custom AI voice for phone calls made through this platform. I
              understand that the voice model will be created by a third-party
              AI provider.
            </Label>
          </div>
        </div>

        {remainingAttempts <= 1 && remainingAttempts > 0 && (
          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>This is your last remaining attempt.</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
            {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""}{" "}
            remaining
          </span>
          <Button
            size="sm"
            className="h-7 text-[11px] px-4"
            onClick={handleStart}
            disabled={
              !voiceName.trim() || !consentChecked || startMutation.isPending
            }
          >
            {startMutation.isPending ? "Starting..." : "Start Recording"}
          </Button>
        </div>

        {startMutation.isError && (
          <p className="mt-3 text-[11px] text-red-600 dark:text-red-400">
            {startMutation.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
