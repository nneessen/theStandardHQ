// src/features/agent-roadmap/components/admin/ItemEditorDrawer.tsx
//
// Right-side Sheet that opens when the admin clicks an item in the list.
// Contains all item metadata + the content blocks editor.
//
// All fields autosave via useDebouncedField. On close, we call flush() on
// each debounced field to guarantee no in-flight edit is dropped.

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useDebouncedField } from "@/features/training-modules";
import { useUpdateItem } from "../../index";
import { ContentBlocksEditor } from "../blocks/ContentBlocksEditor";
import type { RoadmapItem } from "../../types/roadmap";
import type { RoadmapContentBlock } from "../../types/contentBlocks";

interface ItemEditorDrawerProps {
  item: RoadmapItem | null;
  roadmapId: string;
  agencyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemEditorDrawer({
  item,
  roadmapId,
  agencyId,
  open,
  onOpenChange,
}: ItemEditorDrawerProps) {
  // Guard against rendering the inner editor when there's no item yet —
  // avoids calling hooks with undefined values.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0"
      >
        {item ? (
          <ItemEditorDrawerInner
            item={item}
            roadmapId={roadmapId}
            agencyId={agencyId}
          />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// Inner editor — mounted only when an item is selected
// ============================================================================

interface ItemEditorDrawerInnerProps {
  item: RoadmapItem;
  roadmapId: string;
  agencyId: string;
}

function ItemEditorDrawerInner({
  item,
  roadmapId,
  agencyId,
}: ItemEditorDrawerInnerProps) {
  const updateMutation = useUpdateItem();

  // Debounced commit callbacks — memoized so useDebouncedField's setValue
  // identity stays stable
  const commitTitle = useCallback(
    (title: string) => {
      if (!title.trim() || title === item.title) return;
      updateMutation.mutate({
        itemId: item.id,
        patch: { title: title.trim() },
        roadmapId,
      });
    },
    [item.id, item.title, updateMutation, roadmapId],
  );

  const commitSummary = useCallback(
    (summary: string) => {
      if ((item.summary ?? "") === summary) return;
      updateMutation.mutate({
        itemId: item.id,
        patch: { summary: summary || null },
        roadmapId,
      });
    },
    [item.id, item.summary, updateMutation, roadmapId],
  );

  const commitEstimatedMinutes = useCallback(
    (raw: string) => {
      const parsed = raw.trim() === "" ? null : parseInt(raw, 10);
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
      if (parsed === (item.estimated_minutes ?? null)) return;
      updateMutation.mutate({
        itemId: item.id,
        patch: { estimated_minutes: parsed },
        roadmapId,
      });
    },
    [item.id, item.estimated_minutes, updateMutation, roadmapId],
  );

  // Content blocks: held in a local ref so ContentBlocksEditor's onChange
  // updates directly, and we debounce the server commit.
  const commitContentBlocks = useCallback(
    (blocks: RoadmapContentBlock[]) => {
      updateMutation.mutate({
        itemId: item.id,
        patch: { content_blocks: blocks },
        roadmapId,
      });
    },
    [item.id, updateMutation, roadmapId],
  );

  const [titleLocal, setTitleLocal, flushTitle] = useDebouncedField(
    item.title,
    commitTitle,
  );
  const [summaryLocal, setSummaryLocal, flushSummary] = useDebouncedField(
    item.summary ?? "",
    commitSummary,
  );
  const [minutesLocal, setMinutesLocal, flushMinutes] = useDebouncedField(
    item.estimated_minutes?.toString() ?? "",
    commitEstimatedMinutes,
  );
  const [blocksLocal, setBlocksLocal, flushBlocks] = useDebouncedField(
    item.content_blocks,
    commitContentBlocks,
    800, // slightly longer debounce for the heavier content_blocks payload
  );

  // Keep flush functions alive across renders so the unmount cleanup uses
  // the latest identity
  const flushRefs = useRef({
    title: flushTitle,
    summary: flushSummary,
    minutes: flushMinutes,
    blocks: flushBlocks,
  });
  useEffect(() => {
    flushRefs.current = {
      title: flushTitle,
      summary: flushSummary,
      minutes: flushMinutes,
      blocks: flushBlocks,
    };
  }, [flushTitle, flushSummary, flushMinutes, flushBlocks]);

  // Flush any pending debounced save when the drawer closes (inner unmounts)
  useEffect(() => {
    return () => {
      flushRefs.current.title();
      flushRefs.current.summary();
      flushRefs.current.minutes();
      flushRefs.current.blocks();
    };
  }, []);

  function handleToggleRequired(checked: boolean) {
    updateMutation.mutate({
      itemId: item.id,
      patch: { is_required: checked },
      roadmapId,
    });
  }

  function handleTogglePublished(checked: boolean) {
    updateMutation.mutate({
      itemId: item.id,
      patch: { is_published: checked },
      roadmapId,
    });
  }

  // Keep local blocks in sync with whatever is in the drawer editor
  const handleBlocksChange = useCallback(
    (next: RoadmapContentBlock[]) => {
      setBlocksLocal(next);
    },
    [setBlocksLocal],
  );

  const sortedBlocks = useMemo(
    () => [...blocksLocal].sort((a, b) => a.order - b.order),
    [blocksLocal],
  );

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
        <SheetTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Edit item
        </SheetTitle>
        <SheetDescription className="sr-only">
          Edit item details and content
        </SheetDescription>
        <Input
          value={titleLocal}
          onChange={(e) => setTitleLocal(e.target.value)}
          placeholder="Item title"
          className="h-9 text-base font-semibold border-transparent hover:border-border focus:border-ring px-2 -mx-2 bg-transparent"
        />
        <Textarea
          value={summaryLocal}
          onChange={(e) => setSummaryLocal(e.target.value)}
          placeholder="Optional 1-line summary shown in the list"
          rows={1}
          className="mt-1 text-sm resize-none border-transparent hover:border-border focus:border-ring px-2 -mx-2 bg-transparent min-h-[32px]"
        />
      </SheetHeader>

      {/* Metadata toggles */}
      <div className="px-6 py-4 border-b border-border space-y-3 bg-muted/30">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div>
            <Label className="text-sm font-medium text-foreground">
              Required
            </Label>
            <p className="text-xs text-muted-foreground">
              Counts toward completion %
            </p>
          </div>
          <Switch
            checked={item.is_required}
            onCheckedChange={handleToggleRequired}
            aria-label="Toggle required"
          />
        </div>

        <Separator />

        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div>
            <Label className="text-sm font-medium text-foreground">
              Published
            </Label>
            <p className="text-xs text-muted-foreground">
              Unpublish to hide from agents while you work
            </p>
          </div>
          <Switch
            checked={item.is_published}
            onCheckedChange={handleTogglePublished}
            aria-label="Toggle published"
          />
        </div>

        <Separator />

        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div>
            <Label
              htmlFor={`est-${item.id}`}
              className="text-sm font-medium text-foreground"
            >
              Estimated time
            </Label>
            <p className="text-xs text-muted-foreground">
              Shown as a small "~15m" badge
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Input
              id={`est-${item.id}`}
              type="number"
              min={0}
              value={minutesLocal}
              onChange={(e) => setMinutesLocal(e.target.value)}
              placeholder="—"
              className="h-8 w-20 text-sm text-right"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
      </div>

      {/* Content blocks */}
      <div className="flex-1 px-6 py-5">
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            Instructions
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build step-by-step content for agents. Mix text, images, videos,
            links, and callouts.
          </p>
        </div>
        <ContentBlocksEditor
          blocks={sortedBlocks}
          onChange={handleBlocksChange}
          agencyId={agencyId}
          roadmapId={roadmapId}
          itemId={item.id}
        />
      </div>
    </div>
  );
}
