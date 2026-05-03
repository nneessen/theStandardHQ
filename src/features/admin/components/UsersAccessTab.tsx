// src/features/admin/components/UsersAccessTab.tsx

import { useState } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useDeleteUser } from "@/hooks/admin";
import {
  useAllActiveImos,
  useMyImoAgencies,
  useAllActiveAgencies,
} from "@/hooks/imo";
import type { Role, RoleName } from "@/types/permissions.types";
import type { UserProfile } from "@/types/user.types";
import { getFullName, getDisplayName } from "@/types/user.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UsersAccessTabProps {
  users: UserProfile[] | undefined;
  roles: Role[] | undefined;
  isLoading: boolean;
  isSuperAdmin: boolean;
  onEditUser: (user: UserProfile) => void;
  onAddUser: () => void;
}

export function UsersAccessTab({
  users,
  roles,
  isLoading,
  isSuperAdmin,
  onEditUser,
  onAddUser,
}: UsersAccessTabProps) {
  // Local state for search and pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Hooks for delete and organization data
  const deleteUserMutation = useDeleteUser();
  const { data: allImos } = useAllActiveImos({ enabled: isSuperAdmin });
  const { data: myAgencies } = useMyImoAgencies();
  const { data: allAgencies } = useAllActiveAgencies();

  // Helper to get IMO name by ID
  const getImoName = (imoId: string | null) => {
    if (!imoId) return "-";
    return allImos?.find((imo) => imo.id === imoId)?.code || "-";
  };

  // Helper to get Agency name by ID
  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId) return "-";
    const agencies = isSuperAdmin ? allAgencies : myAgencies;
    return agencies?.find((a) => a.id === agencyId)?.code || "-";
  };

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

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${userName}? This cannot be undone.`,
      )
    ) {
      return;
    }

    deleteUserMutation.mutate(userId, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success(`${userName} deleted`);
        } else {
          toast.error(result.error || "Failed to delete user");
        }
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete user",
        );
      },
    });
  };

  // Search filtering
  const filteredUsers = users?.filter((user: UserProfile) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = getFullName(user);
    return (
      user.email?.toLowerCase().includes(query) ||
      fullName.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil((filteredUsers?.length || 0) / itemsPerPage);
  const paginatedUsers = filteredUsers?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Compact controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-7 h-7 text-[11px] bg-card border-border"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Show</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(v) => {
                setItemsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-16 text-[11px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" className="h-6 text-[10px] px-2" onClick={onAddUser}>
          <Plus className="h-3 w-3 mr-1" />
          Add User
        </Button>
      </div>

      {/* Data table */}
      <div className="flex-1 overflow-auto rounded-lg bg-card border border-border">
        {isLoading ? (
          <div className="p-3 space-y-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[180px]">
                  User
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[120px]">
                  Roles
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[120px]">
                  Upline
                </TableHead>
                {isSuperAdmin && (
                  <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[70px]">
                    IMO
                  </TableHead>
                )}
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[80px]">
                  Agency
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[65px]">
                  Status
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[55px]">
                  Level
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[60px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers?.map((user: UserProfile) => (
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
                      {user.roles?.slice(0, 2).map((roleName) => (
                        <Badge
                          key={roleName}
                          className={`${getRoleColor(roleName as RoleName)} text-[10px] px-1 py-0 h-4 border-0`}
                          variant="secondary"
                        >
                          {getRoleDisplayName(roleName as RoleName)}
                        </Badge>
                      ))}
                      {(user.roles?.length || 0) > 2 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 border-border "
                        >
                          +{(user.roles?.length || 0) - 2}
                        </Badge>
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
                  {isSuperAdmin && (
                    <TableCell className="py-1.5">
                      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground font-mono">
                        {getImoName(user.imo_id)}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="py-1.5">
                    <span className="text-[10px] text-muted-foreground dark:text-muted-foreground font-mono">
                      {getAgencyName(user.agency_id)}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    {user.approval_status === "approved" ? (
                      <Badge
                        variant="outline"
                        className="text-success border-success/30 text-[10px] h-4 px-1"
                      >
                        OK
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-warning border-warning/30 text-[10px] h-4 px-1"
                      >
                        Pend
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {user.contract_level || "-"}%
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground dark:text-muted-foreground hover:text-foreground"
                        onClick={() => onEditUser(user)}
                        title="Edit user"
                      >
                        <Edit className="h-2.5 w-2.5 mr-0.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                        onClick={() =>
                          handleDeleteUser(user.id, getDisplayName(user))
                        }
                        title="Delete user"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedUsers?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isSuperAdmin ? 8 : 7}
                    className="text-center text-[11px] text-muted-foreground py-6"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[11px]">
          <div className="text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredUsers?.length || 0)}{" "}
            of {filteredUsers?.length || 0} users
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 border-border"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, idx, arr) => (
                  <span key={`page-${page}`}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1 text-muted-foreground">...</span>
                    )}
                    <Button
                      size="sm"
                      variant={currentPage === page ? "default" : "ghost"}
                      className="h-6 w-6 p-0 text-[11px]"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  </span>
                ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 border-border"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
