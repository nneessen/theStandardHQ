// src/features/admin/components/RolesPermissionsTab.tsx

import { useState } from "react";
import { ScrollText, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAssignPermissionToRole,
  useRemovePermissionFromRole,
} from "@/hooks/permissions";
import type {
  Role,
  Permission,
  PermissionWithSource,
  RoleName,
} from "@/types/permissions.types";
import type { UserProfile } from "@/types/user.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RolePermissionEditor } from "./RolePermissionEditor";
import { CreateRoleDialog } from "./CreateRoleDialog";
import { DeleteRoleDialog } from "./DeleteRoleDialog";

interface RolesPermissionsTabProps {
  roles: Role[] | undefined;
  allPermissions: Permission[] | undefined;
  activeAgents: UserProfile[] | undefined;
  isSuperAdmin: boolean;
}

export function RolesPermissionsTab({
  roles,
  allPermissions,
  activeAgents,
  isSuperAdmin,
}: RolesPermissionsTabProps) {
  // Dialog state
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [isDeleteRoleDialogOpen, setIsDeleteRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Permission mutation hooks
  const assignPermissionMutation = useAssignPermissionToRole();
  const removePermissionMutation = useRemovePermissionFromRole();

  const openEditRoleDialog = (role: Role) => {
    const fullRole = roles?.find((r) => r.id === role.id);
    setSelectedRole(fullRole || role);
    setIsEditRoleDialogOpen(true);
  };

  const openDeleteRoleDialog = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteRoleDialogOpen(true);
  };

  // Toggle a permission on/off for the selected role
  const handleTogglePermission = async (permission: Permission) => {
    if (!selectedRole) return;

    const currentPermissions = selectedRole.permissions || [];
    const hasPermission = currentPermissions.some(
      (p) => p.id === permission.id,
    );

    try {
      if (hasPermission) {
        await removePermissionMutation.mutateAsync({
          roleId: selectedRole.id,
          permissionId: permission.id,
        });
        // Update local state
        setSelectedRole((prev) =>
          prev
            ? {
                ...prev,
                permissions: prev.permissions?.filter(
                  (p) => p.id !== permission.id,
                ),
              }
            : null,
        );
        toast.success(`Removed "${permission.code}" from ${selectedRole.name}`);
      } else {
        await assignPermissionMutation.mutateAsync({
          roleId: selectedRole.id,
          permissionId: permission.id,
        });
        // Update local state - add as direct permission
        const permissionWithSource: PermissionWithSource = {
          ...permission,
          permissionType: "direct",
        };
        setSelectedRole((prev) =>
          prev
            ? {
                ...prev,
                permissions: [
                  ...(prev.permissions || []),
                  permissionWithSource,
                ],
              }
            : null,
        );
        toast.success(`Added "${permission.code}" to ${selectedRole.name}`);
      }
    } catch (error) {
      console.error("[RolesPermissionsTab] Toggle permission error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update permission",
      );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <span className="font-medium text-v2-ink">
              {roles?.length || 0}
            </span>
            <span className="text-v2-ink-muted">total roles</span>
          </div>
        </div>
        {isSuperAdmin && (
          <Button
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setIsCreateRoleDialogOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Create Role
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-lg bg-v2-card border border-v2-ring">
        <Table>
          <TableHeader className="sticky top-0 bg-v2-canvas z-10">
            <TableRow className="border-b border-v2-ring hover:bg-transparent">
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[200px]">
                Role Name
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                Description
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                Permissions
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                Users
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[120px]">
                System Role
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px] text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles?.map((role) => (
              <TableRow
                key={role.id}
                className="hover:bg-v2-canvas border-b border-v2-ring/60"
              >
                <TableCell className="py-1.5">
                  <div className="font-medium text-[11px] text-v2-ink">
                    {role.display_name}
                  </div>
                  <div className="text-[10px] text-v2-ink-muted">
                    {role.name}
                  </div>
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle truncate max-w-md">
                    {role.description || "-"}
                  </div>
                </TableCell>
                <TableCell className="py-1.5">
                  <span className="text-[11px] text-v2-ink-muted">
                    {role.permissions?.length || 0}
                  </span>
                </TableCell>
                <TableCell className="py-1.5">
                  <span className="text-[11px] text-v2-ink-muted">
                    {activeAgents?.filter((u: UserProfile) =>
                      u.roles?.includes(role.name as RoleName),
                    ).length || 0}
                  </span>
                </TableCell>
                <TableCell className="py-1.5">
                  {role.is_system_role && (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1 border-v2-ring "
                    >
                      System
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                        onClick={() => openEditRoleDialog(role)}
                        title="Manage role permissions"
                      >
                        <Edit className="h-2.5 w-2.5 mr-0.5" />
                        Permissions
                      </Button>
                    )}
                    {isSuperAdmin && !role.is_system_role && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => openDeleteRoleDialog(role)}
                        title="Delete role"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Role Dialog */}
      <CreateRoleDialog
        open={isCreateRoleDialogOpen}
        onOpenChange={setIsCreateRoleDialogOpen}
      />

      {/* Role Permission Editor Sheet */}
      <RolePermissionEditor
        role={selectedRole}
        allPermissions={allPermissions || []}
        open={isEditRoleDialogOpen}
        onOpenChange={setIsEditRoleDialogOpen}
        onTogglePermission={handleTogglePermission}
        isLoading={
          assignPermissionMutation.isPending ||
          removePermissionMutation.isPending
        }
      />

      {/* Delete Role Dialog */}
      <DeleteRoleDialog
        role={selectedRole}
        open={isDeleteRoleDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteRoleDialogOpen(open);
          if (!open) setSelectedRole(null);
        }}
      />
    </div>
  );
}
