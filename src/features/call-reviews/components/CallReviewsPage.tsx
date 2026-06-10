// src/features/call-reviews/components/CallReviewsPage.tsx
// The Call Reviews library: a SERVER-SIDE paginated, server-filtered list of the
// IMO's recordings (never loads the whole table), an upload panel (call-type +
// validated audio), and per-row archive / delete. Clicking a row opens the
// review screen. Reuses the kpi upload mutation + storage + status libs.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Headphones,
  Upload,
  Search,
  Loader2,
  X,
  Check,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUploadRecording,
  deriveRecordingStatus,
  recordingStatusLabel,
  formatCallDuration,
  CALL_OUTCOME_OPTIONS,
  useActiveCallTypes,
  useKpiIdentity,
  type CallOutcome,
} from "@/features/kpi";
import {
  useCallLibrary,
  useImoAgents,
  useArchiveRecording,
  useDeleteRecording,
  DEFAULT_LIBRARY_FILTERS,
  type CallLibraryFilters,
  type CallLibraryRow,
} from "../hooks/useCallLibrary";
import { callReviewKeys } from "../hooks/callReviewKeys";
import { validateAudioFile, AUDIO_ACCEPT } from "../utils/audioUpload";

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

const ROW_GRID =
  "grid grid-cols-[1fr_110px_84px_64px_84px_84px_72px] gap-2 items-center";

