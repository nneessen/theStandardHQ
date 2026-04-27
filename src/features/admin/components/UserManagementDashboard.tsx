// /home/nneessen/projects/commissionTracker/src/features/admin/components/UserManagementDashboard.tsx

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  Shield,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useUsersView,
  useApproveUser,
  useDenyUser,
  useSetPendingUser,
  useSetAdminRole,
  useCurrentUserProfile,
  useUpdateContractLevel,
} from "@/hooks/admin";
import { VALID_CONTRACT_LEVELS } from "@/lib/constants";
import type { UserProfile } from "@/types/user.types";
import { Checkbox } from "@/components/ui/checkbox";

export const UserManagementDashboard: React.FC = () => {
  const {
    users,
    metrics,
    isLoading,
    error,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    filters,
    setFilters,
    clearFilters,
    filterCount,
    sortConfig,
    toggleSort,
    refresh,
  } = useUsersView();

  const approveUser = useApproveUser();
  const denyUser = useDenyUser();
  const setPendingUser = useSetPendingUser();
  const setAdminRole = useSetAdminRole();
  const updateContractLevel = useUpdateContractLevel();
  const { data: currentUserProfile } = useCurrentUserProfile();

  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [denialReason, setDenialReason] = useState("");

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ searchTerm });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, setFilters]);

  const handleApprove = async (userId: string) => {
    const result = await approveUser.mutateAsync(userId);
    if (result.success) {
      refresh();
    }
  };

  const handleSetPending = async (userId: string) => {
    const result = await setPendingUser.mutateAsync(userId);
    if (result.success) {
      refresh();
    }
  };

  const handleDenyClick = (user: UserProfile) => {
    setSelectedUser(user);
    setDenialReason("");
    setDenyDialogOpen(true);
  };

  const handleDenyConfirm = async () => {
    if (!selectedUser) return;

    const result = await denyUser.mutateAsync({
      userId: selectedUser.id,
      reason: denialReason || "No reason provided",
    });

    if (result.success) {
      setDenyDialogOpen(false);
      setSelectedUser(null);
      setDenialReason("");
      refresh();
    }
  };

  const handleAdminToggle = async (userId: string, currentIsAdmin: boolean) => {
    // Prevent users from removing their own admin status
    if (userId === currentUserProfile?.id && currentIsAdmin) {
      console.warn("Cannot remove your own admin privileges");
      return;
    }

    const result = await setAdminRole.mutateAsync({
      userId,
      isAdmin: !currentIsAdmin,
    });

    if (result.success) {
      refresh();
    }
  };

  const handleContractLevelChange = async (
    userId: string,
    contractLevel: string,
  ) => {
    const level = contractLevel === "none" ? null : parseInt(contractLevel);
    const result = await updateContractLevel.mutateAsync({
      userId,
      contractLevel: level,
    });
    if (result.success) {
      refresh();
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header with Title and Metrics Bar */}
      <div className="bg-background border-b border-border/50">
        {/* Title */}
        <div className="flex items-center justify-between px-6 py-3">
          <h1 className="text-2xl font-semibold">User Management</h1>
        </div>

        {/* Data-Dense Metrics Bar */}
        <div className="px-6 pb-3">
          {metrics ? (
            <>
              {/* Scope Indicator */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {filterCount > 0 ? "Filtered Users" : "All Users"}
                </span>
                {filterCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    {filterCount} {filterCount === 1 ? "filter" : "filters"}{" "}
                    active
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-8 text-sm">
                {/* Count metrics */}
                <div className="flex items-center gap-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold">
                      {metrics.totalUsers}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      total users
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="font-medium">{metrics.pendingUsers}</span>
                    <span className="text-muted-foreground">pending</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium">{metrics.approvedUsers}</span>
                    <span className="text-muted-foreground">approved</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="font-medium">{metrics.deniedUsers}</span>
                    <span className="text-muted-foreground">denied</span>
                  </div>
                </div>

                {/* Current page context */}
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-semibold">{users.length}</span>
                    <span className="text-muted-foreground ml-1">
                      on this page
                    </span>
                  </div>
                  <div className="text-muted-foreground">•</div>
                  <div>
                    <span className="font-semibold">
                      {
                        users.filter((u) => u.approval_status === "pending")
                          .length
                      }
                    </span>
                    <span className="text-muted-foreground ml-1">
                      pending (page)
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Loading metrics...
            </div>
          )}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-background border-b border-border/50">
        <div className="flex gap-3 p-2 px-4">
          <div className="flex-1 relative flex items-center">
            <Search
              size={16}
              className="absolute left-2.5 text-muted-foreground/60"
            />
            <Input
              type="text"
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-9 text-sm"
            />
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="h-8"
          >
            <Filter size={14} className="mr-1" />
            Filters {filterCount > 0 && `(${filterCount})`}
          </Button>
          {filterCount > 0 && (
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="flex gap-3 p-2 px-4 bg-muted/50">
            <Select
              value={filters.approvalStatus || "all"}
              onValueChange={(value) =>
                setFilters({
                  approvalStatus:
                    value === "all"
                      ? undefined
                      : (value as "pending" | "approved" | "denied"),
                })
              }
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Approval Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Table Container - Scrollable */}
      <div
        className="overflow-auto"
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 border-b border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="h-10 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("email")}
              >
                <div className="flex items-center gap-1">
                  Email
                  {sortConfig.field === "email" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="h-10 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("approval_status")}
              >
                <div className="flex items-center gap-1">
                  Status
                  {sortConfig.field === "approval_status" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    ))}
                </div>
              </TableHead>
              <TableHead className="h-10 px-3">Admin Role</TableHead>
              <TableHead className="h-10 px-3">Contract Level</TableHead>
              <TableHead
                className="h-10 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("created_at")}
              >
                <div className="flex items-center gap-1">
                  Created
                  {sortConfig.field === "created_at" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="h-10 px-3 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("approved_at")}
              >
                <div className="flex items-center gap-1">
                  Status Date
                  {sortConfig.field === "approved_at" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    ))}
                </div>
              </TableHead>
              <TableHead className="h-10 px-3">Notes</TableHead>
              <TableHead className="h-10 px-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="text-sm text-muted-foreground">
                      Loading users...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <span className="text-sm text-destructive">
                      Error: {error}
                    </span>
                    <Button onClick={refresh} size="sm" variant="outline">
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <Shield className="h-8 w-8 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">
                      {filterCount > 0
                        ? "No users match your filters"
                        : "No users found"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="py-1.5 px-3 font-medium text-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="py-1.5 px-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        user.approval_status === "pending" &&
                          "bg-yellow-100 text-yellow-800 border-yellow-300",
                        user.approval_status === "approved" &&
                          "bg-green-100 text-green-800 border-green-300",
                        user.approval_status === "denied" &&
                          "bg-red-100 text-red-800 border-red-300",
                      )}
                    >
                      {user.approval_status === "pending" && (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {user.approval_status === "approved" && (
                        <UserCheck className="h-3 w-3 mr-1" />
                      )}
                      {user.approval_status === "denied" && (
                        <UserX className="h-3 w-3 mr-1" />
                      )}
                      {user.approval_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 px-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={user.is_admin}
                        onCheckedChange={() =>
                          handleAdminToggle(user.id, user.is_admin)
                        }
                        disabled={
                          user.id === currentUserProfile?.id && user.is_admin
                        }
                      />
                      {user.is_admin && (
                        <Badge
                          variant="outline"
                          className="border-primary text-primary text-xs"
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {user.id === currentUserProfile?.id && user.is_admin && (
                        <span className="text-[10px] text-muted-foreground">
                          (You)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5 px-3">
                    <Select
                      value={user.contract_level?.toString() || "none"}
                      onValueChange={(value) =>
                        handleContractLevelChange(user.id, value)
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-[90px]">
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        {VALID_CONTRACT_LEVELS.map((level) => (
                          <SelectItem key={level} value={level.toString()}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-[12px] text-muted-foreground">
                    {user.created_at
                      ? format(new Date(user.created_at), "MMM d, yyyy h:mm a")
                      : "-"}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-[12px] text-muted-foreground">
                    {user.approved_at &&
                      format(new Date(user.approved_at), "MMM d, yyyy h:mm a")}
                    {user.denied_at &&
                      format(new Date(user.denied_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-[11px] text-muted-foreground max-w-[200px] truncate">
                    {user.denial_reason && (
                      <span
                        className="text-destructive"
                        title={user.denial_reason}
                      >
                        {user.denial_reason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-right">
                    {user.is_admin ? (
                      <span className="text-xs text-muted-foreground">
                        Protected
                      </span>
                    ) : (
                      <Select
                        value={user.approval_status}
                        onValueChange={(value) => {
                          if (value === "denied") {
                            handleDenyClick(user);
                          } else if (value === "approved") {
                            handleApprove(user.id);
                          } else if (value === "pending") {
                            handleSetPending(user.id);
                          }
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-7 text-xs w-[110px] !px-2 !gap-1 font-medium border-2",
                            user.approval_status === "approved" &&
                              "!bg-green-100 !text-green-800 !border-green-300 hover:!bg-green-200",
                            user.approval_status === "pending" &&
                              "!bg-yellow-100 !text-yellow-800 !border-yellow-300 hover:!bg-yellow-200",
                            user.approval_status === "denied" &&
                              "!bg-red-100 !text-red-800 !border-red-300 hover:!bg-red-200",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="!bg-white dark:!bg-gray-800 border-2">
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="denied">Denied</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Server-side Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-background border-t border-border/50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{" "}
            of <span className="font-medium text-foreground">{totalItems}</span>{" "}
            users
          </div>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            onClick={previousPage}
            disabled={currentPage === 1}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {(() => {
              const pages = [];
              const maxVisible = 5;
              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              const end = Math.min(totalPages, start + maxVisible - 1);

              if (end - start < maxVisible - 1) {
                start = Math.max(1, end - maxVisible + 1);
              }

              if (start > 1) {
                pages.push(
                  <Button
                    key={1}
                    onClick={() => goToPage(1)}
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-8 px-2"
                  >
                    1
                  </Button>,
                );
                if (start > 2) {
                  pages.push(
                    <span key="dots1" className="px-1 text-muted-foreground">
                      ...
                    </span>,
                  );
                }
              }

              for (let i = start; i <= end; i++) {
                pages.push(
                  <Button
                    key={i}
                    onClick={() => goToPage(i)}
                    variant={currentPage === i ? "default" : "outline"}
                    size="sm"
                    className="h-8 min-w-8 px-2"
                  >
                    {i}
                  </Button>,
                );
              }

              if (end < totalPages) {
                if (end < totalPages - 1) {
                  pages.push(
                    <span key="dots2" className="px-1 text-muted-foreground">
                      ...
                    </span>,
                  );
                }
                pages.push(
                  <Button
                    key={totalPages}
                    onClick={() => goToPage(totalPages)}
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-8 px-2"
                  >
                    {totalPages}
                  </Button>,
                );
              }

              return pages;
            })()}
          </div>

          <Button
            onClick={nextPage}
            disabled={currentPage === totalPages}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny User Access</DialogTitle>
            <DialogDescription>
              Please provide a reason for denying access to{" "}
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter denial reason..."
              value={denialReason}
              onChange={(e) => setDenialReason(e.target.value)}
              rows={4}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This reason will be shown to the user.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDenyDialogOpen(false);
                setSelectedUser(null);
                setDenialReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDenyConfirm}
              disabled={denyUser.isPending || !denialReason.trim()}
            >
              {denyUser.isPending ? "Denying..." : "Deny Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
