// src/features/admin/components/PermissionManagementPage.tsx

import { useState, useMemo } from "react";
import {
  useAllPermissions,
  useAllRolesWithPermissions,
  useCreatePermission,
  useUpdatePermission,
  useDeletePermission,
  type CreatePermissionInput,
  type UpdatePermissionInput,
} from "@/hooks/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Search,
  Lock,
} from "lucide-react";
import type { Permission, PermissionScope } from "@/types/permissions.types";

export function PermissionManagementPage() {
  const { data: permissions = [], isLoading: permissionsLoading } =
    useAllPermissions();
  const { data: roles = [], isLoading: rolesLoading } =
    useAllRolesWithPermissions();
  const createPermission = useCreatePermission();
  const updatePermission = useUpdatePermission();
  const deletePermission = useDeletePermission();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] =
    useState<Permission | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  // Form state for create/edit
  const [formData, setFormData] = useState<{
    code: string;
    resource: string;
    action: string;
    scope: PermissionScope;
    description: string;
  }>({
    code: "",
    resource: "",
    action: "",
    scope: "all",
    description: "",
  });

  // Filtered permissions
  const filteredPermissions = useMemo(() => {
    return permissions.filter((permission) => {
      const matchesSearch =
        permission.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        permission.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        permission.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (permission.description
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ??
          false);

      const matchesResource =
        resourceFilter === "all" || permission.resource === resourceFilter;

      return matchesSearch && matchesResource;
    });
  }, [permissions, searchTerm, resourceFilter]);

  // Get unique resources for filter dropdown
  const uniqueResources = useMemo(() => {
    return Array.from(new Set(permissions.map((p) => p.resource))).sort();
  }, [permissions]);

  // Find which roles have a given permission
  const getRolesWithPermission = (permissionId: string) => {
    return roles.filter((role) =>
      role.permissions?.some((p) => p.id === permissionId),
    );
  };

  // Stats
  const systemPermsCount = permissions.filter(
    (p) => p.is_system_permission,
  ).length;
  const customPermsCount = permissions.length - systemPermsCount;

  const handleOpenCreateDialog = () => {
    setFormData({
      code: "",
      resource: "",
      action: "",
      scope: "all",
      description: "",
    });
    setIsCreateDialogOpen(true);
  };

  const handleOpenEditDialog = (permission: Permission) => {
    setSelectedPermission(permission);
    setFormData({
      code: permission.code,
      resource: permission.resource,
      action: permission.action,
      scope: permission.scope,
      description: permission.description || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenDeleteDialog = (permission: Permission) => {
    setSelectedPermission(permission);
    setIsDeleteDialogOpen(true);
  };

  const handleCreate = async () => {
    try {
      await createPermission.mutateAsync(formData as CreatePermissionInput);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create permission:", error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPermission) return;

    try {
      const updateInput: UpdatePermissionInput = {
        resource: formData.resource,
        action: formData.action,
        scope: formData.scope,
        description: formData.description,
      };
      await updatePermission.mutateAsync({
        permissionId: selectedPermission.id,
        input: updateInput,
      });
      setIsEditDialogOpen(false);
      setSelectedPermission(null);
    } catch (error) {
      console.error("Failed to update permission:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedPermission) return;

    try {
      await deletePermission.mutateAsync(selectedPermission.id);
      setIsDeleteDialogOpen(false);
      setSelectedPermission(null);
    } catch (error) {
      console.error("Failed to delete permission:", error);
    }
  };

  if (permissionsLoading || rolesLoading) {
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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* Compact Header with inline stats */}
      <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-foreground" />
            <h1 className="text-sm font-semibold text-foreground">
              Permission Management
            </h1>
          </div>

          {/* Inline compact stats */}
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">
                {permissions.length}
              </span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {systemPermsCount}
              </span>
              <span className="text-muted-foreground">system</span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">
                {customPermsCount}
              </span>
              <span className="text-muted-foreground">custom</span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">
                {uniqueResources.length}
              </span>
              <span className="text-muted-foreground">resources</span>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={handleOpenCreateDialog}
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Permission
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 h-7 text-[11px] bg-card border-border"
          />
        </div>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger className="w-40 h-7 text-[11px] bg-card border-border">
            <SelectValue placeholder="Filter by resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All Resources
            </SelectItem>
            {uniqueResources.map((resource) => (
              <SelectItem
                key={resource}
                value={resource}
                className="text-[11px]"
              >
                {resource}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Permissions Table */}
      <div className="flex-1 overflow-auto rounded-lg bg-card border border-border">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[200px]">
                Permission Code
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[100px]">
                Resource
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[80px]">
                Action
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[80px]">
                Scope
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                Description
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[80px]">
                Roles
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[80px]">
                Type
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[80px] text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPermissions.map((permission) => {
              const assignedRoles = getRolesWithPermission(permission.id);
              const isSystemPermission = permission.is_system_permission;

              return (
                <TableRow
                  key={permission.id}
                  className="hover:bg-background border-b border-border/60"
                >
                  <TableCell className="py-1.5">
                    <code className="text-[10px] font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                      {permission.code}
                    </code>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1 bg-muted"
                    >
                      {permission.resource}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1 border-border "
                    >
                      {permission.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1 border-border "
                    >
                      {permission.scope}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="text-[10px] text-muted-foreground dark:text-muted-foreground truncate block max-w-xs">
                      {permission.description || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {assignedRoles.length}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    {isSystemPermission ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 border-border "
                      >
                        <Lock className="h-2.5 w-2.5 mr-0.5" />
                        System
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 border-info/40 text-info"
                      >
                        Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground dark:text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEditDialog(permission)}
                        disabled={isSystemPermission}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                        onClick={() => handleOpenDeleteDialog(permission)}
                        disabled={
                          isSystemPermission || assignedRoles.length > 0
                        }
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredPermissions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-[11px] text-muted-foreground py-6"
                >
                  No permissions found matching your filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Permission Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md p-3 bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Create Permission
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">
              Create a new custom permission. Code format: resource:action
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Permission Code <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="policies:create"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                className="h-7 text-[11px] bg-card border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Resource <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="policies"
                  value={formData.resource}
                  onChange={(e) =>
                    setFormData({ ...formData, resource: e.target.value })
                  }
                  className="h-7 text-[11px] bg-card border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Action <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="create"
                  value={formData.action}
                  onChange={(e) =>
                    setFormData({ ...formData, action: e.target.value })
                  }
                  className="h-7 text-[11px] bg-card border-border"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Scope <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.scope}
                onValueChange={(value) =>
                  setFormData({ ...formData, scope: value as PermissionScope })
                }
              >
                <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own" className="text-[11px]">
                    Own
                  </SelectItem>
                  <SelectItem value="downline" className="text-[11px]">
                    Downline
                  </SelectItem>
                  <SelectItem value="all" className="text-[11px]">
                    All
                  </SelectItem>
                  <SelectItem value="self" className="text-[11px]">
                    Self
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Description
              </Label>
              <Textarea
                placeholder="Describe what this permission allows..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="text-[11px] bg-card border-border resize-none"
              />
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
              disabled={
                !formData.code ||
                !formData.resource ||
                !formData.action ||
                createPermission.isPending
              }
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {createPermission.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Create Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permission Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md p-3 bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Edit Permission
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">
              Update permission details. Code cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Permission Code (Read-only)
              </Label>
              <Input
                value={formData.code}
                disabled
                className="h-7 text-[11px] bg-muted border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Resource <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.resource}
                  onChange={(e) =>
                    setFormData({ ...formData, resource: e.target.value })
                  }
                  className="h-7 text-[11px] bg-card border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Action <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.action}
                  onChange={(e) =>
                    setFormData({ ...formData, action: e.target.value })
                  }
                  className="h-7 text-[11px] bg-card border-border"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Scope <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.scope}
                onValueChange={(value) =>
                  setFormData({ ...formData, scope: value as PermissionScope })
                }
              >
                <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own" className="text-[11px]">
                    Own
                  </SelectItem>
                  <SelectItem value="downline" className="text-[11px]">
                    Downline
                  </SelectItem>
                  <SelectItem value="all" className="text-[11px]">
                    All
                  </SelectItem>
                  <SelectItem value="self" className="text-[11px]">
                    Self
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Description
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="text-[11px] bg-card border-border resize-none"
              />
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
              disabled={
                !formData.resource ||
                !formData.action ||
                updatePermission.isPending
              }
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {updatePermission.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Update Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Permission Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm p-3 bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Delete Permission
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">
              Are you sure you want to delete this permission? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {selectedPermission && (
            <div className="py-2">
              <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {selectedPermission.code}
              </code>
              {selectedPermission.description && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {selectedPermission.description}
                </p>
              )}
            </div>
          )}
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
              disabled={deletePermission.isPending}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {deletePermission.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Delete Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
