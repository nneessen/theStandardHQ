// src/features/channel-orchestration/components/sessions/VoiceSessionsTab.tsx
import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVoiceSessions } from "../../hooks/useOrchestration";
import type { VoiceSession } from "../../types/orchestration.types";
import { VoiceSessionDetail } from "./VoiceSessionDetail";
import { outcomeBadge, formatDuration, formatDate } from "./session-utils";

const PAGE_SIZE = 20;

export function VoiceSessionsTab() {
  const [page, setPage] = useState(1);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const { data, isLoading } = useVoiceSessions(page, PAGE_SIZE);

  // Detail view
  if (selectedSessionId) {
    return (
      <VoiceSessionDetail
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const sessions = data?.items ?? [];
  const pagination = data?.pagination;

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <PhoneOff className="h-8 w-8 text-v2-ink-subtle dark:text-v2-ink-muted mb-2" />
        <p className="text-xs font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
          No voice sessions yet
        </p>
        <p className="text-[10px] text-v2-ink-muted max-w-xs">
          Voice sessions will appear here after your AI voice agent makes or
          receives calls.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-v2-canvas dark:bg-v2-card-tinted/50 border-b border-v2-ring dark:border-v2-ring-strong">
              <Th>Date/Time</Th>
              <Th>Duration</Th>
              <Th>Outcome</Th>
              <Th className="hidden sm:table-cell">Workflow</Th>
              <Th className="hidden md:table-cell">Lead ID</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session: VoiceSession) => {
              const { variant, label } = outcomeBadge(session.outcome);
              return (
                <tr
                  key={session.id}
                  className="border-b border-v2-ring dark:border-v2-ring hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30 transition-colors"
                >
                  <Td>{formatDate(session.startedAt ?? session.createdAt)}</Td>
                  <Td>{formatDuration(session.durationMs)}</Td>
                  <Td>
                    <Badge variant={variant} className="h-4 text-[9px]">
                      {label}
                    </Badge>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <span className="text-v2-ink-muted">
                      {session.workflowType || "—"}
                    </span>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <span className="font-mono text-v2-ink-muted truncate max-w-[120px] inline-block">
                      {session.closeLeadId || "—"}
                    </span>
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      View
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-[10px] text-v2-ink-muted">
          <span>
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.totalItems} total)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-2 py-1.5 text-left text-[9px] font-medium text-v2-ink-muted uppercase tracking-wider ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-2 py-1.5 text-[10px] ${className ?? ""}`}>{children}</td>
  );
}
