// src/features/recruiting/admin/PhaseEditor.tsx

import React, { useState, useCallback } from "react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Loader2,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePhases,
  useCreatePhase,
  useUpdatePipelinePhase,
  useDeletePhase,
  useReorderPhases,
} from "../hooks/usePipeline";
import { ChecklistItemEditor } from "./ChecklistItemEditor";
import { PhaseAutomationConfig } from "./PhaseAutomationConfig";
import type { PipelinePhase, CreatePhaseInput } from "@/types/recruiting.types";

interface PhaseEditorProps {
  templateId: string;
  /** When true, hides add/edit/delete actions */
  readOnly?: boolean;
}

// Sortable Phase Item Component
interface SortablePhaseItemProps {
  phase: PipelinePhase;
  index: number;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  readOnly?: boolean;
}

function SortablePhaseItem({
  phase,
  index,
  isExpanded,
  isFirst,
  isLast,
  onToggleExpand,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  readOnly = false,
}: SortablePhaseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-background rounded-md border border-border shadow-sm"
    >
      {/* Phase Row */}
      <div
        className="flex items-center gap-2 p-2.5 hover:bg-muted/50 cursor-pointer rounded-t-md border-l-2 border-l-primary/60"
        onClick={onToggleExpand}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
        >
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
        >
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
        <span className="text-[10px] text-muted-foreground font-mono w-5">
          {index + 1}
        </span>
        <span className="text-[11px] font-medium text-foreground flex-1">
          {phase.phase_name}
        </span>
        <Badge
          variant="outline"
          className="text-[9px] h-4 px-1.5 border-border"
        >
          {phase.estimated_days || 0} days
        </Badge>
        {phase.auto_advance && (
          <Badge
            variant="secondary"
            className="text-[9px] h-4 px-1.5 bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]"
          >
            Auto
          </Badge>
        )}
        {!phase.visible_to_recruit && (
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 border-[hsl(var(--warning))]/50 text-[hsl(var(--warning))]"
          >
            <EyeOff className="h-2.5 w-2.5 mr-0.5" />
            Hidden
          </Badge>
        )}
        {!readOnly && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit2 className="h-3 w-3 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-destructive hover:text-destructive/80"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {/* Expanded: Checklist Items & Automations */}
      {isExpanded && (
        <div className="m-2 p-3 rounded-md bg-muted/40 space-y-4">
          <ChecklistItemEditor phaseId={phase.id} readOnly={readOnly} />
          <div className="border-t border-border/50 pt-3">
            <PhaseAutomationConfig phaseId={phase.id} readOnly={readOnly} />
          </div>
        </div>
      )}
    </div>
  );
}

