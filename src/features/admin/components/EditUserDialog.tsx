// src/features/admin/components/EditUserDialog.tsx
// Redesigned with zinc palette and compact design

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateHierarchyForNode } from "@/hooks/hierarchy";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/v2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAllRolesWithPermissions } from "@/hooks/permissions";
import { useDeleteUser } from "@/hooks/admin";
import { useToggleUserUWAccess } from "@/hooks/admin";
// eslint-disable-next-line no-restricted-imports
import { userApprovalService } from "@/services/users/userService";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
// eslint-disable-next-line no-restricted-imports
import { createAuthUserWithProfile } from "@/services/recruiting";
import { toast } from "sonner";
import {
  Mail,
  User,
  Phone,
  Users,
  Trash2,
  Send,
  MapPin,
  CreditCard,
  Globe,
  AlertTriangle,
  Loader2,
  Building2,
  ShieldCheck,
} from "lucide-react";
import type { RoleName } from "@/types/permissions.types";
import { VALID_CONTRACT_LEVELS } from "@/lib/constants";
import type { UserProfile } from "@/types/user.types";
import { UserSearchCombobox } from "@/components/shared/user-search-combobox";
import { useImo } from "@/contexts/ImoContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAllActiveImos,
  useAgenciesByImo,
  useAssignAgentToAgency,
  useAgencyById,
  imoKeys,
  agencyKeys,
} from "@/hooks/imo";

interface EditUserDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

interface EditableUserData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  upline_id: string | null;
  roles: RoleName[];
  approval_status: "pending" | "approved" | "denied";
  agent_status: "unlicensed" | "licensed" | "not_applicable" | null;
  contract_level: number | null;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  resident_state: string;
  license_number: string;
  npn: string;
  license_expiration: string;
  instagram_url: string;
  imo_id: string | null;
  agency_id: string | null;
  uw_wizard_enabled: boolean;
}

