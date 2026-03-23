import { ExternalLink, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChatBotVoiceCloneStatus } from "@/features/chat-bot";

interface VoiceCloneStatusCardProps {
  cloneStatus: ChatBotVoiceCloneStatus | null | undefined;
  isLoading: boolean;
}

export function VoiceCloneStatusCard({
  cloneStatus,
  isLoading,
}: VoiceCloneStatusCardProps) {
  if (isLoading && !cloneStatus) return null;
  if (!cloneStatus) return null;

  const {
    hasActiveClone,
    inProgressCloneId,
    completedSegments,
    totalSegments,
    remainingAttempts,
    cloneWizardUrl,
  } = cloneStatus;

  // Active clone
  if (hasActiveClone) {
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
        <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          Your cloned voice is active on all calls.
        </p>
      </div>
    );
  }

  // Recording in progress
  if (inProgressCloneId) {
    const pct =
      totalSegments > 0
        ? Math.round((completedSegments / totalSegments) * 100)
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
            {completedSegments}/{totalSegments}
          </span>
        </div>
        {cloneWizardUrl && (
          <a
            href={cloneWizardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
          >
            Continue Recording
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  // CTA: can start a clone
  if (remainingAttempts > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            Voice Cloning
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          Record guided audio segments to create a custom AI voice that sounds
          like you.
        </p>
        <div className="mt-2.5 flex items-center justify-between">
          {cloneWizardUrl ? (
            <a
              href={cloneWizardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Clone Your Voice
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Recording wizard not available
            </span>
          )}
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""}{" "}
            remaining
          </span>
        </div>
      </div>
    );
  }

  // No attempts remaining
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
        All voice clone attempts have been used. Contact support for additional
        attempts.
      </p>
    </div>
  );
}
