// src/features/agent-roadmap/components/admin/RoadmapListPage.tsx
//
// Super-admin index of all roadmaps in the current agency.
// Create, delete, set-default, toggle publish, navigate to editor.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import {
  useRoadmapList,
  useCreateRoadmap,
  useDeleteRoadmap,
  useSetDefaultRoadmap,
  useUpdateRoadmap,
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

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoadmapTemplateRow | null>(
    null,
  );
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

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
      <div className="p-6">
        <p className="text-sm text-zinc-500">Loading agency context…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Agent Roadmaps
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Build checkoff-as-you-go roadmaps for new agents. One can be marked
            as the default "START HERE" for new hires.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          variant="primary"
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New roadmap
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      ) : !roadmaps || roadmaps.length === 0 ? (
        <Empty className="py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks className="h-6 w-6 text-zinc-400" />
            </EmptyMedia>
            <EmptyTitle>No roadmaps yet</EmptyTitle>
            <EmptyDescription>
              Create your first roadmap to start building your onboarding
              checklist.
            </EmptyDescription>
          </EmptyHeader>
          <div className="mt-4">
            <Button
              onClick={() => setCreateOpen(true)}
              variant="primary"
              size="sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create your first roadmap
            </Button>
          </div>
        </Empty>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {roadmaps.map((roadmap) => (
              <div
                key={roadmap.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {roadmap.is_default && (
                      <Badge variant="warning" size="sm" className="gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        START HERE
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/admin/agent-roadmap/$roadmapId",
                          params: { roadmapId: roadmap.id },
                        })
                      }
                      className="font-medium text-sm text-zinc-900 dark:text-zinc-100 hover:underline truncate text-left"
                    >
                      {roadmap.title}
                    </button>
                    {!roadmap.is_published && (
                      <Badge variant="outline" size="sm">
                        Draft
                      </Badge>
                    )}
                  </div>
                  {roadmap.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {roadmap.description}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() =>
                    navigate({
                      to: "/admin/agent-roadmap/$roadmapId/team",
                      params: { roadmapId: roadmap.id },
                    })
                  }
                >
                  <Users className="h-3.5 w-3.5" />
                  Team progress
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() =>
                    navigate({
                      to: "/admin/agent-roadmap/$roadmapId",
                      params: { roadmapId: roadmap.id },
                    })
                  }
                >
                  <Pencil className="h-3.5 w-3.5" />
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
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleTogglePublish(roadmap)}
                    >
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
                      onClick={() => handleSetDefault(roadmap)}
                      disabled={roadmap.is_default}
                    >
                      <Star className="h-3.5 w-3.5 mr-2" />
                      Set as default
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteTarget(roadmap)}
                      className="text-red-600 dark:text-red-400 focus:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create dialog */}
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
              variant="primary"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              )}
              Create &amp; open editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
              className="bg-red-600 hover:bg-red-700"
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
