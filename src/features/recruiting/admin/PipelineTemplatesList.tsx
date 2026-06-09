// src/features/recruiting/admin/PipelineTemplatesList.tsx

import { useState } from "react";
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
  Loader2,
  Plus,
  Star,
  Edit2,
  Trash2,
  Inbox,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useImo } from "@/contexts/ImoContext";
import { useAllActiveImos } from "@/hooks/imo";
import {
  useTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useSetDefaultTemplate,
  useDuplicateTemplate,
} from "../hooks/usePipeline";

interface PipelineTemplatesListProps {
  onSelectTemplate: (id: string) => void;
  /** Whether the current user is an admin (can edit/delete any pipeline) */
  isAdmin: boolean;
  /** Current user's ID (for ownership checks) */
  currentUserId?: string;
  /** Whether the current user has a staff role (trainer/contracting_manager) */
  isStaffRole: boolean;
}

export function PipelineTemplatesList({
  onSelectTemplate,
  isAdmin,
  currentUserId,
  isStaffRole,
}: PipelineTemplatesListProps) {
  const { effectiveImoId, imo, isViewingAllImos, isSuperAdmin } = useImo();
  const { data: allActiveImos } = useAllActiveImos({ enabled: isSuperAdmin });
  // Resolve the name of the IMO a new template will be stamped with, so the
  // creator can never silently create it under the wrong tenant (the FFG
  // mis-stamp root cause). For super-admins this follows the acting IMO; for
  // everyone else it is their home IMO.
  const targetImoName =
    allActiveImos?.find((i) => i.id === effectiveImoId)?.name ??
    (imo && imo.id === effectiveImoId ? imo.name : null);
  // Short IMO label for a template row (super-admins see templates across IMOs,
  // so labeling avoids the FFG-vs-Epic-Life confusion the owner reported).
  const imoLabel = (id: string | null | undefined) => {
    const match = allActiveImos?.find((i) => i.id === id);
    return match?.code || match?.name || null;
  };
  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const setDefaultTemplate = useSetDefaultTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [consultationWarningOpen, setConsultationWarningOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicateTemplateId, setDuplicateTemplateId] = useState<string | null>(
    null,
  );
  const [duplicateName, setDuplicateName] = useState("");
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  // Whether the user is a regular agent (not admin or staff) — needs consultation before creating
  const isRegularUser = !isAdmin && !isStaffRole;

  // Helper: Check if user can modify a template (admin, owner, or staff on DEFAULT templates)
  // Regular users (agents) cannot modify any existing templates
  const canModifyTemplate = (
    templateCreatedBy: string | undefined | null,
    templateName?: string,
  ) => {
    if (isRegularUser) return false;
    if (isAdmin) return true;
    if (currentUserId && templateCreatedBy === currentUserId) return true;
    if (isStaffRole && templateName?.toUpperCase().includes("DEFAULT"))
      return true;
    return false;
  };

  const handleCreate = async () => {
    if (!newTemplate.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!effectiveImoId) {
      toast.error(
        "Select a specific IMO (not All IMOs) before creating a template.",
      );
      return;
    }

    try {
      const created = await createTemplate.mutateAsync({
        name: newTemplate.name,
        description: newTemplate.description || undefined,
        is_active: newTemplate.is_active,
        created_by: currentUserId ?? null,
        imo_id: effectiveImoId,
      });
      toast.success(
        isRegularUser
          ? "Template created. Contact an admin to configure phases and checklists."
          : "Template created",
      );
      setCreateDialogOpen(false);
      setNewTemplate({ name: "", description: "", is_active: true });
      if (!isRegularUser) {
        onSelectTemplate(created.id);
      }
    } catch (_error) {
      toast.error("Failed to create template");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Template deleted");
      setDeleteConfirmId(null);
    } catch (_error) {
      toast.error("Failed to delete template");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultTemplate.mutateAsync(id);
      toast.success("Default template updated");
    } catch (_error) {
      toast.error("Failed to set default template");
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateTemplateId || !duplicateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    try {
      const newId = await duplicateTemplate.mutateAsync({
        templateId: duplicateTemplateId,
        newName: duplicateName.trim(),
      });
      toast.success("Template duplicated successfully");
      setDuplicateTemplateId(null);
      setDuplicateName("");
      onSelectTemplate(newId); // Open the new template for editing
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        toast.error("A template with this name already exists");
      } else {
        toast.error("Failed to duplicate template");
      }
    }
  };

  const openCreateFlow = () => {
    if (isRegularUser) {
      setConsultationWarningOpen(true);
    } else {
      setCreateDialogOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center border border-border bg-card rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEmpty = !templates || templates.length === 0;

  return (
    <div className="space-y-2.5">
      {/* Actions bar */}
      <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
        <p className="text-[11px] text-muted-foreground">
          {isEmpty
            ? "Create your first pipeline template to start building your recruiting workflow"
            : "Duplicate a proven template, then tweak phases and items — fastest way to build a new pipeline"}
        </p>
        <Button
          size="sm"
          className="h-7 px-3 text-[11px]"
          disabled={isViewingAllImos}
          title={
            isViewingAllImos
              ? "Switch from All IMOs to a specific IMO to create a template"
              : undefined
          }
          onClick={openCreateFlow}
        >
          <Plus className="h-3 w-3 mr-1.5" />
          New Template
        </Button>
      </div>

      {/* Empty state — rich panel outside the table */}
      {isEmpty ? (
        <div className="border border-border bg-card rounded-lg px-6 py-10 flex flex-col items-center text-center gap-3">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-foreground">
              No pipeline templates yet
            </p>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Create your first template to define phases, checklist items, and
              automations for your recruiting pipeline.
            </p>
          </div>
          <Button
            size="sm"
            className="h-7 px-3 text-[11px] mt-1"
            disabled={isViewingAllImos}
            title={
              isViewingAllImos
                ? "Switch from All IMOs to a specific IMO to create a template"
                : undefined
            }
            onClick={openCreateFlow}
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Create your first pipeline
          </Button>
        </div>
      ) : (
        /* Templates Grid — two-column cards, spacious and readable */
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {templates.map((template) => {
            const canModify = canModifyTemplate(
              template.created_by,
              template.name,
            );
            return (
              <div
                key={template.id}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                {/* Header — title + default star + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">
                        {template.name}
                      </h3>
                      {template.is_default && (
                        <Star className="h-4 w-4 shrink-0 text-warning fill-amber-500" />
                      )}
                    </div>
                    {isSuperAdmin && imoLabel(template.imo_id) && (
                      <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {imoLabel(template.imo_id)}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={template.is_active ? "default" : "secondary"}
                    className="shrink-0 text-[10px] h-5 px-2"
                  >
                    {template.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Description */}
                <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[13px] leading-snug text-muted-foreground">
                  {template.description || "No description"}
                </p>

                {/* Footer — set default + actions */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  {template.is_default ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <Star className="h-3.5 w-3.5 text-warning fill-amber-500" />
                      Default
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1.5 text-muted-foreground"
                      onClick={() => handleSetDefault(template.id)}
                      disabled={setDefaultTemplate.isPending || !isAdmin}
                      title={
                        !isAdmin
                          ? "Only admins can set the default template"
                          : "Make this the default template"
                      }
                    >
                      <Star className="h-3.5 w-3.5" />
                      Set default
                    </Button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] font-medium gap-1.5"
                      onClick={() => {
                        setDuplicateName(`${template.name} (Copy)`);
                        setDuplicateTemplateId(template.id);
                      }}
                      disabled={isRegularUser}
                      title={
                        isRegularUser
                          ? "Only admins and staff can duplicate templates"
                          : "Duplicate this template — fastest way to build a new pipeline"
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] font-medium gap-1.5"
                      onClick={() => onSelectTemplate(template.id)}
                      disabled={!canModify}
                      title={
                        !canModify
                          ? "You can only edit your own templates"
                          : "Edit template"
                      }
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(template.id)}
                      disabled={template.is_default || !canModify}
                      title={
                        !canModify
                          ? "You can only delete your own templates"
                          : "Delete template"
                      }
                    >
                      <Trash2
                        className={`h-3.5 w-3.5 ${canModify ? "" : "opacity-30"}`}
                      />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md p-3 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Create Pipeline Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
              <p className="text-[10px] text-muted-foreground">
                Creating template for
              </p>
              <p className="text-[12px] font-semibold text-foreground">
                {targetImoName ?? "your IMO"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Name
              </Label>
              <Input
                value={newTemplate.name}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, name: e.target.value })
                }
                placeholder="e.g., Insurance Agent Onboarding"
                className="h-7 text-[11px] bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Description (optional)
              </Label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) =>
                  setNewTemplate({
                    ...newTemplate,
                    description: e.target.value,
                  })
                }
                placeholder="Describe this pipeline template..."
                className="text-[11px] min-h-16 bg-background border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={newTemplate.is_active}
                onCheckedChange={(checked) =>
                  setNewTemplate({ ...newTemplate, is_active: !!checked })
                }
              />
              <label
                htmlFor="is_active"
                className="text-[11px] text-muted-foreground cursor-pointer"
              >
                Active (can be assigned to recruits)
              </label>
            </div>
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
              onClick={handleCreate}
              disabled={createTemplate.isPending}
            >
              {createTemplate.isPending && (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm p-3 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            This will permanently delete this template including all phases,
            checklist items, and recruit progress records. Users will be
            un-enrolled from this pipeline. This action cannot be undone.
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
              disabled={deleteTemplate.isPending}
            >
              {deleteTemplate.isPending && (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consultation Warning Dialog (regular users only) */}
      <Dialog
        open={consultationWarningOpen}
        onOpenChange={setConsultationWarningOpen}
      >
        <DialogContent className="max-w-md p-4 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Before You Create a Pipeline
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-[11px] text-muted-foreground mb-2">
              Pipelines are powerful tools with many configuration options that
              directly affect your recruiting workflow.
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">
              You must consult with Teagan Keyser or Nick Neessen before
              creating a new pipeline to ensure it&apos;s set up correctly for
              your needs.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setConsultationWarningOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setConsultationWarningOpen(false);
                setCreateDialogOpen(true);
              }}
            >
              I&apos;ve Consulted — Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Template Dialog */}
      <Dialog
        open={!!duplicateTemplateId}
        onOpenChange={() => setDuplicateTemplateId(null)}
      >
        <DialogContent className="max-w-md p-3 bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm">Duplicate Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                New Template Name
              </Label>
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter unique name"
                className="h-7 text-[11px] bg-background border-border"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              This will create a copy of the template with all phases, checklist
              items, and automations.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setDuplicateTemplateId(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleDuplicate}
              disabled={duplicateTemplate.isPending || !duplicateName.trim()}
            >
              {duplicateTemplate.isPending && (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
