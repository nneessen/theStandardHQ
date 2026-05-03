// src/features/recruiting/admin/ChecklistItemEditor.tsx

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useChecklistItems,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useReorderChecklistItems,
} from "../hooks/usePipeline";
import type {
  PhaseChecklistItem,
  CreateChecklistItemInput,
} from "@/types/recruiting.types";
import { ChecklistItemList } from "./ChecklistItemList";
import { ChecklistItemFormDialog } from "./ChecklistItemFormDialog";

interface ChecklistItemEditorProps {
  phaseId: string;
  /** When true, hides add/edit/delete actions */
  readOnly?: boolean;
}

export function ChecklistItemEditor({
  phaseId,
  readOnly = false,
}: ChecklistItemEditorProps) {
  const { data: items, isLoading } = useChecklistItems(phaseId);
  const createItem = useCreateChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const reorderItems = useReorderChecklistItems();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PhaseChecklistItem | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Handle reordering - centralized error handling
  const handleReorder = useCallback(
    async (itemIds: string[]) => {
      try {
        await reorderItems.mutateAsync({ phaseId, itemIds });
      } catch (_error) {
        toast.error("Failed to reorder items");
      }
    },
    [phaseId, reorderItems],
  );

  // Handle toggle expand
  const handleToggleExpand = useCallback((itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  // Handle create - centralized error handling
  const handleCreate = useCallback(
    async (data: CreateChecklistItemInput) => {
      try {
        await createItem.mutateAsync({ phaseId, data });
        toast.success("Item created");
        setCreateDialogOpen(false);
      } catch (_error) {
        toast.error("Failed to create item");
        throw _error; // Re-throw so form dialog knows it failed
      }
    },
    [phaseId, createItem],
  );

  // Handle update - centralized error handling
  const handleUpdate = useCallback(
    async (data: CreateChecklistItemInput) => {
      if (!editingItem) return;
      try {
        await updateItem.mutateAsync({
          itemId: editingItem.id,
          updates: data,
        });
        toast.success("Item updated");
        setEditingItem(null);
      } catch (_error) {
        toast.error("Failed to update item");
        throw _error; // Re-throw so form dialog knows it failed
      }
    },
    [editingItem, updateItem],
  );

  // Handle delete - centralized error handling
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteItem.mutateAsync({ itemId: id, phaseId });
        toast.success("Item deleted");
        setDeleteConfirmId(null);
      } catch (_error) {
        toast.error("Failed to delete item");
      }
    },
    [phaseId, deleteItem],
  );

  // Get items count for header
  const itemCount = items?.length ?? 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Checklist Items ({itemCount})
        </span>
        {!readOnly && (
          <Button
            size="sm"
            variant="success"
            className="h-6 text-[10px]"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Item
          </Button>
        )}
      </div>

      {/* List */}
      <ChecklistItemList
        items={items ?? []}
        isLoading={isLoading}
        expandedItemId={expandedItemId}
        onReorder={handleReorder}
        onToggleExpand={handleToggleExpand}
        onEdit={setEditingItem}
        onDelete={setDeleteConfirmId}
        readOnly={readOnly}
      />

      {/* Create Dialog */}
      <ChecklistItemFormDialog
        mode="create"
        open={createDialogOpen}
        isPending={createItem.isPending}
        onSubmit={handleCreate}
        onClose={() => setCreateDialogOpen(false)}
      />

      {/* Edit Dialog */}
      <ChecklistItemFormDialog
        mode="edit"
        open={!!editingItem}
        editingItem={editingItem}
        isPending={updateItem.isPending}
        onSubmit={handleUpdate}
        onClose={() => setEditingItem(null)}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm p-3 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Item?</DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            This will permanently delete this checklist item.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending && (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
