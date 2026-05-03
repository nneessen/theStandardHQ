// src/features/recruiting/admin/PhaseAutomationConfig.tsx

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
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Mail,
  Bell,
  Zap,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePhaseAutomations,
  useDeleteAutomation,
  useUpdateAutomation,
} from "../hooks/usePipelineAutomations";
import { AutomationDialog } from "./AutomationDialog";
import type { PipelineAutomation } from "@/types/recruiting.types";
import { TRIGGER_SHORT_LABELS } from "@/types/recruiting.types";

interface PhaseAutomationConfigProps {
  phaseId: string;
  /** When true, hides add/edit/delete actions */
  readOnly?: boolean;
}

export function PhaseAutomationConfig({
  phaseId,
  readOnly = false,
}: PhaseAutomationConfigProps) {
  const { data: automations, isLoading } = usePhaseAutomations(phaseId);
  const deleteAutomation = useDeleteAutomation();
  const updateAutomation = useUpdateAutomation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] =
    useState<PipelineAutomation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteAutomation.mutateAsync({ id, phaseId });
      toast.success("Automation deleted");
      setDeleteConfirmId(null);
    } catch (_error) {
      toast.error("Failed to delete automation");
    }
  };

  const handleToggleActive = async (automation: PipelineAutomation) => {
    try {
      await updateAutomation.mutateAsync({
        id: automation.id,
        updates: { is_active: !automation.is_active },
      });
      toast.success(
        automation.is_active ? "Automation disabled" : "Automation enabled",
      );
    } catch (_error) {
      toast.error("Failed to update automation");
    }
  };

  const getCommunicationIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-3 w-3" />;
      case "notification":
        return <Bell className="h-3 w-3" />;
      case "sms":
        return <MessageSquare className="h-3 w-3" />;
      case "all":
        return (
          <div className="flex items-center gap-0.5">
            <Mail className="h-2.5 w-2.5" />
            <Bell className="h-2.5 w-2.5" />
            <MessageSquare className="h-2.5 w-2.5" />
          </div>
        );
      default: // "both" = email + notification
        return (
          <div className="flex items-center gap-0.5">
            <Mail className="h-2.5 w-2.5" />
            <Bell className="h-2.5 w-2.5" />
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-warning" />
          <span className="text-[10px] text-muted-foreground">
            Automations ({automations?.length || 0})
          </span>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 text-[10px]"
            onClick={() => {
              setEditingAutomation(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {automations && automations.length > 0 ? (
        <div className="space-y-1">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className={`flex items-center gap-2 p-1.5 rounded-sm border ${
                automation.is_active
                  ? "bg-background border-border/60"
                  : "bg-muted/50  border-border opacity-60"
              }`}
            >
              <div className="text-muted-foreground">
                {getCommunicationIcon(automation.communication_type)}
              </div>
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 border-border"
              >
                {TRIGGER_SHORT_LABELS[automation.trigger_type] ||
                  automation.trigger_type}
              </Badge>
              {automation.delay_days && (
                <span className="text-[10px] text-muted-foreground">
                  ({automation.delay_days}d)
                </span>
              )}
              <span className="text-[10px] text-muted-foreground dark:text-muted-foreground flex-1 truncate">
                → {automation.recipients.map((r) => r.type).join(", ")}
              </span>
              {!readOnly && (
                <>
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={() => handleToggleActive(automation)}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => {
                      setEditingAutomation(automation);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirmId(automation.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground text-center py-2">
          No automations configured
        </div>
      )}

      {/* Automation Dialog */}
      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        phaseId={phaseId}
        editingAutomation={editingAutomation}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Automation?</DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            This will permanently delete this automation. No future
            communications will be sent for this trigger.
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
              disabled={deleteAutomation.isPending}
            >
              {deleteAutomation.isPending && (
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
