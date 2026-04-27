// src/features/recruiting/components/AddRecruitDialog.tsx
// TODO: why is this file over 1000 lines long? This is not how a senior dev would write a simple dialog feaeture component

import React, { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/v2";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateRecruit,
  useCheckEmailExists,
} from "../hooks/useRecruitMutations";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, UserPlus } from "lucide-react";
import { UserSearchCombobox } from "@/components/shared/user-search-combobox";
import type { AgentStatus, LicensingInfo } from "@/types/recruiting.types";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import { US_STATES } from "@/constants/states";
import { usePermissionCheck } from "@/hooks/permissions";
import { buildRecruitCreateAssignmentFields } from "../utils/recruit-create-assignment";

// Helper function to auto-prepend https:// to URLs
// TODO: helper function should also not be in this file.
const normalizeUrl = (url: string): string => {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

// Helper to extract error message from Zod error
// TODO: another helper function...why is it in here?
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
const getErrorMessage = (errors: any[]): string => {
  if (!errors || errors.length === 0) return "";
  return errors
    .map((err) => (typeof err === "string" ? err : err?.message || String(err)))
    .join(", ");
};

// Validation schema
const createRecruitSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  date_of_birth: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true; // Optional
      const date = new Date(val);
      const age = Math.floor(
        (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      );
      return age >= 18;
    }, "Must be at least 18 years old"),

  // Address
  street_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),

  // Professional
  is_licensed_agent: z.boolean().default(false),
  skip_pipeline: z.boolean().default(false),
  resident_state: z.string().optional(),
  license_number: z.string().optional(),
  npn: z.string().optional(),
  license_expiration: z.string().optional(),
  years_licensed: z.number().optional(),

  // Social Media
  instagramusername: z.string().optional(),
  instagram_url: z.string().optional(),
  facebook_handle: z.string().optional(),
  personal_website: z.string().optional(),

  // Assignment
  upline_id: z.string().optional(),

  // Admin assignment
  is_admin: z.boolean().default(false),

  // Referral
  referral_source: z.string().optional(),
});

interface AddRecruitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (recruitId: string) => void;
}

