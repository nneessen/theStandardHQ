// src/features/messages/components/thread/ThreadView.tsx
// Email thread detail view — restyled to "Standard HQ board" design language.
// Visual restyle only: props, hooks, state logic, data flow, and exports are unchanged.

import { useState, useEffect } from "react";
import { useThread } from "../../hooks/useThread";
import { useThreads } from "../../hooks/useThreads";
import { ComposeDialog } from "../compose/ComposeDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  Star,
  Archive,
  Trash2,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Bot,
  Eye,
  MousePointer,
  Loader2,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isToday, isYesterday } from "date-fns";
import { getInitialsFromEmail } from "@/lib/string";
import { sanitizeHtml } from "@/features/email";
import { T } from "@/components/board/tokens";

// Scoped style block for sanitized HTML body descendants.
// Defined once as a module constant so it's not emitted per card.
const EMAIL_BODY_STYLES = `
.tv-email-body {
  font: 500 13.5px/1.72 "${T.data.replace(/"/g, "")}";
  color: ${T.ink};
}
.tv-email-body p { margin: 0 0 12px; }
.tv-email-body p:last-child { margin-bottom: 0; }
.tv-email-body a { color: ${T.blue}; text-decoration: none; }
.tv-email-body a:hover { text-decoration: underline; }
.tv-email-body b, .tv-email-body strong { color: ${T.cream}; }
.tv-email-body blockquote {
  border-left: 2px solid ${T.line2};
  margin: 10px 0;
  padding: 4px 0 4px 12px;
  color: ${T.mut};
  font-style: italic;
}
.tv-email-body code {
  background: ${T.surface4};
  color: ${T.ink};
  font-size: 11.5px;
  padding: 1px 5px;
  border-radius: 5px;
}
.tv-email-body pre {
  background: ${T.surface4};
  color: ${T.ink};
  font-size: 11.5px;
  padding: 10px 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}
.tv-email-body ul, .tv-email-body ol { margin: 8px 0; padding-left: 20px; }
.tv-email-body li { margin: 3px 0; }
.tv-email-body img { max-width: 100%; height: auto; }
.tv-email-body .sig { color: ${T.mut2}; font-size: 12.5px; }
.tv-iconbtn:hover { color: ${T.ink} !important; border-color: rgba(255,255,255,0.28) !important; }
.tv-iconbtn.amber:hover { color: ${T.amber} !important; }
.tv-ghostbtn:hover { color: ${T.ink} !important; background: rgba(255,255,255,0.05) !important; }
.tv-msgcard-toggle:hover { background: rgba(255,255,255,0.03) !important; }
.tv-loadmore:hover { color: ${T.ink} !important; background: rgba(255,255,255,0.04) !important; }
`;

interface ThreadViewProps {
  threadId: string;
  onClose: () => void;
}

const EXPANDED_MESSAGE_COUNT = 5;

