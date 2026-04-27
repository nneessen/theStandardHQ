// src/features/training-modules/components/presentations/PresentationMarkersPanel.tsx
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
import {
  formatTimestamp,
  MARKER_TYPES,
  MARKER_TYPE_LABELS,
  MARKER_TYPE_COLORS,
  type MarkerType,
  type PresentationMarker,
} from "../../types/presentation-marker.types";
import {
  useCreateMarker,
  useDeleteMarker,
  useUpdateMarker,
} from "../../hooks/usePresentationMarkers";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PresentationMarkersPanelProps {
  submissionId: string;
  markers: PresentationMarker[];
  isLoading: boolean;
  currentTime: number;
  onSeek: (seconds: number) => void;
  getCurrentTime: () => number;
  pause: () => void;
}

export function PresentationMarkersPanel({
  submissionId,
  markers,
  isLoading,
  currentTime,
  onSeek,
  getCurrentTime,
  pause,
}: PresentationMarkersPanelProps) {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useCreateMarker(submissionId);
  const updateMutation = useUpdateMarker(submissionId);
  const deleteMutation = useDeleteMarker(submissionId);

  const handleAddClick = () => {
    pause();
    setAdding(true);
  };

  const activeMarkerId = (() => {
    let active: string | null = null;
    for (const m of markers) {
      if (m.timestamp_seconds <= currentTime) active = m.id;
      else break;
    }
    return active;
  })();

  return (
    <div className="rounded-xl border border-v2-ring dark:border-v2-ring bg-v2-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-v2-canvas/80 dark:bg-v2-card/80 border-b border-v2-ring dark:border-v2-ring">
        <div className="flex items-center gap-1.5">
          <Bookmark className="h-3.5 w-3.5 text-v2-ink-muted" />
          <h3 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink-muted uppercase tracking-wide">
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
            className="h-6 text-[11px] gap-1 text-v2-ink-muted hover:text-v2-ink dark:text-v2-ink-subtle"
            onClick={handleAddClick}
          >
            <Plus className="h-3 w-3" />
            Add at {formatTimestamp(currentTime)}
          </Button>
        )}
      </div>

      {/* Add form */}
      {adding && user?.id && (
        <MarkerForm
          mode="create"
          initialTimestamp={getCurrentTime()}
          isPending={createMutation.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(values) => {
            const userId = user?.id;
            if (!userId) return;
            createMutation.mutate(
              {
                submission_id: submissionId,
                created_by: userId,
                ...values,
              },
              {
                onSuccess: () => {
                  toast.success("Marker added");
                  setAdding(false);
                },
                onError: (err) => toast.error(`Failed: ${err.message}`),
              },
            );
          }}
        />
      )}

      {/* List */}
      <div className="divide-y divide-v2-ring dark:divide-v2-ring/50">
        {isLoading ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-v2-ink-subtle" />
          </div>
        ) : markers.length === 0 && !adding ? (
          <div className="p-6 text-center">
            <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
              No markers yet. Add one to help listeners skip to key moments.
            </p>
          </div>
        ) : (
          markers.map((marker) =>
            editingId === marker.id ? (
              <MarkerForm
                key={marker.id}
                mode="edit"
                initialTimestamp={marker.timestamp_seconds}
                initialLabel={marker.label}
                initialDescription={marker.description || ""}
                initialType={marker.marker_type as MarkerType}
                isPending={updateMutation.isPending}
                onCancel={() => setEditingId(null)}
                onSubmit={(values) => {
                  updateMutation.mutate(
                    { id: marker.id, patch: values },
                    {
                      onSuccess: () => {
                        toast.success("Marker updated");
                        setEditingId(null);
                      },
                      onError: (err) => toast.error(`Failed: ${err.message}`),
                    },
                  );
                }}
              />
            ) : (
              <MarkerRow
                key={marker.id}
                marker={marker}
                isActive={marker.id === activeMarkerId}
                canEdit={marker.created_by === user?.id}
                onSeek={() => onSeek(marker.timestamp_seconds)}
                onEdit={() => setEditingId(marker.id)}
                onDelete={() => {
                  deleteMutation.mutate(marker.id, {
                    onSuccess: () => toast.success("Marker deleted"),
                    onError: (err) => toast.error(`Failed: ${err.message}`),
                  });
                }}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

interface MarkerRowProps {
  marker: PresentationMarker;
  isActive: boolean;
  canEdit: boolean;
  onSeek: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function MarkerRow({
  marker,
  isActive,
  canEdit,
  onSeek,
  onEdit,
  onDelete,
}: MarkerRowProps) {
  const colors =
    MARKER_TYPE_COLORS[marker.marker_type as MarkerType] ||
    MARKER_TYPE_COLORS.chapter;
  const creator = marker.creator
    ? `${marker.creator.first_name || ""} ${marker.creator.last_name || ""}`.trim()
    : "";

  return (
    <div
      className={`group flex items-start gap-2 px-3 py-2 transition-colors cursor-pointer ${
        isActive
          ? "bg-v2-canvas dark:bg-v2-card-tinted/40"
          : "hover:bg-v2-canvas/60 dark:hover:bg-v2-card-tinted/20"
      }`}
      onClick={onSeek}
    >
      {/* Dot + timestamp */}
      <div className="flex flex-col items-center pt-0.5 w-12 flex-shrink-0">
        <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
        <span className="text-[10px] font-mono tabular-nums text-v2-ink-muted mt-0.5">
          {formatTimestamp(marker.timestamp_seconds)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={`text-xs font-medium truncate ${isActive ? "text-v2-ink dark:text-v2-ink" : "text-v2-ink dark:text-v2-ink"}`}
          >
            {marker.label}
          </p>
          <span
            className={`text-[9px] uppercase tracking-wider font-semibold ${colors.text}`}
          >
            {MARKER_TYPE_LABELS[marker.marker_type as MarkerType] ||
              marker.marker_type}
          </span>
        </div>
        {marker.description && (
          <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle mt-0.5 line-clamp-2">
            {marker.description}
          </p>
        )}
        {creator && (
          <p className="text-[10px] text-v2-ink-subtle mt-0.5">by {creator}</p>
        )}
      </div>

      {/* Actions */}
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
            className="h-6 w-6 hover:text-red-500"
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

interface MarkerFormProps {
  mode: "create" | "edit";
  initialTimestamp: number;
  initialLabel?: string;
  initialDescription?: string;
  initialType?: MarkerType;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    timestamp_seconds: number;
    label: string;
    description: string | null;
    marker_type: MarkerType;
  }) => void;
}

function MarkerForm({
  mode,
  initialTimestamp,
  initialLabel = "",
  initialDescription = "",
  initialType = "chapter",
  isPending,
  onCancel,
  onSubmit,
}: MarkerFormProps) {
  const [timestamp, setTimestamp] = useState(Math.round(initialTimestamp));
  const [label, setLabel] = useState(initialLabel);
  const [description, setDescription] = useState(initialDescription);
  const [type, setType] = useState<MarkerType>(initialType);

  const canSubmit = label.trim().length > 0 && timestamp >= 0 && !isPending;

  return (
    <div className="px-3 py-2.5 bg-v2-canvas/80 dark:bg-v2-card-tinted/30 border-b border-v2-ring dark:border-v2-ring space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Marker label (e.g., Pricing objection handled)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MarkerType)}
          className="h-7 text-[11px] rounded border border-v2-ring dark:border-v2-ring-strong bg-v2-card px-2 text-v2-ink dark:text-v2-ink-muted"
        >
          {MARKER_TYPES.map((t) => (
            <option key={t} value={t}>
              {MARKER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Optional details..."
        className="w-full text-xs rounded border border-v2-ring dark:border-v2-ring-strong bg-v2-card p-2 resize-none"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          <span>At</span>
          <input
            type="number"
            min={0}
            value={timestamp}
            onChange={(e) => setTimestamp(parseInt(e.target.value, 10) || 0)}
            className="w-16 h-6 rounded border border-v2-ring dark:border-v2-ring-strong bg-v2-card px-1.5 text-[11px] font-mono"
          />
          <span className="font-mono tabular-nums">
            ({formatTimestamp(timestamp)})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px]"
            onClick={onCancel}
            disabled={isPending}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 text-[11px]"
            onClick={() =>
              onSubmit({
                timestamp_seconds: timestamp,
                label: label.trim(),
                description: description.trim() || null,
                marker_type: type,
              })
            }
            disabled={!canSubmit}
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
