// src/features/settings/integrations/components/IntegrationDialog.tsx

import { useState, useEffect } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useUpsertSchedulingIntegration,
  useUpdateSchedulingIntegration,
} from "@/hooks/integrations";
import type {
  SchedulingIntegration,
  SchedulingIntegrationType,
  CreateSchedulingIntegrationInput,
} from "@/types/integration.types";
import {
  INTEGRATION_TYPE_LABELS,
  INTEGRATION_TYPE_PLACEHOLDERS,
  isValidIntegrationUrl,
} from "@/types/integration.types";
import { toast } from "sonner";

interface IntegrationDialogProps {
  open: boolean;
  onClose: () => void;
  integrationType: SchedulingIntegrationType | null;
  existingIntegration: SchedulingIntegration | null;
}

export function IntegrationDialog({
  open,
  onClose,
  integrationType,
  existingIntegration,
}: IntegrationDialogProps) {
  const upsertIntegration = useUpsertSchedulingIntegration();
  const updateIntegration = useUpdateSchedulingIntegration();

  const [displayName, setDisplayName] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [instructions, setInstructions] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const isEditing = !!existingIntegration;
  const type = existingIntegration?.integration_type ?? integrationType;

  // Reset form when dialog opens/closes or integration changes
  useEffect(() => {
    if (open && existingIntegration) {
      setDisplayName(existingIntegration.display_name ?? "");
      setBookingUrl(existingIntegration.booking_url);
      setMeetingId(existingIntegration.meeting_id ?? "");
      setPasscode(existingIntegration.passcode ?? "");
      setInstructions(existingIntegration.instructions ?? "");
      setUrlError(null);
    } else if (open) {
      setDisplayName("");
      setBookingUrl("");
      setMeetingId("");
      setPasscode("");
      setInstructions("");
      setUrlError(null);
    }
  }, [open, existingIntegration]);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError("URL is required");
      return false;
    }

    if (!type) {
      setUrlError("Integration type is required");
      return false;
    }

    if (!isValidIntegrationUrl(type, url)) {
      const domain =
        type === "calendly"
          ? "calendly.com"
          : type === "zoom"
            ? "zoom.us"
            : "calendar.google.com";
      setUrlError(
        `URL must be a valid ${INTEGRATION_TYPE_LABELS[type]} link (${domain})`,
      );
      return false;
    }

    setUrlError(null);
    return true;
  };

  const handleUrlChange = (url: string) => {
    setBookingUrl(url);
    if (urlError) {
      validateUrl(url);
    }
  };

  const handleSubmit = async () => {
    if (!type) return;

    if (!validateUrl(bookingUrl)) return;

    try {
      if (isEditing && existingIntegration) {
        await updateIntegration.mutateAsync({
          id: existingIntegration.id,
          updates: {
            display_name: displayName || undefined,
            booking_url: bookingUrl,
            meeting_id: meetingId || undefined,
            passcode: passcode || undefined,
            instructions: instructions || undefined,
          },
        });
        toast.success("Integration updated");
      } else {
        const input: CreateSchedulingIntegrationInput = {
          integration_type: type,
          display_name: displayName || undefined,
          booking_url: bookingUrl,
          meeting_id: meetingId || undefined,
          passcode: passcode || undefined,
          instructions: instructions || undefined,
        };
        await upsertIntegration.mutateAsync(input);
        toast.success("Integration connected");
      }
      onClose();
    } catch {
      toast.error(
        isEditing
          ? "Failed to update integration"
          : "Failed to connect integration",
      );
    }
  };

  const isPending = upsertIntegration.isPending || updateIntegration.isPending;

  if (!type) return null;

  return (
    <Dialog open={open} onOpenChange={() => !isPending && onClose()}>
      <DialogContent className="max-w-md p-3 bg-v2-card">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm font-semibold">
            {isEditing ? "Edit" : "Connect"} {INTEGRATION_TYPE_LABELS[type]}
          </DialogTitle>
          <DialogDescription className="text-[10px]">
            {isEditing
              ? "Update your scheduling link and settings"
              : "Add your scheduling link to use in recruiting pipeline"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Display Name */}
          <div className="space-y-1">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Display Name
              <span className="text-v2-ink-subtle ml-1">(optional)</span>
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., 30 Min Phone Call"
              className="h-7 text-[11px] bg-v2-canvas border-v2-ring"
            />
          </div>

          {/* Booking URL */}
          <div className="space-y-1">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Booking URL
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Input
              value={bookingUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={INTEGRATION_TYPE_PLACEHOLDERS[type]}
              className={`h-7 text-[11px] bg-v2-canvas border-v2-ring ${
                urlError ? "border-red-500 dark:border-red-500" : ""
              }`}
            />
            {urlError && <p className="text-[10px] text-red-500">{urlError}</p>}
            <p className="text-[10px] text-v2-ink-muted flex items-center gap-1">
              <ExternalLink className="h-2.5 w-2.5" />
              This link will be shown to recruits for scheduling
            </p>
          </div>

          {/* Zoom-specific fields */}
          {type === "zoom" && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Meeting ID
                  <span className="text-v2-ink-subtle ml-1">(optional)</span>
                </Label>
                <Input
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="e.g., 123 456 7890"
                  className="h-7 text-[11px] bg-v2-canvas border-v2-ring"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Passcode
                  <span className="text-v2-ink-subtle ml-1">(optional)</span>
                </Label>
                <Input
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="e.g., abc123"
                  className="h-7 text-[11px] bg-v2-canvas border-v2-ring"
                />
                <p className="text-[10px] text-v2-ink-muted">
                  Will be shown to recruits along with the meeting link
                </p>
              </div>
            </>
          )}

          {/* Instructions */}
          <div className="space-y-1">
            <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Instructions for Recruits
              <span className="text-v2-ink-subtle ml-1">(optional)</span>
            </Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Please book a time that works for you. I'll call you at the scheduled time."
              className="text-[11px] min-h-14 bg-v2-canvas border-v2-ring"
            />
          </div>
        </div>

        <DialogFooter className="gap-1 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px]"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 text-[10px]"
            onClick={handleSubmit}
            disabled={isPending || !bookingUrl.trim()}
          >
            {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {isEditing ? "Save" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
