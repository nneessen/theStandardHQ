// src/features/admin/components/UserManagementPage.tsx

import { useState, useMemo } from "react";
import { useAllUsers } from "@/hooks/admin";
import {
  useAllRolesWithPermissions,
  useUpdateUserRoles,
} from "@/hooks/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronRight,
  Users,
  Shield,
  UserCog,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { RoleName, Permission } from "@/types/permissions.types";
import type { UserProfile } from "@/types/user.types";
import { getFullName, getDisplayName } from "@/types/user.types";

export function UserManagementPage() {
  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
  } = useAllUsers();
  const { data: roles, isLoading: rolesLoading } = useAllRolesWithPermissions();
  const updateUserRoles = useUpdateUserRoles();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleName>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setSelectedRoles(new Set((user.roles || []) as RoleName[]));
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setSelectedUser(null);
    setSelectedRoles(new Set());
    setIsEditDialogOpen(false);
  };

  const handleRoleToggle = (roleName: RoleName) => {
    const newRoles = new Set(selectedRoles);
    if (newRoles.has(roleName)) {
      newRoles.delete(roleName);
    } else {
      newRoles.add(roleName);
    }
    setSelectedRoles(newRoles);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    const rolesArray = Array.from(selectedRoles);

    await updateUserRoles.mutateAsync({
      userId: selectedUser.id,
      roles: rolesArray.length > 0 ? rolesArray : ["agent"],
    });

    closeEditDialog();
  };

  // Filter users based on search query
  const filteredUsers = users?.filter((user: UserProfile) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = getFullName(user);
    return (
      user.email?.toLowerCase().includes(query) ||
      fullName.toLowerCase().includes(query)
    );
  });

  // Stats
  const totalUsers = users?.length || 0;
  const approvedUsers =
    users?.filter((u: UserProfile) => u.approval_status === "approved")
      .length || 0;
  const adminCount =
    users?.filter((u: UserProfile) => u.roles?.includes("admin")).length || 0;
  const agentCount =
    users?.filter(
      (u: UserProfile) =>
        u.roles?.includes("agent") && !u.roles?.includes("admin"),
    ).length || 0;

  const getRoleColor = (roleName: RoleName): string => {
    const colors: Record<string, string> = {
      admin:
        "bg-destructive/20 text-destructive dark:bg-destructive/50 dark:text-destructive",
      agent: "bg-info/20 text-info dark:bg-info/50 dark:text-info",
      upline_manager: "bg-info/20 text-info dark:bg-info/50 dark:text-info",
      trainer:
        "bg-success/20 text-success dark:bg-success/50 dark:text-success",
      recruiter:
        "bg-warning/20 text-warning dark:bg-warning/50 dark:text-warning",
      contracting_manager:
        "bg-info/20 text-info dark:bg-info/50 dark:text-info",
      office_staff: "bg-info/20 text-info dark:bg-info/50 dark:text-info",
      view_only:
        "bg-muted text-foreground dark:bg-muted dark:text-muted-foreground",
    };
    return (
      colors[roleName] ||
      "bg-muted text-foreground dark:bg-muted dark:text-muted-foreground"
    );
  };

  const getRoleDisplayName = (roleName: RoleName): string => {
    const role = roles?.find((r) => r.name === roleName);
    return role?.display_name || roleName;
  };

  // Calculate permission changes when roles are modified
  const permissionPreview = useMemo(() => {
    if (!selectedUser || !roles) return { added: [], removed: [], total: 0 };

    // Get current permissions from user's current roles
    const currentPermissions = new Set<string>();
    selectedUser.roles?.forEach((roleName) => {
      const role = roles.find((r) => r.name === roleName);
      role?.permissions?.forEach((perm) => currentPermissions.add(perm.code));
    });

    // Get new permissions from selected roles
    const newPermissions = new Set<string>();
    const newPermissionObjects: Permission[] = [];
    Array.from(selectedRoles).forEach((roleName) => {
      const role = roles.find((r) => r.name === roleName);
      role?.permissions?.forEach((perm) => {
        newPermissions.add(perm.code);
        if (!newPermissionObjects.find((p) => p.code === perm.code)) {
          newPermissionObjects.push(perm);
        }
      });
    });

    // Calculate diff
    const added = Array.from(newPermissions).filter(
      (code) => !currentPermissions.has(code),
    );
    const removed = Array.from(currentPermissions).filter(
      (code) => !newPermissions.has(code),
    );

    return {
      added,
      removed,
      total: newPermissions.size,
      allPermissions: newPermissionObjects,
    };
  }, [selectedUser, selectedRoles, roles]);

  if (usersLoading || rolesLoading) {
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

  if (usersError) {
    return (
      <div className="p-3 min-h-screen">
        <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
          <p className="text-[11px] text-destructive">
            Failed to load users:{" "}
            {usersError instanceof Error ? usersError.message : "Unknown error"}
          </p>
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
            <Users className="h-4 w-4 text-foreground" />
            <h1 className="text-sm font-semibold text-foreground">
              User Management
            </h1>
          </div>

          {/* Inline compact stats */}
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">{totalUsers}</span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span className="font-medium text-foreground">
                {approvedUsers}
              </span>
              <span className="text-muted-foreground">approved</span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-destructive" />
              <span className="font-medium text-foreground">{adminCount}</span>
              <span className="text-muted-foreground">admins</span>
            </div>
            <div className="h-3 w-px bg-muted" />
            <div className="flex items-center gap-1">
              <UserCog className="h-3 w-3 text-info" />
              <span className="font-medium text-foreground">{agentCount}</span>
              <span className="text-muted-foreground">agents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-[11px] bg-card border-border"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="flex-1 overflow-auto rounded-lg bg-card border border-border">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[200px]">
                User
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                Roles
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[120px]">
                Upline
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[100px]">
                Status
              </TableHead>
              <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[100px] text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers?.map((user: UserProfile) => (
              <TableRow
                key={user.id}
                className="hover:bg-background border-b border-border/60"
              >
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                      {user.first_name?.charAt(0)?.toUpperCase() ||
                        user.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[11px] text-foreground truncate leading-tight">
                        {getDisplayName(user)}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate leading-tight">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {user.roles?.slice(0, 3).map((roleName) => (
                      <Badge
                        key={roleName}
                        className={`${getRoleColor(roleName as RoleName)} text-[10px] px-1 py-0 h-4 border-0`}
                        variant="secondary"
                      >
                        {getRoleDisplayName(roleName as RoleName)}
                      </Badge>
                    ))}
                    {(user.roles?.length || 0) > 3 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 h-4 border-border "
                      >
                        +{(user.roles?.length || 0) - 3}
                      </Badge>
                    )}
                    {(!user.roles || user.roles.length === 0) && (
                      <span className="text-[10px] text-muted-foreground italic">
                        No roles
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    {user.upline
                      ? `${user.upline.first_name || ""} ${user.upline.last_name || ""}`.trim() ||
                        "-"
                      : "-"}
                  </span>
                </TableCell>
                <TableCell className="py-1.5">
                  {user.approval_status === "approved" ? (
                    <Badge
                      variant="outline"
                      className="text-success border-success/30 text-[10px] h-4 px-1"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-warning border-warning/30 text-[10px] h-4 px-1"
                    >
                      <XCircle className="h-2.5 w-2.5 mr-0.5" />
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10px] text-muted-foreground dark:text-muted-foreground hover:text-foreground"
                    onClick={() => openEditDialog(user)}
                  >
                    <Shield className="h-2.5 w-2.5 mr-0.5" />
                    Edit Roles
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredUsers?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-[11px] text-muted-foreground py-6"
                >
                  No users found matching "{searchQuery}"
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Roles Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-3 bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Edit User Roles
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">
              Assign roles to {selectedUser ? getDisplayName(selectedUser) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Role Selection */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Available Roles
              </div>
              {roles?.map((role) => {
                const permissionCount = role.permissions?.length || 0;
                const isSelected = selectedRoles.has(role.name);

                return (
                  <div
                    key={role.id}
                    className={`border rounded p-2 ${isSelected ? "border-info/40 bg-info/10/50 dark:bg-info/10" : "border-border"}`}
                  >
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleRoleToggle(role.name)}
                        className="h-3 w-3 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`role-${role.id}`}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-medium text-foreground">
                              {role.display_name}
                            </span>
                            <Badge
                              className={`${getRoleColor(role.name)} text-[9px] px-1 py-0 h-3.5`}
                              variant="secondary"
                            >
                              {role.name}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[9px] h-3.5 px-1 border-border "
                            >
                              {permissionCount} perms
                            </Badge>
                          </div>
                        </Label>
                        {role.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {role.description}
                          </p>
                        )}

                        {/* Show permissions for this role */}
                        {isSelected &&
                          role.permissions &&
                          role.permissions.length > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground mt-1">
                                <ChevronRight className="h-2.5 w-2.5" />
                                View {permissionCount} permission
                                {permissionCount !== 1 ? "s" : ""}
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-1 pl-3 space-y-0.5">
                                {role.permissions.map((perm) => (
                                  <div
                                    key={perm.id}
                                    className="text-[9px] text-muted-foreground"
                                  >
                                    <code className="bg-muted px-1 py-0.5 rounded">
                                      {perm.code}
                                    </code>
                                  </div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Permission Preview - Compact */}
            <div className="bg-background rounded p-2 border border-border/50">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                Permission Summary
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-bold text-foreground">
                    {permissionPreview.total}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Total</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-success">
                    +{permissionPreview.added.length}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Added</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-destructive">
                    -{permissionPreview.removed.length}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    Removed
                  </div>
                </div>
              </div>

              {/* Show added/removed permissions */}
              {(permissionPreview.added.length > 0 ||
                permissionPreview.removed.length > 0) && (
                <div className="space-y-1.5 mt-2 text-[9px]">
                  {permissionPreview.added.length > 0 && (
                    <div>
                      <div className="font-medium text-success mb-0.5">
                        + Adding:
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {permissionPreview.added.slice(0, 5).map((code) => (
                          <code
                            key={code}
                            className="bg-success/10 dark:bg-success/30 text-success px-1 py-0.5 rounded"
                          >
                            {code}
                          </code>
                        ))}
                        {permissionPreview.added.length > 5 && (
                          <span className="text-muted-foreground">
                            +{permissionPreview.added.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {permissionPreview.removed.length > 0 && (
                    <div>
                      <div className="font-medium text-destructive mb-0.5">
                        - Removing:
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {permissionPreview.removed.slice(0, 5).map((code) => (
                          <code
                            key={code}
                            className="bg-destructive/10 dark:bg-destructive/30 text-destructive px-1 py-0.5 rounded"
                          >
                            {code}
                          </code>
                        ))}
                        {permissionPreview.removed.length > 5 && (
                          <span className="text-muted-foreground">
                            +{permissionPreview.removed.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {permissionPreview.added.length === 0 &&
                permissionPreview.removed.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    No permission changes
                  </p>
                )}
            </div>
          </div>

          <DialogFooter className="gap-1 pt-2">
            <Button
              variant="ghost"
              onClick={closeEditDialog}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRoles}
              disabled={updateUserRoles.isPending}
              size="sm"
              className="h-6 px-2 text-[10px]"
            >
              {updateUserRoles.isPending ? "Saving..." : "Save Roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
