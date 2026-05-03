// src/features/recruiting/admin/PipelineTemplateEditor.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTemplate, useUpdateTemplate } from "../hooks/usePipeline";
import { PhaseEditor } from "./PhaseEditor";

interface PipelineTemplateEditorProps {
  templateId: string;
  onClose: () => void;
  /** Whether the current user is an admin (can edit any pipeline) */
  isAdmin: boolean;
  /** Current user's ID (for ownership checks) */
  currentUserId?: string;
  /** Whether the current user has a staff role (trainer/contracting_manager) */
  isStaffRole: boolean;
}

export function PipelineTemplateEditor({
  templateId,
  onClose,
  isAdmin,
  currentUserId,
  isStaffRole,
}: PipelineTemplateEditorProps) {
  const { data: template, isLoading } = useTemplate(templateId);
  const updateTemplate = useUpdateTemplate();

  // Check if user can modify this template (admin, owner, or staff on DEFAULT templates)
  const isDefaultTemplate = template?.name?.toUpperCase().includes("DEFAULT");
  const canModify =
    isAdmin ||
    (currentUserId && template?.created_by === currentUserId) ||
    (isStaffRole && isDefaultTemplate);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when template loads
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setIsActive(template.is_active);
      setHasChanges(false);
    }
  }, [template]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic field value
  const handleFieldChange = (field: string, value: any) => {
    switch (field) {
      case "name":
        setName(value);
        break;
      case "description":
        setDescription(value);
        break;
      case "is_active":
        setIsActive(value);
        break;
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      await updateTemplate.mutateAsync({
        id: templateId,
        updates: {
          name,
          description: description || undefined,
          is_active: isActive,
        },
      });
      toast.success("Template saved");
      setHasChanges(false);
    } catch (_error) {
      toast.error("Failed to save template");
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center border border-v2-ring bg-v2-card rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-8 text-center border border-v2-ring bg-v2-card rounded-lg">
        <AlertCircle className="h-6 w-6 text-v2-ink-subtle mx-auto mb-2" />
        <p className="text-[11px] text-v2-ink-muted">Template not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Read-only warning for non-owners */}
      {!canModify && (
        <div className="flex items-center gap-2 bg-warning/10 rounded-lg px-3 py-2 border border-warning/30">
          <AlertCircle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
          <span className="text-[11px] text-warning">
            You can only view this template. Only the creator, an admin, or
            staff with access to DEFAULT templates can make changes.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={onClose}
          >
            <ArrowLeft className="h-3 w-3 mr-1.5" />
            Back to Templates
          </Button>
          <div className="h-4 w-px bg-v2-ring" />
          <span className="text-[11px] font-medium text-v2-ink">
            {template.name}
          </span>
          {template.is_default && (
            <Badge
              variant="secondary"
              className="text-[9px] h-4 px-1.5 bg-warning/20 text-warning dark:bg-warning dark:text-warning"
            >
              Default
            </Badge>
          )}
        </div>
        {canModify && (
          <Button
            size="sm"
            className="h-7 px-3 text-[11px]"
            onClick={handleSave}
            disabled={!hasChanges || updateTemplate.isPending}
          >
            {updateTemplate.isPending ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1.5" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Template Details */}
      <div className="p-3 border border-v2-ring bg-v2-card rounded-lg">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted mb-3">
          Template Details
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Name
            </Label>
            {/* WARNING: Any template name containing "DEFAULT" (case-insensitive) is
                readable by ALL authenticated users in the same IMO due to the RLS policy in
                migration 20260218205623_allow_upline_read_default_templates.sql. Avoid using
                "DEFAULT" in custom template names to prevent unintended visibility. */}
            <Input
              value={name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              disabled={!canModify}
              className="h-7 text-[11px] bg-v2-canvas border-v2-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Status
            </Label>
            <div className="flex items-center gap-2 h-7">
              <Checkbox
                checked={isActive}
                onCheckedChange={(checked: boolean) =>
                  handleFieldChange("is_active", checked)
                }
                disabled={!canModify}
              />
              <span className="text-[11px] text-v2-ink-muted">
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Optional description..."
              disabled={!canModify}
              className="text-[11px] min-h-14 bg-v2-canvas border-v2-ring"
            />
          </div>
        </div>
      </div>

      {/* Phases Editor */}
      <div className="p-3 border border-v2-ring bg-v2-card rounded-lg">
        <PhaseEditor templateId={templateId} readOnly={!canModify} />
      </div>
    </div>
  );
}
