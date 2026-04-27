// src/features/admin/components/CreateRoleDialog.tsx

import { useState } from "react";
import { toast } from "sonner";
import { useCreateRole, type CreateRoleInput } from "@/hooks/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateRoleDialogProps) {
  const [roleFormData, setRoleFormData] = useState<CreateRoleInput>({
    name: "",
    display_name: "",
    description: "",
  });

  const createRoleMutation = useCreateRole();

  const handleCreateRole = async () => {
    if (!roleFormData.name || !roleFormData.display_name) {
      toast.error("Name and Display Name are required");
      return;
    }

    try {
      await createRoleMutation.mutateAsync(roleFormData);
      toast.success(`Role "${roleFormData.display_name}" created`);
      onOpenChange(false);
      setRoleFormData({ name: "", display_name: "", description: "" });
      onSuccess?.();
    } catch (error) {
      console.error("[CreateRoleDialog] Create role error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create role",
      );
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setRoleFormData({ name: "", display_name: "", description: "" });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Create New Role</DialogTitle>
          <DialogDescription className="text-[11px]">
            Create a custom role with specific permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Role Name (slug)</Label>
            <Input
              placeholder="e.g., sales_lead"
              className="h-8 text-[11px]"
              value={roleFormData.name || ""}
              onChange={(e) =>
                setRoleFormData((prev) => ({
                  ...prev,
                  name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                }))
              }
            />
            <p className="text-[10px] text-v2-ink-muted">
              Lowercase, underscores only. Used internally.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Display Name</Label>
            <Input
              placeholder="e.g., Sales Lead"
              className="h-8 text-[11px]"
              value={roleFormData.display_name || ""}
              onChange={(e) =>
                setRoleFormData((prev) => ({
                  ...prev,
                  display_name: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Description (optional)</Label>
            <Textarea
              placeholder="What this role is for..."
              className="text-[11px] min-h-[60px]"
              value={roleFormData.description || ""}
              onChange={(e) =>
                setRoleFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            onClick={handleCreateRole}
            disabled={createRoleMutation.isPending}
          >
            {createRoleMutation.isPending ? "Creating..." : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