export default function EditUserDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
}: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const { data: roles } = useAllRolesWithPermissions();
  const deleteUserMutation = useDeleteUser();
  const toggleUWAccessMutation = useToggleUserUWAccess();

  // Auth hook for activity logging
  const { user: currentUser } = useAuth();

  // IMO/Agency hooks
  const { isSuperAdmin, isImoAdmin } = useImo();
  const { data: allImos, isLoading: isLoadingImos } = useAllActiveImos();
  const [selectedImoId, setSelectedImoId] = useState<string | null>(null);
  const { data: agenciesForImo, isLoading: isLoadingAgencies } =
    useAgenciesByImo(selectedImoId ?? "");
  const assignAgentMutation = useAssignAgentToAgency();
  // Fetch user's original agency separately (HIGH-2 fix: don't rely on agenciesForImo)
  const { data: userOriginalAgency } = useAgencyById(
    user?.agency_id ?? undefined,
  );
  // LOW-3: Combined loading state for organization tab
  const isOrgDataLoading =
    isLoadingImos || (selectedImoId && isLoadingAgencies);

  const [formData, setFormData] = useState<EditableUserData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    upline_id: null,
    roles: [],
    approval_status: "pending",
    agent_status: null,
    contract_level: null,
    street_address: "",
    city: "",
    state: "",
    zip: "",
    resident_state: "",
    license_number: "",
    npn: "",
    license_expiration: "",
    instagram_url: "",
    imo_id: null,
    agency_id: null,
    uw_wizard_enabled: false,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showOrgChangeConfirm, setShowOrgChangeConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [reassignUplineId, setReassignUplineId] = useState<string | null>(null);
  const [checkingDependencies, setCheckingDependencies] = useState(false);
  const [downlineCount, setDownlineCount] = useState(0);

  useEffect(() => {
    if (!showDeleteConfirm || !user) {
      setDownlineCount(0);
      setReassignUplineId(null);
      setCheckingDependencies(false);
      return;
    }

    let isActive = true;

    const checkDownlines = async () => {
      setCheckingDependencies(true);
      try {
        const { count, error: countError } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true })
          .eq("upline_id", user.id);

        if (countError) {
          console.error("Error checking downlines:", countError);
          if (isActive) setDownlineCount(0);
          return;
        }

        if (!isActive) return;
        setDownlineCount(count || 0);
      } catch (error) {
        console.error("Error checking downlines:", error);
        if (isActive) setDownlineCount(0);
      } finally {
        if (isActive) setCheckingDependencies(false);
      }
    };

    checkDownlines();

    return () => {
      isActive = false;
    };
  }, [showDeleteConfirm, user?.id, user]);

  useEffect(() => {
    if (user && open) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone: user.phone || "",
        upline_id: user.upline_id || null,
        roles: (user.roles as RoleName[]) || [],
        approval_status:
          (user.approval_status as "pending" | "approved" | "denied") ||
          "pending",
        agent_status: user.agent_status || null,
        contract_level: user.contract_level || null,
        street_address: user.street_address || "",
        city: user.city || "",
        state: user.state || "",
        zip: user.zip || "",
        resident_state: user.resident_state || "",
        license_number: user.license_number || "",
        npn: user.npn || "",
        license_expiration: user.license_expiration || "",
        instagram_url: user.instagram_url || "",
        imo_id: user.imo_id || null,
        agency_id: user.agency_id || null,
        uw_wizard_enabled: user.uw_wizard_enabled || false,
      });
      // Set selected IMO for agency dropdown
      setSelectedImoId(user.imo_id || null);
    }
  }, [user, open]);

  const handleRoleToggle = (roleName: RoleName) => {
    setFormData((prev) => {
      let newRoles = prev.roles.includes(roleName)
        ? prev.roles.filter((r) => r !== roleName)
        : [...prev.roles, roleName];

      // Mutual exclusivity: recruit vs agent/active_agent
      // Selecting recruit removes agent roles; selecting agent removes recruit
      // Note: Cast to string for comparison since DB may contain values not in RoleName type
      const roleStr = roleName as string;
      if (roleStr === "recruit" && newRoles.includes("recruit")) {
        // Adding recruit role - remove agent roles
        newRoles = newRoles.filter(
          (r) => (r as string) !== "agent" && (r as string) !== "active_agent",
        );
      } else if (
        (roleStr === "agent" || roleStr === "active_agent") &&
        newRoles.includes(roleName)
      ) {
        // Adding agent role - remove recruit role
        newRoles = newRoles.filter((r) => (r as string) !== "recruit");
      }

      return { ...prev, roles: newRoles };
    });
  };

  // Check if organization (IMO/Agency) is changing
  const hasOrgChanges = () => {
    const agencyChanged = formData.agency_id !== user?.agency_id;
    const imoChanged = formData.imo_id !== user?.imo_id;
    return agencyChanged || imoChanged;
  };

  // Pre-save check: show confirmation if org changes
  const handleSaveClick = () => {
    if (!user) return;

    // MEDIUM-3 fix: Show confirmation dialog for organization changes
    if (hasOrgChanges()) {
      setShowOrgChangeConfirm(true);
      return;
    }

    // No org changes, proceed directly
    handleSave();
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    // Don't close org confirm dialog yet - wait for save to complete

    try {
      const updates: Record<string, unknown> = {};
      let agencyChanged = false;
      let uplineChanged = false;

      if (formData.first_name !== (user.first_name || ""))
        updates.first_name = formData.first_name || null;
      if (formData.last_name !== (user.last_name || ""))
        updates.last_name = formData.last_name || null;
      if (formData.phone !== (user.phone || ""))
        updates.phone = formData.phone || null;
      if (formData.upline_id !== user.upline_id) {
        updates.upline_id = formData.upline_id;
        uplineChanged = true;
      }
      if (JSON.stringify(formData.roles) !== JSON.stringify(user.roles || []))
        updates.roles = formData.roles;

      // Handle switching TO recruit role: sync recruiter_id with upline_id
      const wasRecruit = user.roles?.includes("recruit");
      const isNowRecruit = formData.roles.includes("recruit");
      const switchingToRecruit = !wasRecruit && isNowRecruit;

      if (switchingToRecruit) {
        // Set recruiter_id from upline (or current user as fallback)
        const recruiterId =
          formData.upline_id || user.upline_id || currentUser?.id;
        if (recruiterId) {
          updates.recruiter_id = recruiterId;
        }

        // Reset onboarding status if user was previously a completed agent
        if (user.onboarding_status === "completed") {
          updates.onboarding_status = null; // Reset to allow re-enrollment
          updates.current_onboarding_phase = null;
        }

        // CRITICAL: Set onboarding_started_at so they pass the exclude_prospects filter
        // The filter requires: onboarding_status IS NOT NULL OR onboarding_started_at IS NOT NULL
        // Without this, recruits converted from non-agent roles are invisible in pipelines
        if (!user.onboarding_started_at) {
          updates.onboarding_started_at = new Date().toISOString();
        }

        // Inherit imo_id from current user if not already set
        if (!user.imo_id && !formData.imo_id && currentUser?.imo_id) {
          updates.imo_id = currentUser.imo_id;
        }
      }

      if (formData.approval_status !== user.approval_status)
        updates.approval_status = formData.approval_status;
      if (formData.agent_status !== user.agent_status)
        updates.agent_status = formData.agent_status;
      if (formData.contract_level !== user.contract_level)
        updates.contract_level = formData.contract_level;

      if (formData.street_address !== (user.street_address || ""))
        updates.street_address = formData.street_address || null;
      if (formData.city !== (user.city || ""))
        updates.city = formData.city || null;
      if (formData.state !== (user.state || ""))
        updates.state = formData.state || null;
      if (formData.zip !== (user.zip || "")) updates.zip = formData.zip || null;
      if (formData.resident_state !== (user.resident_state || ""))
        updates.resident_state = formData.resident_state || null;

      if (formData.license_number !== (user.license_number || ""))
        updates.license_number = formData.license_number || null;
      if (formData.npn !== (user.npn || "")) updates.npn = formData.npn || null;
      if (formData.license_expiration !== (user.license_expiration || ""))
        updates.license_expiration = formData.license_expiration || null;

      if (formData.instagram_url !== (user.instagram_url || ""))
        updates.instagram_url = formData.instagram_url || null;

      // Check if agency assignment changed
      if (formData.agency_id !== user.agency_id) {
        agencyChanged = true;
      }

      // Check if IMO changed (for super admin IMO-only assignment)
      const imoChanged = formData.imo_id !== user.imo_id;

      // Check if UW wizard access changed (super admin only)
      const uwWizardChanged =
        isSuperAdmin &&
        formData.uw_wizard_enabled !== (user.uw_wizard_enabled || false);

      const hasProfileUpdates = Object.keys(updates).length > 0;

      if (
        !hasProfileUpdates &&
        !agencyChanged &&
        !imoChanged &&
        !uwWizardChanged
      ) {
        toast.success("No changes to save");
        setIsSaving(false);
        return;
      }

      // HIGH-4 fix: Validate IMO is still active before assignment
      if (imoChanged && formData.imo_id) {
        const selectedImo = allImos?.find((i) => i.id === formData.imo_id);
        if (!selectedImo) {
          toast.error(
            "Selected IMO no longer exists. Please refresh and try again.",
          );
          setIsSaving(false);
          return;
        }
        if (!selectedImo.is_active) {
          toast.error(
            "Selected IMO is no longer active. Please select a different IMO.",
          );
          setIsSaving(false);
          return;
        }
      }

      // Handle agency assignment if changed (this also sets imo_id via the service)
      if (agencyChanged && formData.agency_id) {
        await assignAgentMutation.mutateAsync({
          agentId: user.id,
          agencyId: formData.agency_id,
        });
      } else if (imoChanged) {
        // IMO changed but no agency selected - update imo_id directly
        // Also clear agency_id if IMO changed (user should be reassigned to new agency)
        const { error: imoError } = await supabase
          .from("user_profiles")
          .update({
            imo_id: formData.imo_id,
            agency_id: formData.agency_id, // Will be null if no agency selected
          })
          .eq("id", user.id);

        if (imoError) {
          toast.error("Failed to update organization assignment");
          setIsSaving(false);
          return;
        }
      }

      // Handle other profile updates if any
      if (hasProfileUpdates) {
        const result = await userApprovalService.updateUser(user.id, updates);
        if (!result.success) {
          toast.error(result.error || "Failed to update user");
          setIsSaving(false);
          return;
        }
      }

      // Handle UW wizard access toggle (super admin only)
      if (uwWizardChanged) {
        await toggleUWAccessMutation.mutateAsync({
          userId: user.id,
          enabled: formData.uw_wizard_enabled,
        });
      }

      // Log activity if demoting to recruit
      if (switchingToRecruit) {
        await supabase.from("user_activity_log").insert({
          user_id: user.id,
          action: "demoted_to_recruit",
          description: "Demoted from agent to recruit",
          metadata: {
            previous_roles: user.roles,
            new_roles: formData.roles,
            recruiter_id: updates.recruiter_id || null,
            demoted_by: currentUser?.id,
          },
        });
      }

      toast.success("User updated successfully");

      queryClient.invalidateQueries({ queryKey: ["userApproval"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // Invalidate recruits when switching to recruit role or recruiter_id changes
      if (switchingToRecruit || updates.recruiter_id !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["recruits"] });
      }
      // HIGH-3 fix: Invalidate IMO/Agency queries so Sidebar updates for affected user
      if (imoChanged || agencyChanged) {
        queryClient.invalidateQueries({ queryKey: imoKeys.all });
        queryClient.invalidateQueries({ queryKey: agencyKeys.all });
      }
      // Invalidate hierarchy queries so Team page updates when upline changes
      if (uplineChanged) {
        invalidateHierarchyForNode(queryClient, user.id);
        if (updates.upline_id && typeof updates.upline_id === "string") {
          invalidateHierarchyForNode(queryClient, updates.upline_id);
        }
        // Also invalidate client hierarchy queries
        queryClient.invalidateQueries({ queryKey: ["clients", "hierarchy"] });
      }
      // Invalidate client hierarchy when agency changes (affects who can see which clients)
      if (agencyChanged) {
        queryClient.invalidateQueries({ queryKey: ["clients", "hierarchy"] });
      }
      // Close dialogs on success
      setShowOrgChangeConfirm(false);
      onOpenChange(false);
    } catch (error) {
      toast.error("An error occurred while saving");
      console.error("Save error:", error);
      // Keep org confirm dialog open on error so user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);

    try {
      // Step 1: Reassign downlines if needed
      if (downlineCount > 0 && reassignUplineId) {
        const { data, error } = await supabase
          .from("user_profiles")
          .update({ upline_id: reassignUplineId })
          .eq("upline_id", user.id)
          .select();

        if (error) {
          throw new Error(error.message || "Failed to reassign downlines");
        }
        toast.success(`Reassigned ${data?.length || 0} downline(s)`);
      }

      // Step 2: Delete user using mutation hook for proper cache invalidation
      deleteUserMutation.mutate(user.id, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("User permanently deleted");
            // Query invalidation is handled by the mutation hook
            setShowDeleteConfirm(false);
            onOpenChange(false);
            onDeleted?.();
          } else {
            toast.error(result.error || "Failed to delete user");
          }
          setIsDeleting(false);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "An error occurred while deleting",
          );
          console.error("Delete error:", error);
          setIsDeleting(false);
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting",
      );
      console.error("Delete error:", error);
      setIsDeleting(false);
    }
  };

  const handleResendInvite = async () => {
    if (!user) return;
    setIsSendingInvite(true);

    try {
      // First, try to send password reset (works if auth user exists)
      const { data, error: fnError } = await supabase.functions.invoke(
        "send-password-reset",
        {
          body: {
            email: user.email,
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        },
      );

      if (!fnError && data?.success !== false) {
        toast.success(
          `Confirmation email sent to ${user.email} to set password`,
        );
        return;
      }

      // Auth user likely doesn't exist — create one with matching profile ID
      console.log(
        "[handleResendInvite] Password reset failed, creating auth user for:",
        user.email,
      );
      const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim();
      const createResult = await createAuthUserWithProfile({
        email: user.email,
        fullName,
        roles: (user.roles as string[]) || ["recruit"],
        isAdmin: false,
        skipPipeline: true,
        existingProfileId: user.id,
      });

      if (createResult.emailSent) {
        toast.success(`Login instructions sent to ${user.email}`);
      } else if (createResult.message?.includes("already exists")) {
        toast.success("User already has an account.");
      } else {
        toast.success(
          "Account created but email may not have sent. Check edge function logs.",
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to send confirmation email: ${msg}`);
      console.error("Resend confirmation email error:", error);
    } finally {
      setIsSendingInvite(false);
    }
  };

  if (!user) return null;

  // Close main dialog when showing confirmation dialogs to prevent dual overlays
  const dialogOpen = open && !showDeleteConfirm && !showOrgChangeConfirm;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
        <DialogContent
          className="theme-v2 font-display p-0 gap-0 overflow-hidden rounded-v2-lg bg-card text-foreground border border-border shadow-v2-lift w-[calc(100vw-1.5rem)] sm:w-auto max-w-xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col"
          hideCloseButton
        >
          <DialogHeader className="px-5 py-3 border-b border-border bg-card-tinted flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <div className="flex flex-col leading-tight min-w-0 flex-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                  Edit user
                </span>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground text-left flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {user.email}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-[11px] text-muted-foreground text-left mt-1">
              Created{" "}
              {user.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "Unknown"}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            defaultValue="basic"
            className="w-full flex flex-col flex-1 min-h-0"
          >
            <TabsList className="mx-5 mt-3 grid w-[calc(100%-2.5rem)] grid-cols-5 h-7 bg-background border border-border p-0.5 rounded-v2-pill flex-shrink-0">
              <TabsTrigger
                value="basic"
                className="text-[10px] h-6 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-card-dark data-[state=active]:shadow-sm"
              >
                Basic
              </TabsTrigger>
              <TabsTrigger
                value="roles"
                className="text-[10px] h-6 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-card-dark data-[state=active]:shadow-sm"
              >
                Roles
              </TabsTrigger>
              <TabsTrigger
                value="org"
                className="text-[10px] h-6 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-card-dark data-[state=active]:shadow-sm"
              >
                Organization
              </TabsTrigger>
              <TabsTrigger
                value="details"
                className="text-[10px] h-6 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-card-dark data-[state=active]:shadow-sm"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="actions"
                className="text-[10px] h-6 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-card-dark data-[state=active]:shadow-sm"
              >
                Actions
              </TabsTrigger>
            </TabsList>

            <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
              <TabsContent value="basic" className="space-y-3 mt-0">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      First Name
                    </Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      className="h-7 text-[11px] bg-card border-border"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Last Name
                    </Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      className="h-7 text-[11px] bg-card border-border"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                      <Input
                        value={formData.email}
                        disabled
                        className="h-7 text-[11px] pl-7 bg-muted border-border"
                        title="Email cannot be changed"
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Email cannot be changed
                    </p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Phone
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                      <Input
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] pl-7 bg-card border-border"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Upline
                    </Label>
                    <UserSearchCombobox
                      value={formData.upline_id}
                      onChange={(id) =>
                        setFormData((prev) => ({
                          ...prev,
                          upline_id: id,
                        }))
                      }
                      excludeIds={user ? [user.id] : []}
                      approvalStatus="approved"
                      placeholder="Search for upline..."
                      showNoUplineOption={true}
                      noUplineLabel="No upline"
                      className="h-7"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Contract Level
                    </Label>
                    <Select
                      value={formData.contract_level?.toString() || "none"}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          contract_level:
                            value === "none" ? null : parseInt(value),
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-[11px]">
                          Not set
                        </SelectItem>
                        {VALID_CONTRACT_LEVELS.map((level) => (
                          <SelectItem
                            key={level}
                            value={level.toString()}
                            className="text-[11px]"
                          >
                            {level}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="roles" className="space-y-3 mt-0">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Approval Status
                    </Label>
                    <Select
                      value={formData.approval_status}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          approval_status: value as
                            | "pending"
                            | "approved"
                            | "denied",
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved" className="text-[11px]">
                          Approved
                        </SelectItem>
                        <SelectItem value="pending" className="text-[11px]">
                          Pending
                        </SelectItem>
                        <SelectItem value="denied" className="text-[11px]">
                          Denied
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Agent Status
                    </Label>
                    <Select
                      value={formData.agent_status || "none"}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          agent_status:
                            value === "none"
                              ? null
                              : (value as
                                  | "unlicensed"
                                  | "licensed"
                                  | "not_applicable"),
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-[11px]">
                          Not Set
                        </SelectItem>
                        <SelectItem value="licensed" className="text-[11px]">
                          Licensed (Active)
                        </SelectItem>
                        <SelectItem value="unlicensed" className="text-[11px]">
                          Unlicensed (Training)
                        </SelectItem>
                        <SelectItem
                          value="not_applicable"
                          className="text-[11px]"
                        >
                          Not Applicable
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <Label className="text-[10px] text-muted-foreground mb-1.5 block">
                    Roles
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {roles?.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center gap-1.5 p-1.5 bg-background rounded hover:bg-muted dark:hover:bg-muted transition-colors"
                      >
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={formData.roles.includes(
                            role.name as RoleName,
                          )}
                          onCheckedChange={() =>
                            handleRoleToggle(role.name as RoleName)
                          }
                          className="h-3 w-3"
                        />
                        <Label
                          htmlFor={`role-${role.id}`}
                          className="cursor-pointer text-[10px] font-normal text-muted-foreground flex-1"
                          title={role.description ?? undefined}
                        >
                          {role.display_name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5 italic">
                    Note: Agent/Active Agent and Recruit roles are mutually
                    exclusive.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="org" className="space-y-3 mt-0">
                <div className="p-2.5 bg-background rounded-lg border border-border relative">
                  {/* LOW-3 fix: Loading overlay for organization data */}
                  {isOrgDataLoading && (
                    <div className="absolute inset-0 bg-background/80 dark:bg-muted/80 rounded-lg flex items-center justify-center z-10">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[10px]">Loading...</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Organization Assignment
                    </Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">
                    {isSuperAdmin
                      ? "As Super Admin, you can assign this user to any IMO and agency."
                      : isImoAdmin
                        ? "You can assign this user to agencies within your IMO."
                        : "Contact an admin to change organization assignment."}
                  </p>

                  {(isSuperAdmin || isImoAdmin) && (
                    <div className="space-y-2">
                      {/* IMO Selection - Only for super admins */}
                      {isSuperAdmin && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">
                            IMO
                          </Label>
                          <Select
                            value={selectedImoId || "none"}
                            onValueChange={(value) => {
                              const newImoId = value === "none" ? null : value;
                              setSelectedImoId(newImoId);
                              setFormData((prev) => ({
                                ...prev,
                                imo_id: newImoId,
                                agency_id: null, // Reset agency when IMO changes
                              }));
                            }}
                          >
                            <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                              <SelectValue placeholder="Select IMO" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-[11px]">
                                No IMO
                              </SelectItem>
                              {allImos?.map((imo) => (
                                <SelectItem
                                  key={imo.id}
                                  value={imo.id}
                                  className="text-[11px]"
                                >
                                  {imo.name} ({imo.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Agency Selection */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          Agency
                        </Label>
                        <Select
                          value={formData.agency_id || "none"}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              agency_id: value === "none" ? null : value,
                            }))
                          }
                          disabled={isSuperAdmin && !selectedImoId}
                        >
                          <SelectTrigger
                            className={`h-7 text-[11px] border-border ${
                              isSuperAdmin && !selectedImoId
                                ? "bg-muted opacity-60 cursor-not-allowed"
                                : "bg-card"
                            }`}
                          >
                            <SelectValue
                              placeholder={
                                isSuperAdmin && !selectedImoId
                                  ? "Select an IMO first"
                                  : "Select Agency"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-[11px]">
                              No Agency
                            </SelectItem>
                            {agenciesForImo?.map((agency) => (
                              <SelectItem
                                key={agency.id}
                                value={agency.id}
                                className="text-[11px]"
                              >
                                {agency.name} ({agency.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* MEDIUM-2 fix: Helper text explaining why dropdown is disabled */}
                        {isSuperAdmin && !selectedImoId && (
                          <p className="text-[9px] text-warning mt-0.5">
                            Choose an IMO above to see available agencies
                          </p>
                        )}
                      </div>

                      {/* Current assignment info */}
                      <div className="pt-2 mt-2 border-t border-border">
                        <p className="text-[10px] text-muted-foreground">
                          Current Assignment:
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {user?.imo_id
                            ? allImos?.find((i) => i.id === user.imo_id)
                                ?.name || "Unknown IMO"
                            : "No IMO"}{" "}
                          →{" "}
                          {user?.agency_id
                            ? userOriginalAgency?.name || "Loading..."
                            : "No Agency"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-3 mt-0">
                <div>
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <MapPin className="h-2.5 w-2.5" /> Address
                  </Label>
                  <div className="space-y-1.5">
                    <Input
                      value={formData.street_address}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          street_address: e.target.value,
                        }))
                      }
                      className="h-7 text-[11px] bg-card border-border"
                      placeholder="Street address"
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      <Input
                        value={formData.city}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            city: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] bg-card border-border"
                        placeholder="City"
                      />
                      <Input
                        value={formData.state}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            state: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] bg-card border-border"
                        placeholder="State"
                      />
                      <Input
                        value={formData.zip}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            zip: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] bg-card border-border"
                        placeholder="ZIP"
                      />
                    </div>
                    <div>
                      <Label className="text-[9px] text-muted-foreground">
                        Resident State (licensing)
                      </Label>
                      <Input
                        value={formData.resident_state}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            resident_state: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] bg-card border-border"
                        placeholder="Resident state"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <CreditCard className="h-2.5 w-2.5" /> License Information
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <Label className="text-[9px] text-muted-foreground">
                        License #
                      </Label>
                      <Input
                        value={formData.license_number}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            license_number: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] bg-card border-border"
                        placeholder="License number"
                      />
                    </div>
                    <div>
                      <Label className="text-[9px] text-muted-foreground">
                        NPN
                      </Label>
                      <Input
                        value={formData.npn}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            npn: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] bg-card border-border"
                        placeholder="NPN"
                      />
                    </div>
                    <div>
                      <Label className="text-[9px] text-muted-foreground">
                        Expiration
                      </Label>
                      <Input
                        type="date"
                        value={formData.license_expiration}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            license_expiration: e.target.value,
                          }))
                        }
                        className="h-7 text-[11px] bg-card border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Globe className="h-2.5 w-2.5" /> Social & Web
                  </Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    <Input
                      value={formData.instagram_url}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          instagram_url: e.target.value,
                        }))
                      }
                      className="h-7 text-[11px] bg-card border-border"
                      placeholder="Instagram URL"
                    />
                  </div>
                </div>

                {isSuperAdmin && (
                  <>
                    <div className="border-t border-border my-3" />

                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Premium Features
                      </Label>

                      <div className="flex items-center justify-between bg-background rounded p-2 border border-border">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-info" />
                          <div>
                            <div className="text-[11px] font-medium text-foreground">
                              Underwriting Wizard
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Access to UW decision engine and quick quote tools
                            </div>
                          </div>
                        </div>

                        <Checkbox
                          checked={formData.uw_wizard_enabled}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              uw_wizard_enabled: checked === true,
                            }));
                          }}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-3 mt-0">
                <div className="p-2.5 border border-border rounded-lg bg-background">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Send Signup Confirmation
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Email {user.email} to set password
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 border-border"
                      onClick={handleResendInvite}
                      disabled={isSendingInvite}
                    >
                      <Send className="h-2.5 w-2.5 mr-1" />
                      {isSendingInvite ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>

                <div className="p-2.5 bg-muted rounded-lg text-[10px] space-y-0.5">
                  <p>
                    <span className="text-muted-foreground">ID:</span>{" "}
                    <span className="text-muted-foreground font-mono">
                      {user.id}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    <span className="text-muted-foreground">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleString()
                        : "Unknown"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Updated:</span>{" "}
                    <span className="text-muted-foreground">
                      {user.updated_at
                        ? new Date(user.updated_at).toLocaleString()
                        : "Unknown"}
                    </span>
                  </p>
                  {user.onboarding_status && (
                    <p>
                      <span className="text-muted-foreground">Onboarding:</span>{" "}
                      <span className="text-muted-foreground">
                        {user.onboarding_status}
                      </span>
                    </p>
                  )}
                </div>

                <Alert
                  variant="destructive"
                  className="border-destructive/30 dark:border-destructive bg-destructive/10 py-2"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <AlertDescription className="ml-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-destructive">
                          Delete User Permanently
                        </p>
                        <p className="text-[9px] text-destructive dark:text-destructive">
                          Cannot be undone
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-2.5 w-2.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="px-5 py-3 gap-2 border-t border-border bg-card-tinted flex-shrink-0 sm:justify-end">
            <PillButton
              type="button"
              tone="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </PillButton>
            <PillButton
              type="button"
              tone="black"
              size="sm"
              onClick={handleSaveClick}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(isOpen) => {
          setShowDeleteConfirm(isOpen);
        }}
      >
        <AlertDialogContent className="max-w-md bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Permanently Delete User?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                  Delete{" "}
                  <strong className="text-foreground">{user?.email}</strong>?
                </p>

                {checkingDependencies && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking for downlines...
                  </div>
                )}

                {!checkingDependencies && downlineCount > 0 && (
                  <div className="p-2 border border-warning/30 bg-warning/10 rounded">
                    <div className="flex items-start gap-2">
                      <Users className="h-3 w-3 text-warning mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[11px] font-medium text-warning">
                          {downlineCount} downline{downlineCount > 1 ? "s" : ""}{" "}
                          must be reassigned
                        </p>
                        <div className="mt-1.5">
                          <p className="text-[10px] text-warning mb-1">
                            Select new upline:
                          </p>
                          <UserSearchCombobox
                            value={reassignUplineId}
                            onChange={setReassignUplineId}
                            excludeIds={user ? [user.id] : []}
                            approvalStatus="approved"
                            placeholder="Search for new upline..."
                            showNoUplineOption={false}
                            className="h-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[11px] font-medium text-destructive">
                  This will delete all associated data. Cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1.5">
            <AlertDialogCancel
              disabled={isDeleting}
              className="h-7 text-[11px] px-3"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                isDeleting ||
                checkingDependencies ||
                (downlineCount > 0 && !reassignUplineId)
              }
              className="h-7 text-[11px] px-3 bg-destructive hover:bg-destructive text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Deleting...
                </>
              ) : downlineCount > 0 && !reassignUplineId ? (
                "Select upline first"
              ) : (
                "Delete Permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MEDIUM-3: Organization Change Confirmation Dialog */}
      <AlertDialog
        open={showOrgChangeConfirm}
        onOpenChange={setShowOrgChangeConfirm}
      >
        <AlertDialogContent className="max-w-md bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm text-warning">
              <Building2 className="h-4 w-4" />
              Confirm Organization Change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                  You are about to change the organization assignment for{" "}
                  <strong className="text-foreground">
                    {user?.first_name} {user?.last_name || user?.email}
                  </strong>
                </p>

                <div className="p-2 border border-warning/30 bg-warning/10 rounded text-[11px]">
                  <p className="font-medium text-warning mb-1">
                    This may affect:
                  </p>
                  <ul className="list-disc list-inside text-warning space-y-0.5">
                    <li>Hierarchy/upline relationships</li>
                    <li>Access to IMO-specific products & carriers</li>
                    <li>Commission calculations and overrides</li>
                    <li>Visibility in agency reports</li>
                  </ul>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  The user may need to re-establish their upline relationship in
                  the new organization.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-1.5">
            <AlertDialogCancel
              disabled={isSaving}
              className="h-7 text-[11px] px-3"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // Prevent auto-close - let handleSave control dialog state
                handleSave();
              }}
              disabled={isSaving}
              className="h-7 text-[11px] px-3 bg-warning hover:bg-warning text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm Change"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
