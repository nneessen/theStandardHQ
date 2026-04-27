// src/features/recruiting/admin/ChecklistItemList.tsx

import { useCallback, useMemo, memo } from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2 } from "lucide-react";
import type { PhaseChecklistItem } from "@/types/recruiting.types";
import { SortableChecklistItem } from "./SortableChecklistItem";

interface ChecklistItemListProps {
  items: PhaseChecklistItem[];
  isLoading: boolean;
  expandedItemId: string | null;
  onReorder: (itemIds: string[]) => Promise<void>;
  onToggleExpand: (itemId: string) => void;
  onEdit: (item: PhaseChecklistItem) => void;
  onDelete: (itemId: string) => void;
  /** When true, hides edit/delete actions */
  readOnly?: boolean;
}

function ChecklistItemListComponent({
  items,
  isLoading,
  expandedItemId,
  onReorder,
  onToggleExpand,
  onEdit,
  onDelete,
  readOnly = false,
}: ChecklistItemListProps) {
  // Memoize sorted items to prevent unnecessary re-renders
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.item_order - b.item_order),
    [items],
  );

  // DnD-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Handle drag end for reordering - error handling is done by parent
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedItems.findIndex((i) => i.id === active.id);
      const newIndex = sortedItems.findIndex((i) => i.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedItems, oldIndex, newIndex);
        await onReorder(newOrder.map((i) => i.id));
      }
    },
    [sortedItems, onReorder],
  );

  // Stable callback for move up - uses item ID instead of index
  const handleMoveUp = useCallback(
    async (itemId: string) => {
      const currentIndex = sortedItems.findIndex((i) => i.id === itemId);
      if (currentIndex <= 0) return;
      const newOrder = arrayMove(sortedItems, currentIndex, currentIndex - 1);
      await onReorder(newOrder.map((i) => i.id));
    },
    [sortedItems, onReorder],
  );

  // Stable callback for move down - uses item ID instead of index
  const handleMoveDown = useCallback(
    async (itemId: string) => {
      const currentIndex = sortedItems.findIndex((i) => i.id === itemId);
      if (currentIndex === -1 || currentIndex >= sortedItems.length - 1) return;
      const newOrder = arrayMove(sortedItems, currentIndex, currentIndex + 1);
      await onReorder(newOrder.map((i) => i.id));
    },
    [sortedItems, onReorder],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="text-[10px] text-v2-ink-muted text-center py-2">
        No checklist items
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedItems.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {sortedItems.map((item, index) => (
            <SortableChecklistItem
              key={item.id}
              item={item}
              index={index}
              isExpanded={expandedItemId === item.id}
              isFirst={index === 0}
              isLast={index === sortedItems.length - 1}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              readOnly={readOnly}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export const ChecklistItemList = memo(ChecklistItemListComponent);
