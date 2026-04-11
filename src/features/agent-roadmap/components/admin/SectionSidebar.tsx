// src/features/agent-roadmap/components/admin/SectionSidebar.tsx
//
// Left rail of the roadmap editor. Sortable list of sections with a
// per-section item count, drag handles, and a "+ Add section" button.

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
import { GripVertical, Plus, Trash2, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateSection,
  useDeleteSection,
  useReorderSections,
} from "../../index";
import type { RoadmapTree, RoadmapSectionWithItems } from "../../types/roadmap";

interface SectionSidebarProps {
  roadmap: RoadmapTree;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
}

export function SectionSidebar({
  roadmap,
  selectedSectionId,
  onSelectSection,
}: SectionSidebarProps) {
  const createMutation = useCreateSection();
  const deleteMutation = useDeleteSection();
  const reorderMutation = useReorderSections();

  const [deleteTarget, setDeleteTarget] =
    useState<RoadmapSectionWithItems | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sectionIds = roadmap.sections.map((s) => s.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = roadmap.sections.findIndex((s) => s.id === active.id);
      const newIndex = roadmap.sections.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const orderedIds = arrayMove(sectionIds, oldIndex, newIndex);
      reorderMutation.mutate({ roadmapId: roadmap.id, orderedIds });
    },
    [roadmap.sections, roadmap.id, sectionIds, reorderMutation],
  );

  const handleAddSection = useCallback(() => {
    createMutation.mutate(
      { roadmap_id: roadmap.id, title: "Untitled section" },
      {
        onSuccess: (section) => {
          onSelectSection(section.id);
        },
      },
    );
  }, [createMutation, roadmap.id, onSelectSection]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { sectionId: deleteTarget.id, roadmapId: roadmap.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          if (selectedSectionId === deleteTarget.id) {
            const remaining = roadmap.sections.filter(
              (s) => s.id !== deleteTarget.id,
            );
            onSelectSection(remaining[0]?.id ?? "");
          }
          toast.success("Section deleted");
        },
      },
    );
  }, [
    deleteMutation,
    deleteTarget,
    roadmap.id,
    roadmap.sections,
    selectedSectionId,
    onSelectSection,
  ]);

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header: always-visible "+ Add section" button lives here. When the
          list is empty, the header button is the user's entry point. When
          the list is long, it's still visible at the top. */}
      <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Sections
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              · {roadmap.sections.length}
            </span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAddSection}
            disabled={createMutation.isPending}
            className="h-7 px-2 gap-1 text-xs"
            aria-label="Add section"
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {roadmap.sections.length === 0 ? (
          <div className="px-4 py-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListTree className="h-6 w-6 text-zinc-400" />
                </EmptyMedia>
                <EmptyTitle className="text-sm">No sections yet</EmptyTitle>
                <EmptyDescription className="text-xs">
                  Sections group related items (e.g. "Week 1: Setup", "Week 2:
                  CRM").
                </EmptyDescription>
              </EmptyHeader>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleAddSection}
                  disabled={createMutation.isPending}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create first section
                </Button>
              </div>
            </Empty>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="px-2 space-y-0.5">
                {roadmap.sections.map((section) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    isSelected={section.id === selectedSectionId}
                    onSelect={() => onSelectSection(section.id)}
                    onDelete={() => setDeleteTarget(section)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Bottom footer button — only shown when we have sections, so the
          user can add another one without scrolling back to the top. */}
      {roadmap.sections.length > 0 && (
        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddSection}
            disabled={createMutation.isPending}
            className="w-full gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add section
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" contains{" "}
              <strong>{deleteTarget?.items.length ?? 0}</strong> item(s). They
              will be permanently deleted along with any agent progress. This
              cannot be undone.
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
    </aside>
  );
}

// ============================================================================
// Sortable row
// ============================================================================

interface SortableSectionRowProps {
  section: RoadmapSectionWithItems;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableSectionRow({
  section,
  isSelected,
  onSelect,
  onDelete,
}: SortableSectionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 rounded-md px-1.5 py-1.5 ${
        isSelected
          ? "bg-zinc-200 dark:bg-zinc-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-5 w-5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Drag to reorder section"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left px-1 py-0.5"
      >
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {section.title || "Untitled section"}
        </div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {section.items.length} item{section.items.length === 1 ? "" : "s"}
        </div>
      </button>

      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="h-5 w-5 p-0 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete section"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
