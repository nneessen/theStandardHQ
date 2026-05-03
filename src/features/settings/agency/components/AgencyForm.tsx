// src/features/settings/agency/components/AgencyForm.tsx
// Form component for creating and editing Agencies

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { usePreviewCascadeAssignment } from "@/hooks/imo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Crown, AlertTriangle, Users } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import type {
  Agency,
  CreateAgencyData,
  UpdateAgencyData,
} from "@/types/imo.types";

interface AgencyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agency: Agency | null;
  imoId: string;
  onSubmit: (
    data: CreateAgencyData | UpdateAgencyData,
    options?: { cascadeDownlines?: boolean },
  ) => Promise<void>;
  isSubmitting: boolean;
}

interface FormData {
  name: string;
  code: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  owner_id: string;
  is_active: boolean;
}

interface PotentialOwner {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export function AgencyForm({
  open,
  onOpenChange,
  agency,
  imoId,
  onSubmit,
  isSubmitting,
}: AgencyFormProps) {
  const isEditing = !!agency;

  // State for cascade option (only for new agencies)
  const [cascadeDownlines, setCascadeDownlines] = useState(false);

  // Fetch potential owners (agents in the same IMO)
  const { data: potentialOwners = [] } = useQuery({
    queryKey: ["potential-agency-owners", imoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, first_name, last_name")
        .eq("imo_id", imoId)
        .eq("approval_status", "approved")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as PotentialOwner[];
    },
    enabled: !!imoId && open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      code: "",
      description: "",
      contact_email: "",
      contact_phone: "",
      website: "",
      street_address: "",
      city: "",
      state: "",
      zip: "",
      owner_id: "",
      is_active: true,
    },
  });

  // Watch owner_id for cascade preview
  const watchedOwnerId = watch("owner_id");

  // Fetch preview of cascade assignment when owner is selected (new agencies only)
  const { data: cascadePreview, isLoading: isLoadingPreview } =
    usePreviewCascadeAssignment(
      !isEditing && watchedOwnerId && watchedOwnerId !== "none"
        ? watchedOwnerId
        : undefined,
    );

  // Reset form when agency changes
  useEffect(() => {
    if (agency) {
      reset({
        name: agency.name,
        code: agency.code,
        description: agency.description ?? "",
        contact_email: agency.contact_email ?? "",
        contact_phone: agency.contact_phone ?? "",
        website: agency.website ?? "",
        street_address: agency.street_address ?? "",
        city: agency.city ?? "",
        state: agency.state ?? "",
        zip: agency.zip ?? "",
        owner_id: agency.owner_id ?? "",
        is_active: agency.is_active,
      });
      setCascadeDownlines(false);
    } else {
      reset({
        name: "",
        code: "",
        description: "",
        contact_email: "",
        contact_phone: "",
        website: "",
        street_address: "",
        city: "",
        state: "",
        zip: "",
        owner_id: "",
        is_active: true,
      });
      setCascadeDownlines(false);
    }
  }, [agency, reset]);

  // Reset cascade toggle when owner changes
  useEffect(() => {
    setCascadeDownlines(false);
  }, [watchedOwnerId]);

  const onFormSubmit = async (data: FormData) => {
    const submitData: CreateAgencyData | UpdateAgencyData = {
      name: data.name,
      code: data.code,
      description: data.description || undefined,
      contact_email: data.contact_email || undefined,
      contact_phone: data.contact_phone || undefined,
      website: data.website || undefined,
      street_address: data.street_address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      zip: data.zip || undefined,
      owner_id: data.owner_id || null,
    };

    if (!isEditing) {
      (submitData as CreateAgencyData).imo_id = imoId;
    }

    if (isEditing) {
      (submitData as UpdateAgencyData).is_active = data.is_active;
    }

    // Pass cascade option for new agencies
    await onSubmit(submitData, {
      cascadeDownlines: !isEditing && cascadeDownlines,
    });
  };

