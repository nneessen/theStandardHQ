// src/features/call-reviews/components/CallReviewsPage.tsx
// The Call Reviews library: every recording in the IMO (open training library),
// searchable/filterable, plus an upload panel any agent can use. Clicking a row
// opens the review screen. Reuses the kpi upload mutation + storage + status libs.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Headphones, Upload, Search, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUploadRecording,
  deriveRecordingStatus,
  recordingStatusLabel,
  formatCallDuration,
  CALL_OUTCOME_OPTIONS,
  type CallOutcome,
} from "@/features/kpi";
import { useCallLibrary, useLibraryAgents } from "../hooks/useCallLibrary";
import { callReviewKeys } from "../hooks/callReviewKeys";

const OUTCOME_LABEL = new Map<string, string>(
  CALL_OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
);

const STATUS_CLASSES: Record<string, string> = {
  analyzed: "text-emerald-700 border-emerald-300",
  transcribed: "text-blue-700 border-blue-300",
  analyzing: "text-amber-700 border-amber-300",
  transcribing: "text-amber-700 border-amber-300",
  uploaded: "text-v2-ink-muted border-v2-ring",
  skipped: "text-v2-ink-subtle border-v2-ring",
  failed: "text-rose-700 border-rose-300",
};

export function CallReviewsPage() {
  const { data, isLoading } = useCallLibrary();
  const agents = useLibraryAgents(data);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState<string>("all");
  const [agentId, setAgentId] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);

  const recordings = useMemo(() => {
    const all = data?.recordings ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (outcome !== "all" && r.outcome !== outcome) return false;
      if (agentId !== "all" && r.agent_id !== agentId) return false;
      if (q) {
        const hay =
          `${r.caller_name ?? ""} ${r.original_filename ?? ""} ${r.notes ?? ""} ${r.transcript_text ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, outcome, agentId]);

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-v2-ink flex items-center gap-2">
            <Headphones className="h-4 w-4 text-v2-ink-muted" /> Call Reviews
          </h1>
          <p className="text-[11px] text-v2-ink-muted mt-0.5">
            Listen to real sold &amp; unsold calls, read the diarized
            transcript, study the scripts, and mark key moments. A shared
            training library for every agent.
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => setShowUpload((s) => !s)}
        >
          <Upload className="h-3 w-3 mr-1" /> Upload call
        </Button>
      </div>

      {showUpload && <UploadPanel onDone={() => setShowUpload(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-v2-ink-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search caller, file, notes, transcript…"
            className="h-8 text-xs pl-7"
          />
        </div>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="h-8 text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          <option value="all">All outcomes</option>
          {CALL_OUTCOME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="h-8 text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Library table */}
      <div className="rounded-xl border border-v2-ring bg-v2-card shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_90px_70px_90px_90px] gap-2 px-3 py-2 bg-v2-canvas/80 border-b border-v2-ring text-[10px] font-semibold uppercase tracking-wide text-v2-ink-muted">
          <div>Call</div>
          <div>Agent</div>
          <div>Date</div>
          <div>Length</div>
          <div>Outcome</div>
          <div>Status</div>
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="p-8 text-center text-xs text-v2-ink-muted">
            No calls match. Upload a recording to start building the library.
          </div>
        ) : (
          <div className="divide-y divide-v2-ring/60">
            {recordings.map((r) => {
              const status = deriveRecordingStatus(r);
              return (
                <Link
                  key={r.id}
                  to="/call-reviews/$recordingId"
                  params={{ recordingId: r.id }}
                  className="grid grid-cols-[1fr_120px_90px_70px_90px_90px] gap-2 px-3 py-2 items-center hover:bg-v2-canvas/70 text-xs"
                >
                  <div className="truncate text-v2-ink font-medium">
                    {r.caller_name || r.original_filename || "Call recording"}
                  </div>
                  <div className="truncate text-v2-ink-muted text-[11px]">
                    {data?.agentNames[r.agent_id] ?? "—"}
                  </div>
                  <div className="text-v2-ink-muted text-[11px] tabular-nums">
                    {r.call_at ? new Date(r.call_at).toLocaleDateString() : "—"}
                  </div>
                  <div className="text-v2-ink-muted text-[11px] font-mono tabular-nums">
                    {formatCallDuration(r.duration_seconds) ?? "—"}
                  </div>
                  <div>
                    {r.outcome ? (
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${r.outcome === "sold" ? "text-emerald-600 border-emerald-300" : ""}`}
                      >
                        {OUTCOME_LABEL.get(r.outcome) ?? r.outcome}
                      </Badge>
                    ) : (
                      <span className="text-v2-ink-subtle text-[11px]">—</span>
                    )}
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 ${STATUS_CLASSES[status] ?? ""}`}
                    >
                      {recordingStatusLabel(status)}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadPanel({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const uploadMutation = useUploadRecording();
  const [file, setFile] = useState<File | null>(null);
  const [callerName, setCallerName] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [callAt, setCallAt] = useState("");
  const [premium, setPremium] = useState("");
  const [consent, setConsent] = useState(false);

  const canSubmit = !!file && consent && !uploadMutation.isPending;

  const submit = () => {
    if (!file) return;
    uploadMutation.mutate(
      {
        file,
        meta: {
          caller_name: callerName.trim() || null,
          outcome: outcome || null,
          call_at: callAt ? new Date(callAt).toISOString() : null,
          premium_amount: premium ? Number(premium) : null,
          // Record the consent acknowledgement alongside the recording (open
          // IMO-wide library exposes client PII — captured for compliance).
          metadata: {
            consent_ack: true,
            consent_ack_at: new Date().toISOString(),
          },
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
          onDone();
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-v2-ring bg-v2-canvas/60 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink">
          Upload a call recording
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onDone}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <input
        type="file"
        accept="audio/*,video/mp4"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-xs text-v2-ink-muted file:mr-2 file:rounded file:border file:border-v2-ring file:bg-v2-card file:px-2 file:py-1 file:text-[11px]"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          value={callerName}
          onChange={(e) => setCallerName(e.target.value)}
          placeholder="Caller name (optional)"
          className="h-7 text-xs"
        />
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as CallOutcome | "")}
          className="h-7 text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          <option value="">Outcome (optional)</option>
          {CALL_OUTCOME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={callAt}
          onChange={(e) => setCallAt(e.target.value)}
          className="h-7 text-xs"
        />
        <Input
          type="number"
          value={premium}
          onChange={(e) => setPremium(e.target.value)}
          placeholder="Premium $ (if sold)"
          className="h-7 text-xs"
        />
      </div>

      <label className="flex items-start gap-2 text-[11px] text-v2-ink-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I confirm this recording complies with applicable
          call-recording/consent laws and may be shared with my IMO team for
          training.
        </span>
      </label>

      <div className="flex justify-end">
        <Button
          size="sm"
          className="h-7 text-[11px]"
          disabled={!canSubmit}
          onClick={submit}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Check className="h-3 w-3 mr-1" />
          )}
          Upload &amp; transcribe
        </Button>
      </div>
    </div>
  );
}