export function ThreadView({ threadId, onClose }: ThreadViewProps) {
  const {
    thread,
    messages,
    totalMessages,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMoreMessages,
    markAsRead: _markAsRead,
  } = useThread(threadId);
  const {
    toggleStar,
    archive,
    unarchive,
    deleteThread,
    isStarring,
    isArchiving,
    isUnarchiving,
    isDeleting,
  } = useThreads();

  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    setManualExpanded(new Set());
    setManualCollapsed(new Set());
  }, [threadId]);

  const [composeState, setComposeState] = useState<{
    open: boolean;
    replyTo?: {
      threadId: string;
      messageId: string;
      to: string;
      subject: string;
    };
    forward?: { subject: string; body: string };
  }>({ open: false });

  const handleReply = () => {
    if (!thread || !messages?.length) return;
    const lastMessage = messages[messages.length - 1];
    setComposeState({
      open: true,
      replyTo: {
        threadId: thread.id,
        messageId: lastMessage.id,
        to: lastMessage.fromAddress,
        subject: thread.subject,
      },
    });
  };

  const handleForward = () => {
    if (!thread || !messages?.length) return;
    const lastMessage = messages[messages.length - 1];
    setComposeState({
      open: true,
      forward: {
        subject: thread.subject,
        body: lastMessage.bodyText || "",
      },
    });
  };

  const handleToggleStar = () => {
    if (!thread) return;
    toggleStar(thread.id, !thread.isStarred);
  };

  const handleArchiveToggle = () => {
    if (!thread) return;
    if (thread.isArchived) {
      unarchive(thread.id);
    } else {
      archive(thread.id);
      onClose();
    }
  };

  const handleDelete = () => {
    if (!thread) return;
    deleteThread(thread.id);
    onClose();
  };

  if (isLoading) {
    return <ThreadViewSkeleton />;
  }

  if (error || !thread) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          background: T.surface2,
          borderRadius: 13,
          border: `1px solid ${T.line}`,
        }}
      >
        <p
          style={{
            font: `600 12px ${T.data}`,
            color: T.mut,
            margin: 0,
          }}
        >
          Failed to load conversation
        </p>
        <p
          style={{
            font: `500 11px ${T.data}`,
            color: T.mut2,
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          {error?.message || "Thread not found"}
        </p>
      </div>
    );
  }

  const toggleMessage = (messageId: string, currentlyExpanded: boolean) => {
    if (currentlyExpanded) {
      setManualCollapsed((prev) => new Set(prev).add(messageId));
      setManualExpanded((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    } else {
      setManualExpanded((prev) => new Set(prev).add(messageId));
      setManualCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  const getIsExpanded = (messageId: string, index: number): boolean => {
    if (manualExpanded.has(messageId)) return true;
    if (manualCollapsed.has(messageId)) return false;
    const messagesFromEnd = messages.length - 1 - index;
    return messagesFromEnd < EXPANDED_MESSAGE_COUNT;
  };

  const collapsedCount =
    messages.length > EXPANDED_MESSAGE_COUNT
      ? messages.length - EXPANDED_MESSAGE_COUNT
      : 0;

  // Icon button: 32×32, T.surface3 bg, T.line2 border, T.mut icon → T.ink on hover
  const iconBtnBase: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: T.surface3,
    border: `1px solid ${T.line2}`,
    color: T.mut,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    transition: "color .12s, border-color .12s",
  };

  return (
    <>
      <style>{EMAIL_BODY_STYLES}</style>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: T.surface2,
          borderRadius: 13,
          border: `1px solid ${T.line}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            borderBottom: `1px solid ${T.line}`,
            padding: "16px 22px",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Eyebrow */}
            <div
              style={{
                font: `700 10px ${T.mono}`,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: T.mut2,
                marginBottom: 6,
              }}
            >
              Email thread &middot; {totalMessages} message
              {totalMessages !== 1 ? "s" : ""}
            </div>
            {/* Subject */}
            <h2
              style={{
                font: `800 18px ${T.disp}`,
                color: T.ink,
                margin: 0,
                lineHeight: 1.18,
              }}
            >
              {thread.subject}
            </h2>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {/* Star */}
            <button
              className="tv-iconbtn amber"
              style={{
                ...iconBtnBase,
                color: thread.isStarred ? T.amber : T.mut,
                opacity: isStarring ? 0.5 : 1,
                cursor: isStarring ? "not-allowed" : "pointer",
              }}
              onClick={handleToggleStar}
              disabled={isStarring}
              title={thread.isStarred ? "Unstar" : "Star"}
            >
              <Star
                size={15}
                fill={thread.isStarred ? T.amber : "none"}
                strokeWidth={2}
              />
            </button>

            {/* Archive */}
            <button
              className="tv-iconbtn"
              style={{
                ...iconBtnBase,
                color: thread.isArchived ? T.ink : T.mut,
                background: thread.isArchived ? T.surface4 : T.surface3,
                opacity: isArchiving || isUnarchiving ? 0.5 : 1,
                cursor:
                  isArchiving || isUnarchiving ? "not-allowed" : "pointer",
              }}
              onClick={handleArchiveToggle}
              disabled={isArchiving || isUnarchiving}
              title={thread.isArchived ? "Unarchive" : "Archive"}
            >
              <Archive size={15} strokeWidth={2} />
            </button>

            {/* More dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="tv-iconbtn"
                  style={iconBtnBase}
                  title="More actions"
                >
                  <MoreVertical size={15} strokeWidth={2} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                style={{
                  background: T.surface5,
                  border: `1px solid ${T.line2}`,
                  borderRadius: 10,
                  padding: "4px",
                  minWidth: 148,
                }}
              >
                <DropdownMenuItem
                  style={{
                    font: `600 12.5px ${T.data}`,
                    color: T.ink,
                    borderRadius: 7,
                    padding: "7px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onClick={handleReply}
                >
                  <Reply size={13} strokeWidth={2} /> Reply
                </DropdownMenuItem>
                <DropdownMenuItem
                  style={{
                    font: `600 12.5px ${T.data}`,
                    color: T.ink,
                    borderRadius: 7,
                    padding: "7px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onClick={handleForward}
                >
                  <Forward size={13} strokeWidth={2} /> Forward
                </DropdownMenuItem>
                <DropdownMenuSeparator
                  style={{ background: T.line, margin: "4px 0" }}
                />
                <DropdownMenuItem
                  style={{
                    font: `600 12.5px ${T.data}`,
                    color: T.red,
                    borderRadius: 7,
                    padding: "7px 10px",
                    cursor: isDeleting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 size={13} strokeWidth={2} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close */}
            <button
              className="tv-iconbtn"
              style={iconBtnBase}
              onClick={onClose}
              title="Close"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div
            style={{
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Load More */}
            {hasMore && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingBottom: 4,
                }}
              >
                <button
                  className="tv-loadmore"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: "transparent",
                    border: `1px solid ${T.line2}`,
                    color: T.mut,
                    font: `700 11px ${T.mono}`,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    cursor: isLoadingMore ? "not-allowed" : "pointer",
                    opacity: isLoadingMore ? 0.6 : 1,
                    transition: "color .12s, background .12s",
                  }}
                  onClick={loadMoreMessages}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <ChevronUp size={12} strokeWidth={2.5} />
                      Load earlier messages
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Collapsed indicator */}
            {collapsedCount > 0 && !hasMore && (
              <div
                style={{
                  textAlign: "center",
                  font: `600 11px ${T.mono}`,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: T.mut2,
                  padding: "4px 0",
                }}
              >
                &#9662; {collapsedCount} earlier message
                {collapsedCount !== 1 ? "s" : ""} collapsed
              </div>
            )}

            {messages?.map((message, index) => {
              const isExpanded = getIsExpanded(message.id, index);
              const isLast = index === messages.length - 1;

              return (
                <MessageCard
                  key={message.id}
                  message={message}
                  isExpanded={isExpanded}
                  isLast={isLast}
                  onToggle={() => toggleMessage(message.id, isExpanded)}
                />
              );
            })}
          </div>
        </ScrollArea>

        {/* Quick Reply Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${T.line}`,
            padding: "14px 22px",
            background: T.surface2,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* Primary reply button — solid CTA, theme-aware via btn-solid-bg/fg */}
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 34,
              padding: "0 14px",
              borderRadius: 9,
              background: "var(--btn-solid-bg)",
              border: "none",
              color: "var(--btn-solid-fg)",
              font: `700 12.5px ${T.data}`,
              cursor: "pointer",
            }}
            onClick={handleReply}
          >
            <Reply size={13} strokeWidth={2.2} />
            Reply
          </button>

          {/* Ghost: Reply All */}
          <button
            className="tv-ghostbtn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 34,
              padding: "0 14px",
              borderRadius: 9,
              background: "transparent",
              border: `1px solid ${T.line2}`,
              color: T.mut,
              font: `700 12.5px ${T.data}`,
              cursor: "pointer",
              transition: "color .12s, background .12s",
            }}
            onClick={handleReply}
          >
            <ReplyAll size={13} strokeWidth={2.2} />
            Reply all
          </button>

          {/* Ghost: Forward */}
          <button
            className="tv-ghostbtn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 34,
              padding: "0 14px",
              borderRadius: 9,
              background: "transparent",
              border: `1px solid ${T.line2}`,
              color: T.mut,
              font: `700 12.5px ${T.data}`,
              cursor: "pointer",
              transition: "color .12s, background .12s",
            }}
            onClick={handleForward}
          >
            <Forward size={13} strokeWidth={2.2} />
            Forward
          </button>
        </div>

        {/* Compose Dialog — unchanged */}
        <ComposeDialog
          open={composeState.open}
          onOpenChange={(open) => setComposeState({ ...composeState, open })}
          replyTo={composeState.replyTo}
          forward={composeState.forward}
        />
      </div>
    </>
  );
}

