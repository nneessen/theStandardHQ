// src/features/agent-roadmap/components/admin/RoadmapListPage.tsx
//
// Super-admin roadmap management page. This is the view Nick sees when he
// clicks "Agent Roadmap" in the sidebar. Designed for frequent use —
// fast navigation, clear status at a glance, drag-to-reorder.

import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  Plus,
  Star,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  ListChecks,
  Users,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import {
  useRoadmapList,
  useCreateRoadmap,
  useDeleteRoadmap,
  useSetDefaultRoadmap,
  useUpdateRoadmap,
  useReorderRoadmaps,
} from "../../index";
import type { RoadmapTemplateRow } from "../../types/roadmap";

export function RoadmapListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agency } = useImo();

  const agencyId = agency?.id ?? null;
  const { data: roadmaps, isLoading } = useRoadmapList(agencyId);

  const createMutation = useCreateRoadmap();
  const deleteMutation = useDeleteRoadmap();
  const setDefaultMutation = useSetDefaultRoadmap();
  const updateMutation = useUpdateRoadmap();
  const reorderMutation = useReorderRoadmaps();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoadmapTemplateRow | null>(
    null,
  );
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const defaultRoadmap = useMemo(
    () => roadmaps?.find((r) => r.is_default) ?? null,
    [roadmaps],
  );
  const nonDefaultRoadmaps = useMemo(
    () => (roadmaps ?? []).filter((r) => !r.is_default),
    [roadmaps],
  );
  const nonDefaultIds = useMemo(
    () => nonDefaultRoadmaps.map((r) => r.id),
    [nonDefaultRoadmaps],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!agencyId) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = nonDefaultRoadmaps.findIndex((r) => r.id === active.id);
      const newIndex = nonDefaultRoadmaps.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(nonDefaultRoadmaps, oldIndex, newIndex);
      const orderedIds = [
        ...(defaultRoadmap ? [defaultRoadmap.id] : []),
        ...reordered.map((r) => r.id),
      ];
      reorderMutation.mutate({ agencyId, orderedIds });
    },
    [agencyId, defaultRoadmap, nonDefaultRoadmaps, reorderMutation],
  );

  function handleCreate() {
    if (!agencyId || !user?.id || !newTitle.trim()) return;
    createMutation.mutate(
      {
        input: {
          agency_id: agencyId,
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          imo_id: user.imo_id ?? null,
        },
        createdBy: user.id,
      },
      {
        onSuccess: (created) => {
          setCreateOpen(false);
          setNewTitle("");
          setNewDescription("");
          navigate({
            to: "/admin/agent-roadmap/$roadmapId",
            params: { roadmapId: created.id },
          });
        },
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget || !agencyId) return;
    deleteMutation.mutate(
      { roadmapId: deleteTarget.id, agencyId },
      { onSuccess: () => setDeleteTarget(null) },
    );
  }

  function handleSetDefault(roadmap: RoadmapTemplateRow) {
    if (!agencyId) return;
    setDefaultMutation.mutate({ roadmapId: roadmap.id, agencyId });
  }

  function handleTogglePublish(roadmap: RoadmapTemplateRow) {
    updateMutation.mutate({
      roadmapId: roadmap.id,
      patch: { is_published: !roadmap.is_published },
    });
  }

  if (!agencyId) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  // Stats for the header
  const publishedCount = (roadmaps ?? []).filter((r) => r.is_published).length;
  const draftCount = (roadmaps ?? []).length - publishedCount;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring dark:border-v2-ring">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-v2-ink dark:text-v2-ink" />
          <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Manage Roadmaps
          </h1>
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hidden sm:inline">
            Build and manage onboarding checklists
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(roadmaps ?? []).length > 0 && (
            <div className="flex items-center gap-3 text-[11px] mr-2">
              <span>
                <span className="font-medium text-v2-ink dark:text-v2-ink">
                  {publishedCount}
                </span>{" "}
                <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                  published
                </span>
              </span>
              {draftCount > 0 && (
                <span>
                  <span className="font-medium text-v2-ink dark:text-v2-ink">
                    {draftCount}
                  </span>{" "}
                  <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                    draft
                  </span>
                </span>
              )}
              <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => navigate({ to: "/admin/agent-roadmap/team" })}
          >
            <Users className="h-3 w-3" />
            Team
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() =>
              navigate({ to: "/agent-roadmap", search: { preview: true } })
            }
          >
            <Eye className="h-3 w-3" />
            Preview
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="h-7 text-[11px] gap-1"
          >
            <Plus className="h-3 w-3" />
            New
          </Button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 rounded-lg bg-v2-card border border-v2-ring dark:border-v2-ring animate-pulse"
              />
            ))}
          </div>
        ) : !roadmaps || roadmaps.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListChecks className="h-5 w-5 text-v2-ink-subtle" />
                </EmptyMedia>
                <EmptyTitle>No roadmaps yet</EmptyTitle>
                <EmptyDescription>
                  Create your first roadmap to start building your onboarding
                  checklist.
                </EmptyDescription>
              </EmptyHeader>
              <div className="mt-3">
                <Button onClick={() => setCreateOpen(true)} size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create your first roadmap
                </Button>
              </div>
            </Empty>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Pinned default */}
            {defaultRoadmap && (
              <AdminRoadmapCard
                roadmap={defaultRoadmap}
                leftSlot={
                  <div className="flex items-center justify-center h-6 w-6 text-amber-500 shrink-0">
                    <Star className="h-4 w-4 fill-current" />
                  </div>
                }
                onEdit={() =>
                  navigate({
                    to: "/admin/agent-roadmap/$roadmapId",
                    params: { roadmapId: defaultRoadmap.id },
                  })
                }
                onTeam={() =>
                  navigate({
                    to: "/admin/agent-roadmap/$roadmapId/team",
                    params: { roadmapId: defaultRoadmap.id },
                  })
                }
                onTogglePublish={() => handleTogglePublish(defaultRoadmap)}
                onSetDefault={() => handleSetDefault(defaultRoadmap)}
                onDelete={() => setDeleteTarget(defaultRoadmap)}
              />
            )}

            {/* Sortable non-defaults */}
            {nonDefaultRoadmaps.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={nonDefaultIds}
                  strategy={verticalListSortingStrategy}
                >
                  {nonDefaultRoadmaps.map((roadmap) => (
                    <SortableAdminRoadmapCard
                      key={roadmap.id}
                      roadmap={roadmap}
                      onEdit={() =>
                        navigate({
                          to: "/admin/agent-roadmap/$roadmapId",
                          params: { roadmapId: roadmap.id },
                        })
                      }
                      onTeam={() =>
                        navigate({
                          to: "/admin/agent-roadmap/$roadmapId/team",
                          params: { roadmapId: roadmap.id },
                        })
                      }
                      onTogglePublish={() => handleTogglePublish(roadmap)}
                      onSetDefault={() => handleSetDefault(roadmap)}
                      onDelete={() => setDeleteTarget(roadmap)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </div>

      {/* ── Create dialog ──────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new roadmap</DialogTitle>
            <DialogDescription>
              Give it a name and optional description. You'll add sections and
              items next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="roadmap-title">Title</Label>
              <Input
                id="roadmap-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. START HERE: New Agent"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="roadmap-desc">Description (optional)</Label>
              <Textarea
                id="roadmap-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short summary shown on the roadmap picker"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              )}
              Create &amp; open editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this roadmap?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" and all its sections, items, and agent
              progress will be permanently deleted. This cannot be undone.
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
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Admin roadmap card — white bg, zinc border, clear visual hierarchy
// ============================================================================

interface AdminRoadmapCardProps {
  roadmap: RoadmapTemplateRow;
  leftSlot: React.ReactNode;
  onEdit: () => void;
  onTeam: () => void;
  onTogglePublish: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function AdminRoadmapCard({
  roadmap,
  leftSlot,
  onEdit,
  onTeam,
  onTogglePublish,
  onSetDefault,
  onDelete,
}: AdminRoadmapCardProps) {
  return (
    <div className="flex items-center gap-3 bg-v2-card rounded-lg px-3 py-3 border border-v2-ring dark:border-v2-ring hover:border-v2-ring-strong dark:hover:border-v2-ring-strong transition-colors group">
      {leftSlot}

      {/* Info section */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {roadmap.is_default && (
            <Badge variant="warning" size="sm" className="gap-0.5 text-[10px]">
              <Star className="h-2.5 w-2.5 fill-current" />
              DEFAULT
            </Badge>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-semibold text-v2-ink dark:text-v2-ink hover:underline underline-offset-2 truncate text-left"
          >
            {roadmap.title}
          </button>
        </div>
        {roadmap.description && (
          <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
            {roadmap.description}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0">
        {roadmap.is_published ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Published
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-v2-ink-subtle dark:text-v2-ink-muted">
            <div className="h-1.5 w-1.5 rounded-full bg-v2-ring-strong dark:bg-v2-ring-strong" />
            Draft
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onTeam}
        >
          <Users className="h-3 w-3" />
          Team
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3" />
          Edit
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTogglePublish}>
              {roadmap.is_published ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-2" />
                  Unpublish
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  Publish
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onSetDefault}
              disabled={roadmap.is_default}
            >
              <Star className="h-3.5 w-3.5 mr-2" />
              Set as default
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================================
// Sortable wrapper
// ============================================================================

interface SortableAdminRoadmapCardProps {
  roadmap: RoadmapTemplateRow;
  onEdit: () => void;
  onTeam: () => void;
  onTogglePublish: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function SortableAdminRoadmapCard({
  roadmap,
  onEdit,
  onTeam,
  onTogglePublish,
  onSetDefault,
  onDelete,
}: SortableAdminRoadmapCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: roadmap.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? "rounded-lg ring-2 ring-blue-400/40 shadow-xl z-10 relative"
          : ""
      }
    >
      <AdminRoadmapCard
        roadmap={roadmap}
        leftSlot={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex items-center justify-center h-6 w-6 rounded text-v2-ink-subtle dark:text-v2-ink-muted hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            aria-label={`Drag ${roadmap.title} to reorder`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        }
        onEdit={onEdit}
        onTeam={onTeam}
        onTogglePublish={onTogglePublish}
        onSetDefault={onSetDefault}
        onDelete={onDelete}
      />
    </div>
  );
}
