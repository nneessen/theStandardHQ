// src/features/messages/components/instagram/InstagramConversationItem.tsx
// Single conversation row in the sidebar

import { type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { Star, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { selectAvatarUrl } from "@/lib/instagram";
import { InstagramWindowIndicator } from "./InstagramWindowIndicator";
import type { InstagramConversation } from "@/types/instagram.types";

interface InstagramConversationItemProps {
  conversation: InstagramConversation;
  isSelected: boolean;
  onClick: () => void;
}

export function InstagramConversationItem({
  conversation,
  isSelected,
  onClick,
}: InstagramConversationItemProps): ReactNode {
  const displayName =
    conversation.participant_name ||
    conversation.participant_username ||
    "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  const lastMessageTime = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: true,
      })
    : null;

  const hasUnread = conversation.unread_count > 0;
  const isInbound = conversation.last_message_direction === "inbound";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-2 p-2 rounded-md text-left transition-colors",
        isSelected ? "bg-blue-100 dark:bg-blue-900/30" : "hover:bg-v2-canvas",
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={
              selectAvatarUrl(
                conversation.participant_avatar_cached_url,
                conversation.participant_profile_picture_url,
              ) ?? undefined
            }
            alt={displayName}
          />
          <AvatarFallback className="text-[10px] bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Window status dot */}
        <div className="absolute -bottom-0.5 -right-0.5">
          <InstagramWindowIndicator
            canReplyUntil={conversation.can_reply_until}
            variant="minimal"
            showTooltip={false}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-1">
          {/* Name */}
          <span
            className={cn(
              "text-[11px] truncate flex-1",
              hasUnread
                ? "font-semibold text-v2-ink"
                : "font-medium text-v2-ink-muted",
            )}
          >
            {conversation.participant_username
              ? `@${conversation.participant_username}`
              : displayName}
          </span>

          {/* Priority star */}
          {conversation.is_priority && (
            <Star className="h-3 w-3 flex-shrink-0 text-amber-500 fill-amber-500" />
          )}

          {/* Linked lead badge */}
          {conversation.hasLinkedLead && (
            <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <User className="h-2 w-2 text-emerald-600 dark:text-emerald-400" />
            </div>
          )}
        </div>

        {/* Message preview row */}
        <div className="flex items-center gap-1 mt-0.5">
          <p
            className={cn(
              "text-[10px] truncate flex-1",
              hasUnread ? "text-v2-ink-muted" : "text-v2-ink-muted",
            )}
          >
            {isInbound ? "" : "You: "}
            {conversation.last_message_preview || "No messages yet"}
          </p>
        </div>

        {/* Time and unread badge row */}
        <div className="flex items-center justify-between mt-0.5">
          {lastMessageTime && (
            <span className="text-[9px] text-v2-ink-subtle">
              {lastMessageTime}
            </span>
          )}
          {hasUnread && (
            <span className="ml-auto flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-medium flex items-center justify-center">
              {conversation.unread_count > 99
                ? "99+"
                : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
