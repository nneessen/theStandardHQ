// src/features/recruiting/components/SendInviteDialog.tsx
// Dialog for sending self-registration invites to recruits
// Redesigned with zinc palette and compact design

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2, Mail, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateRecruitWithInvitation } from "../hooks/useRecruitInvitations";
import { UserSearchCombobox } from "@/components/shared/user-search-combobox";

// Form validation schema
const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  message: z
    .string()
    .max(500, "Message must be 500 characters or less")
    .optional(),
  upline_id: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface SendInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, send invite to existing recruit instead of creating new one */
  _existingRecruitId?: string;
  existingEmail?: string;
  existingName?: string;
  onSuccess?: () => void;
}

export function SendInviteDialog({
  open,
  onOpenChange,
  _existingRecruitId,
  existingEmail,
  existingName,
  onSuccess,
}: SendInviteDialogProps) {
  const { user } = useAuth();
  const createWithInvite = useCreateRecruitWithInvitation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: existingEmail || "",
      first_name: existingName?.split(" ")[0] || "",
      last_name: existingName?.split(" ").slice(1).join(" ") || "",
      message: "",
      upline_id: user?.id || "",
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    // Prevent concurrent submissions (double-click protection)
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createWithInvite.mutateAsync({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        message: data.message,
        upline_id: data.upline_id || user?.id,
        sendEmail: true,
      });

      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error sending invite:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 bg-v2-card border-v2-ring">
        <DialogHeader className="px-4 py-3 border-b border-v2-ring bg-v2-canvas">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-v2-ink">
            <Mail className="h-4 w-4" />
            Send Registration Invite
          </DialogTitle>
          <DialogDescription className="text-[10px] text-v2-ink-muted">
            Send an email invitation for the recruit to fill out their own
            registration information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-3 space-y-3">
          {/* Email */}
          <div className="space-y-1">
            <Label htmlFor="email" className="text-[10px] text-v2-ink-muted">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-2 top-1.5 h-3 w-3 text-v2-ink-subtle" />
              <Input
                id="email"
                type="email"
                placeholder="recruit@example.com"
                {...register("email")}
                disabled={!!existingEmail}
                className={`h-7 text-[11px] pl-7 ${
                  existingEmail ? "bg-v2-ring" : "bg-v2-card"
                } border-v2-ring`}
              />
            </div>
            {errors.email && (
              <p className="text-[10px] text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Name (optional, for prefill) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label
                htmlFor="first_name"
                className="text-[10px] text-v2-ink-muted"
              >
                First Name
              </Label>
              <Input
                id="first_name"
                placeholder="John"
                {...register("first_name")}
                className="h-7 text-[11px] bg-v2-card border-v2-ring"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="last_name"
                className="text-[10px] text-v2-ink-muted"
              >
                Last Name
              </Label>
              <Input
                id="last_name"
                placeholder="Doe"
                {...register("last_name")}
                className="h-7 text-[11px] bg-v2-card border-v2-ring"
              />
            </div>
          </div>

          {/* Upline Assignment */}
          <div className="space-y-1">
            <Label
              htmlFor="upline_id"
              className="text-[10px] text-v2-ink-muted"
            >
              Assign Upline
            </Label>
            <UserSearchCombobox
              value={watch("upline_id") || null}
              onChange={(id) => setValue("upline_id", id || "")}
              roles={["agent", "admin", "trainer"]}
              approvalStatus="approved"
              placeholder="Search for upline..."
              showNoUplineOption={false}
              className="h-7"
            />
            <p className="text-[9px] text-v2-ink-subtle">
              The recruit will be assigned to this person as their upline.
            </p>
          </div>

          {/* Personal Message */}
          <div className="space-y-1">
            <Label htmlFor="message" className="text-[10px] text-v2-ink-muted">
              Personal Message (Optional)
            </Label>
            <Textarea
              id="message"
              placeholder="Add a personal note to include in the invitation email..."
              rows={3}
              {...register("message")}
              className="resize-none text-[11px] bg-v2-card border-v2-ring"
            />
            {errors.message && (
              <p className="text-[10px] text-red-500">
                {errors.message.message}
              </p>
            )}
            <p className="text-[9px] text-v2-ink-subtle">
              {watch("message")?.length || 0}/500 characters
            </p>
          </div>
        </form>

        <DialogFooter className="px-4 py-2.5 gap-1.5 border-t border-v2-ring bg-v2-canvas">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            size="sm"
            className="h-6 text-[10px] px-2"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            size="sm"
            className="h-6 text-[10px] px-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-3 w-3 mr-1" />
                Send Invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SendInviteDialog;
