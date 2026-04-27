// src/features/messages/components/instagram/InstagramMessageBubble.tsx
// Single message display in a conversation thread

import { type ReactNode } from "react";
import { format } from "date-fns";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Image,
  Film,
  FileText,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { selectMediaUrl } from "@/lib/instagram";
import type { InstagramMessage } from "@/types/instagram.types";

interface InstagramMessageBubbleProps {
  message: InstagramMessage;
  showAvatar?: boolean;
  isGrouped?: boolean;
}

export function InstagramMessageBubble({
  message,
  showAvatar: _showAvatar = false,
  isGrouped = false,
}: InstagramMessageBubbleProps): ReactNode {
  const isOutbound = message.direction === "outbound";
  const timestamp = message.sent_at ? new Date(message.sent_at) : null;

  const getStatusIcon = () => {
    switch (message.status) {
      case "pending":
        return <Clock className="h-2.5 w-2.5 text-v2-ink-subtle" />;
      case "sent":
        return <Check className="h-2.5 w-2.5 text-v2-ink-subtle" />;
      case "delivered":
        return <CheckCheck className="h-2.5 w-2.5 text-v2-ink-subtle" />;
      case "read":
        return <CheckCheck className="h-2.5 w-2.5 text-blue-500" />;
      case "failed":
        return <AlertCircle className="h-2.5 w-2.5 text-red-500" />;
      default:
        return null;
    }
  };

  const getMessageTypeIcon = () => {
    switch (message.message_type) {
      case "media":
        if (message.media_type === "audio") {
          return <Mic className="h-3 w-3" />;
        }
        if (message.media_type?.startsWith("video")) {
          return <Film className="h-3 w-3" />;
        }
        return <Image className="h-3 w-3" />;
      case "story_reply":
      case "story_mention":
        return <FileText className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // Story reply/mention indicator
  const storyIndicator =
    message.message_type === "story_reply" ||
    message.message_type === "story_mention" ? (
      <div className="flex items-center gap-1 text-[9px] text-v2-ink-subtle mb-1">
        <FileText className="h-2.5 w-2.5" />
        <span>
          {message.message_type === "story_reply"
            ? "Replied to your story"
            : "Mentioned you in their story"}
        </span>
      </div>
    ) : null;

  // Media content - prefer cached URL, fall back to original
  const mediaUrl = selectMediaUrl(message.media_cached_url, message.media_url);
  const mediaContent = mediaUrl ? (
    <div className="mb-1 rounded overflow-hidden max-w-[200px]">
      {message.media_type === "audio" ? (
        <audio
          src={mediaUrl}
          controls
          className="w-full min-w-[180px]"
          preload="metadata"
          onError={(e) => {
            // Hide broken audio player, will fall through to "Unsupported message"
            e.currentTarget.style.display = "none";
          }}
        />
      ) : message.media_type?.startsWith("video") ? (
        <video
          src={mediaUrl}
          controls
          className="w-full max-h-[200px] object-contain bg-v2-ring"
        />
      ) : (
        <img
          src={mediaUrl}
          alt="Shared media"
          className="w-full max-h-[200px] object-contain bg-v2-ring"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "flex w-full",
        isOutbound ? "justify-end" : "justify-start",
        isGrouped ? "mt-0.5" : "mt-2",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] min-w-[60px]",
          isOutbound ? "items-end" : "items-start",
        )}
      >
        {/* Sender username for inbound messages (non-grouped) */}
        {!isOutbound && !isGrouped && message.sender_username && (
          <p className="text-[9px] text-v2-ink-muted mb-0.5 px-1">
            @{message.sender_username}
          </p>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "px-2.5 py-1.5 rounded-2xl",
            isOutbound
              ? "bg-blue-500 text-white rounded-br-md"
              : "bg-v2-ring text-v2-ink rounded-bl-md",
          )}
        >
          {storyIndicator}
          {mediaContent}

          {/* Message text */}
          {message.message_text && (
            <p className="text-[11px] whitespace-pre-wrap break-words leading-relaxed">
              {message.message_text}
            </p>
          )}

          {/* Empty message placeholder */}
          {!message.message_text && !mediaUrl && (
            <div className="flex items-center gap-1 text-[10px] opacity-70">
              {getMessageTypeIcon()}
              <span>
                {message.message_type === "media"
                  ? "Shared media"
                  : "Unsupported message"}
              </span>
            </div>
          )}
        </div>

        {/* Timestamp and status row */}
        <div
          className={cn(
            "flex items-center gap-1 mt-0.5 px-1",
            isOutbound ? "justify-end" : "justify-start",
          )}
        >
          {timestamp && (
            <span className="text-[9px] text-v2-ink-subtle">
              {format(timestamp, "h:mm a")}
            </span>
          )}
          {isOutbound && getStatusIcon()}
        </div>
      </div>
    </div>
  );
}

// Grouped messages helper - groups consecutive messages from same sender
export function groupMessages(
  messages: InstagramMessage[],
): InstagramMessage[][] {
  const groups: InstagramMessage[][] = [];
  let currentGroup: InstagramMessage[] = [];

  for (const message of messages) {
    if (currentGroup.length === 0) {
      currentGroup.push(message);
    } else {
      const lastMessage = currentGroup[currentGroup.length - 1];
      const sameDirection = lastMessage.direction === message.direction;
      const timeDiff = Math.abs(
        new Date(message.sent_at).getTime() -
          new Date(lastMessage.sent_at).getTime(),
      );
      const withinTimeWindow = timeDiff < 60000; // 1 minute

      if (sameDirection && withinTimeWindow) {
        currentGroup.push(message);
      } else {
        groups.push(currentGroup);
        currentGroup = [message];
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}