export function CallReviewsPage() {
  const { imoId } = useKpiIdentity();
  const [filters, setFilters] = useState<CallLibraryFilters>(
    DEFAULT_LIBRARY_FILTERS,
  );
  const [searchInput, setSearchInput] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CallLibraryRow | null>(null);

  // Debounce the search box → one server query per pause, not per keystroke.
  useEffect(() => {
    const id = setTimeout(
      () => setFilters((f) => ({ ...f, search: searchInput })),
      350,
    );
    return () => clearTimeout(id);
  }, [searchInput]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useCallLibrary(filters);
  const { data: agentsData } = useImoAgents(imoId ?? undefined);
  const { callTypes } = useActiveCallTypes(imoId ?? undefined);
  const archiveMutation = useArchiveRecording();
  const deleteMutation = useDeleteRecording();

  const agentNames = agentsData?.names ?? {};
  const agents = agentsData?.list ?? [];
  const rows = data?.pages.flatMap((p) => p.rows) ?? [];

  const setFilter = <K extends keyof CallLibraryFilters>(
    key: K,
    value: CallLibraryFilters[K],
  ) => setFilters((f) => ({ ...f, [key]: value }));

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

      {showUpload && (
        <UploadPanel
          callTypes={callTypes}
          onDone={() => setShowUpload(false)}
        />
      )}

      {/* Filters (all server-side) */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-v2-ink-subtle" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search caller, file, transcript…"
            className="h-8 text-xs pl-7"
          />
          {isFetching && !isFetchingNextPage && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-v2-ink-subtle" />
          )}
        </div>
        <select
          value={filters.callTypeId}
          onChange={(e) => setFilter("callTypeId", e.target.value)}
          className="h-8 text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          <option value="all">All call types</option>
          {callTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filters.outcome}
          onChange={(e) => setFilter("outcome", e.target.value)}
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
          value={filters.agentId}
          onChange={(e) => setFilter("agentId", e.target.value)}
          className="h-8 text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant={filters.showArchived ? "default" : "outline"}
          className="h-8 text-[11px]"
          onClick={() => setFilter("showArchived", !filters.showArchived)}
        >
          <Archive className="h-3 w-3 mr-1" />
          {filters.showArchived ? "Showing archived" : "Show archived"}
        </Button>
      </div>

      {/* Library table */}
      <div className="rounded-xl border border-v2-ring bg-v2-card shadow-sm overflow-hidden">
        <div
          className={`${ROW_GRID} px-3 py-2 bg-v2-canvas/80 border-b border-v2-ring text-[10px] font-semibold uppercase tracking-wide text-v2-ink-muted`}
        >
          <div>Call</div>
          <div>Agent</div>
          <div>Date</div>
          <div>Length</div>
          <div>Outcome</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-v2-ink-muted">
            No calls match. Upload a recording to start building the library.
          </div>
        ) : (
          <div className="divide-y divide-v2-ring/60">
            {rows.map((r) => {
              const status = deriveRecordingStatus(r);
              const archived = !!r.archived_at;
              const title =
                r.call_type?.name ||
                r.caller_name ||
                r.original_filename ||
                "Call recording";
              return (
                <div
                  key={r.id}
                  className={`${ROW_GRID} px-3 py-2 hover:bg-v2-canvas/70 text-xs group`}
                >
                  <Link
                    to="/call-reviews/$recordingId"
                    params={{ recordingId: r.id }}
                    className="contents"
                  >
                    <div className="truncate text-v2-ink font-medium flex items-center gap-1.5">
                      {archived && (
                        <Archive className="h-3 w-3 text-v2-ink-subtle shrink-0" />
                      )}
                      <span className="truncate">{title}</span>
                    </div>
                    <div className="truncate text-v2-ink-muted text-[11px]">
                      {agentNames[r.agent_id] ?? "—"}
                    </div>
                    <div className="text-v2-ink-muted text-[11px] tabular-nums">
                      {r.call_at
                        ? new Date(r.call_at).toLocaleDateString()
                        : "—"}
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
                        <span className="text-v2-ink-subtle text-[11px]">
                          —
                        </span>
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
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      title={archived ? "Restore" : "Archive"}
                      onClick={() =>
                        archiveMutation.mutate({ id: r.id, archive: !archived })
                      }
                      disabled={archiveMutation.isPending}
                      className="p-1 rounded text-v2-ink-subtle hover:text-v2-ink hover:bg-v2-ring/40"
                    >
                      {archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => setDeleteTarget(r)}
                      className="p-1 rounded text-v2-ink-subtle hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasNextPage && (
          <div className="p-2 border-t border-v2-ring/60 flex justify-center">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Load more
            </Button>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <p className="text-[10px] text-v2-ink-subtle text-center">
          Showing {rows.length} call{rows.length === 1 ? "" : "s"}
          {hasNextPage ? " — load more for older calls" : ""}
        </p>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this call recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the recording and its audio file for the
              whole team. This can’t be undone. To keep it but hide it from the
              library, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (deleteTarget)
                  deleteMutation.mutate({
                    id: deleteTarget.id,
                    storage_path: deleteTarget.storage_path,
                  });
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface UploadPanelProps {
  callTypes: { id: string; name: string }[];
  onDone: () => void;
}

function UploadPanel({ callTypes, onDone }: UploadPanelProps) {
  const queryClient = useQueryClient();
  const uploadMutation = useUploadRecording();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [callTypeId, setCallTypeId] = useState<string>("");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [callAt, setCallAt] = useState("");
  const [premium, setPremium] = useState("");
  const [consent, setConsent] = useState(false);

  const onPickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      setFileError(null);
      return;
    }
    const err = validateAudioFile(f);
    setFileError(err);
    setFile(err ? null : f);
  };

  const canSubmit =
    !!file && !fileError && consent && !uploadMutation.isPending;

  const submit = () => {
    if (!file) return;
    uploadMutation.mutate(
      {
        file,
        meta: {
          call_type_id: callTypeId || null,
          outcome: outcome || null,
          call_at: callAt ? new Date(callAt).toISOString() : null,
          premium_amount: premium ? Number(premium) : null,
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
        accept={AUDIO_ACCEPT}
        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        className="block w-full text-xs text-v2-ink-muted file:mr-2 file:rounded file:border file:border-v2-ring file:bg-v2-card file:px-2 file:py-1 file:text-[11px]"
      />
      {fileError && <p className="text-[11px] text-rose-600">{fileError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={callTypeId}
          onChange={(e) => setCallTypeId(e.target.value)}
          className="h-7 text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          <option value="">Call type (angle)…</option>
          {callTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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

      {callTypes.length === 0 && (
        <p className="text-[10px] text-amber-600">
          No call types defined yet. A super-admin can add them in Settings →
          Call types.
        </p>
      )}

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
