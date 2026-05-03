// src/features/admin/components/AddUserDialog.tsx
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/v2";
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
import { useAllRolesWithPermissions } from "@/hooks/permissions";
import { useAllActiveImos, useAgenciesByImo } from "@/hooks/imo";
import { useImo } from "@/contexts/ImoContext";
import { Mail, User, Phone, Building2 } from "lucide-react";
import type { RoleName } from "@/types/permissions.types";
import type { ApprovalStatus } from "@/types/user.types";
import { STAFF_ONLY_ROLES } from "@/constants/roles";
import { UserSearchCombobox } from "@/components/shared/user-search-combobox";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userData: NewUserData) => void;
}

export interface NewUserData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  upline_id?: string | null;
  roles: RoleName[];
  approval_status: ApprovalStatus;
  onboarding_status?: "lead" | "active" | null;
  imo_id?: string | null;
  agency_id?: string | null;
}

const INITIAL_FORM_DATA: NewUserData = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  upline_id: null,
  roles: ["recruit"], // Default to recruit since approval_status defaults to "pending"
  approval_status: "pending",
  onboarding_status: null,
  imo_id: null,
  agency_id: null,
};

export default function AddUserDialog({
  open,
  onOpenChange,
  onSave,
}: AddUserDialogProps) {
  const { data: roles } = useAllRolesWithPermissions();

  // IMO/Agency hooks
  const { isSuperAdmin, isImoAdmin, imo: currentImo } = useImo();
  const { data: allImos, isLoading: isLoadingImos } = useAllActiveImos();
  const [selectedImoId, setSelectedImoId] = useState<string | null>(null);
  const { data: agenciesForImo, isLoading: isLoadingAgencies } =
    useAgenciesByImo(selectedImoId ?? "");

  const [formData, setFormData] = useState<NewUserData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize selected IMO from context for IMO admins
  useMemo(() => {
    if (isImoAdmin && currentImo?.id && !selectedImoId) {
      setSelectedImoId(currentImo.id);
      setFormData((prev) => ({ ...prev, imo_id: currentImo.id }));
    }
  }, [isImoAdmin, currentImo?.id, selectedImoId]);

  // Detect if user is being created as a staff role (trainer, contracting_manager)
  // Staff roles don't go through the approval pipeline
  const isStaffRoleSelected = useMemo(
    () =>
      formData.roles.some((r) =>
        STAFF_ONLY_ROLES.includes(r as (typeof STAFF_ONLY_ROLES)[number]),
      ),
    [formData.roles],
  );

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) newErrors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email";
    }
    if (!formData.first_name) newErrors.first_name = "Required";
    if (!formData.last_name) newErrors.last_name = "Required";
    // Roles are auto-set by status toggle (agent/recruit), no need to validate

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    onSave(formData);
    handleReset();
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    // Reset IMO selection (unless user is IMO admin, keep their IMO)
    if (!isImoAdmin) {
      setSelectedImoId(null);
    }
  };

  const handleRoleToggle = (roleName: RoleName) => {
    setFormData((prev) => {
      const isAdding = !prev.roles.includes(roleName);
      let newRoles: RoleName[];

      // Helper to check if a role is a staff-only role
      const isStaffOnlyRole = (r: RoleName) =>
        STAFF_ONLY_ROLES.includes(r as (typeof STAFF_ONLY_ROLES)[number]);

      if (isAdding) {
        // Adding a role
        if (isStaffOnlyRole(roleName)) {
          // Staff role selected: remove agent/recruit (they conflict)
          newRoles = [
            ...prev.roles.filter((r) => r !== "agent" && r !== "recruit"),
            roleName,
          ];
        } else {
          newRoles = [...prev.roles, roleName];
        }
      } else {
        // Removing a role
        newRoles = prev.roles.filter((r) => r !== roleName);
      }

      // Check if any staff role remains
      const hasStaffRole = newRoles.some((r) => isStaffOnlyRole(r));

      return {
        ...prev,
        roles: newRoles,
        // Staff roles are always approved and don't have onboarding
        approval_status: hasStaffRole ? "approved" : prev.approval_status,
        onboarding_status: hasStaffRole ? null : prev.onboarding_status,
      };
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleReset();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent
        className="theme-v2 font-display p-0 gap-0 overflow-hidden rounded-v2-lg bg-card text-foreground border border-border shadow-v2-lift w-[calc(100vw-1.5rem)] sm:w-auto max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col"
        hideCloseButton
      >
        <DialogHeader className="px-5 py-3 border-b border-border bg-card-tinted flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                New user
              </span>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground text-left">
                Add new user
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-[11px] text-muted-foreground text-left mt-1">
            A login link will be emailed to the user automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Email */}
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Email <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className={`h-7 text-[11px] pl-7 bg-card border-border ${errors.email ? "border-destructive" : ""}`}
                placeholder="user@email.com"
              />
            </div>
            {errors.email && (
              <p className="text-[10px] text-destructive mt-0.5">
                {errors.email}
              </p>
            )}
          </div>

          {/* First Name & Last Name */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                First Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                <Input
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      first_name: e.target.value,
                    }))
                  }
                  className={`h-7 text-[11px] pl-7 bg-card border-border ${errors.first_name ? "border-destructive" : ""}`}
                  placeholder="First"
                />
              </div>
              {errors.first_name && (
                <p className="text-[10px] text-destructive mt-0.5">
                  {errors.first_name}
                </p>
              )}
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.last_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    last_name: e.target.value,
                  }))
                }
                className={`h-7 text-[11px] bg-card border-border ${errors.last_name ? "border-destructive" : ""}`}
                placeholder="Last"
              />
              {errors.last_name && (
                <p className="text-[10px] text-destructive mt-0.5">
                  {errors.last_name}
                </p>
              )}
            </div>
          </div>

          {/* Phone & Upline */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="h-7 text-[11px] pl-7 bg-card border-border"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground">
                Upline
              </Label>
              <UserSearchCombobox
                value={formData.upline_id ?? null}
                onChange={(id) =>
                  setFormData((prev) => ({
                    ...prev,
                    upline_id: id,
                  }))
                }
                approvalStatus="approved"
                placeholder="Search for upline..."
                showNoUplineOption={true}
                noUplineLabel="No upline"
                className="h-7"
              />
            </div>
          </div>

          {/* IMO & Agency Selection */}
          {(isSuperAdmin || isImoAdmin) && (
            <div className="grid grid-cols-2 gap-2">
              {/* IMO Selection - Only for super admins */}
              {isSuperAdmin && (
                <div>
                  <Label className="text-[11px] text-muted-foreground">
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
                    disabled={isLoadingImos}
                  >
                    <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                      <Building2 className="h-3 w-3 text-muted-foreground mr-1.5" />
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
                          {imo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Agency Selection */}
              <div className={isSuperAdmin ? "" : "col-span-2"}>
                <Label className="text-[11px] text-muted-foreground">
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
                  disabled={
                    (isSuperAdmin && !selectedImoId) || isLoadingAgencies
                  }
                >
                  <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                    <Building2 className="h-3 w-3 text-muted-foreground mr-1.5" />
                    <SelectValue
                      placeholder={
                        isSuperAdmin && !selectedImoId
                          ? "Select IMO first"
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
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSuperAdmin && !selectedImoId && (
                  <p className="text-[9px] text-warning mt-0.5">
                    Choose an IMO above to see agencies
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Roles - Compact Inline Checkboxes */}
          {/* Filter out 'recruit' - this is managed by the status toggle */}
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Additional Roles
              {errors.roles && (
                <span className="text-destructive ml-1">({errors.roles})</span>
              )}
            </Label>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1.5 bg-background p-2 rounded border border-border/50">
              {roles
                ?.filter((role) => !["recruit"].includes(role.name))
                .map((role) => (
                  <div key={role.id} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={formData.roles.includes(role.name as RoleName)}
                      onCheckedChange={() =>
                        handleRoleToggle(role.name as RoleName)
                      }
                      className="h-3 w-3"
                    />
                    <Label
                      htmlFor={`role-${role.id}`}
                      className="cursor-pointer text-[11px] font-normal text-muted-foreground"
                      title={role.description ?? undefined}
                    >
                      {role.display_name}
                    </Label>
                  </div>
                ))}
            </div>
            {!isStaffRoleSelected && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Base role (agent/recruit) is set by status below
              </p>
            )}
          </div>

          {/* Status Toggle Buttons - Hidden for staff roles */}
          {isStaffRoleSelected ? (
            <div className="bg-info/10 p-2 rounded border border-info/30/50">
              <p className="text-[10px] text-info">
                Staff roles (Trainer, Contracting Manager) are automatically
                approved and don't require onboarding.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Status
                </Label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <Button
                    type="button"
                    variant={
                      formData.approval_status === "approved"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() =>
                      setFormData((prev) => {
                        // Remove recruit role, add agent role
                        const filteredRoles: RoleName[] = prev.roles.filter(
                          (r) => r !== "recruit",
                        );
                        const hasAgent = filteredRoles.some(
                          (r) => r === "agent",
                        );
                        return {
                          ...prev,
                          approval_status: "approved",
                          onboarding_status: null,
                          roles: hasAgent
                            ? filteredRoles
                            : [...filteredRoles, "agent" as RoleName],
                        };
                      })
                    }
                  >
                    Approved (Agent)
                  </Button>
                  <Button
                    type="button"
                    variant={
                      formData.approval_status === "pending"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() =>
                      setFormData((prev) => {
                        // Remove agent role, add recruit role
                        const filteredRoles: RoleName[] = prev.roles.filter(
                          (r) => r !== "agent",
                        );
                        const hasRecruit = filteredRoles.some(
                          (r) => r === "recruit",
                        );
                        return {
                          ...prev,
                          approval_status: "pending",
                          roles: hasRecruit
                            ? filteredRoles
                            : [...filteredRoles, "recruit" as RoleName],
                        };
                      })
                    }
                  >
                    Pending (Recruit)
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formData.approval_status === "approved"
                    ? "User appears in Users & Access"
                    : "User appears in Recruiting Pipeline"}
                </p>
              </div>

              {/* Onboarding Status - Only when Pending */}
              {formData.approval_status === "pending" && (
                <div className="bg-background p-2 rounded border border-border/50">
                  <Label className="text-[10px] text-muted-foreground">
                    Onboarding Status
                  </Label>
                  <div className="grid grid-cols-3 gap-1 mt-1">
                    <Button
                      type="button"
                      variant={
                        formData.onboarding_status === null
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          onboarding_status: null,
                        }))
                      }
                    >
                      Not set
                    </Button>
                    <Button
                      type="button"
                      variant={
                        formData.onboarding_status === "lead"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          onboarding_status: "lead",
                        }))
                      }
                    >
                      Lead
                    </Button>
                    <Button
                      type="button"
                      variant={
                        formData.onboarding_status === "active"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          onboarding_status: "active",
                        }))
                      }
                    >
                      Active
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border bg-card-tinted flex-shrink-0 gap-2 sm:justify-end">
          <PillButton
            type="button"
            tone="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </PillButton>
          <PillButton type="button" tone="black" size="sm" onClick={handleSave}>
            Create user
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
