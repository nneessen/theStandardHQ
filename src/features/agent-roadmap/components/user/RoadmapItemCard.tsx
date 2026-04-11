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
      className={`rounded-xl border shadow-sm transition-all ${
        isCompleted
          ? "border-success/30 bg-success/[0.04]"
          : isSkipped
            ? "border-border bg-muted/40 opacity-75"
            : "border-border bg-card hover:border-ring hover:shadow-md"
      }`}
    >
      {/* Top row: checkbox + title + meta + chevron */}
      <div className="flex items-start gap-4 px-5 py-4">
        <button
          type="button"
          onClick={handleToggleComplete}
          disabled={upsertProgress.isPending}
          className={`mt-0.5 shrink-0 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${
            isCompleted
              ? "bg-success border-success text-success-foreground shadow-sm hover:opacity-90 active:scale-95"
              : "border-border bg-card hover:border-success hover:bg-success/5 active:scale-95"
          }`}
          aria-label={isCompleted ? "Mark as not complete" : "Mark as complete"}
        >
          {isCompleted && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-base font-semibold leading-snug ${
                isCompleted
                  ? "text-muted-foreground line-through"
                  : isSkipped
                    ? "text-muted-foreground"
                    : "text-foreground"
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
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />~{item.estimated_minutes}m
              </span>
            )}
          </div>
          {item.summary && !expanded && (
            <p
              className={`text-sm leading-relaxed ${
                isResolved
                  ? "text-muted-foreground/70"
                  : "text-muted-foreground"
              } line-clamp-1`}
            >
              {item.summary}
            </p>
          )}
        </button>

        {expanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
        )}
      </div>

      {/* Expanded body: content blocks + notes + actions */}
      {expanded && (
        <div className="border-t border-border px-5 py-5 space-y-5 bg-background/30">
          {item.summary && (
            <p className="text-sm text-foreground leading-relaxed font-medium">
              {item.summary}
            </p>
          )}

          {item.content_blocks.length > 0 ? (
            <ContentBlockListView blocks={item.content_blocks} />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No instructions for this item — ask Nick if you get stuck.
            </p>
          )}

          <Separator />

          {/* Notes toggle + textarea */}
          <div>
            {showNotes || notesLocal ? (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  My notes (private)
                </label>
                <Textarea
                  value={notesLocal}
                  onChange={(e) => setNotesLocal(e.target.value)}
                  placeholder="Jot down your own notes on this item — only you and Nick can see them"
                  rows={2}
                  className="text-sm resize-y min-h-[64px] bg-card"
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNotes(true)}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
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
