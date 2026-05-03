// src/features/admin/components/DeleteRoleDialog.tsx

import { toast } from "sonner";
import { useDeleteRole } from "@/hooks/permissions";
import type { Role } from "@/types/permissions.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteRoleDialogProps {
  role: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteRoleDialog({
  role,
  open,
  onOpenChange,
  onSuccess,
}: DeleteRoleDialogProps) {
  const deleteRoleMutation = useDeleteRole();

  const handleDeleteRole = async () => {
    if (!role) return;

    try {
      await deleteRoleMutation.mutateAsync(role.id);
      toast.success(`Role "${role.display_name}" deleted`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("[DeleteRoleDialog] Delete role error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete role",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm text-destructive">
            Delete Role
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <p className="text-[11px] text-muted-foreground">
            Are you sure you want to delete the role{" "}
            <strong>"{role?.display_name}"</strong>?
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Users with this role will lose it. Make sure no users are assigned
            to this role before deleting.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-[11px]"
            onClick={handleDeleteRole}
            disabled={deleteRoleMutation.isPending}
          >
            {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
