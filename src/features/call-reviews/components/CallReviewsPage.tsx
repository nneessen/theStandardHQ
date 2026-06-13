// src/features/call-reviews/components/CallReviewsPage.tsx
// The Call Reviews library: a SERVER-SIDE paginated, server-filtered list of the
// IMO's recordings (never loads the whole table), an upload panel (call-type +
// validated audio), and per-row archive / delete. Clicking a row opens the
// review screen. Reuses the kpi upload mutation + storage + status libs.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
  Pencil,
  CheckCircle2,
  Circle,
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
import { useAuth } from "@/contexts/AuthContext";
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
  useDownlineAgents,
  useArchiveRecording,
  useDeleteRecording,
  DEFAULT_LIBRARY_FILTERS,
  type AgentName,
  type CallLibraryFilters,
  type CallLibraryRow,
} from "../hooks/useCallLibrary";
import { callReviewKeys } from "../hooks/callReviewKeys";
import { useMyLikedRecordingIds, useToggleLike } from "../hooks/useCallLikes";
import { useMyListenedRecordingIds } from "../hooks/useCallListens";
import { LikeButton } from "./LikeButton";
import { validateAudioFile, AUDIO_ACCEPT } from "../utils/audioUpload";
import {
  EditAgentDialog,
  externalAgentName,
  OTHER_AGENT,
} from "./EditAgentDialog";

const OUTCOME_LABEL = new Map<string, string>(
  CALL_OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
);

// Tinted (not flat-dark) semantic badges: a soft colored fill + readable text in
// BOTH themes, so a status reads at a glance instead of being one more charcoal
// pill. Each carries an explicit dark-mode variant (plain palette colors don't
// auto-adapt). Mirrors the KIND_STYLE approach in GeneratedScriptView.
const TINT = {
  emerald:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  amber:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  slate:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  rose: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
} as const;

const STATUS_CLASSES: Record<string, string> = {
  analyzed: TINT.emerald,
  transcribed: TINT.blue,
  analyzing: TINT.amber,
  transcribing: TINT.amber,
  uploaded: TINT.slate,
  skipped: TINT.slate,
  failed: TINT.rose,
};

// Wider fixed columns than before — the full-width container gives the room, and
// bigger type needs it (avoids clipping the status/outcome badges).
const ROW_GRID =
  "grid grid-cols-[1fr_150px_110px_92px_120px_140px_72px_100px] gap-2 items-center";

// A recording counts as "newly uploaded" (gets a New badge) for this long after
// it was added — so the team can spot fresh calls at a glance.
const NEW_UPLOAD_WINDOW_MS = 48 * 60 * 60 * 1000;

