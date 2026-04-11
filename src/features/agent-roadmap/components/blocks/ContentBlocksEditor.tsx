// src/features/agent-roadmap/components/blocks/ContentBlocksEditor.tsx
//
// Holds the content_blocks array for a single roadmap item and dispatches
// to the appropriate per-type editor. Uses @dnd-kit for drag-reorder.
//
// This component is intentionally controlled: it takes `blocks` + `onChange`
// from the parent (ItemEditorDrawer). That keeps state consolidated at the
// drawer level and lets the drawer commit the whole array in one update.

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Blocks } from "lucide-react";
import type {
  RoadmapContentBlock,
  RoadmapContentBlockType,
} from "../../types/contentBlocks";
import { CONTENT_BLOCK_LABELS } from "../../types/contentBlocks";
import { BlockTypePickerMenu, createEmptyBlock } from "./BlockTypePickerMenu";
import { RichTextBlockEditor } from "./RichTextBlockEditor";
import { ImageBlockEditor } from "./ImageBlockEditor";
import { VideoBlockEditor } from "./VideoBlockEditor";
import { ExternalLinkBlockEditor } from "./ExternalLinkBlockEditor";
import { CalloutBlockEditor } from "./CalloutBlockEditor";
import { CodeSnippetBlockEditor } from "./CodeSnippetBlockEditor";
import { MAX_CONTENT_BLOCKS_PER_ITEM } from "../../constants";

interface ContentBlocksEditorProps {
  blocks: RoadmapContentBlock[];
  onChange: (blocks: RoadmapContentBlock[]) => void;
  /** Context for image uploads */
  agencyId: string;
  roadmapId: string;
  itemId: string;
}

export function ContentBlocksEditor({
  blocks,
  onChange,
  agencyId,
  roadmapId,
  itemId,
}: ContentBlocksEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Ensure blocks are always sorted by `order` before render
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  const blockIds = sortedBlocks.map((b) => b.id);

  const handleAddBlock = useCallback(
    (type: RoadmapContentBlockType) => {
      const nextOrder = sortedBlocks.length;
      const newBlock = createEmptyBlock(type, nextOrder);
      onChange([...sortedBlocks, newBlock]);
    },
    [sortedBlocks, onChange],
  );

  const handleUpdateBlock = useCallback(
    (updated: RoadmapContentBlock) => {
      onChange(sortedBlocks.map((b) => (b.id === updated.id ? updated : b)));
    },
    [sortedBlocks, onChange],
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      const filtered = sortedBlocks
        .filter((b) => b.id !== blockId)
        .map((b, idx) => ({ ...b, order: idx }));
      onChange(filtered);
    },
    [sortedBlocks, onChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedBlocks.findIndex((b) => b.id === active.id);
      const newIndex = sortedBlocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortedBlocks, oldIndex, newIndex).map(
        (b, idx) => ({ ...b, order: idx }),
      );
      onChange(reordered);
    },
    [sortedBlocks, onChange],
  );

  const atMax = sortedBlocks.length >= MAX_CONTENT_BLOCKS_PER_ITEM;

  return (
    <div className="space-y-3">
      {sortedBlocks.length === 0 ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Blocks className="h-6 w-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>No content yet</EmptyTitle>
            <EmptyDescription>
              Add text, images, videos, links, callouts, or code to explain what
              the agent needs to do.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blockIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedBlocks.map((block) => (
                <SortableBlockRow
                  key={block.id}
                  block={block}
                  agencyId={agencyId}
                  roadmapId={roadmapId}
                  itemId={itemId}
                  onUpdate={handleUpdateBlock}
                  onDelete={handleDeleteBlock}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center justify-between">
        <BlockTypePickerMenu onPick={handleAddBlock} disabled={atMax} />
        {atMax && (
          <span className="text-xs font-medium text-warning">
            Max {MAX_CONTENT_BLOCKS_PER_ITEM} blocks reached
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Per-block sortable row
// ============================================================================

interface SortableBlockRowProps {
  block: RoadmapContentBlock;
  agencyId: string;
  roadmapId: string;
  itemId: string;
  onUpdate: (block: RoadmapContentBlock) => void;
  onDelete: (blockId: string) => void;
}

function SortableBlockRow({
  block,
  agencyId,
  roadmapId,
  itemId,
  onUpdate,
  onDelete,
}: SortableBlockRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/block flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:border-ring hover:shadow-md"
    >
      {/* Drag handle — always visible but subtle at rest */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-7 w-7 mt-0.5 rounded-md text-muted-foreground/50 transition-colors hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing group-hover/block:text-muted-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            {CONTENT_BLOCK_LABELS[block.type]}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(block.id)}
            className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete block"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <BlockEditorDispatch
          block={block}
          agencyId={agencyId}
          roadmapId={roadmapId}
          itemId={itemId}
          onChange={onUpdate}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Editor dispatch — picks the right editor for the block type
// ============================================================================

interface BlockEditorDispatchProps {
  block: RoadmapContentBlock;
  agencyId: string;
  roadmapId: string;
  itemId: string;
  onChange: (block: RoadmapContentBlock) => void;
}

function BlockEditorDispatch({
  block,
  agencyId,
  roadmapId,
  itemId,
  onChange,
}: BlockEditorDispatchProps) {
  switch (block.type) {
    case "rich_text":
      return <RichTextBlockEditor block={block} onChange={onChange} />;
    case "image":
      return (
        <ImageBlockEditor
          block={block}
          agencyId={agencyId}
          roadmapId={roadmapId}
          itemId={itemId}
          onChange={onChange}
        />
      );
    case "video":
      return <VideoBlockEditor block={block} onChange={onChange} />;
    case "external_link":
      return <ExternalLinkBlockEditor block={block} onChange={onChange} />;
    case "callout":
      return <CalloutBlockEditor block={block} onChange={onChange} />;
    case "code_snippet":
      return <CodeSnippetBlockEditor block={block} onChange={onChange} />;
    default: {
      const exhaustive: never = block;
      console.warn("Unknown roadmap content block type:", exhaustive);
      return null;
    }
  }
}
