// src/features/training-modules/components/admin/ModulesManagementTab.tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Users,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useTrainingModules,
  useDeleteTrainingModule,
  usePublishTrainingModule,
  useCreateTrainingModule,
  useUpdateTrainingModule,
} from "../../hooks/useTrainingModules";
import {
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
} from "../../types/training-module.types";
import type {
  ModuleCategory,
  TrainingModule,
} from "../../types/training-module.types";
import { CategoryBadge } from "../shared/CategoryBadge";
import { DifficultyBadge } from "../shared/DifficultyBadge";
import { AssignModuleDialog } from "./AssignModuleDialog";
import { CreateFromPdfDialog } from "./CreateFromPdfDialog";
import { toast } from "sonner";

export function ModulesManagementTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [assignModuleId, setAssignModuleId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleCategory, setNewModuleCategory] =
    useState<ModuleCategory>("custom");

  const { data: modules = [], isLoading } = useTrainingModules({
    search: search || undefined,
    category: categoryFilter || undefined,
  });
  const deleteModule = useDeleteTrainingModule();
  const publishModule = usePublishTrainingModule();
  const updateModule = useUpdateTrainingModule();
  const createModule = useCreateTrainingModule();

  const handleOpenCreateDialog = () => {
    setNewModuleTitle("");
    setNewModuleCategory("custom");
    setShowCreateDialog(true);
  };

  const handleCreateModule = async () => {
    const title = newModuleTitle.trim();
    if (!title) {
      toast.error("Module title is required");
      return;
    }
    try {
      const newModule = await createModule.mutateAsync({
        title,
        category: newModuleCategory,
      });
      setShowCreateDialog(false);
      navigate({
        to: "/my-training/builder/$moduleId" as string,
        params: { moduleId: newModule.id } as Record<string, string>,
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleDuplicate = async (module: TrainingModule) => {
    try {
      const dup = await createModule.mutateAsync({
        title: `${module.title} (Copy)`,
        category: module.category as ModuleCategory,
        description: module.description || undefined,
        difficulty_level: module.difficulty_level as
          | "beginner"
          | "intermediate"
          | "advanced",
        estimated_duration_minutes:
          module.estimated_duration_minutes || undefined,
        xp_reward: module.xp_reward,
        tags: module.tags,
      });
      toast.success("Module duplicated");
      navigate({
        to: "/my-training/builder/$moduleId" as string,
        params: { moduleId: dup.id } as Record<string, string>,
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleTogglePublish = (module: TrainingModule) => {
    if (module.is_published) {
      updateModule.mutate({ id: module.id, input: { is_published: false } });
    } else {
      publishModule.mutate(module.id);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this module? This cannot be undone.")) {
      deleteModule.mutate(id);
    }
  };

  const assignModule = modules.find((m) => m.id === assignModuleId);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-7 text-xs border border-border dark:border-border rounded-md px-2 bg-card"
        >
          <option value="">All Categories</option>
          {MODULE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {MODULE_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowPdfDialog(true)}
        >
          <FileUp className="h-3 w-3 mr-1" />
          Import PDF
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleOpenCreateDialog}
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Module
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border dark:border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-background dark:bg-card-tinted/50 border-b border-border dark:border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Title
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Category
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Difficulty
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                  XP
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                  Updated
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border">
              {modules.map((module) => (
                <tr
                  key={module.id}
                  className="hover:bg-background dark:hover:bg-card-tinted/30 cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: "/my-training/builder/$moduleId" as string,
                      params: { moduleId: module.id } as Record<string, string>,
                    })
                  }
                >
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground dark:text-foreground">
                      {module.title}
                    </span>
                    {module.description && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-xs mt-0.5">
                        {module.description}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CategoryBadge category={module.category} />
                  </td>
                  <td className="px-3 py-2">
                    <DifficultyBadge level={module.difficulty_level} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge
                      variant={module.is_published ? "default" : "secondary"}
                      className="text-[10px] px-1.5"
                    >
                      {module.is_published ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {module.xp_reward}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {new Date(module.updated_at).toLocaleDateString()}
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate({
                              to: "/my-training/builder/$moduleId" as string,
                              params: { moduleId: module.id } as Record<
                                string,
                                string
                              >,
                            })
                          }
                        >
                          <Pencil className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTogglePublish(module)}
                        >
                          {module.is_published ? (
                            <>
                              <EyeOff className="h-3 w-3 mr-2" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-2" />
                              Publish
                            </>
                          )}
                        </DropdownMenuItem>
                        {module.is_published && (
                          <DropdownMenuItem
                            onClick={() => setAssignModuleId(module.id)}
                          >
                            <Users className="h-3 w-3 mr-2" />
                            Assign
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(module)}
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(module.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {modules.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No modules yet. Create your first training module.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create module dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Create New Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Module Title
              </label>
              <Input
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="e.g. Sales Fundamentals 101"
                className="h-8 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newModuleTitle.trim()) {
                    e.preventDefault();
                    handleCreateModule();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Category
              </label>
              <select
                value={newModuleCategory}
                onChange={(e) =>
                  setNewModuleCategory(e.target.value as ModuleCategory)
                }
                className="w-full h-8 text-xs border border-border dark:border-border rounded-md px-2 bg-card"
              >
                {MODULE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {MODULE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleCreateModule}
              disabled={createModule.isPending || !newModuleTitle.trim()}
            >
              {createModule.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      {assignModule && (
        <AssignModuleDialog
          module={assignModule}
          open={!!assignModuleId}
          onOpenChange={(open: boolean) => !open && setAssignModuleId(null)}
        />
      )}

      {/* PDF import dialog */}
      <CreateFromPdfDialog
        open={showPdfDialog}
        onOpenChange={setShowPdfDialog}
      />
    </div>
  );
}