function isRecentlyUploaded(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const age = Date.now() - new Date(createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < NEW_UPLOAD_WINDOW_MS;
}

const SORT_OPTIONS: { value: CallLibraryFilters["sort"]; label: string }[] = [
  { value: "recent", label: "Recent calls" },
  { value: "recent_upload", label: "Recently uploaded" },
  { value: "most_liked", label: "Most liked" },
];

export function CallReviewsPage() {
  const { imoId, userId } = useKpiIdentity();
  const { user } = useAuth();
  const isSuperAdmin = user?.is_super_admin === true;
  const [filters, setFilters] = useState<CallLibraryFilters>(
    DEFAULT_LIBRARY_FILTERS,
  );
  const [searchInput, setSearchInput] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CallLibraryRow | null>(null);
  const [editTarget, setEditTarget] = useState<CallLibraryRow | null>(null);

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
  const { data: downlineData } = useDownlineAgents();
  const { callTypes } = useActiveCallTypes(imoId ?? undefined);
  const archiveMutation = useArchiveRecording();
  const deleteMutation = useDeleteRecording();

  const agentNames = agentsData?.names ?? {};
  const agents = agentsData?.list ?? [];

  // The upload "assign to" picker is scoped to what the recording INSERT RLS
  // accepts: a super-admin can attribute to anyone in the IMO (full roster +
  // free-text off-system name); a regular agent/manager can only attribute to
  // themselves or a downline. Agents with no downline see no picker (upload as
  // self). The default is always "Me".
  const downlineAgents = downlineData?.list ?? [];
  // downline list includes self, so >1 means they actually have a downline.
  const hasDownline = downlineAgents.filter((a) => a.id !== userId).length > 0;
  const uploadAgents = isSuperAdmin ? agents : downlineAgents;
  const canAssignUpload = isSuperAdmin || hasDownline;
  const rows = data?.pages.flatMap((p) => p.rows) ?? [];

  // Likes: which calls the current user has hearted (to fill their own hearts)
  // and the toggle mutation. Fetched once for the whole list.
  const { data: likedIds } = useMyLikedRecordingIds();
  const toggleLike = useToggleLike();

  // Which calls the current user has already listened to (read/unread marker).
  const { data: listenedIds } = useMyListenedRecordingIds();

  const setFilter = <K extends keyof CallLibraryFilters>(
    key: K,
    value: CallLibraryFilters[K],
  ) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="w-full px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-v2-ink flex items-center gap-2">
            <Headphones className="h-5 w-5 text-v2-ink-muted" /> Call Reviews
          </h1>
          <p className="text-xs text-v2-ink-muted mt-0.5">
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
          agents={uploadAgents}
          canAssign={canAssignUpload}
          allowExternal={isSuperAdmin}
          currentUserId={userId}
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
            className="h-8 text-sm pl-7"
          />
          {isFetching && !isFetchingNextPage && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-v2-ink-subtle" />
          )}
        </div>
        <select
          value={filters.callTypeId}
          onChange={(e) => setFilter("callTypeId", e.target.value)}
          className="h-8 text-xs rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
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
          className="h-8 text-xs rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
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
          className="h-8 text-xs rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={filters.sort}
          onChange={(e) =>
            setFilter("sort", e.target.value as CallLibraryFilters["sort"])
          }
          className="h-8 text-xs rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
          title="Sort the library"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant={filters.showArchived ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setFilter("showArchived", !filters.showArchived)}
        >
          <Archive className="h-3 w-3 mr-1" />
          {filters.showArchived ? "Showing archived" : "Show archived"}
        </Button>
      </div>

      {/* Library table */}
      <div className="rounded-xl border border-v2-ring bg-v2-card shadow-sm overflow-hidden">
        <div
          className={`${ROW_GRID} px-4 py-2.5 bg-v2-canvas/80 border-b border-v2-ring text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted`}
        >
          <div>Call</div>
          <div>Agent</div>
          <div>Date</div>
          <div>Length</div>
          <div>Outcome</div>
          <div>Status</div>
          <div className="text-center">Likes</div>
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
          <div className="divide-y divide-v2-ring">
            {rows.map((r) => {
              const status = deriveRecordingStatus(r);
              const archived = !!r.archived_at;
              const isNew = !archived && isRecentlyUploaded(r.created_at);
              const liked = likedIds?.has(r.id) ?? false;
              const listened = listenedIds?.has(r.id) ?? false;
              const title =
                r.call_type?.name ||
                r.caller_name ||
                r.original_filename ||
                "Call recording";
              return (
                <div
                  key={r.id}
                  className={`${ROW_GRID} px-4 py-2.5 hover:bg-v2-canvas/70 text-sm group`}
                >
                  <Link
                    to="/call-reviews/$recordingId"
                    params={{ recordingId: r.id }}
                    className="contents"
                  >
                    <div
                      className={`truncate font-medium flex items-center gap-1.5 ${listened ? "text-v2-ink-muted" : "text-v2-ink"}`}
                    >
                      <span
                        className="shrink-0 flex items-center"
                        title={
                          listened
                            ? "You've listened to this call"
                            : "Not yet listened"
                        }
                      >
                        {listened ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-v2-ink-subtle/40" />
                        )}
                      </span>
                      {archived && (
                        <Archive className="h-3.5 w-3.5 text-v2-ink-subtle shrink-0" />
                      )}
                      <span className="truncate">{title}</span>
                      {isNew && (
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[11px] px-1.5 py-0.5 ${TINT.emerald}`}
                          title="Uploaded in the last 48 hours"
                        >
                          New
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-v2-ink-muted text-[13px]">
                      {externalAgentName(r) ?? agentNames[r.agent_id] ?? "—"}
                    </div>
                    <div className="text-v2-ink-muted text-[13px] tabular-nums">
                      {r.call_at
                        ? new Date(r.call_at).toLocaleDateString()
                        : "—"}
                    </div>
                    <div className="text-v2-ink-muted text-[13px] font-mono tabular-nums">
                      {formatCallDuration(r.duration_seconds) ?? "—"}
                    </div>
                    <div>
                      {r.outcome ? (
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-1.5 py-0.5 ${r.outcome === "sold" ? TINT.emerald : TINT.slate}`}
                        >
                          {OUTCOME_LABEL.get(r.outcome) ?? r.outcome}
                        </Badge>
                      ) : (
                        <span className="text-v2-ink-subtle text-[13px]">
                          —
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[11px] px-1.5 py-0.5 ${STATUS_CLASSES[status] ?? TINT.slate}`}
                      >
                        {recordingStatusLabel(status)}
                      </Badge>
                      {r.audio_deleted_at && (
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-1.5 py-0.5 ${TINT.slate}`}
                          title="Audio expired after 180 days; transcript retained"
                        >
                          Transcript only
                        </Badge>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center justify-center">
                    <LikeButton
                      liked={liked}
                      count={r.like_count ?? 0}
                      disabled={toggleLike.isPending}
                      onToggle={() =>
                        toggleLike.mutate({ recordingId: r.id, liked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-end gap-0.5">
                    {isSuperAdmin && (
                      <button
                        type="button"
                        title="Reassign agent"
                        onClick={() => setEditTarget(r)}
                        className="p-1 rounded text-v2-ink-subtle hover:text-v2-ink hover:bg-v2-ring/40"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title={archived ? "Restore" : "Archive"}
                      onClick={() =>
                        archiveMutation.mutate({ id: r.id, archive: !archived })
                      }
                      disabled={
                        archiveMutation.isPending &&
                        archiveMutation.variables?.id === r.id
                      }
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
        <p className="text-[11px] text-v2-ink-subtle text-center">
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

      {editTarget && (
        <EditAgentDialog
          row={editTarget}
          agents={agents}
          agentNames={agentNames}
          currentUserId={userId}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

interface UploadPanelProps {
  callTypes: { id: string; name: string }[];
  /** The roster the uploader may attribute a call to (self + downline, or the
   *  full IMO for a super-admin). Already scoped to what the INSERT RLS allows. */
  agents: AgentName[];
  /** Show the "assign to agent" picker. True for a super-admin, or any agent
   *  who has a downline; false for a solo agent (they upload as self). */
  canAssign: boolean;
  /** Allow the free-text "Other agent (not listed)" off-system option. Only a
   *  super-admin gets it; a manager assigns to real downline agents. */
  allowExternal: boolean;
  /** The uploader's own id, used to label the default "assign to me" option. */
  currentUserId: string | null;
  onDone: () => void;
}

function UploadPanel({
  callTypes,
  agents,
  canAssign,
  allowExternal,
  currentUserId,
  onDone,
}: UploadPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const uploadMutation = useUploadRecording();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [callTypeId, setCallTypeId] = useState<string>("");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [callAt, setCallAt] = useState("");
  const [premium, setPremium] = useState("");
  const [consent, setConsent] = useState(false);
  // Assignment. "" = assign to me, an agent id, or OTHER_AGENT.
  const [assignTo, setAssignTo] = useState<string>("");
  const [externalName, setExternalName] = useState("");

  const isOther = allowExternal && assignTo === OTHER_AGENT;
  const trimmedExternal = externalName.trim();

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
    !!file &&
    !fileError &&
    consent &&
    // If attributing to an off-system agent, a name is required.
    (!isOther || trimmedExternal.length > 0) &&
    !uploadMutation.isPending;

  const submit = () => {
    if (!file) return;
    // A real selected agent → set agent_id. "Me" or "Other" → leave unset so the
    // mutation defaults agent_id to the uploader; the typed name (if any) rides
    // along in metadata and is preferred for display.
    const agentId =
      canAssign && assignTo && assignTo !== OTHER_AGENT ? assignTo : null;
    uploadMutation.mutate(
      {
        file,
        agentId,
        meta: {
          call_type_id: callTypeId || null,
          outcome: outcome || null,
          call_at: callAt ? new Date(callAt).toISOString() : null,
          premium_amount: premium ? Number(premium) : null,
          metadata: {
            consent_ack: true,
            consent_ack_at: new Date().toISOString(),
            ...(isOther ? { external_agent_name: trimmedExternal } : {}),
          },
        },
      },
      {
        onSuccess: (recording) => {
          queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
          // Close the upload panel and jump straight to the call just uploaded,
          // so the user lands on it and can review it (the detail page has a
          // "Back to library" link). For a bulk batch, re-open Upload from there.
          onDone();
          navigate({
            to: "/call-reviews/$recordingId",
            params: { recordingId: recording.id },
          });
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDone}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {canAssign && (
        <div className="space-y-1.5 rounded-lg border border-v2-ring/70 bg-v2-card/60 p-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-v2-ink-muted">
            Whose call is this?
          </label>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="h-7 w-full text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
          >
            <option value="">Me (assign to my own calls)</option>
            {agents
              .filter((a) => a.id !== currentUserId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            {allowExternal && (
              <option value={OTHER_AGENT}>Other agent (not listed)…</option>
            )}
          </select>
          {isOther && (
            <Input
              value={externalName}
              onChange={(e) => setExternalName(e.target.value)}
              placeholder="Type the agent's name"
              className="h-7 text-xs"
            />
          )}
          <p className="text-[10px] text-v2-ink-subtle">
            {allowExternal
              ? "Assign this call to yourself or any agent in your IMO."
              : "Upload your own calls, or attribute a call to one of your downline agents."}
          </p>
        </div>
      )}

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
