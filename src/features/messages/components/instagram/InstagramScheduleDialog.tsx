// src/features/messages/components/instagram/InstagramScheduleDialog.tsx
// Dialog to schedule a message for future sending within the messaging window

import { type ReactNode, useState, useMemo, useEffect } from "react";
import { Calendar, Clock, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, addMinutes, isBefore, isAfter, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  selectWindowTimeRemaining,
  formatTimeRemaining,
} from "@/lib/instagram";
import { useScheduleInstagramMessage, useInstagramTemplates } from "@/hooks";
import type {
  InstagramConversation,
  InstagramScheduledMessage,
} from "@/types/instagram.types";

interface InstagramScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: InstagramConversation;
  onScheduled?: (scheduled: InstagramScheduledMessage) => void;
}

const MAX_CHARS = 1000;
const MIN_SCHEDULE_MINUTES = 5; // Must be at least 5 minutes from now

export function InstagramScheduleDialog({
  open,
  onOpenChange,
  conversation,
  onScheduled,
}: InstagramScheduleDialogProps): ReactNode {
  const scheduleMutation = useScheduleInstagramMessage();
  const { data: templates = [] } = useInstagramTemplates();

  const [messageText, setMessageText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Calculate time constraints - recalculate when dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [open]);
  const windowExpiry = conversation.can_reply_until
    ? parseISO(conversation.can_reply_until)
    : null;
  const minScheduleTime = addMinutes(now, MIN_SCHEDULE_MINUTES);
  const windowTimeRemaining = selectWindowTimeRemaining(
    conversation.can_reply_until,
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMessageText("");
      setSelectedTemplateId(null);
      // Default to 1 hour from now or middle of window
      const defaultTime = addMinutes(now, 60);
      if (windowExpiry && isAfter(defaultTime, windowExpiry)) {
        // If 1 hour is past window, set to halfway through remaining window
        const halfwayMs = windowTimeRemaining
          ? windowTimeRemaining / 2
          : 30 * 60 * 1000;
        const halfwayTime = new Date(now.getTime() + halfwayMs);
        setScheduleDate(format(halfwayTime, "yyyy-MM-dd"));
        setScheduleTime(format(halfwayTime, "HH:mm"));
      } else {
        setScheduleDate(format(defaultTime, "yyyy-MM-dd"));
        setScheduleTime(format(defaultTime, "HH:mm"));
      }
    }
  }, [open, now, windowExpiry, windowTimeRemaining]);

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    if (templateId === "none") {
      setSelectedTemplateId(null);
      return;
    }

    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setMessageText(template.content);
    }
  };

  // Validate scheduled time
  const scheduledDateTime = useMemo(() => {
    if (!scheduleDate || !scheduleTime) return null;
    try {
      return new Date(`${scheduleDate}T${scheduleTime}`);
    } catch {
      return null;
    }
  }, [scheduleDate, scheduleTime]);

  const timeValidation = useMemo(() => {
    if (!scheduledDateTime) {
      return { valid: false, error: "Select a date and time" };
    }

    if (isBefore(scheduledDateTime, minScheduleTime)) {
      return { valid: false, error: "Must be at least 5 minutes from now" };
    }

    if (windowExpiry && isAfter(scheduledDateTime, windowExpiry)) {
      return {
        valid: false,
        error: "Must be before the messaging window closes",
      };
    }

    return { valid: true, error: null };
  }, [scheduledDateTime, minScheduleTime, windowExpiry]);

  // Validation
  const charCount = messageText.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSubmit =
    messageText.trim().length > 0 &&
    !isOverLimit &&
    timeValidation.valid &&
    !scheduleMutation.isPending;

  // Is window closing soon?
  const isWindowClosingSoon =
    windowTimeRemaining !== null && windowTimeRemaining < 2 * 60 * 60 * 1000; // < 2 hours

  const handleSubmit = async () => {
    if (!canSubmit || !scheduledDateTime) return;

    try {
      const result = await scheduleMutation.mutateAsync({
        conversationId: conversation.id,
        messageText: messageText.trim(),
        scheduledFor: scheduledDateTime,
        templateId: selectedTemplateId || undefined,
      });

      toast.success("Message scheduled", {
        description: `Will be sent at ${format(scheduledDateTime, "MMM d, h:mm a")}`,
      });

      onScheduled?.(result);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to schedule message", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  // Format window expiry for display
  const windowExpiryFormatted = windowExpiry
    ? format(windowExpiry, "MMM d, h:mm a")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Schedule Message
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Send to @{conversation.participant_username || "contact"} at a
            specific time
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template selector */}
          <div className="space-y-1">
            <Label htmlFor="template" className="text-[11px]">
              Template (optional)
            </Label>
            <Select
              value={selectedTemplateId || "none"}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-[11px]">
                  No template
                </SelectItem>
                {templates.map((template) => (
                  <SelectItem
                    key={template.id}
                    value={template.id}
                    className="text-[11px]"
                  >
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message text */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="message" className="text-[11px]">
                Message
              </Label>
              <span
                className={cn(
                  "text-[9px]",
                  isOverLimit
                    ? "text-destructive font-medium"
                    : charCount > MAX_CHARS * 0.9
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                {charCount}/{MAX_CHARS}
              </span>
            </div>
            <Textarea
              id="message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className={cn(
                "min-h-[100px] text-[11px] resize-none",
                isOverLimit && "border-destructive/40",
              )}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date" className="text-[11px]">
                Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={format(now, "yyyy-MM-dd")}
                  max={
                    windowExpiry
                      ? format(windowExpiry, "yyyy-MM-dd")
                      : undefined
                  }
                  className="h-8 pl-8 text-[11px]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="time" className="text-[11px]">
                Time
              </Label>
              <div className="relative">
                <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="h-8 pl-8 text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Time validation error */}
          {!timeValidation.valid && timeValidation.error && (
            <p className="text-[10px] text-destructive">
              {timeValidation.error}
            </p>
          )}

          {/* Window warning */}
          {isWindowClosingSoon && (
            <div className="flex items-start gap-2 p-2 bg-warning/10 rounded border border-warning/30">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-warning">
                  Window closing soon
                </p>
                <p className="text-[10px] text-warning">
                  {formatTimeRemaining(windowTimeRemaining)} until window closes
                  {windowExpiryFormatted && ` (${windowExpiryFormatted})`}
                </p>
              </div>
            </div>
          )}

          {/* Window info */}
          {windowExpiryFormatted && !isWindowClosingSoon && (
            <p className="text-[10px] text-muted-foreground">
              Messaging window closes: {windowExpiryFormatted}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-[11px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="text-[11px]"
          >
            {scheduleMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Scheduling...
              </>
            ) : (
              "Schedule Message"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
