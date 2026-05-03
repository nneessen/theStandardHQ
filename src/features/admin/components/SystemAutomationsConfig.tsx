// src/features/admin/components/SystemAutomationsConfig.tsx
// Component for managing system-level automations (password reminders, etc.)

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
  Key,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useSystemAutomations,
  useDeleteAutomation,
  useUpdateAutomation,
  AutomationDialog,
} from "@/features/recruiting";
import type { PipelineAutomation } from "@/types/recruiting.types";
import { TRIGGER_SHORT_LABELS } from "@/types/recruiting.types";
import { useImo } from "@/contexts/ImoContext";

export function SystemAutomationsConfig() {
  const { imo, isImoAdmin, isSuperAdmin } = useImo();
  const { data: automations, isLoading } = useSystemAutomations();
  const deleteAutomation = useDeleteAutomation();
  const updateAutomation = useUpdateAutomation();

  // Get the current user's IMO ID for tenant isolation
  const imoId = imo?.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] =
    useState<PipelineAutomation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteAutomation.mutateAsync({ id, isSystem: true });
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
        return <Mail className="h-3.5 w-3.5" />;
      case "notification":
        return <Bell className="h-3.5 w-3.5" />;
      case "sms":
        return <MessageSquare className="h-3.5 w-3.5" />;
      case "all":
        return (
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <Bell className="h-3 w-3" />
            <MessageSquare className="h-3 w-3" />
          </div>
        );
      default: // "both" = email + notification
        return (
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <Bell className="h-3 w-3" />
          </div>
        );
    }
  };

  // Check if user has permission to manage system automations
  const canManageAutomations = isImoAdmin || isSuperAdmin;

  // Filter automations by current IMO and trigger type
  const passwordAutomations = automations?.filter(
    (a) =>
      (a.trigger_type === "password_not_set_24h" ||
        a.trigger_type === "password_not_set_12h") &&
      // Only show automations for the current IMO
      a.imo_id === imoId,
  );

  // If no IMO context, show warning
  if (!imoId && !isLoading) {
    return (
      <div className="bg-warning/10 rounded-lg border border-warning/30 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning" />
          <p className="text-sm text-warning">
            IMO context not available. Cannot configure system automations.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Password Reminder Automations Section */}
      <div className="bg-card rounded-v2-md border border-border shadow-v2-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-warning/10">
              <Key className="h-4 w-4 text-warning" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Password Setup Reminders
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Remind users to set their password before the invite link
                expires
              </p>
            </div>
          </div>
          {canManageAutomations && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                setEditingAutomation(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Automation
            </Button>
          )}
        </div>

        {passwordAutomations && passwordAutomations.length > 0 ? (
          <div className="space-y-2">
            {passwordAutomations.map((automation) => (
              <div
                key={automation.id}
                className={`flex items-center gap-3 p-2.5 rounded-md border ${
                  automation.is_active
                    ? "bg-background border-border"
                    : "bg-muted/50 dark:bg-card-dark border-border opacity-60"
                }`}
              >
                <div className="text-muted-foreground">
                  {getCommunicationIcon(automation.communication_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0.5 border-warning/30 bg-warning/10 text-warning"
                    >
                      {TRIGGER_SHORT_LABELS[automation.trigger_type] ||
                        automation.trigger_type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {automation.trigger_type === "password_not_set_24h"
                        ? "24h before expiration"
                        : "12h before expiration"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Zap className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground dark:text-muted-foreground truncate">
                      Recipients:{" "}
                      {automation.recipients.map((r) => r.type).join(", ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={() => handleToggleActive(automation)}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
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
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirmId(automation.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-background/30 rounded-md border border-dashed border-border">
            <Key className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              No password reminder automations configured
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Add an automation to remind users to set their password before the
              72-hour invite link expires
            </p>
          </div>
        )}
      </div>

      {/* Automation Dialog */}
      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="system"
        imoId={imoId}
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