interface MessageCardProps {
  message: {
    id: string;
    senderId?: string;
    senderName?: string;
    fromAddress: string;
    toAddresses: string[];
    ccAddresses?: string[];
    subject: string;
    bodyHtml: string;
    bodyText: string;
    createdAt: string;
    isIncoming: boolean;
    hasAttachments: boolean;
    attachments?: { name: string; size: number }[];
    source?: string;
    openCount?: number;
    clickCount?: number;
  };
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
}

function MessageCard({
  message,
  isExpanded,
  isLast: _isLast,
  onToggle,
}: MessageCardProps) {
  const isAutomated = message.source === "workflow";
  const isSent = !message.isIncoming;

  const displayName = isSent
    ? "Me"
    : message.senderName || formatEmailAddress(message.fromAddress);
  const initials = isSent
    ? "ME"
    : message.senderName
      ? message.senderName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : getInitialsFromEmail(message.fromAddress);

  // Sent/you messages: blue tint bg + blue border
  const cardBg = isSent ? "rgba(91,155,255,0.06)" : T.surface3;
  const cardBorder = isSent ? "rgba(91,155,255,0.22)" : T.line;

  // Avatar: "me" = blue16 bg + blueLit text; "them" = T.surface5 bg + ink text
  const avBg = isSent ? "rgba(91,155,255,0.16)" : T.surface5;
  const avColor = isSent ? T.blueLit : T.ink;
  const avShadow = isSent ? "inset 0 0 0 1px rgba(91,155,255,0.30)" : "none";

  return (
    <div
      style={{
        borderRadius: 13,
        overflow: "hidden",
        border: `1px solid ${cardBorder}`,
        background: cardBg,
      }}
    >
      {/* Card header / toggle row */}
      <button
        className="tv-msgcard-toggle"
        style={{
          width: "100%",
          textAlign: "left",
          padding: "13px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 11,
          borderBottom: isExpanded ? `1px solid ${T.line}` : "none",
          transition: "background .1s",
        }}
        onClick={onToggle}
      >
        {/* Avatar — 30×30 rounded-9 tile with initials */}
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: `800 11px ${T.disp}`,
            background: avBg,
            color: avColor,
            boxShadow: avShadow,
          }}
        >
          {initials}
        </span>

        {/* Name + badges */}
        <span
          style={{
            font: `700 13.5px ${T.data}`,
            color: T.ink,
            flexShrink: 0,
            maxWidth: "40%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </span>

        {/* Sent badge */}
        {isSent && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 18,
              padding: "0 6px",
              borderRadius: 6,
              font: `700 9.5px ${T.data}`,
              background: "rgba(91,155,255,0.16)",
              color: T.blueLit,
              flexShrink: 0,
            }}
          >
            <Send size={10} strokeWidth={2} />
            Sent
          </span>
        )}

        {/* Auto badge */}
        {isAutomated && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 18,
              padding: "0 6px",
              borderRadius: 6,
              font: `700 9.5px ${T.data}`,
              background: T.surface4,
              color: T.mut,
              border: `1px solid ${T.line2}`,
              flexShrink: 0,
            }}
          >
            <Bot size={10} strokeWidth={2} />
            Auto
          </span>
        )}

        {/* Preview when collapsed */}
        {!isExpanded && (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              font: `500 12.5px ${T.data}`,
              color: T.mut,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {message.bodyText?.slice(0, 80)}…
          </span>
        )}

        <span style={{ flex: 1 }} />

        {/* Open / click receipts */}
        {isSent && (message.openCount || 0) > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              font: `600 11px ${T.data}`,
              color: T.mut2,
              flexShrink: 0,
            }}
            title="Opens"
          >
            <Eye size={12} strokeWidth={2} />
            {message.openCount}
          </span>
        )}
        {isSent && (message.clickCount || 0) > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              font: `600 11px ${T.data}`,
              color: T.mut2,
              flexShrink: 0,
            }}
            title="Clicks"
          >
            <MousePointer size={11} strokeWidth={2} />
            {message.clickCount}
          </span>
        )}

        {/* Timestamp */}
        <span
          style={{
            font: `600 11.5px ${T.data}`,
            color: T.mut2,
            flexShrink: 0,
          }}
        >
          {formatMessageDate(message.createdAt)}
        </span>

        {/* Chevron */}
        {isExpanded ? (
          <ChevronUp size={15} style={{ color: T.mut2, flexShrink: 0 }} />
        ) : (
          <ChevronDown size={15} style={{ color: T.mut2, flexShrink: 0 }} />
        )}
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div>
          {/* From / To / CC / Date meta block */}
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(255,255,255,0.02)",
              borderBottom: `1px solid ${T.line}`,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {[
              { label: "From", value: message.fromAddress },
              { label: "To", value: message.toAddresses?.join(", ") },
              ...(message.ccAddresses && message.ccAddresses.length > 0
                ? [{ label: "CC", value: message.ccAddresses.join(", ") }]
                : []),
              {
                label: "Date",
                value: format(new Date(message.createdAt), "PPpp"),
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  gap: 8,
                  font: `500 11px ${T.data}`,
                  color: T.mut2,
                }}
              >
                <span
                  style={{
                    font: `700 11px ${T.mono}`,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: T.mut2,
                    minWidth: 38,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Email body (sanitized HTML) */}
          <div
            className="tv-email-body"
            style={{ padding: "16px" }}
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(
                message.bodyHtml || formatPlainText(message.bodyText) || "",
              ),
            }}
          />

          {/* Attachments */}
          {message.hasAttachments &&
            message.attachments &&
            message.attachments.length > 0 && (
              <div
                style={{
                  padding: "0 16px 16px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {message.attachments.map((att, i) => (
                  <button
                    key={i}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "9px 12px",
                      borderRadius: 10,
                      background: T.surface4,
                      border: `1px solid ${T.line2}`,
                      color: T.ink,
                      font: `600 12px ${T.data}`,
                      cursor: "pointer",
                    }}
                  >
                    <Paperclip size={14} strokeWidth={2} />
                    <span
                      style={{
                        maxWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {att.name}
                    </span>
                    <span style={{ color: T.mut2, fontWeight: 500 }}>
                      {formatFileSize(att.size)}
                    </span>
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function ThreadViewSkeleton() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: T.surface2,
        borderRadius: 13,
        border: `1px solid ${T.line}`,
      }}
    >
      {/* Skeleton header */}
      <div
        style={{
          padding: "16px 22px",
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <Skeleton
          style={{
            height: 10,
            width: 120,
            marginBottom: 8,
            background: T.surface4,
            borderRadius: 6,
          }}
        />
        <Skeleton
          style={{
            height: 16,
            width: 240,
            background: T.surface4,
            borderRadius: 6,
          }}
        />
      </div>
      {/* Skeleton cards */}
      <div
        style={{
          flex: 1,
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${T.line}`,
              borderRadius: 13,
              padding: "13px 16px",
              background: T.surface3,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                marginBottom: 10,
              }}
            >
              <Skeleton
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: T.surface4,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <Skeleton
                  style={{
                    height: 12,
                    width: 100,
                    marginBottom: 6,
                    background: T.surface4,
                    borderRadius: 5,
                  }}
                />
                <Skeleton
                  style={{
                    height: 10,
                    width: 160,
                    background: T.surface4,
                    borderRadius: 5,
                  }}
                />
              </div>
              <Skeleton
                style={{
                  height: 10,
                  width: 50,
                  background: T.surface4,
                  borderRadius: 5,
                }}
              />
            </div>
            <Skeleton
              style={{
                height: 10,
                width: "100%",
                marginBottom: 6,
                background: T.surface4,
                borderRadius: 5,
              }}
            />
            <Skeleton
              style={{
                height: 10,
                width: "72%",
                background: T.surface4,
                borderRadius: 5,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions — unchanged
function formatEmailAddress(email: string): string {
  const namePart = email.split("@")[0];
  const parts = namePart.split(/[._-]/);
  if (parts.length >= 2) {
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, "h:mm a")}`;
  }
  return format(date, "MMM d");
}

function formatPlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
