// src/features/channel-orchestration/components/sessions/VoiceSessionDetail.tsx
import { ArrowLeft, ExternalLink, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useVoiceSession,
  useManualWriteback,
} from "../../hooks/useOrchestration";
import { outcomeBadge, formatDuration, formatDate } from "./session-utils";

interface Props {
  sessionId: string;
  onBack: () => void;
}

export function VoiceSessionDetail({ sessionId, onBack }: Props) {
  const { data: session, isLoading } = useVoiceSession(sessionId);
  const writeback = useManualWriteback();

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const { variant, label } = outcomeBadge(session.outcome);

  return (
    <div className="space-y-3">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[10px]"
        onClick={onBack}
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        Back to sessions
      </Button>

      {/* Metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetaCard label="Outcome">
          <Badge variant={variant} className="h-4 text-[9px]">
            {label}
          </Badge>
        </MetaCard>
        <MetaCard label="Duration">
          {formatDuration(session.durationMs)}
        </MetaCard>
        <MetaCard label="Workflow">{session.workflowType || "—"}</MetaCard>
        <MetaCard label="Started">{formatDate(session.startedAt)}</MetaCard>
      </div>

      {session.closeLeadId && (
        <div className="text-[10px] text-v2-ink-muted">
          Lead:{" "}
          <span className="font-mono text-v2-ink-muted dark:text-v2-ink-subtle">
            {session.closeLeadId}
          </span>
        </div>
      )}

      {/* Summary */}
      {session.summary && (
        <div className="border border-v2-ring dark:border-v2-ring-strong rounded p-2">
          <p className="text-[10px] font-medium text-v2-ink-muted mb-1">
            Summary
          </p>
          <p className="text-[11px] text-v2-ink dark:text-v2-ink-muted">
            {session.summary}
          </p>
        </div>
      )}

      {/* Transcript */}
      {session.transcript && session.transcript.length > 0 && (
        <div className="border border-v2-ring dark:border-v2-ring-strong rounded p-2">
          <p className="text-[10px] font-medium text-v2-ink-muted mb-1.5">
            Transcript
          </p>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {session.transcript.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  entry.role === "agent" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-2 py-1 rounded text-[10px]",
                    entry.role === "agent"
                      ? "bg-info/10 text-info dark:text-info"
                      : "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink dark:text-v2-ink-muted",
                  )}
                >
                  <span className="text-[8px] font-medium text-v2-ink-subtle block mb-0.5">
                    {entry.role === "agent" ? "Agent" : "Lead"}
                  </span>
                  {entry.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {session.recordingUrl && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => window.open(session.recordingUrl!, "_blank")}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Recording
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => writeback.mutate({ sessionId: session.id })}
          disabled={writeback.isPending}
        >
          {writeback.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          Write to Close
        </Button>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-v2-ring dark:border-v2-ring-strong rounded px-2 py-1.5">
      <p className="text-[8px] text-v2-ink-subtle font-medium">{label}</p>
      <div className="text-[11px] text-v2-ink dark:text-v2-ink-muted mt-0.5">
        {children}
      </div>
    </div>
  );
}
