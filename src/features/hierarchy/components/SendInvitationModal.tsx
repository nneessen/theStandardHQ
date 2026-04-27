// src/features/hierarchy/components/SendInvitationModal.tsx
// Modal for sending hierarchy invitations - email-only input

import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { useSendInvitation } from "../../../hooks/hierarchy/useInvitations";
import { useTeamSizeLimit } from "../../../hooks/subscription";
import {
  Loader2,
  Mail,
  Send,
  AlertTriangle,
  Crown,
  Users,
  MessageSquare,
} from "lucide-react";

const _sendInvitationSchema = z.object({
  invitee_email: z.string().email("Invalid email address"),
  message: z.string().optional(),
});

interface SendInvitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendInvitationModal({
  open,
  onOpenChange,
}: SendInvitationModalProps) {
  const sendInvitationMutation = useSendInvitation();
  const { status: teamLimit, isLoading: limitLoading } = useTeamSizeLimit();

  // Check if user has reached team size limit
  const isAtLimit =
    teamLimit &&
    !teamLimit.canAdd &&
    teamLimit.limit !== null &&
    teamLimit.limit > 0;
  const showWarning = teamLimit?.atWarning && !isAtLimit;

  const form = useForm({
    defaultValues: {
      invitee_email: "",
      message: "",
    },
    onSubmit: async ({ value }) => {
      const response = await sendInvitationMutation.mutateAsync({
        invitee_email: value.invitee_email,
        message: value.message || undefined,
      });

      if (response.success) {
        onOpenChange(false);
        form.reset();
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-v2-ring bg-v2-canvas">
          <DialogTitle className="flex items-center gap-1.5 text-sm font-medium">
            <Send className="h-3.5 w-3.5 text-v2-ink-muted" />
            Invite Agent to Downline
          </DialogTitle>
          <DialogDescription className="text-[11px] text-v2-ink-muted">
            Send an email invitation to add someone to your team. Must already
            have an account.
          </DialogDescription>
        </DialogHeader>

        {/* Team size limit status */}
        {teamLimit && teamLimit.limit !== null && teamLimit.limit > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 text-[10px] text-v2-ink-muted border-b border-v2-ring bg-v2-card-tinted">
            <Users className="h-3 w-3" />
            <span>
              Team: {teamLimit.current} / {teamLimit.limit}
            </span>
            {teamLimit.remaining !== null && teamLimit.remaining > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">
                ({teamLimit.remaining} available)
              </span>
            )}
          </div>
        )}

        {/* Limit reached - block sending */}
        {isAtLimit && (
          <div className="mx-4 mt-3">
            <Alert
              variant="destructive"
              className="py-2 px-3 border-red-500/30"
            >
              <div className="flex items-start gap-2">
                <Crown className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-medium">
                    Team Size Limit Reached
                  </p>
                  <p className="text-[10px] mt-0.5 opacity-80">
                    Max {teamLimit?.limit} direct downlines on{" "}
                    {teamLimit?.planName}
                  </p>
                  <Link to="/billing">
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-6 text-[10px] px-2"
                    >
                      <Crown className="h-2.5 w-2.5 mr-1" />
                      Upgrade
                    </Button>
                  </Link>
                </div>
              </div>
            </Alert>
          </div>
        )}

        {/* Warning - approaching limit */}
        {showWarning && (
          <div className="mx-4 mt-3">
            <Alert className="py-2 px-3 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
                <AlertDescription className="text-[10px] text-amber-700 dark:text-amber-300">
                  {teamLimit?.remaining} spot
                  {teamLimit?.remaining === 1 ? "" : "s"} remaining on{" "}
                  {teamLimit?.planName}
                </AlertDescription>
              </div>
            </Alert>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="p-4 space-y-3">
            {/* Email Field */}
            <form.Field name="invitee_email">
              {(field) => (
                <div>
                  <Label className="text-[11px] text-v2-ink-muted">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-2 top-1.5 h-3 w-3 text-v2-ink-subtle" />
                    <Input
                      id="invitee_email"
                      type="email"
                      placeholder="agent@example.com"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoFocus
                      className="h-7 text-[11px] pl-7 bg-v2-card border-v2-ring"
                    />
                  </div>
                  {field.state.meta.errors &&
                    field.state.meta.errors.length > 0 && (
                      <p className="text-[10px] text-red-500 mt-0.5">
                        {field.state.meta.errors.join(", ")}
                      </p>
                    )}
                  <p className="text-[10px] text-v2-ink-muted mt-0.5">
                    Invitation email will be sent automatically
                  </p>
                </div>
              )}
            </form.Field>

            {/* Optional Message */}
            <form.Field name="message">
              {(field) => (
                <div>
                  <Label className="text-[11px] text-v2-ink-muted">
                    Message (optional)
                  </Label>
                  <div className="relative mt-1">
                    <MessageSquare className="absolute left-2 top-2 h-3 w-3 text-v2-ink-subtle" />
                    <Textarea
                      id="message"
                      placeholder="Add a personal message..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      rows={2}
                      className="text-[11px] pl-7 pt-1.5 min-h-[52px] resize-none bg-v2-card border-v2-ring"
                    />
                  </div>
                </div>
              )}
            </form.Field>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-v2-ring bg-v2-card-tinted">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={sendInvitationMutation.isPending}
              className="h-7 text-[11px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                sendInvitationMutation.isPending || limitLoading || !!isAtLimit
              }
              className="h-7 text-[11px]"
            >
              {(sendInvitationMutation.isPending || limitLoading) && (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              )}
              {!sendInvitationMutation.isPending && !limitLoading && (
                <Send className="mr-1.5 h-3 w-3" />
              )}
              {isAtLimit ? "Limit Reached" : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
