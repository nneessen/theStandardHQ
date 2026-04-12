// src/features/agent-roadmap/components/admin/ItemListPanel.tsx
//
// Center pane of the roadmap editor. Shows the currently-selected section's
// items as a sortable list. Clicking an item opens the editor drawer (handled
// by the parent via onSelectItem).

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  GripVertical,
  Plus,
  Clock,
  EyeOff,
  Trash2,
  ChevronRight,
  MoreHorizontal,
  Copy,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListChecks } from "lucide-react";
import { useDebouncedField } from "@/features/training-modules";
import {
  useCreateItem,
  useDeleteItem,
  useDuplicateItem,
  useMoveItem,
  useReorderItems,
  useUpdateSection,
} from "../../index";
import type {
  RoadmapItem,
  RoadmapSectionWithItems,
  RoadmapTree,
} from "../../types/roadmap";

interface ItemListPanelProps {
  roadmapId: string;
  roadmap: RoadmapTree;
  section: RoadmapSectionWithItems | null;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}

export function ItemListPanel({
  roadmapId,
  roadmap,
  section,
  selectedItemId,
  onSelectItem,
}: ItemListPanelProps) {
  const createMutation = useCreateItem();
  const deleteMutation = useDeleteItem();
  const duplicateMutation = useDuplicateItem();
  const moveMutation = useMoveItem();
  const reorderMutation = useReorderItems();
  const updateSectionMutation = useUpdateSection();

  const [deleteTarget, setDeleteTarget] = useState<RoadmapItem | null>(null);

  const commitTitle = useCallback(
    (title: string) => {
      if (!section || !title.trim() || title === section.title) return;
      updateSectionMutation.mutate({
        sectionId: section.id,
        patch: { title: title.trim() },
        roadmapId,
      });
    },
    [section, updateSectionMutation, roadmapId],
  );

  const commitDescription = useCallback(
    (description: string) => {
      if (!section) return;
      if ((section.description ?? "") === description) return;
      updateSectionMutation.mutate({
        sectionId: section.id,
        patch: { description: description || null },
        roadmapId,
      });
    },
    [section, updateSectionMutation, roadmapId],
  );

  const [titleLocal, setTitleLocal, flushTitle] = useDebouncedField(
    section?.title ?? "",
    commitTitle,
  );
  const [descLocal, setDescLocal, flushDesc] = useDebouncedField(
    section?.description ?? "",
    commitDescription,
  );

  // M-1 fix: flush pending debounced saves when the user switches sections.
  // Without this, typing in section A's title then clicking section B could
  // save the typed text to the wrong section (because the debounce fires
  // after the callback ref updates to section B's context).
  const prevSectionIdRef = useRef(section?.id);
  useEffect(() => {
    if (prevSectionIdRef.current && prevSectionIdRef.current !== section?.id) {
      flushTitle();
      flushDesc();
    }
    prevSectionIdRef.current = section?.id;
  }, [section?.id, flushTitle, flushDesc]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!section) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = section.items.findIndex((i) => i.id === active.id);
      const newIndex = section.items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const itemIds = section.items.map((i) => i.id);
      const orderedIds = arrayMove(itemIds, oldIndex, newIndex);
      reorderMutation.mutate({
        sectionId: section.id,
        orderedIds,
        roadmapId,
      });
    },
    [section, reorderMutation, roadmapId],
  );

  const handleAddItem = useCallback(() => {
    if (!section) return;
    createMutation.mutate(
      {
        input: { section_id: section.id, title: "Untitled item" },
        roadmapId,
      },
      {
        onSuccess: (item) => {
          onSelectItem(item.id);
        },
      },
    );
  }, [createMutation, section, roadmapId, onSelectItem]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { itemId: deleteTarget.id, roadmapId },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          if (selectedItemId === deleteTarget.id) {
            onSelectItem("");
          }
        },
      },
    );
  }, [deleteMutation, deleteTarget, roadmapId, selectedItemId, onSelectItem]);

  const handleDuplicate = useCallback(
    (itemId: string) => {
      duplicateMutation.mutate(
        { itemId, roadmapId },
        {
          onSuccess: (newItem) => {
            onSelectItem(newItem.id);
          },
        },
      );
    },
    [duplicateMutation, roadmapId, onSelectItem],
  );

  /**
   * Move an item to a different section, appending at the end.
   * Uses the existing roadmap_move_item RPC — no DnD refactor needed.
   */
  const handleMoveToSection = useCallback(
    (itemId: string, targetSectionId: string) => {
      // Resolve the target section's current item count so we append at the end
      const targetSection = roadmap.sections.find(
        (s) => s.id === targetSectionId,
      );
      const newIndex = targetSection?.items.length ?? 0;
      moveMutation.mutate({
        itemId,
        targetSectionId,
        newIndex,
        roadmapId,
      });
    },
    [moveMutation, roadmap.sections, roadmapId],
  );

  if (!section) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks className="h-6 w-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>Select a section</EmptyTitle>
            <EmptyDescription>
              Pick a section on the left, or create a new one to start adding
              items.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const itemIds = section.items.map((i) => i.id);

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-background">
      {/* Section metadata editor */}
      <div className="px-8 py-5 border-b border-border bg-card">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Section
        </div>
        <Input
          value={titleLocal}
          onChange={(e) => setTitleLocal(e.target.value)}
          placeholder="Section title"
          className="h-10 text-lg font-bold border-transparent hover:border-border focus:border-ring px-2 -mx-2 bg-transparent shadow-none"
        />
        <Textarea
          value={descLocal}
          onChange={(e) => setDescLocal(e.target.value)}
          placeholder="Optional description for this section"
          rows={1}
          className="mt-1 text-sm text-muted-foreground resize-none border-transparent hover:border-border focus:border-ring px-2 -mx-2 bg-transparent min-h-[32px] shadow-none"
        />
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {section.items.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecks className="h-6 w-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No items in this section</EmptyTitle>
              <EmptyDescription>
                Add the first item an agent should complete in this section.
              </EmptyDescription>
            </EmptyHeader>
            <div className="mt-3">
              <Button onClick={handleAddItem} size="sm" variant="primary">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add item
              </Button>
            </div>
          </Empty>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedItemId}
                    onSelect={() => onSelectItem(item.id)}
                    onDelete={() => setDeleteTarget(item)}
                    onDuplicate={() => handleDuplicate(item.id)}
                    onMoveToSection={(targetSectionId) =>
                      handleMoveToSection(item.id, targetSectionId)
                    }
                    allSections={roadmap.sections}
                    currentSectionId={section.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {section.items.length > 0 && (
          <div className="mt-3">
            <Button
              onClick={handleAddItem}
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={createMutation.isPending}
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" and any agent progress on it will be
              permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ============================================================================
// Sortable row
// ============================================================================

interface SortableItemRowProps {
  item: RoadmapItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveToSection: (targetSectionId: string) => void;
  allSections: RoadmapSectionWithItems[];
  currentSectionId: string;
}

function SortableItemRow({
  item,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onMoveToSection,
  allSections,
  currentSectionId,
}: SortableItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-3 rounded-lg border px-4 py-3 transition-all cursor-pointer ${
        isDragging
          ? "border-ring bg-card shadow-xl ring-2 ring-ring/40 z-10 relative"
          : isSelected
            ? "border-ring bg-card shadow-md ring-1 ring-ring/20"
            : "border-border bg-card shadow-sm hover:border-ring hover:shadow-md"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-6 w-6 mt-0.5 rounded text-muted-foreground/40 transition-all hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100"
        aria-label="Drag to reorder item"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">
            {item.title || "Untitled item"}
          </span>
          {!item.is_published && (
            <Badge variant="outline" size="sm" className="gap-1">
              <EyeOff className="h-2.5 w-2.5" />
              Draft
            </Badge>
          )}
          {!item.is_required && (
            <Badge variant="secondary" size="sm">
              Optional
            </Badge>
          )}
          {item.estimated_minutes && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {item.estimated_minutes}m
            </span>
          )}
        </div>
        {item.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {item.summary}
          </p>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => e.stopPropagation()}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onDuplicate();
            }}
            className="gap-2"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate item
          </DropdownMenuItem>

          {allSections.filter((s) => s.id !== currentSectionId).length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Move to section
              </DropdownMenuLabel>
              {allSections
                .filter((s) => s.id !== currentSectionId)
                .map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      onMoveToSection(s.id);
                    }}
                    className="gap-2"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">
                      {s.title || "Untitled section"}
                    </span>
                  </DropdownMenuItem>
                ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChevronRight className="h-4 w-4 text-muted-foreground/50 mt-1 shrink-0 opacity-0 group-hover:opacity-100 group-hover:text-foreground transition-all" />
    </div>
  );
}
