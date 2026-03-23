import { Loader2, Mic } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatBotVoiceCloneStatus } from "@/features/chat-bot";
import { useDeactivateVoiceClone } from "@/features/chat-bot";

interface VoiceCloneStatusCardProps {
  cloneStatus: ChatBotVoiceCloneStatus | null | undefined;
  isLoading: boolean;
  agentId?: string | null;
}

export function VoiceCloneStatusCard({
  cloneStatus,
  isLoading,
}: VoiceCloneStatusCardProps) {
  const navigate = useNavigate();
  const deactivateMutation = useDeactivateVoiceClone();

  // Show a compact loading skeleton while first fetch is in-flight
  if (isLoading && !cloneStatus) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            Voice Cloning
          </span>
          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-zinc-400 dark:text-zinc-500" />
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          Checking clone status...
        </p>
      </div>
    );
  }

  // Active clone
  if (cloneStatus?.hasActiveClone) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            Voice Cloning
          </span>
          <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] px-1.5 py-0">
            Custom Voice Active
          </Badge>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Your cloned voice is active on all calls.
          </p>
          <button
            type="button"
            onClick={() => deactivateMutation.mutate()}
            disabled={deactivateMutation.isPending}
            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
          >
            {deactivateMutation.isPending ? "Reverting..." : "Deactivate"}
          </button>
        </div>
      </div>
    );
  }

  // Recording in progress
  if (cloneStatus?.inProgressCloneId) {
    const pct =
      cloneStatus.totalSegments > 0
        ? Math.round(
            (cloneStatus.completedSegments / cloneStatus.totalSegments) * 100,
          )
        : 0;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            Voice Cloning
          </span>
          <Badge className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] px-1.5 py-0">
            Recording in Progress
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 tabular-nums">
            {cloneStatus.completedSegments}/{cloneStatus.totalSegments}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Your progress is saved.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2.5 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
            onClick={() => navigate({ to: "/voice-agent/clone" })}
          >
            Continue Recording
          </Button>
        </div>
      </div>
    );
  }

  // No attempts remaining
  if (cloneStatus && cloneStatus.remainingAttempts === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400">
            Voice Cloning
          </span>
          <Badge className="ml-auto bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 text-[10px] px-1.5 py-0">
            No Attempts Remaining
          </Badge>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          All voice clone attempts have been used. Contact support for
          additional attempts.
        </p>
      </div>
    );
  }

  // Default: clone available — show CTA
  const attemptsText = cloneStatus
    ? `${cloneStatus.remainingAttempts} attempt${cloneStatus.remainingAttempts !== 1 ? "s" : ""} remaining`
    : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
          Voice Cloning
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        Record 25 guided audio segments to create a custom AI voice that sounds
        like you on all calls.
      </p>
      <div className="mt-2.5 flex items-center justify-between">
        {attemptsText && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {attemptsText}
          </p>
        )}
        <Button
          size="sm"
          className="h-6 text-[10px] px-3 ml-auto"
          onClick={() => navigate({ to: "/voice-agent/clone" })}
        >
          Clone Your Voice
        </Button>
      </div>
    </div>
  );
}
