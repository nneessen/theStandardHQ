// src/features/policies/components/FirstSellerNamingDialog.tsx
// Dialog shown to first seller of the day to name the leaderboard
// Styled to match the signup/login pages for a premium, professional look

import { useState, useRef, useEffect } from "react";
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
import { Trophy, Sparkles } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { toast } from "sonner";

// Common emojis for leaderboard titles
const QUICK_EMOJIS = [
  "🔥",
  "💰",
  "🚀",
  "💪",
  "⭐",
  "🏆",
  "👑",
  "💎",
  "🎯",
  "📈",
  "🙌",
  "✨",
  "💵",
  "🎉",
  "🌟",
  "⚡",
];

interface FirstSellerNamingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  agencyName: string;
  totalChannels: number;
  channelNames: string[];
}

export function FirstSellerNamingDialog({
  open,
  onOpenChange,
  groupId,
  agencyName,
  totalChannels,
  channelNames,
}: FirstSellerNamingDialogProps) {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHandlingClose, setIsHandlingClose] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset all state when switching to a new group
  useEffect(() => {
    setTitle("");
    setIsSubmitting(false);
    setIsHandlingClose(false);
  }, [groupId]);

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setTitle((prev) => prev + emoji);
      return;
    }

    const start = input.selectionStart ?? title.length;
    const end = input.selectionEnd ?? title.length;
    const newValue = title.slice(0, start) + emoji + title.slice(end);
    setTitle(newValue);

    // Set cursor position after the inserted emoji
    requestAnimationFrame(() => {
      input.focus();
      const newPos = start + emoji.length;
      input.setSelectionRange(newPos, newPos);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title for the leaderboard");
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Update the title for ALL logs in the group
      const { error } = await supabase.rpc("set_leaderboard_title_batch", {
        p_first_sale_group_id: groupId,
        p_title: title.trim(),
      });

      if (error) {
        console.error("Error setting leaderboard title:", error);
        toast.error("Failed to set leaderboard title");
        return;
      }

      // Step 2: Complete the first sale batch - posts to ALL channels with the same title
      try {
        const batchBody = {
          action: "complete-first-sale-batch",
          firstSaleGroupId: groupId,
          title: title.trim(),
        };

        const { error: slackError } = await supabase.functions.invoke(
          "slack-policy-notification",
          { body: batchBody },
        );

        if (slackError) {
          console.error("Slack notification failed:", slackError);
          toast.error("Leaderboard named but failed to post notifications");
        } else {
          const channelText =
            totalChannels > 1
              ? `${totalChannels} channels`
              : channelNames[0] || "channel";
          toast.success(`Leaderboard posted to ${channelText}!`);
        }
      } catch (err) {
        console.error("Error calling complete-first-sale-batch:", err);
        toast.error("Leaderboard named but failed to post notifications");
      }

      onOpenChange(false);
    } catch (err) {
      console.error("Error setting leaderboard title:", err);
      toast.error("Failed to set leaderboard title");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete first sale batch with default title (shared by skip button and dismiss)
  const completeFirstSaleBatchWithDefault = async (): Promise<boolean> => {
    try {
      const batchBody = {
        action: "complete-first-sale-batch",
        firstSaleGroupId: groupId,
        // No title = use default
      };

      const { error: slackError } = await supabase.functions.invoke(
        "slack-policy-notification",
        { body: batchBody },
      );

      if (slackError) {
        console.error("Slack notification failed:", slackError);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error completing first sale batch:", err);
      return false;
    }
  };

  const handleSkip = async () => {
    // User skipped naming - post to Slack with default title
    setIsSubmitting(true);
    const success = await completeFirstSaleBatchWithDefault();
    if (success) {
      const channelText =
        totalChannels > 1
          ? `${totalChannels} channels`
          : channelNames[0] || "Slack";
      toast.success(`Leaderboard posted to ${channelText} with default title`);
    }
    setIsSubmitting(false);
    onOpenChange(false);
  };

  // Handle dialog dismissal (clicking outside, pressing ESC)
  // This ensures the notification is always posted even if user dismisses without action
  const handleOpenChange = async (newOpen: boolean) => {
    if (newOpen) {
      onOpenChange(true);
      return;
    }

    // Dialog closing - prevent double handling
    if (isHandlingClose || isSubmitting) {
      return; // Already being handled
    }

    // Dismissed without completing - complete with default title
    setIsHandlingClose(true);
    setIsSubmitting(true);
    await completeFirstSaleBatchWithDefault();
    // Don't show toast for dismiss (user didn't explicitly click)
    setIsSubmitting(false);
    setIsHandlingClose(false);
    onOpenChange(false);
  };

  const hasMultipleChannels = totalChannels > 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="theme-v2 font-display sm:max-w-lg w-[calc(100vw-1.5rem)] sm:w-auto max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] p-0 overflow-hidden bg-card text-foreground border border-border rounded-v2-lg shadow-v2-lift flex flex-col">
        {/* Hero header — dark v2 card with subtle yellow glow */}
        <div className="relative bg-foreground text-white px-6 py-6 overflow-hidden flex-shrink-0">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-v2-pill bg-accent text-foreground">
                <Trophy className="h-5 w-5" />
              </span>
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-v2-pill bg-white/10 text-warning">
                <Sparkles className="h-5 w-5" />
              </span>
            </div>

            <DialogHeader className="text-left space-y-1.5">
              <div className="text-[10px] font-semibold text-warning uppercase tracking-[0.18em]">
                First sale today
              </div>
              <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                Name today&apos;s leaderboard
              </DialogTitle>
              <DialogDescription className="text-white/75 text-sm leading-relaxed">
                You&apos;re the first to close a deal
                {agencyName !== "IMO-Level" &&
                agencyName !== "Self Made Financial"
                  ? ` at ${agencyName}`
                  : agencyName === "Self Made Financial"
                    ? " in the entire organization"
                    : ""}{" "}
                today. As a reward, you get to name the leaderboard.
              </DialogDescription>
            </DialogHeader>

            {/* Show channels that will receive the leaderboard */}
            {hasMultipleChannels && channelNames.length > 0 && (
              <div className="mt-3 rounded-v2-md bg-white/5 px-3 py-2">
                <span className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.18em] block mb-1.5">
                  Posting to {totalChannels} channels
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {channelNames.map((name) => (
                    <span
                      key={name}
                      className="text-[11px] px-2 py-0.5 rounded-v2-pill bg-white/10 text-white/80"
                    >
                      #{name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-1.5">
            <Label
              htmlFor="leaderboard-title"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Leaderboard title · {agencyName}
            </Label>
            <Input
              ref={inputRef}
              id="leaderboard-title"
              placeholder="e.g., Freaky Friday Sales, Monday Motivation…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSubmitting && title.trim()) {
                  handleSubmit();
                }
              }}
              autoFocus
              className="h-10 text-sm bg-card border-border focus-visible:ring-accent"
            />
            <p className="text-[11px] text-muted-foreground">
              Will appear on the Slack leaderboard for everyone to see.
            </p>
          </div>

          {/* Quick emoji picker */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Quick add emoji
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-lg rounded-v2-pill border border-border bg-card hover:bg-accent/40 transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 bg-card-tinted border-t border-border flex gap-2 flex-shrink-0">
          <PillButton
            type="button"
            tone="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {isSubmitting ? "Posting…" : "Use default title"}
          </PillButton>
          <PillButton
            type="button"
            tone="black"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="flex-1 sm:flex-none"
          >
            {isSubmitting ? "Posting…" : "Name the leaderboard"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
