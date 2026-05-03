// src/features/messages/components/instagram/CreateLeadFromIGDialog.tsx
// Dialog to create a recruiting lead from an Instagram conversation

import { type ReactNode, useState, useEffect } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { parseInstagramName } from "@/lib/nameParser";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLeadFromInstagram } from "@/hooks/instagram";
import { US_STATES } from "@/constants/states";
import type { InstagramConversation } from "@/types/instagram.types";

interface CreateLeadFromIGDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: InstagramConversation;
  onSuccess?: (leadId: string) => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  availability: "full_time" | "part_time" | "exploring";
  insuranceExperience:
    | "none"
    | "less_than_1_year"
    | "1_to_3_years"
    | "3_plus_years";
  whyInterested: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

/**
 * Creates initial form data pre-filled from conversation
 * Uses display name for first/last parsing, with username as fallback for first name
 */
function getInitialFormData(conversation: InstagramConversation): FormData {
  const parsed = parseInstagramName(
    conversation.participant_name,
    conversation.participant_username, // Use username as fallback for first name
  );
  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: conversation.participant_email || "",
    phone: conversation.participant_phone || "",
    city: "",
    state: "",
    availability: "exploring",
    insuranceExperience: "none",
    whyInterested: conversation.contact_notes || "",
  };
}

export function CreateLeadFromIGDialog({
  open,
  onOpenChange,
  conversation,
  onSuccess,
}: CreateLeadFromIGDialogProps): ReactNode {
  const createLead = useCreateLeadFromInstagram();
  const [formData, setFormData] = useState<FormData>(() =>
    getInitialFormData(conversation),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form with pre-filled data when dialog opens or conversation changes
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(conversation));
      setErrors({});
    }
  }, [open, conversation]);

  /**
   * Validates email using a more robust pattern
   * Checks for: local part, @ symbol, domain with at least one dot, valid TLD
   */
  const isValidEmail = (email: string): boolean => {
    const trimmed = email.trim().toLowerCase();
    // More comprehensive email validation:
    // - Local part: alphanumeric, dots, hyphens, underscores, plus signs
    // - Domain: alphanumeric and hyphens, no consecutive dots
    // - TLD: 2-10 characters
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(trimmed) && trimmed.length <= 254;
  };

  /**
   * Validates phone number - accepts US (10 digits) or international (7-15 digits with optional +)
   */
  const isValidPhone = (phone: string): boolean => {
    const digitsOnly = phone.replace(/\D/g, "");
    // International: 7-15 digits (E.164 standard)
    // US: exactly 10 digits
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email required";
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = "Valid email required";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone required";
    } else if (!isValidPhone(formData.phone)) {
      newErrors.phone = "Valid phone required (7-15 digits)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const leadId = await createLead.mutateAsync({
        conversationId: conversation.id,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim() || undefined,
        state: formData.state || undefined,
        availability: formData.availability,
        insuranceExperience: formData.insuranceExperience,
        whyInterested: formData.whyInterested.trim() || undefined,
      });

      toast.success("Lead created successfully");
      setFormData(getInitialFormData(conversation));
      setErrors({});
      onOpenChange(false);
      onSuccess?.(leadId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create lead",
      );
    }
  };

  const handleClose = () => {
    setFormData(getInitialFormData(conversation));
    setErrors({});
    onOpenChange(false);
  };

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-3">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <UserPlus className="h-4 w-4" />
            Create Lead
          </DialogTitle>
          <DialogDescription className="text-[10px]">
            Convert @{conversation.participant_username || "user"} to a
            recruiting lead
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={createLead.isPending} className="py-2 space-y-2">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  className={`h-7 text-[11px] ${errors.firstName ? "border-destructive" : ""}`}
                  value={formData.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  placeholder="First name"
                  maxLength={100}
                />
                {errors.firstName && (
                  <p className="text-[10px] text-destructive">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  className={`h-7 text-[11px] ${errors.lastName ? "border-destructive" : ""}`}
                  value={formData.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  placeholder="Last name"
                  maxLength={100}
                />
                {errors.lastName && (
                  <p className="text-[10px] text-destructive">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Email and Phone row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="email"
                  className={`h-7 text-[11px] ${errors.email ? "border-destructive" : ""}`}
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="email@example.com"
                  maxLength={254}
                />
                {errors.email && (
                  <p className="text-[10px] text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="tel"
                  className={`h-7 text-[11px] ${errors.phone ? "border-destructive" : ""}`}
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+1 (555) 555-5555"
                  maxLength={20}
                />
                {errors.phone && (
                  <p className="text-[10px] text-destructive">{errors.phone}</p>
                )}
              </div>
            </div>

            {/* City and State row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">City</Label>
                <Input
                  className="h-7 text-[11px]"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="City"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">State</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => updateField("state", value)}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem
                        key={state.value}
                        value={state.value}
                        className="text-[11px]"
                      >
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Availability and Experience row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Availability</Label>
                <Select
                  value={formData.availability}
                  onValueChange={(value) =>
                    updateField(
                      "availability",
                      value as FormData["availability"],
                    )
                  }
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exploring" className="text-[11px]">
                      Just Exploring
                    </SelectItem>
                    <SelectItem value="part_time" className="text-[11px]">
                      Part-time
                    </SelectItem>
                    <SelectItem value="full_time" className="text-[11px]">
                      Full-time
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Experience</Label>
                <Select
                  value={formData.insuranceExperience}
                  onValueChange={(value) =>
                    updateField(
                      "insuranceExperience",
                      value as FormData["insuranceExperience"],
                    )
                  }
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-[11px]">
                      No experience
                    </SelectItem>
                    <SelectItem
                      value="less_than_1_year"
                      className="text-[11px]"
                    >
                      Less than 1 year
                    </SelectItem>
                    <SelectItem value="1_to_3_years" className="text-[11px]">
                      1-3 years
                    </SelectItem>
                    <SelectItem value="3_plus_years" className="text-[11px]">
                      3+ years
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes row */}
            <div className="space-y-1">
              <Label className="text-[11px]">Notes</Label>
              <Textarea
                className="h-16 text-[11px] resize-none"
                placeholder="Any notes about this lead..."
                value={formData.whyInterested}
                onChange={(e) => updateField("whyInterested", e.target.value)}
                maxLength={1000}
              />
            </div>
          </fieldset>

          <DialogFooter className="gap-1 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[10px]"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-6 text-[10px]"
              disabled={createLead.isPending}
            >
              {createLead.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-3 w-3 mr-1" />
                  Create Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
