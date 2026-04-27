// src/features/messages/components/inbox/ThreadListItem.tsx
// Single thread row with zinc palette styling

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Paperclip, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitialsFromEmail } from "@/lib/string";
import type { Thread } from "../../hooks/useThreads";

interface ThreadListItemProps {
  thread: Thread;
  isSelected: boolean;
  onClick: () => void;
  isSentView?: boolean;
}

export function ThreadListItem({
  thread,
  isSelected,
  onClick,
  isSentView = false,
}: ThreadListItemProps) {
  const isUnread = thread.unreadCount > 0;
  const hasAttachments = thread.latestMessage?.hasAttachments;
  const isAutomated = thread.source === "workflow";

  // Get initials and display name based on view type
  const firstParticipant = thread.participantEmails[0] || "Unknown";
  const displayName = isSentView ? "Me" : formatParticipant(firstParticipant);
  const initials = isSentView ? "ME" : getInitialsFromEmail(firstParticipant);

  // Format relative time
  const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), {
    addSuffix: false,
  });

  return (
    <button
      className={cn(
        "w-full text-left p-2 hover:bg-v2-canvas transition-colors border-b border-v2-ring/60",
        isSelected && "bg-v2-ring border-l-2 border-l-blue-500",
        isUnread && "bg-blue-50/30 dark:bg-blue-900/10",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <Avatar className="h-7 w-7 flex-shrink-0">
          <AvatarFallback className="text-[10px] bg-v2-ring text-v2-ink-muted">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-1 mb-0.5">
            {/* Sender name */}
            <span
              className={cn(
                "text-[11px] truncate flex-1",
                isUnread
                  ? "font-semibold text-v2-ink"
                  : "font-medium text-v2-ink-muted dark:text-v2-ink-subtle",
              )}
            >
              {displayName}
            </span>

            {/* Indicators */}
            {thread.isStarred && (
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
            {hasAttachments && (
              <Paperclip className="h-3 w-3 text-v2-ink-subtle flex-shrink-0" />
            )}
            {isAutomated && (
              <Bot className="h-3 w-3 text-v2-ink-subtle flex-shrink-0" />
            )}

            {/* Time */}
            <span className="text-[10px] text-v2-ink-muted flex-shrink-0">
              {formatTimeAgo(timeAgo)}
            </span>
          </div>

          {/* Subject */}
          <div
            className={cn(
              "text-[11px] truncate",
              isUnread
                ? "font-medium text-v2-ink dark:text-v2-ink-subtle"
                : "text-v2-ink-muted dark:text-v2-ink-subtle",
            )}
          >
            {thread.subject}
          </div>

          {/* Preview */}
          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-muted truncate mt-0.5">
            {thread.snippet}
          </div>

          {/* Labels */}
          {thread.labels && thread.labels.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {thread.labels.slice(0, 3).map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="h-4 px-1 text-[9px] border-v2-ring "
                  style={{
                    borderColor: label.color,
                    color: label.color,
                  }}
                >
                  {label.name}
                </Badge>
              ))}
              {thread.labels.length > 3 && (
                <span className="text-[9px] text-v2-ink-subtle">
                  +{thread.labels.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Message count badge */}
        {thread.messageCount > 1 && (
          <Badge
            variant="secondary"
            className="h-4 min-w-[16px] px-1 text-[9px] bg-v2-ring text-v2-ink-muted dark:text-v2-ink-subtle flex-shrink-0"
          >
            {thread.messageCount}
          </Badge>
        )}
      </div>
    </button>
  );
}

// Helper functions
function formatParticipant(email: string): string {
  const namePart = email.split("@")[0];
  const parts = namePart.split(/[._-]/);

  if (parts.length >= 2) {
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }

  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

function formatTimeAgo(timeAgo: string): string {
  return timeAgo
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace("about ", "")
    .replace("less than a minute", "now");
}