export function PhaseEditor({
  templateId,
  readOnly = false,
}: PhaseEditorProps) {
  const { data: phases, isLoading } = usePhases(templateId);
  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePipelinePhase();
  const deletePhase = useDeletePhase();
  const reorderPhases = useReorderPhases();

  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<PipelinePhase | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [phaseForm, setPhaseForm] = useState<CreatePhaseInput>({
    phase_name: "",
    phase_description: "",
    estimated_days: 7,
    auto_advance: false,
    visible_to_recruit: true,
  });

  const sortedPhases = [...(phases || [])].sort(
    (a, b) => a.phase_order - b.phase_order,
  );

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedPhases.findIndex((p) => p.id === active.id);
      const newIndex = sortedPhases.findIndex((p) => p.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedPhases, oldIndex, newIndex);
        try {
          await reorderPhases.mutateAsync({
            templateId,
            phaseIds: newOrder.map((p) => p.id),
          });
        } catch (_error) {
          toast.error("Failed to reorder phases");
        }
      }
    },
    [sortedPhases, templateId, reorderPhases],
  );

  // Handle move up button
  const handleMoveUp = useCallback(
    async (index: number) => {
      if (index === 0) return;
      const newOrder = arrayMove(sortedPhases, index, index - 1);
      try {
        await reorderPhases.mutateAsync({
          templateId,
          phaseIds: newOrder.map((p) => p.id),
        });
      } catch (_error) {
        toast.error("Failed to reorder phases");
      }
    },
    [sortedPhases, templateId, reorderPhases],
  );

  // Handle move down button
  const handleMoveDown = useCallback(
    async (index: number) => {
      if (index === sortedPhases.length - 1) return;
      const newOrder = arrayMove(sortedPhases, index, index + 1);
      try {
        await reorderPhases.mutateAsync({
          templateId,
          phaseIds: newOrder.map((p) => p.id),
        });
      } catch (_error) {
        toast.error("Failed to reorder phases");
      }
    },
    [sortedPhases, templateId, reorderPhases],
  );

  const handleCreatePhase = async () => {
    if (!phaseForm.phase_name.trim()) {
      toast.error("Phase name is required");
      return;
    }

    try {
      await createPhase.mutateAsync({
        templateId,
        data: phaseForm,
      });
      toast.success("Phase created");
      setCreateDialogOpen(false);
      setPhaseForm({
        phase_name: "",
        phase_description: "",
        estimated_days: 7,
        auto_advance: false,
        visible_to_recruit: true,
      });
    } catch (_error) {
      toast.error("Failed to create phase");
    }
  };

  const handleUpdatePhase = async () => {
    if (!editingPhase) return;

    try {
      await updatePhase.mutateAsync({
        phaseId: editingPhase.id,
        updates: {
          phase_name: editingPhase.phase_name,
          phase_description: editingPhase.phase_description ?? undefined,
          estimated_days: editingPhase.estimated_days ?? undefined,
          auto_advance: editingPhase.auto_advance,
          visible_to_recruit: editingPhase.visible_to_recruit,
        },
      });
      toast.success("Phase updated");
      setEditingPhase(null);
    } catch (_error) {
      toast.error("Failed to update phase");
    }
  };

  const handleDeletePhase = async (id: string) => {
    try {
      await deletePhase.mutateAsync({ phaseId: id, templateId });
      toast.success("Phase deleted");
      setDeleteConfirmId(null);
      if (expandedPhase === id) {
        setExpandedPhase(null);
      }
    } catch (_error) {
      toast.error("Failed to delete phase");
    }
  };

  const toggleExpand = (phaseId: string) => {
    setExpandedPhase(expandedPhase === phaseId ? null : phaseId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Pipeline Phases ({sortedPhases.length})
        </h3>
        {!readOnly && (
          <Button
            size="sm"
            variant="default"
            className="h-7 px-3 text-[11px]"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Phase
          </Button>
        )}
      </div>

      {sortedPhases.length === 0 ? (
        <div className="text-center py-6 text-[11px] text-muted-foreground">
          No phases yet. Add your first phase to get started.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedPhases.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {sortedPhases.map((phase, index) => (
                <SortablePhaseItem
                  key={phase.id}
                  phase={phase}
                  index={index}
                  isExpanded={expandedPhase === phase.id}
                  isFirst={index === 0}
                  isLast={index === sortedPhases.length - 1}
                  onToggleExpand={() => toggleExpand(phase.id)}
                  onEdit={() => setEditingPhase(phase)}
                  onDelete={() => setDeleteConfirmId(phase.id)}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Create Phase Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md p-3 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Phase</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Phase Name
              </Label>
              <Input
                value={phaseForm.phase_name}
                onChange={(e) =>
                  setPhaseForm({ ...phaseForm, phase_name: e.target.value })
                }
                placeholder="e.g., Background Check"
                className="h-7 text-[11px] bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Description
              </Label>
              <Textarea
                value={phaseForm.phase_description || ""}
                onChange={(e) =>
                  setPhaseForm({
                    ...phaseForm,
                    phase_description: e.target.value,
                  })
                }
                placeholder="Optional description..."
                className="text-[11px] min-h-14 bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Estimated Days
              </Label>
              <Input
                type="number"
                value={phaseForm.estimated_days || 7}
                onChange={(e) =>
                  setPhaseForm({
                    ...phaseForm,
                    estimated_days: parseInt(e.target.value) || 7,
                  })
                }
                className="h-7 text-[11px] w-20 bg-background border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto_advance"
                checked={phaseForm.auto_advance}
                onCheckedChange={(checked) =>
                  setPhaseForm({ ...phaseForm, auto_advance: !!checked })
                }
              />
              <label
                htmlFor="auto_advance"
                className="text-[11px] text-muted-foreground cursor-pointer"
              >
                Auto-advance when all items complete
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="visible_to_recruit"
                checked={phaseForm.visible_to_recruit !== false}
                onCheckedChange={(checked) =>
                  setPhaseForm({ ...phaseForm, visible_to_recruit: !!checked })
                }
              />
              <label
                htmlFor="visible_to_recruit"
                className="text-[11px] text-muted-foreground cursor-pointer"
              >
                Visible to recruits
              </label>
            </div>
            {phaseForm.visible_to_recruit === false && (
              <p className="text-[10px] text-warning ml-5">
                This phase will be hidden from recruits. They will see a
                &quot;waiting&quot; state instead.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleCreatePhase}
              disabled={createPhase.isPending}
            >
              {createPhase.isPending && (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              Add Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Phase Dialog */}
      <Dialog open={!!editingPhase} onOpenChange={() => setEditingPhase(null)}>
        <DialogContent className="max-w-md p-3 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Phase</DialogTitle>
          </DialogHeader>
          {editingPhase && (
            <div className="space-y-3 py-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                  Phase Name
                </Label>
                <Input
                  value={editingPhase.phase_name}
                  onChange={(e) =>
                    setEditingPhase({
                      ...editingPhase,
                      phase_name: e.target.value,
                    })
                  }
                  className="h-7 text-[11px] bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  value={editingPhase.phase_description || ""}
                  onChange={(e) =>
                    setEditingPhase({
                      ...editingPhase,
                      phase_description: e.target.value,
                    })
                  }
                  className="text-[11px] min-h-14 bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                  Estimated Days
                </Label>
                <Input
                  type="number"
                  value={editingPhase.estimated_days || 7}
                  onChange={(e) =>
                    setEditingPhase({
                      ...editingPhase,
                      estimated_days: parseInt(e.target.value) || 7,
                    })
                  }
                  className="h-7 text-[11px] w-20 bg-background border-border"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit_auto_advance"
                  checked={editingPhase.auto_advance}
                  onCheckedChange={(checked) =>
                    setEditingPhase({
                      ...editingPhase,
                      auto_advance: !!checked,
                    })
                  }
                />
                <label
                  htmlFor="edit_auto_advance"
                  className="text-[11px] text-muted-foreground cursor-pointer"
                >
                  Auto-advance when all items complete
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit_visible_to_recruit"
                  checked={editingPhase.visible_to_recruit}
                  onCheckedChange={(checked) =>
                    setEditingPhase({
                      ...editingPhase,
                      visible_to_recruit: !!checked,
                    })
                  }
                />
                <label
                  htmlFor="edit_visible_to_recruit"
                  className="text-[11px] text-muted-foreground cursor-pointer"
                >
                  Visible to recruits
                </label>
              </div>
              {!editingPhase.visible_to_recruit && (
                <p className="text-[10px] text-warning ml-5">
                  This phase will be hidden from recruits. They will see a
                  &quot;waiting&quot; state instead.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setEditingPhase(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleUpdatePhase}
              disabled={updatePhase.isPending}
            >
              {updatePhase.isPending && (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm p-3 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Phase?</DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            This will permanently delete this phase and all its checklist items.
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
              onClick={() =>
                deleteConfirmId && handleDeletePhase(deleteConfirmId)
              }
              disabled={deletePhase.isPending}
            >
              {deletePhase.isPending && (
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
