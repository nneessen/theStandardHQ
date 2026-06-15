// src/features/messages/components/instagram/InstagramMessageBubble.tsx
// Single message display in a conversation thread — board token restyle

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
import { T } from "@/components/board/tokens";
import { selectMediaUrl } from "@/lib/instagram";
import type { InstagramMessage } from "@/types/instagram.types";

// rgba(255,255,255,0.28) — T.mut3 does not exist in tokens.ts, use literal
const MUT3 = "rgba(255,255,255,0.28)";

// Violet tint values — T has solid violet only; tints are literals per mock
const VIOLET_BG = "rgba(182,155,255,0.16)";
const VIOLET_BORDER = "rgba(182,155,255,0.30)";

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
        return <Clock style={{ width: 10, height: 10, color: T.mut2 }} />;
      case "sent":
        return <Check style={{ width: 10, height: 10, color: T.mut2 }} />;
      case "delivered":
        return <CheckCheck style={{ width: 10, height: 10, color: T.mut2 }} />;
      case "read":
        return <CheckCheck style={{ width: 10, height: 10, color: T.blue }} />;
      case "failed":
        return <AlertCircle style={{ width: 10, height: 10, color: T.red }} />;
      default:
        return null;
    }
  };

  const getMessageTypeIcon = () => {
    switch (message.message_type) {
      case "media":
        if (message.media_type === "audio") {
          return <Mic style={{ width: 12, height: 12 }} />;
        }
        if (message.media_type?.startsWith("video")) {
          return <Film style={{ width: 12, height: 12 }} />;
        }
        return <Image style={{ width: 12, height: 12 }} />;
      case "story_reply":
      case "story_mention":
        return <FileText style={{ width: 12, height: 12 }} />;
      default:
        return null;
    }
  };

  // Story reply/mention indicator
  const storyIndicator =
    message.message_type === "story_reply" ||
    message.message_type === "story_mention" ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          font: `600 9px ${T.mono}`,
          color: MUT3,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        <FileText style={{ width: 10, height: 10 }} />
        <span>
          {message.message_type === "story_reply"
            ? "Replied to your story"
            : "Mentioned you in their story"}
        </span>
      </div>
    ) : null;

  // Media content — prefer cached URL, fall back to original
  const mediaUrl = selectMediaUrl(message.media_cached_url, message.media_url);
  const mediaContent = mediaUrl ? (
    <div
      style={{
        marginBottom: 4,
        borderRadius: 8,
        overflow: "hidden",
        maxWidth: 200,
      }}
    >
      {message.media_type === "audio" ? (
        <audio
          src={mediaUrl}
          controls
          style={{ width: "100%", minWidth: 180 }}
          preload="metadata"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : message.media_type?.startsWith("video") ? (
        <video
          src={mediaUrl}
          controls
          style={{
            width: "100%",
            maxHeight: 200,
            objectFit: "contain",
            background: T.surface4,
          }}
        />
      ) : (
        <img
          src={mediaUrl}
          alt="Shared media"
          style={{
            width: "100%",
            maxHeight: 200,
            objectFit: "contain",
            background: T.surface4,
          }}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  ) : null;

  // Bubble styling per direction
  const bubbleStyle: React.CSSProperties = isOutbound
    ? {
        background: VIOLET_BG,
        border: `1px solid ${VIOLET_BORDER}`,
        color: T.ink,
        borderRadius: 16,
        borderBottomRightRadius: 5,
        padding: "10px 14px",
        maxWidth: "72%",
        minWidth: 60,
      }
    : {
        background: T.surface4,
        color: T.ink,
        borderRadius: 16,
        borderBottomLeftRadius: 5,
        padding: "10px 14px",
        maxWidth: "72%",
        minWidth: 60,
      };

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        justifyContent: isOutbound ? "flex-end" : "flex-start",
        marginTop: isGrouped ? 2 : 8,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isOutbound ? "flex-end" : "flex-start",
          maxWidth: "72%",
        }}
      >
        {/* Sender username for inbound messages (non-grouped) */}
        {!isOutbound && !isGrouped && message.sender_username && (
          <p
            style={{
              font: `600 9px ${T.mono}`,
              color: T.mut2,
              marginBottom: 2,
              paddingLeft: 2,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            @{message.sender_username}
          </p>
        )}

        {/* Message bubble */}
        <div style={bubbleStyle}>
          {storyIndicator}
          {mediaContent}

          {/* Message text */}
          {message.message_text && (
            <p
              style={{
                font: `500 13.5px/1.5 ${T.data}`,
                color: T.ink,
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {message.message_text}
            </p>
          )}

          {/* Empty message placeholder */}
          {!message.message_text && !mediaUrl && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                font: `500 11px ${T.data}`,
                color: MUT3,
              }}
            >
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
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 2,
            paddingLeft: 4,
            paddingRight: 4,
            justifyContent: isOutbound ? "flex-end" : "flex-start",
          }}
        >
          {timestamp && (
            <span
              style={{
                font: `600 10px ${T.data}`,
                color: MUT3,
              }}
            >
              {format(timestamp, "h:mm a")}
            </span>
          )}
          {isOutbound && getStatusIcon()}
        </div>
      </div>
    </div>
  );
}

// Grouped messages helper — groups consecutive messages from same sender
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
