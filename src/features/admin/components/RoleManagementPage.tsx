// src/features/admin/components/RoleManagementPage.tsx

import { useState } from "react";
import {
  useAllRoles,
  useAllPermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useRolePermissionsWithInheritance,
  useAssignPermissionToRole,
  useRemovePermissionFromRole,
} from "@/hooks/permissions";
import type { Role, Permission } from "@/types/permissions.types";
import type { CreateRoleInput, UpdateRoleInput } from "@/hooks/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Plus, Edit, Trash2, Lock, Search } from "lucide-react";
import { toast } from "sonner";

export function RoleManagementPage() {
  const {
    data: roles,
    isLoading: rolesLoading,
    error: rolesError,
  } = useAllRoles();
  const { data: permissions } = useAllPermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState<
    Partial<CreateRoleInput & UpdateRoleInput>
  >({
    name: "",
    display_name: "",
    description: "",
    parent_role_id: null,
    respects_hierarchy: true,
  });

  const openCreateDialog = () => {
    setFormData({
      name: "",
      display_name: "",
      description: "",
      parent_role_id: null,
      respects_hierarchy: true,
    });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      display_name: role.display_name,
      description: role.description || "",
      parent_role_id: role.parent_role_id,
      respects_hierarchy: role.respects_hierarchy,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  const openPermissionsDialog = (role: Role) => {
    setSelectedRole(role);
    setIsPermissionsDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.display_name) {
      toast.error("Name and Display Name are required");
      return;
    }

    try {
      console.log("[RoleManagement] Creating role:", formData);
      await createRole.mutateAsync(formData as CreateRoleInput);
      toast.success(`Role "${formData.display_name}" created successfully`);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("[RoleManagement] Create role error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to create role";
      toast.error(message);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRole || !formData.display_name) {
      toast.error("Display Name is required");
      return;
    }

    try {
      console.log("[RoleManagement] Updating role:", selectedRole.id, formData);
      await updateRole.mutateAsync({
        roleId: selectedRole.id,
        input: formData as UpdateRoleInput,
      });
      toast.success(`Role "${formData.display_name}" updated successfully`);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("[RoleManagement] Update role error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update role";
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    try {
      console.log("[RoleManagement] Deleting role:", selectedRole.id);
      await deleteRole.mutateAsync(selectedRole.id);
      toast.success(`Role "${selectedRole.display_name}" deleted successfully`);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("[RoleManagement] Delete role error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to delete role";
      toast.error(message);
    }
  };

  const filteredRoles = roles?.filter((role) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      role.name.toLowerCase().includes(query) ||
      role.display_name.toLowerCase().includes(query) ||
      role.description?.toLowerCase().includes(query)
    );
  });

  const systemRolesCount = roles?.filter((r) => r.is_system_role).length || 0;
  const customRolesCount = roles?.filter((r) => !r.is_system_role).length || 0;

  if (rolesLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-64" />
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (rolesError) {
    return (
      <div className="p-3 min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
          <p className="text-[11px] text-red-600 dark:text-red-400">
            Failed to load roles:{" "}
            {rolesError instanceof Error ? rolesError.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* Compact Header with inline stats */}
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-v2-ink" />
            <h1 className="text-sm font-semibold text-v2-ink">
              Role Management
            </h1>
          </div>

          {/* Inline compact stats */}
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="font-medium text-v2-ink">
                {roles?.length || 0}
              </span>
              <span className="text-v2-ink-muted">total roles</span>
            </div>
            <div className="h-3 w-px bg-v2-ring" />
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-v2-ink-subtle" />
              <span className="font-medium text-v2-ink">
                {systemRolesCount}
              </span>
              <span className="text-v2-ink-muted">system</span>
            </div>
            <div className="h-3 w-px bg-v2-ring" />
            <div className="flex items-center gap-1">
              <span className="font-medium text-v2-ink">
                {customRolesCount}
              </span>
              <span className="text-v2-ink-muted">custom</span>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={openCreateDialog}
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Role
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-v2-ink-subtle" />
          <Input
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-[11px] bg-v2-card border-v2-ring"
          />
        </div>
      </div>

      {/* Roles Table */}
      <div className="flex-1 overflow-auto rounded-lg bg-v2-card border border-v2-ring">
        <Table>
          <TableHeader className="sticky top-0 bg-v2-canvas z-10">
            <TableRow className="border-b border-v2-ring hover:bg-transparent">
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[200px]">
                Role
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                Description
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                Permissions
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                Type
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                Hierarchy
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[120px] text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoles?.map((role) => (
              <TableRow
                key={role.id}
                className="hover:bg-v2-canvas border-b border-v2-ring/60"
              >
                <TableCell className="py-1.5">
                  <div>
                    <div className="font-medium text-[11px] text-v2-ink">
                      {role.display_name}
                    </div>
                    <div className="text-[10px] text-v2-ink-muted font-mono">
                      {role.name}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle truncate max-w-xs">
                    {role.description || "-"}
                  </div>
                </TableCell>
                <TableCell className="py-1.5">
                  <span className="text-[11px] text-v2-ink-muted">
                    {role.permissions?.length || 0}
                  </span>
                </TableCell>
                <TableCell className="py-1.5">
                  {role.is_system_role ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1 border-v2-ring "
                    >
                      <Lock className="h-2.5 w-2.5 mr-0.5" />
                      System
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                    >
                      Custom
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-1.5">
                  <span
                    className={`text-[10px] ${role.respects_hierarchy ? "text-emerald-600 dark:text-emerald-400" : "text-v2-ink-muted"}`}
                  >
                    {role.respects_hierarchy ? "Yes" : "No"}
                  </span>
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                      onClick={() => openPermissionsDialog(role)}
                    >
                      <Shield className="h-2.5 w-2.5 mr-0.5" />
                      Perms
                    </Button>
                    {!role.is_system_role && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                          onClick={() => openEditDialog(role)}
                        >
                          <Edit className="h-2.5 w-2.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => openDeleteDialog(role)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredRoles?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-[11px] text-v2-ink-muted py-6"
                >
                  No roles found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md p-3 bg-v2-card border-v2-ring">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-semibold text-v2-ink">
              Create New Role
            </DialogTitle>
            <DialogDescription className="text-[10px] text-v2-ink-muted">
              Create a custom role with specific permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-v2-ink-muted">
                Role Name (snake_case) <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="regional_manager"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="h-7 text-[11px] bg-v2-card border-v2-ring"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-v2-ink-muted">
                Display Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Regional Manager"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                className="h-7 text-[11px] bg-v2-card border-v2-ring"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-v2-ink-muted">
                Description
              </Label>
              <Textarea
                placeholder="What does this role do?"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="text-[11px] bg-v2-card border-v2-ring resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-v2-ink-muted">
                Parent Role
              </Label>
              <Select
                value={formData.parent_role_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    parent_role_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger className="h-7 text-[11px] bg-v2-card border-v2-ring">
                  <SelectValue placeholder="No parent role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-[11px]">
                    No parent role
                  </SelectItem>
                  {roles?.map((role) => (
                    <SelectItem
                      key={role.id}
                      value={role.id}
                      className="text-[11px]"
                    >
                      {role.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="respects_hierarchy"
                checked={formData.respects_hierarchy}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    respects_hierarchy: checked as boolean,
                  })
                }
                className="h-3 w-3"
              />
              <Label
                htmlFor="respects_hierarchy"
                className="cursor-pointer text-[11px] text-v2-ink-muted"
              >
                Respects upline/downline hierarchy
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-1 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(false)}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createRole.isPending}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {createRole.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md p-3 bg-v2-card border-v2-ring">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-semibold text-v2-ink">
              Edit Role
            </DialogTitle>
            <DialogDescription className="text-[10px] text-v2-ink-muted">
              Editing: {selectedRole?.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-v2-ink-muted">
                Display Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                className="h-7 text-[11px] bg-v2-card border-v2-ring"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-v2-ink-muted">
                Description
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="text-[11px] bg-v2-card border-v2-ring resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-v2-ink-muted">
                Parent Role
              </Label>
              <Select
                value={formData.parent_role_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    parent_role_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger className="h-7 text-[11px] bg-v2-card border-v2-ring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-[11px]">
                    No parent role
                  </SelectItem>
                  {roles
                    ?.filter((r) => r.id !== selectedRole?.id)
                    .map((role) => (
                      <SelectItem
                        key={role.id}
                        value={role.id}
                        className="text-[11px]"
                      >
                        {role.display_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit_respects_hierarchy"
                checked={formData.respects_hierarchy}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    respects_hierarchy: checked as boolean,
                  })
                }
                className="h-3 w-3"
              />
              <Label
                htmlFor="edit_respects_hierarchy"
                className="cursor-pointer text-[11px] text-v2-ink-muted"
              >
                Respects upline/downline hierarchy
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-1 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsEditDialogOpen(false)}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateRole.isPending}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {updateRole.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm p-3 bg-v2-card border-v2-ring">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-semibold text-v2-ink">
              Delete Role
            </DialogTitle>
            <DialogDescription className="text-[10px] text-v2-ink-muted">
              Are you sure you want to delete "{selectedRole?.display_name}"?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-1 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRole.isPending}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {deleteRole.isPending ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      {selectedRole && (
        <PermissionsEditorDialog
          role={selectedRole}
          open={isPermissionsDialogOpen}
          onOpenChange={setIsPermissionsDialogOpen}
          allPermissions={permissions || []}
        />
      )}
    </div>
  );
}

// Permissions Editor Dialog Component
interface PermissionsEditorDialogProps {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPermissions: Permission[];
}

function PermissionsEditorDialog({
  role,
  open,
  onOpenChange,
  allPermissions,
}: PermissionsEditorDialogProps) {
  const { data: rolePermissions, isLoading } =
    useRolePermissionsWithInheritance(open ? role.id : undefined);
  const assignPermission = useAssignPermissionToRole();
  const removePermission = useRemovePermissionFromRole();
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggle = async (permissionId: string, hasPermission: boolean) => {
    try {
      if (hasPermission) {
        await removePermission.mutateAsync({ roleId: role.id, permissionId });
      } else {
        await assignPermission.mutateAsync({ roleId: role.id, permissionId });
      }
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to toggle permission",
      );
    }
  };

  const directPermissions = new Set(
    rolePermissions
      ?.filter((p) => p.permissionType === "direct")
      .map((p) => p.id) || [],
  );

  const inheritedPermissions = new Set(
    rolePermissions
      ?.filter((p) => p.permissionType === "inherited")
      .map((p) => p.id) || [],
  );

  const filteredPermissions = allPermissions?.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.code.toLowerCase().includes(query) ||
      p.resource.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-3 bg-v2-card border-v2-ring">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm font-semibold text-v2-ink flex items-center gap-2">
            Permissions for {role.display_name}
            {role.is_system_role && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 border-v2-ring "
              >
                <Lock className="h-2.5 w-2.5 mr-0.5" />
                Read Only
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-[10px] text-v2-ink-muted">
            Manage permissions assigned to this role
            {role.parent_role_id &&
              ". Inherited permissions are shown in gray."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-v2-ink-subtle" />
            <Input
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-[11px] bg-v2-card border-v2-ring"
            />
          </div>
          {isLoading ? (
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {filteredPermissions?.map((permission) => {
                const isDirect = directPermissions.has(permission.id);
                const isInherited = inheritedPermissions.has(permission.id);
                const hasPermission = isDirect || isInherited;

                return (
                  <div
                    key={permission.id}
                    className={`flex items-start space-x-2 p-2 border rounded ${
                      isInherited
                        ? "bg-v2-ring/50 dark:bg-v2-ring/30 border-v2-ring/50"
                        : "border-v2-ring"
                    }`}
                  >
                    <Checkbox
                      checked={hasPermission}
                      disabled={role.is_system_role || isInherited}
                      onCheckedChange={() =>
                        handleToggle(permission.id, isDirect)
                      }
                      className="h-3 w-3 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-medium text-v2-ink">
                          {permission.code}
                        </span>
                        {isInherited && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-3 px-1 border-v2-ring "
                          >
                            Inherited
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-v2-ink-muted">
                        {permission.description ||
                          `${permission.action} ${permission.resource}`}
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-3.5 px-1 bg-v2-ring"
                        >
                          {permission.resource}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-3.5 px-1 bg-v2-ring"
                        >
                          {permission.action}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-3.5 px-1 bg-v2-ring"
                        >
                          {permission.scope}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter className="pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            size="sm"
            className="h-6 px-2 text-[10px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
