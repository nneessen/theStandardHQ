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
import { Button } from "@/components/ui/button";
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
      // Call both Slack and Discord edge functions in parallel — each only processes
      // its own integration type's logs, so the other is a safe no-op.
      try {
        const batchBody = {
          action: "complete-first-sale-batch",
          firstSaleGroupId: groupId,
          title: title.trim(),
        };

        const [slackResult, discordResult] = await Promise.allSettled([
          supabase.functions.invoke("slack-policy-notification", {
            body: batchBody,
          }),
          supabase.functions.invoke("discord-policy-notification", {
            body: batchBody,
          }),
        ]);

        const slackOk =
          slackResult.status === "fulfilled" && !slackResult.value.error;
        const discordOk =
          discordResult.status === "fulfilled" && !discordResult.value.error;

        if (!slackOk && !discordOk) {
          console.error("Both notification channels failed:", {
            slack:
              slackResult.status === "rejected"
                ? slackResult.reason
                : slackResult.value.error,
            discord:
              discordResult.status === "rejected"
                ? discordResult.reason
                : discordResult.value.error,
          });
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

      const [slackResult, discordResult] = await Promise.allSettled([
        supabase.functions.invoke("slack-policy-notification", {
          body: batchBody,
        }),
        supabase.functions.invoke("discord-policy-notification", {
          body: batchBody,
        }),
      ]);

      const slackOk =
        slackResult.status === "fulfilled" && !slackResult.value.error;
      const discordOk =
        discordResult.status === "fulfilled" && !discordResult.value.error;

      if (!slackOk && !discordOk) {
        console.error("Both notification channels failed:", {
          slack:
            slackResult.status === "rejected"
              ? slackResult.reason
              : slackResult.value.error,
          discord:
            discordResult.status === "rejected"
              ? discordResult.reason
              : discordResult.value.error,
        });
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
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card border border-border/50 shadow-2xl">
        {/* Decorative header with gradient and pattern */}
        <div className="relative bg-foreground px-6 py-8 overflow-hidden">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="firstsale-grid"
                  width="32"
                  height="32"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 32 0 L 0 0 0 32"
                    fill="none"
                    stroke="white"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#firstsale-grid)" />
            </svg>
          </div>

          {/* Glow effects */}
          <div className="absolute top-0 -left-10 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -right-10 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl" />

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/20 rounded-xl">
                <Trophy className="h-7 w-7 text-amber-400" />
              </div>
              <div className="p-2.5 bg-purple-500/20 rounded-xl">
                <Sparkles className="h-7 w-7 text-purple-400" />
              </div>
            </div>

            <DialogHeader className="text-left space-y-2">
              <DialogTitle
                className="text-2xl font-bold text-white dark:text-black"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                First Sale of the Day!
              </DialogTitle>
              <DialogDescription className="text-white/80 dark:text-black/70 text-sm leading-relaxed">
                You're the first to close a deal
                {agencyName !== "IMO-Level" &&
                agencyName !== "Self Made Financial"
                  ? ` at ${agencyName}`
                  : agencyName === "Self Made Financial"
                    ? " in the entire organization"
                    : ""}{" "}
                today! As a reward, you get to name today's leaderboard.
              </DialogDescription>
            </DialogHeader>

            {/* Show channels that will receive the leaderboard */}
            {hasMultipleChannels && channelNames.length > 0 && (
              <div className="mt-4 p-2 bg-white/5 dark:bg-black/5 rounded-lg">
                <span className="text-xs text-white/60 dark:text-black/60 block mb-1.5">
                  Your title will be posted to {totalChannels} channels:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {channelNames.map((name) => (
                    <span
                      key={name}
                      className="text-xs px-2 py-0.5 bg-white/10 dark:bg-black/10 rounded text-white/80 dark:text-black/70"
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
        <div className="px-6 py-5 space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="leaderboard-title"
              className="text-sm font-medium text-foreground"
            >
              Leaderboard Title for {agencyName}
            </Label>
            <Input
              ref={inputRef}
              id="leaderboard-title"
              placeholder="e.g., Freaky Friday Sales, Monday Motivation..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSubmitting && title.trim()) {
                  handleSubmit();
                }
              }}
              autoFocus
              className="h-11 text-base"
            />
            <p className="text-xs text-muted-foreground">
              This title will appear on the Slack leaderboard for everyone to
              see
            </p>
          </div>

          {/* Quick emoji picker */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Quick add emoji
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-lg hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-border"
                  disabled={isSubmitting}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border/50 flex gap-3 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {isSubmitting ? "Posting..." : "Use Default Title"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-black font-medium"
          >
            {isSubmitting ? "Posting..." : "Name the Leaderboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
