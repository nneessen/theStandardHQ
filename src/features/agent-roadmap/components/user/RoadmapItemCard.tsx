// src/features/agent-roadmap/components/user/RoadmapItemCard.tsx
//
// One roadmap item as seen by an agent. Handles:
//   - Checkbox for mark complete / uncheck
//   - "Skip" button for optional items
//   - Expanding to show content blocks
//   - Private notes textarea (debounced save)
//   - Status badge (in_progress / completed / skipped)

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Circle,
  SkipForward,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDebouncedField } from "@/features/training-modules";
import { ContentBlockListView } from "../blocks/ContentBlockView";
import { useUpsertProgress, useUpdateProgressNotes } from "../../index";
import type {
  RoadmapItem,
  RoadmapItemProgressRow,
  RoadmapProgressStatus,
} from "../../types/roadmap";

interface RoadmapItemCardProps {
  item: RoadmapItem;
  roadmapId: string;
  progress: RoadmapItemProgressRow | undefined;
  userId: string;
  /** Whether the item is initially expanded (first uncompleted item opens by default) */
  defaultExpanded?: boolean;
}

export function RoadmapItemCard({
  item,
  roadmapId,
  progress,
  userId,
  defaultExpanded = false,
}: RoadmapItemCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showNotes, setShowNotes] = useState(!!progress?.notes);

  // M-4 fix: useState(defaultExpanded) only uses the initializer on first
  // mount. When the parent recomputes "first unfinished item" after a
  // completion, the new first-unfinished card receives defaultExpanded=true
  // via props — but its state was already false from mount. Without this
  // effect, the "auto-expand next item after completing one" flow silently
  // breaks after the first completion. We deliberately only promote to
  // true (never demote) so user clicks to collapse aren't overridden.
  useEffect(() => {
    if (defaultExpanded) {
      setExpanded(true);
    }
  }, [defaultExpanded]);

  const upsertProgress = useUpsertProgress();
  const updateNotes = useUpdateProgressNotes();

  const status: RoadmapProgressStatus = progress?.status ?? "not_started";
  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";
  const isInProgress = status === "in_progress";
  const isResolved = isCompleted || isSkipped;

  const commitNotes = useCallback(
    (notes: string) => {
      updateNotes.mutate({
        userId,
        itemId: item.id,
        notes: notes || null,
        roadmapId,
      });
    },
    [updateNotes, userId, item.id, roadmapId],
  );

  const [notesLocal, setNotesLocal] = useDebouncedField(
    progress?.notes ?? "",
    commitNotes,
    800,
  );

  function handleToggleComplete() {
    const nextStatus: RoadmapProgressStatus = isCompleted
      ? "in_progress"
      : "completed";
    upsertProgress.mutate({
      userId,
      input: { item_id: item.id, status: nextStatus },
      roadmapId,
    });
  }

  function handleSkip() {
    const nextStatus: RoadmapProgressStatus = isSkipped
      ? "not_started"
      : "skipped";
    upsertProgress.mutate({
      userId,
      input: { item_id: item.id, status: nextStatus },
      roadmapId,
    });
  }

  function handleStart() {
    if (status === "not_started") {
      upsertProgress.mutate({
        userId,
        input: { item_id: item.id, status: "in_progress" },
        roadmapId,
      });
    }
    setExpanded(true);
  }

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isCompleted
          ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/10"
          : isSkipped
            ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 opacity-75"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
      }`}
    >
      {/* Top row: checkbox + title + meta + chevron */}
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={handleToggleComplete}
          disabled={upsertProgress.isPending}
          className={`mt-0.5 shrink-0 h-5 w-5 rounded-full flex items-center justify-center border-2 transition-colors ${
            isCompleted
              ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
              : "border-zinc-300 dark:border-zinc-600 hover:border-emerald-500 dark:hover:border-emerald-500"
          }`}
          aria-label={isCompleted ? "Mark as not complete" : "Mark as complete"}
        >
          {isCompleted && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span
              className={`text-sm font-medium ${
                isCompleted
                  ? "text-zinc-500 dark:text-zinc-500 line-through"
                  : isSkipped
                    ? "text-zinc-500 dark:text-zinc-500"
                    : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {item.title}
            </span>
            {!item.is_required && (
              <Badge variant="secondary" size="sm">
                Optional
              </Badge>
            )}
            {isInProgress && (
              <Badge variant="info" size="sm">
                In progress
              </Badge>
            )}
            {isSkipped && (
              <Badge variant="outline" size="sm">
                Skipped
              </Badge>
            )}
            {item.estimated_minutes && !isResolved && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                <Clock className="h-2.5 w-2.5" />~{item.estimated_minutes}m
              </span>
            )}
          </div>
          {item.summary && !expanded && (
            <p
              className={`text-xs ${
                isResolved
                  ? "text-zinc-500 dark:text-zinc-500"
                  : "text-zinc-600 dark:text-zinc-400"
              } line-clamp-1`}
            >
              {item.summary}
            </p>
          )}
        </button>

        {expanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-400 dark:text-zinc-500 mt-1 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500 mt-1 shrink-0" />
        )}
      </div>

      {/* Expanded body: content blocks + notes + actions */}
      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-4">
          {item.summary && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {item.summary}
            </p>
          )}

          {item.content_blocks.length > 0 ? (
            <ContentBlockListView blocks={item.content_blocks} />
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              No instructions for this item — ask Nick if you get stuck.
            </p>
          )}

          <Separator />

          {/* Notes toggle + textarea */}
          <div>
            {showNotes || notesLocal ? (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">
                  My notes (private)
                </label>
                <Textarea
                  value={notesLocal}
                  onChange={(e) => setNotesLocal(e.target.value)}
                  placeholder="Jot down your own notes on this item — only you and Nick can see them"
                  rows={2}
                  className="text-sm resize-y min-h-[60px]"
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNotes(true)}
                className="h-7 text-xs text-zinc-500 hover:text-zinc-700"
              >
                <MessageSquare className="h-3 w-3 mr-1.5" />
                Add a note
              </Button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isCompleted && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleToggleComplete}
                disabled={upsertProgress.isPending}
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Mark complete
              </Button>
            )}
            {isCompleted && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleComplete}
                disabled={upsertProgress.isPending}
              >
                <Circle className="h-3.5 w-3.5 mr-1.5" />
                Uncheck
              </Button>
            )}

            {!item.is_required && !isCompleted && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={upsertProgress.isPending}
              >
                <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                {isSkipped ? "Un-skip" : "Skip"}
              </Button>
            )}

            {status === "not_started" && !isCompleted && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStart}
                disabled={upsertProgress.isPending}
              >
                Start
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
