// src/features/agent-roadmap/components/admin/ItemListPanel.tsx
//
// Center pane of the roadmap editor. Shows the currently-selected section's
// items as a sortable list. Clicking an item opens the editor drawer (handled
// by the parent via onSelectItem).

import { useCallback, useState } from "react";
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
import { ListChecks } from "lucide-react";
import { useDebouncedField } from "@/features/training-modules";
import {
  useCreateItem,
  useDeleteItem,
  useReorderItems,
  useUpdateSection,
} from "../../index";
import type { RoadmapItem, RoadmapSectionWithItems } from "../../types/roadmap";

interface ItemListPanelProps {
  roadmapId: string;
  section: RoadmapSectionWithItems | null;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}

export function ItemListPanel({
  roadmapId,
  section,
  selectedItemId,
  onSelectItem,
}: ItemListPanelProps) {
  const createMutation = useCreateItem();
  const deleteMutation = useDeleteItem();
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

  const [titleLocal, setTitleLocal] = useDebouncedField(
    section?.title ?? "",
    commitTitle,
  );
  const [descLocal, setDescLocal] = useDebouncedField(
    section?.description ?? "",
    commitDescription,
  );

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

  if (!section) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks className="h-6 w-6 text-zinc-400" />
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
    <section className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-950">
      {/* Section metadata editor */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <Input
          value={titleLocal}
          onChange={(e) => setTitleLocal(e.target.value)}
          placeholder="Section title"
          className="h-9 text-base font-semibold border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-700 px-2 -mx-2 bg-transparent"
        />
        <Textarea
          value={descLocal}
          onChange={(e) => setDescLocal(e.target.value)}
          placeholder="Optional description for this section"
          rows={1}
          className="mt-1 text-sm resize-none border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-700 px-2 -mx-2 bg-transparent min-h-[32px]"
        />
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {section.items.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecks className="h-6 w-6 text-zinc-400" />
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
              className="bg-red-600 hover:bg-red-700"
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
}

function SortableItemRow({
  item,
  isSelected,
  onSelect,
  onDelete,
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-md border ${
        isSelected
          ? "border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950"
      } px-3 py-2.5 transition-colors`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-5 w-5 mt-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Drag to reorder item"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
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
            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              <Clock className="h-2.5 w-2.5" />
              {item.estimated_minutes}m
            </span>
          )}
        </div>
        {item.summary && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {item.summary}
          </p>
        )}
      </button>

      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="h-6 w-6 p-0 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete item"
      >
        <Trash2 className="h-3 w-3" />
      </Button>

      <ChevronRight className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