export function AddRecruitDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddRecruitDialogProps) {
  const { user } = useAuth();
  const { canAny, isAdmin } = usePermissionCheck();
  const createRecruitMutation = useCreateRecruit();
  const checkEmailMutation = useCheckEmailExists();
  const [activeTab, setActiveTab] = useState("basic");
  const canManageUsers =
    isAdmin() || canAny(["nav.user_management", "users.manage"]);

  const form = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      street_address: "",
      city: "",
      state: "",
      zip: "",
      is_licensed_agent: false,
      skip_pipeline: false,
      resident_state: "",
      license_number: "",
      npn: "",
      license_expiration: "",
      years_licensed: 0,
      instagramusername: "",
      instagram_url: "",
      facebook_handle: "",
      personal_website: "",
      upline_id: "",
      is_admin: false,
      referral_source: "",
    },
    onSubmit: async ({ value }) => {
      if (!user?.id) return;

      // Check for duplicate email
      const emailCheck = await checkEmailMutation.mutateAsync(value.email);
      if (emailCheck.exists) {
        alert(`A user with email ${value.email} already exists.`);
        return;
      }

      // Normalize URL fields (auto-prepend https://)
      const _normalizedWebsite = value.personal_website
        ? normalizeUrl(value.personal_website)
        : undefined;

      // Determine agent status based on checkboxes
      let agent_status: AgentStatus = "unlicensed";
      const isAdminRecruit = canManageUsers && value.is_admin;
      const skipPipeline =
        canManageUsers && (value.skip_pipeline || isAdminRecruit);

      if (skipPipeline || isAdminRecruit) {
        agent_status = "not_applicable";
      } else if (value.is_licensed_agent) {
        agent_status = "licensed";
      }

      // Build licensing info if licensed
      const licensing_info: LicensingInfo | undefined = value.is_licensed_agent
        ? {
            licenseNumber: value.license_number || undefined,
            npn: value.npn || undefined,
            licenseExpirationDate: value.license_expiration || undefined,
            licenseState: value.resident_state || undefined,
            yearsLicensed: value.years_licensed || undefined,
          }
        : undefined;

      const assignmentFields = buildRecruitCreateAssignmentFields({
        canManageUsers,
        currentUserId: user.id,
        selectedUplineId: value.upline_id,
        imoId: user.imo_id ?? undefined,
        agencyId: user.agency_id ?? undefined,
      });

      const recruit = await createRecruitMutation.mutateAsync({
        first_name: value.first_name,
        last_name: value.last_name,
        email: value.email,
        phone: value.phone || undefined,
        date_of_birth: value.date_of_birth || undefined,
        street_address: value.street_address || undefined,
        city: value.city || undefined,
        state: value.state || undefined,
        resident_state: value.resident_state || value.state || undefined,
        zip: value.zip || undefined,
        agent_status,
        licensing_info,
        skip_pipeline: skipPipeline,
        is_admin: isAdminRecruit,
        ...assignmentFields,
        referral_source: value.referral_source || undefined,
      });

      if (recruit) {
        // Always close dialog and reset form on successful recruit creation
        onOpenChange(false);
        form.reset();
        setActiveTab("basic");
        onSuccess?.(recruit.id);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="theme-v2 font-display p-0 gap-0 overflow-hidden rounded-v2-lg bg-v2-card text-v2-ink border border-v2-ring shadow-v2-lift w-[calc(100vw-1.5rem)] sm:w-auto max-w-2xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col"
        hideCloseButton
      >
        <DialogHeader className="px-5 py-3 border-b border-v2-ring bg-v2-card-tinted flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-v2-accent" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
                New recruit
              </span>
              <DialogTitle className="text-base font-semibold tracking-tight text-v2-ink text-left flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                Add new recruit
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-[11px] text-v2-ink-muted text-left mt-1">
            Enter recruit details to begin onboarding. Only basic info required
            initially.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-5 h-7">
                <TabsTrigger value="basic" className="text-[10px] px-1">
                  Basic
                </TabsTrigger>
                <TabsTrigger value="address" className="text-[10px] px-1">
                  Address
                </TabsTrigger>
                <TabsTrigger value="professional" className="text-[10px] px-1">
                  Professional
                </TabsTrigger>
                <TabsTrigger value="assignment" className="text-[10px] px-1">
                  Assignment
                </TabsTrigger>
                <TabsTrigger value="social" className="text-[10px] px-1">
                  Social/Referral
                </TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-2 py-2">
                <div className="grid grid-cols-2 gap-2">
                  <form.Field
                    name="first_name"
                    validators={{
                      onChange: createRecruitSchema.shape.first_name,
                    }}
                  >
                    {(field) => (
                      <div className="grid gap-1">
                        <Label
                          htmlFor="first_name"
                          className="text-[11px] font-semibold"
                        >
                          First Name *
                        </Label>
                        <Input
                          id="first_name"
                          className="h-7 text-[11px]"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          autoFocus
                          required
                        />
                        {field.state.meta.errors &&
                          field.state.meta.errors.length > 0 && (
                            <p className="text-[10px] text-destructive">
                              {getErrorMessage(field.state.meta.errors)}
                            </p>
                          )}
                      </div>
                    )}
                  </form.Field>

                  <form.Field
                    name="last_name"
                    validators={{
                      onChange: createRecruitSchema.shape.last_name,
                    }}
                  >
                    {(field) => (
                      <div className="grid gap-1">
                        <Label
                          htmlFor="last_name"
                          className="text-[11px] font-semibold"
                        >
                          Last Name *
                        </Label>
                        <Input
                          id="last_name"
                          className="h-7 text-[11px]"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          required
                        />
                        {field.state.meta.errors &&
                          field.state.meta.errors.length > 0 && (
                            <p className="text-[10px] text-destructive">
                              {getErrorMessage(field.state.meta.errors)}
                            </p>
                          )}
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <form.Field
                    name="email"
                    validators={{
                      onChange: createRecruitSchema.shape.email,
                    }}
                  >
                    {(field) => (
                      <div className="grid gap-1">
                        <Label
                          htmlFor="email"
                          className="text-[11px] font-semibold"
                        >
                          Email *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          className="h-7 text-[11px]"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          required
                        />
                        {field.state.meta.errors &&
                          field.state.meta.errors.length > 0 && (
                            <p className="text-[10px] text-destructive">
                              {getErrorMessage(field.state.meta.errors)}
                            </p>
                          )}
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="phone">
                    {(field) => (
                      <div className="grid gap-1">
                        <Label htmlFor="phone" className="text-[11px]">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          className="h-7 text-[11px]"
                          placeholder="(555) 555-5555"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>
                </div>

                <form.Field
                  name="date_of_birth"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return undefined; // Optional field
                      const date = new Date(value);
                      const age = Math.floor(
                        (Date.now() - date.getTime()) /
                          (365.25 * 24 * 60 * 60 * 1000),
                      );
                      return age < 18
                        ? "Must be at least 18 years old"
                        : undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="grid gap-1">
                      <Label htmlFor="date_of_birth" className="text-[11px]">
                        Date of Birth
                      </Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        className="h-7 text-[11px]"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      {field.state.meta.errors &&
                        field.state.meta.errors.length > 0 && (
                          <p className="text-[10px] text-destructive">
                            {getErrorMessage(field.state.meta.errors)}
                          </p>
                        )}
                    </div>
                  )}
                </form.Field>
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-2 py-2">
                <form.Field name="street_address">
                  {(field) => (
                    <div className="grid gap-1">
                      <Label htmlFor="street_address" className="text-[11px]">
                        Street Address
                      </Label>
                      <Input
                        id="street_address"
                        className="h-7 text-[11px]"
                        placeholder="123 Main St"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </form.Field>

                <div className="grid grid-cols-3 gap-2">
                  <form.Field name="city">
                    {(field) => (
                      <div className="grid gap-1">
                        <Label htmlFor="city" className="text-[11px]">
                          City
                        </Label>
                        <Input
                          id="city"
                          className="h-7 text-[11px]"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="state">
                    {(field) => (
                      <div className="grid gap-1">
                        <Label htmlFor="state" className="text-[11px]">
                          State
                        </Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(value) => field.handleChange(value)}
                        >
                          <SelectTrigger id="state" className="h-7 text-[11px]">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state.value} value={state.value}>
                                {state.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="zip">
                    {(field) => (
                      <div className="grid gap-1">
                        <Label htmlFor="zip" className="text-[11px]">
                          ZIP Code
                        </Label>
                        <Input
                          id="zip"
                          className="h-7 text-[11px]"
                          placeholder="12345"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>
                </div>
              </TabsContent>

              {/* Professional Tab */}
              <TabsContent value="professional" className="space-y-2 py-2">
                {/* Licensing status checkboxes */}
                <div className="space-y-2">
                  <form.Field name="is_licensed_agent">
                    {(field) => (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_licensed_agent"
                          checked={field.state.value}
                          onCheckedChange={(checked) => {
                            field.handleChange(checked === true);
                            // If admin/skip is checked, uncheck it
                            if (checked && form.state.values.skip_pipeline) {
                              form.setFieldValue("skip_pipeline", false);
                            }
                          }}
                        />
                        <Label
                          htmlFor="is_licensed_agent"
                          className="text-[11px] cursor-pointer"
                        >
                          This person is already a licensed insurance agent
                        </Label>
                      </div>
                    )}
                  </form.Field>

                  {canManageUsers && (
                    <>
                      <form.Field name="skip_pipeline">
                        {(field) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="skip_pipeline"
                              checked={field.state.value}
                              onCheckedChange={(checked) => {
                                field.handleChange(checked === true);
                                // If licensed is checked, uncheck it
                                if (
                                  checked &&
                                  form.state.values.is_licensed_agent
                                ) {
                                  form.setFieldValue(
                                    "is_licensed_agent",
                                    false,
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor="skip_pipeline"
                              className="text-[11px] cursor-pointer"
                            >
                              Skip onboarding pipeline (admin/office staff)
                            </Label>
                          </div>
                        )}
                      </form.Field>

                      {/* Info alert about pipeline assignment */}
                      {form.state.values.skip_pipeline && (
                        <Alert className="py-2">
                          <InfoIcon className="h-3 w-3" />
                          <AlertDescription className="text-[10px]">
                            This user will not be added to any onboarding
                            pipeline and won't appear in recruiting dashboards.
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </div>

                <form.Field name="resident_state">
                  {(field) => (
                    <div className="grid gap-1">
                      <Label htmlFor="resident_state" className="text-[11px]">
                        Resident State (Primary Licensed State)
                      </Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value)}
                      >
                        <SelectTrigger id="resident_state">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                {/* Show licensing fields if marked as licensed */}
                {form.state.values.is_licensed_agent && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <form.Field name="license_number">
                        {(field) => (
                          <div className="grid gap-1">
                            <Label
                              htmlFor="license_number"
                              className="text-[11px]"
                            >
                              License Number
                            </Label>
                            <Input
                              className="h-7 text-[11px]"
                              id="license_number"
                              placeholder="Insurance license number"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              onBlur={field.handleBlur}
                            />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="npn">
                        {(field) => (
                          <div className="grid gap-1">
                            <Label htmlFor="npn" className="text-[11px]">
                              NPN (National Producer Number)
                            </Label>
                            <Input
                              className="h-7 text-[11px]"
                              id="npn"
                              placeholder="NPN number"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              onBlur={field.handleBlur}
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <form.Field name="license_expiration">
                        {(field) => (
                          <div className="grid gap-1">
                            <Label
                              htmlFor="license_expiration"
                              className="text-[11px]"
                            >
                              License Expiration Date
                            </Label>
                            <Input
                              className="h-7 text-[11px]"
                              id="license_expiration"
                              type="date"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              onBlur={field.handleBlur}
                            />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="years_licensed">
                        {(field) => (
                          <div className="grid gap-1">
                            <Label
                              htmlFor="years_licensed"
                              className="text-[11px]"
                            >
                              Years Licensed
                            </Label>
                            <Input
                              className="h-7 text-[11px]"
                              id="years_licensed"
                              type="number"
                              min="0"
                              placeholder="Years of experience"
                              value={field.state.value || ""}
                              onChange={(e) =>
                                field.handleChange(
                                  e.target.value ? parseInt(e.target.value) : 0,
                                )
                              }
                              onBlur={field.handleBlur}
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Assignment Tab */}
              <TabsContent value="assignment" className="space-y-2 py-2">
                <form.Field name="upline_id">
                  {(field) => (
                    <div className="grid gap-1">
                      <Label htmlFor="upline_id" className="text-[11px]">
                        Assign Upline/Trainer
                      </Label>
                      <UserSearchCombobox
                        value={field.state.value || null}
                        onChange={(id) => field.handleChange(id || "")}
                        roles={["agent", "admin", "trainer", "upline_manager"]}
                        approvalStatus="approved"
                        placeholder="Search for upline..."
                        showNoUplineOption={true}
                        noUplineLabel="Assign later"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Upline/trainer who will manage this recruit's
                        onboarding. Leave blank to assign later.
                      </p>
                    </div>
                  )}
                </form.Field>

                {canManageUsers && (
                  <form.Field name="is_admin">
                    {(field) => (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="is_admin"
                            checked={field.state.value}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked === true)
                            }
                          />
                          <Label
                            htmlFor="is_admin"
                            className="text-[11px] cursor-pointer"
                          >
                            Grant admin privileges
                          </Label>
                        </div>
                        {field.state.value && (
                          <Alert className="py-2">
                            <InfoIcon className="h-3 w-3" />
                            <AlertDescription className="text-[10px]">
                              Admin users have full system access and will not
                              be added to any onboarding pipeline.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </form.Field>
                )}
              </TabsContent>

              {/* Social/Referral Tab */}
              <TabsContent value="social" className="space-y-2 py-2">
                <div className="grid grid-cols-1 gap-2">
                  <form.Field name="instagramusername">
                    {(field) => (
                      <div className="grid gap-1">
                        <Label
                          htmlFor="instagramusername"
                          className="text-[11px]"
                        >
                          Instagram Username
                        </Label>
                        <Input
                          className="h-7 text-[11px]"
                          id="instagramusername"
                          placeholder="@username"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <form.Field name="facebook_handle">
                    {(field) => (
                      <div className="grid gap-1">
                        <Label
                          htmlFor="facebook_handle"
                          className="text-[11px]"
                        >
                          Facebook Handle
                        </Label>
                        <Input
                          className="h-7 text-[11px]"
                          id="facebook_handle"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="personal_website">
                    {(field) => (
                      <div className="grid gap-1">
                        <Label
                          htmlFor="personal_website"
                          className="text-[11px]"
                        >
                          Personal Website
                        </Label>
                        <Input
                          className="h-7 text-[11px]"
                          id="personal_website"
                          type="text"
                          placeholder="example.com (https:// added automatically)"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </div>
                    )}
                  </form.Field>
                </div>

                <form.Field name="referral_source">
                  {(field) => (
                    <div className="grid gap-1">
                      <Label htmlFor="referral_source" className="text-[11px]">
                        Referral Source
                      </Label>
                      <Textarea
                        id="referral_source"
                        placeholder="How did they find us?"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        rows={3}
                      />
                    </div>
                  )}
                </form.Field>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-v2-ring bg-v2-card-tinted flex-shrink-0 gap-2 sm:justify-end">
            <PillButton
              type="button"
              tone="ghost"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                setActiveTab("basic");
              }}
              disabled={createRecruitMutation.isPending}
            >
              Cancel
            </PillButton>
            <PillButton
              type="submit"
              tone="black"
              size="sm"
              disabled={createRecruitMutation.isPending}
            >
              {createRecruitMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Add recruit
            </PillButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
