// src/features/call-reviews/components/CallMarkersPanel.tsx
// Collaborative markers for a call recording: any IMO agent can drop a marker at
// the current playhead (incl. a 'hold' range with an end time); the author or an
// IMO admin can edit/delete. Modeled on the training-modules markers panel.

import { useState } from "react";
import {
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  CALL_MARKER_TYPES,
  CALL_MARKER_LABELS,
  CALL_MARKER_COLORS,
  formatClock,
  isCallMarkerType,
  type CallMarkerRow,
  type CallMarkerType,
} from "../types";
import {
  useCreateMarker,
  useUpdateMarker,
  useDeleteMarker,
  type MarkerFormValues,
} from "../hooks/useCallMarkers";

interface CallMarkersPanelProps {
  recordingId: string;
  markers: CallMarkerRow[];
  creatorNames: Record<string, string>;
  isLoading: boolean;
  currentTime: number;
  onSeek: (seconds: number) => void;
  getCurrentTime: () => number;
  pause: () => void;
}

export function CallMarkersPanel({
  recordingId,
  markers,
  creatorNames,
  isLoading,
  currentTime,
  onSeek,
  getCurrentTime,
  pause,
}: CallMarkersPanelProps) {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useCreateMarker(recordingId);
  const updateMutation = useUpdateMarker(recordingId);
  const deleteMutation = useDeleteMarker(recordingId);

  const activeMarkerId = (() => {
    let active: string | null = null;
    for (const m of markers) {
      if (m.start_seconds <= currentTime) active = m.id;
      else break;
    }
    return active;
  })();

  return (
    <div className="rounded-xl border border-v2-ring bg-v2-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-v2-canvas/80 border-b border-v2-ring">
        <div className="flex items-center gap-1.5">
          <Bookmark className="h-3.5 w-3.5 text-v2-ink-muted" />
          <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
            Markers
          </h3>
          {markers.length > 0 && (
            <span className="text-[10px] text-v2-ink-subtle font-mono">
              {markers.length}
            </span>
          )}
        </div>
        {!adding && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] gap-1 text-v2-ink-muted hover:text-v2-ink"
            onClick={() => {
              pause();
              setAdding(true);
            }}
          >
            <Plus className="h-3 w-3" />
            Add at {formatClock(currentTime)}
          </Button>
        )}
      </div>

      {adding && user?.id && (
        <MarkerForm
          mode="create"
          initialStart={Math.round(getCurrentTime())}
          isPending={createMutation.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(values) =>
            createMutation.mutate(values, {
              onSuccess: () => {
                toast.success("Marker added");
                setAdding(false);
              },
            })
          }
        />
      )}

      <div className="divide-y divide-v2-ring/60">
        {isLoading ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-v2-ink-subtle" />
          </div>
        ) : markers.length === 0 && !adding ? (
          <div className="p-6 text-center">
            <p className="text-[11px] text-v2-ink-muted">
              No markers yet. Mark key moments, objections, or hold start/end to
              make this call a teaching tool.
            </p>
          </div>
        ) : (
          markers.map((m) =>
            editingId === m.id ? (
              <MarkerForm
                key={m.id}
                mode="edit"
                initialStart={Math.round(m.start_seconds)}
                initialEnd={
                  m.end_seconds != null ? Math.round(m.end_seconds) : null
                }
                initialLabel={m.label}
                initialNote={m.note ?? ""}
                initialType={
                  isCallMarkerType(m.marker_type) ? m.marker_type : "highlight"
                }
                isPending={updateMutation.isPending}
                onCancel={() => setEditingId(null)}
                onSubmit={(values) =>
                  updateMutation.mutate(
                    { id: m.id, patch: values },
                    {
                      onSuccess: () => {
                        toast.success("Marker updated");
                        setEditingId(null);
                      },
                    },
                  )
                }
              />
            ) : (
              <MarkerRow
                key={m.id}
                marker={m}
                creatorName={creatorNames[m.created_by]}
                isActive={m.id === activeMarkerId}
                canEdit={m.created_by === user?.id}
                onSeek={() => onSeek(m.start_seconds)}
                onEdit={() => setEditingId(m.id)}
                onDelete={() =>
                  deleteMutation.mutate(m.id, {
                    onSuccess: () => toast.success("Marker deleted"),
                  })
                }
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

function MarkerRow({
  marker,
  creatorName,
  isActive,
  canEdit,
  onSeek,
  onEdit,
  onDelete,
}: {
  marker: CallMarkerRow;
  creatorName?: string;
  isActive: boolean;
  canEdit: boolean;
  onSeek: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const type = isCallMarkerType(marker.marker_type)
    ? marker.marker_type
    : "chapter";
  const colors = CALL_MARKER_COLORS[type];
  const range =
    marker.end_seconds != null
      ? `${formatClock(marker.start_seconds)}–${formatClock(marker.end_seconds)}`
      : formatClock(marker.start_seconds);

  return (
    <div
      className={`group flex items-start gap-2 px-3 py-2 cursor-pointer ${
        isActive ? "bg-v2-canvas" : "hover:bg-v2-canvas/60"
      }`}
      onClick={onSeek}
    >
      <div className="flex flex-col items-center pt-0.5 w-14 flex-shrink-0">
        <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
        <span className="text-[10px] font-mono tabular-nums text-v2-ink-muted mt-0.5 text-center">
          {range}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium truncate text-v2-ink">
            {marker.label}
          </p>
          <span
            className={`text-[9px] uppercase tracking-wider font-semibold ${colors.text}`}
          >
            {CALL_MARKER_LABELS[type]}
          </span>
        </div>
        {marker.note && (
          <p className="text-[11px] text-v2-ink-muted mt-0.5 line-clamp-2">
            {marker.note}
          </p>
        )}
        {creatorName && (
          <p className="text-[10px] text-v2-ink-subtle mt-0.5">
            by {creatorName}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3 w-3 text-v2-ink-muted" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3 text-v2-ink-muted" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MarkerForm({
  mode,
  initialStart,
  initialEnd = null,
  initialLabel = "",
  initialNote = "",
  initialType = "highlight",
  isPending,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialStart: number;
  initialEnd?: number | null;
  initialLabel?: string;
  initialNote?: string;
  initialType?: CallMarkerType;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: MarkerFormValues) => void;
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState<number | null>(initialEnd);
  const [label, setLabel] = useState(initialLabel);
  const [note, setNote] = useState(initialNote);
  const [type, setType] = useState<CallMarkerType>(initialType);

  const isHold = type === "hold";
  const canSubmit =
    label.trim().length > 0 &&
    start >= 0 &&
    (!isHold || (end != null && end > start)) &&
    !isPending;

  return (
    <div className="px-3 py-2.5 bg-v2-canvas/80 border-b border-v2-ring space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Marker label (e.g., Price objection handled)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-7 text-xs flex-1"
          autoFocus
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CallMarkerType)}
          className="h-7 text-[11px] rounded border border-v2-ring bg-v2-card px-2 text-v2-ink"
        >
          {CALL_MARKER_TYPES.map((t) => (
            <option key={t} value={t}>
              {CALL_MARKER_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Optional note / coaching detail..."
        className="w-full text-xs rounded border border-v2-ring bg-v2-card p-2 resize-none"
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] text-v2-ink-muted">
          <span>{isHold ? "From" : "At"}</span>
          <input
            type="number"
            min={0}
            value={start}
            onChange={(e) => setStart(parseInt(e.target.value, 10) || 0)}
            className="w-16 h-6 rounded border border-v2-ring bg-v2-card px-1.5 text-[11px] font-mono"
          />
          <span className="font-mono tabular-nums">({formatClock(start)})</span>
          {isHold && (
            <>
              <span>to</span>
              <input
                type="number"
                min={start}
                value={end ?? ""}
                placeholder="end"
                onChange={(e) =>
                  setEnd(
                    e.target.value === ""
                      ? null
                      : parseInt(e.target.value, 10) || 0,
                  )
                }
                className="w-16 h-6 rounded border border-v2-ring bg-v2-card px-1.5 text-[11px] font-mono"
              />
              {end != null && (
                <span className="font-mono tabular-nums">
                  ({formatClock(end)})
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px]"
            onClick={onCancel}
            disabled={isPending}
          >
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 text-[11px]"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                start_seconds: start,
                end_seconds: isHold ? end : null,
                label: label.trim(),
                note: note.trim() || null,
                marker_type: type,
              })
            }
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Check className="h-3 w-3 mr-1" />
            )}
            {mode === "create" ? "Add" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