  const isActive = watch("is_active");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold">
            {isEditing ? "Edit Agency" : "New Agency"}
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEditing
              ? "Update the agency information below."
              : "Fill in the details for the new agency."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 mt-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Basic Information
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-[11px]">
                  Agency Name *
                </Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                  className="h-7 text-[11px]"
                  placeholder="e.g., Dallas Regional Agency"
                />
                {errors.name && (
                  <p className="text-[10px] text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="code" className="text-[11px]">
                  Code *
                </Label>
                <Input
                  id="code"
                  {...register("code", {
                    required: "Code is required",
                    pattern: {
                      value: /^[A-Za-z0-9-]+$/,
                      message: "Code must be letters, numbers, or dashes",
                    },
                    setValueAs: (v: string) => v?.toUpperCase(),
                  })}
                  className="h-7 text-[11px] font-mono uppercase"
                  placeholder="e.g., DFW-001"
                />
                {errors.code && (
                  <p className="text-[10px] text-destructive">
                    {errors.code.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description" className="text-[11px]">
                Description
              </Label>
              <Textarea
                id="description"
                {...register("description")}
                className="h-16 text-[11px] resize-none"
                placeholder="Brief description of the agency..."
              />
            </div>

            {/* Owner Selection */}
            <div className="space-y-1">
              <Label className="text-[11px] flex items-center gap-1">
                <Crown className="h-3 w-3 text-warning" />
                Agency Owner
              </Label>
              <Select
                value={watch("owner_id") || "none"}
                onValueChange={(value) =>
                  setValue("owner_id", value === "none" ? "" : value)
                }
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Select an owner (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-[11px]">
                    No owner assigned
                  </SelectItem>
                  {potentialOwners.map((user) => (
                    <SelectItem
                      key={user.id}
                      value={user.id}
                      className="text-[11px]"
                    >
                      {user.first_name && user.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                The owner has full control over this agency
              </p>
            </div>

            {/* Cascade Downlines Toggle - Only for new agencies with owner that has downlines */}
            {!isEditing &&
              cascadePreview &&
              cascadePreview.downlineCount > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-background">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground">
                        Assign owner's team to this agency
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isLoadingPreview ? (
                          "Checking team size..."
                        ) : (
                          <>
                            <Users className="inline h-3 w-3 mr-1" />
                            {cascadePreview.ownerName} has{" "}
                            <span className="font-medium">
                              {cascadePreview.downlineCount}
                            </span>{" "}
                            downline
                            {cascadePreview.downlineCount === 1 ? "" : "s"}
                          </>
                        )}
                      </p>
                    </div>
                    <Switch
                      checked={cascadeDownlines}
                      onCheckedChange={setCascadeDownlines}
                      disabled={isLoadingPreview}
                    />
                  </div>
                  {cascadeDownlines && (
                    <p className="text-[10px] text-warning flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>
                        {cascadePreview.totalCount} user
                        {cascadePreview.totalCount === 1 ? "" : "s"} will be
                        moved to this agency
                      </span>
                    </p>
                  )}
                </div>
              )}
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Contact Information
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="contact_email" className="text-[11px]">
                  Email
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  {...register("contact_email")}
                  className="h-7 text-[11px]"
                  placeholder="contact@agency.com"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="contact_phone" className="text-[11px]">
                  Phone
                </Label>
                <Input
                  id="contact_phone"
                  {...register("contact_phone")}
                  className="h-7 text-[11px]"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="website" className="text-[11px]">
                Website
              </Label>
              <Input
                id="website"
                {...register("website")}
                className="h-7 text-[11px]"
                placeholder="https://www.agency.com"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Address
            </h4>

            <div className="space-y-1">
              <Label htmlFor="street_address" className="text-[11px]">
                Street Address
              </Label>
              <Input
                id="street_address"
                {...register("street_address")}
                className="h-7 text-[11px]"
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="city" className="text-[11px]">
                  City
                </Label>
                <Input
                  id="city"
                  {...register("city")}
                  className="h-7 text-[11px]"
                  placeholder="City"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="state" className="text-[11px]">
                  State
                </Label>
                <Input
                  id="state"
                  {...register("state")}
                  className="h-7 text-[11px]"
                  placeholder="TX"
                  maxLength={2}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="zip" className="text-[11px]">
                  ZIP
                </Label>
                <Input
                  id="zip"
                  {...register("zip")}
                  className="h-7 text-[11px]"
                  placeholder="12345"
                />
              </div>
            </div>
          </div>

          {/* Status (edit only) */}
          {isEditing && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Status
              </h4>

              <div className="flex items-center justify-between p-2 rounded-lg border border-border">
                <div>
                  <p className="text-[11px] font-medium text-foreground">
                    Active
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Deactivating will hide this agency from users
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-[11px]"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {isEditing ? "Save Changes" : "Create Agency"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
