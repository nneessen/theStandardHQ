// src/features/admin/components/AdminControlCenter.tsx
// Orchestration layer for Admin Center - manages tabs, shared state, and dialogs

import { useState, useMemo } from "react";
import { Users, Shield, UserCog, CheckCircle2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAllUsers, useCreateUser } from "@/hooks/admin";
import {
  useAllRolesWithPermissions,
  useIsAdmin,
  useAllPermissions,
} from "@/hooks/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AddUserDialog, { type NewUserData } from "./AddUserDialog";
import EditUserDialog from "./EditUserDialog";
import { PillNav } from "@/components/v2";
import type { RoleName } from "@/types/permissions.types";
import type { UserProfile } from "@/types/user.types";
import { hasStaffRole } from "@/constants/roles";
import { useImo } from "@/contexts/ImoContext";
import { useActiveTemplate, usePhases } from "@/features/recruiting";

// Tab components
import { UsersAccessTab } from "./UsersAccessTab";
import { RecruitingPipelineTab } from "./RecruitingPipelineTab";
import { RolesPermissionsTab } from "./RolesPermissionsTab";
import { SystemSettingsTab } from "./SystemSettingsTab";
export default function AdminControlCenter() {
  // Tab navigation
  const [activeView, setActiveView] = useState<
    "users" | "recruits" | "roles" | "system"
  >("users");

  // Shared dialog state (Edit User is used by both Users and Recruits tabs)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Shared data hooks
  const { user: currentUser } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: allUsers, isLoading: usersLoading } = useAllUsers();
  const { data: roles } = useAllRolesWithPermissions();
  const { data: allPermissions } = useAllPermissions();
  const createUserMutation = useCreateUser();
  const { isSuperAdmin } = useImo();

  // Pipeline phases for graduation eligibility
  const { data: activeTemplate } = useActiveTemplate();
  const { data: pipelinePhases = [] } = usePhases(activeTemplate?.id);

  // Check if current user can graduate recruits
  const currentUserProfile = allUsers?.find((u) => u.id === currentUser?.id);
  const canGraduateRecruits = currentUserProfile?.roles?.some((role) =>
    ["admin", "trainer", "contracting_manager"].includes(role as string),
  );

  // Graduation-eligible phases: last 3 phases of the pipeline
  const graduationEligiblePhases = useMemo(() => {
    if (pipelinePhases.length === 0) return [];
    const sortedPhases = [...pipelinePhases].sort(
      (a, b) => a.phase_order - b.phase_order,
    );
    const lastThree = sortedPhases.slice(-3);
    return lastThree.map((phase) => phase.phase_name);
  }, [pipelinePhases]);

  // Hierarchy-based filtering for non-admin users
  const hierarchyFilteredUsers = isAdmin
    ? allUsers
    : allUsers?.filter((u: UserProfile) => {
        if (u.id === currentUser?.id) return true;
        if (u.hierarchy_path?.includes(currentUser?.id || "")) return true;
        return false;
      });

  // Helper to check if user is an agent/admin
  const isAgentOrAdmin = (u: UserProfile) =>
    u.roles?.includes("agent" as RoleName) ||
    u.roles?.includes("active_agent" as RoleName) ||
    u.is_admin === true;

  // Helper to check if user is a pure recruit
  const isPureRecruit = (u: UserProfile) => {
    if (!u.roles?.includes("recruit" as RoleName)) return false;
    if (isAgentOrAdmin(u)) return false;
    if (hasStaffRole(u.roles)) return false;
    return true;
  };

  // Users & Access tab: All users EXCEPT pure recruits
  const activeAgents = hierarchyFilteredUsers?.filter(
    (u: UserProfile) => !isPureRecruit(u),
  );

  // Recruiting Pipeline tab: Only pure recruits
  const recruitsInPipeline =
    hierarchyFilteredUsers?.filter((u: UserProfile) => isPureRecruit(u)) || [];

  // Calculate stats for header
  const totalUsers = activeAgents?.length || 0;
  const admins =
    activeAgents?.filter((u: UserProfile) => u.roles?.includes("admin"))
      .length || 0;
  const agents =
    activeAgents?.filter(
      (u: UserProfile) =>
        u.roles?.includes("agent") && !u.roles?.includes("admin"),
    ).length || 0;
  const approved = activeAgents?.length || 0;
  const pending = recruitsInPipeline.length;

  // Shared handlers
  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleAddUser = async (userData: NewUserData) => {
    const result = await createUserMutation.mutateAsync(userData);
    if (result.success) {
      setIsAddUserDialogOpen(false);

      if (result.inviteSent) {
        toast.success(
          `User created! Confirmation email sent to ${userData.email}`,
        );
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `User "${userData.first_name} ${userData.last_name}" created`,
        );
      }
    } else {
      toast.error(result.error || "Failed to create user");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Compact header — title + inline metric chips + tab nav in one band */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Shield className="h-4 w-4 text-v2-ink" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              Admin Center
            </h1>
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-v2-ink-subtle" />
              <span className="text-v2-ink font-semibold">{totalUsers}</span>
              users
            </span>
            <span className="text-v2-ink-subtle">·</span>
            <span className="inline-flex items-center gap-1">
              <Shield className="h-3 w-3 text-red-500" />
              <span className="text-v2-ink font-semibold">{admins}</span>
              admins
            </span>
            <span className="text-v2-ink-subtle">·</span>
            <span className="inline-flex items-center gap-1">
              <UserCog className="h-3 w-3 text-blue-500" />
              <span className="text-v2-ink font-semibold">{agents}</span>
              agents
            </span>
            <span className="text-v2-ink-subtle">·</span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-v2-ink font-semibold">{approved}</span>
              approved
            </span>
            <span className="text-v2-ink-subtle">·</span>
            <span className="inline-flex items-center gap-1">
              <XCircle className="h-3 w-3 text-amber-500" />
              <span className="text-v2-ink font-semibold">{pending}</span>
              pending
            </span>
          </div>
        </div>

        <PillNav
          size="sm"
          activeValue={activeView}
          onChange={(v) => setActiveView(v as typeof activeView)}
          items={[
            { label: "Users & Access", value: "users" },
            {
              label: pending > 0 ? `Recruiting (${pending})` : "Recruiting",
              value: "recruits",
            },
            { label: "Roles & Permissions", value: "roles" },
            { label: "System", value: "system" },
          ]}
        />
      </header>

      {/* Content area - Tab components */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeView === "users" && (
          <UsersAccessTab
            users={activeAgents}
            roles={roles}
            isLoading={usersLoading}
            isSuperAdmin={isSuperAdmin}
            onEditUser={handleEditUser}
            onAddUser={() => setIsAddUserDialogOpen(true)}
          />
        )}

        {activeView === "recruits" && (
          <RecruitingPipelineTab
            recruits={recruitsInPipeline}
            allUsers={allUsers}
            isLoading={usersLoading}
            canGraduateRecruits={canGraduateRecruits || false}
            graduationEligiblePhases={graduationEligiblePhases}
            onEditRecruit={handleEditUser}
          />
        )}

        {activeView === "roles" && (
          <RolesPermissionsTab
            roles={roles}
            allPermissions={allPermissions}
            activeAgents={activeAgents}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {activeView === "system" && <SystemSettingsTab />}
      </div>

      {/* Shared dialogs */}
      <EditUserDialog
        user={editingUser}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingUser(null);
        }}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["users"] });
          queryClient.invalidateQueries({ queryKey: ["recruits"] });
        }}
      />

      <AddUserDialog
        open={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        onSave={handleAddUser}
      />
    </div>
  );
}
