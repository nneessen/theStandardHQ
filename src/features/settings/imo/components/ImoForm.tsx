// src/features/settings/imo/components/ImoForm.tsx
// Form component for creating and editing IMOs

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Loader2 } from "lucide-react";
import type { Imo, CreateImoData, UpdateImoData } from "@/types/imo.types";

interface ImoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imo: Imo | null;
  onSubmit: (data: CreateImoData | UpdateImoData) => Promise<void>;
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
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
}

export function ImoForm({
  open,
  onOpenChange,
  imo,
  onSubmit,
  isSubmitting,
}: ImoFormProps) {
  const isEditing = !!imo;

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
      primary_color: "#3B82F6",
      secondary_color: "#10B981",
      is_active: true,
    },
  });

  // Reset form when IMO changes
  useEffect(() => {
    if (imo) {
      reset({
        name: imo.name,
        code: imo.code,
        description: imo.description ?? "",
        contact_email: imo.contact_email ?? "",
        contact_phone: imo.contact_phone ?? "",
        website: imo.website ?? "",
        street_address: imo.street_address ?? "",
        city: imo.city ?? "",
        state: imo.state ?? "",
        zip: imo.zip ?? "",
        primary_color: imo.primary_color ?? "#3B82F6",
        secondary_color: imo.secondary_color ?? "#10B981",
        is_active: imo.is_active,
      });
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
        primary_color: "#3B82F6",
        secondary_color: "#10B981",
        is_active: true,
      });
    }
  }, [imo, reset]);

  const onFormSubmit = async (data: FormData) => {
    const submitData: CreateImoData | UpdateImoData = {
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
      primary_color: data.primary_color || undefined,
      secondary_color: data.secondary_color || undefined,
    };

    if (isEditing) {
      (submitData as UpdateImoData).is_active = data.is_active;
    }

    await onSubmit(submitData);
  };

  const isActive = watch("is_active");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold">
            {isEditing ? "Edit IMO" : "New IMO"}
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEditing
              ? "Update the IMO information below."
              : "Fill in the details for the new IMO."}
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
                  IMO Name *
                </Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                  className="h-7 text-[11px]"
                  placeholder="e.g., Founders Financial Group"
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
                  placeholder="e.g., FFG"
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
                placeholder="Brief description of the IMO..."
              />
            </div>
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
                  placeholder="contact@imo.com"
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
                placeholder="https://www.imo.com"
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

          {/* Branding */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Branding
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="primary_color" className="text-[11px]">
                  Primary Color
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    {...register("primary_color")}
                    className="h-7 w-10 p-0.5 cursor-pointer"
                  />
                  <Input
                    {...register("primary_color")}
                    className="h-7 text-[11px] font-mono flex-1"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="secondary_color" className="text-[11px]">
                  Secondary Color
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    {...register("secondary_color")}
                    className="h-7 w-10 p-0.5 cursor-pointer"
                  />
                  <Input
                    {...register("secondary_color")}
                    className="h-7 text-[11px] font-mono flex-1"
                    placeholder="#10B981"
                  />
                </div>
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
                    Deactivating will hide this IMO from users
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
              {isEditing ? "Save Changes" : "Create IMO"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
