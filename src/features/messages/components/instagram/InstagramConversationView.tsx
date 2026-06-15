// src/features/messages/components/instagram/InstagramConversationView.tsx
// Displays Instagram conversation messages and message composer
// Board token restyle — Standard HQ design language

import { useRef, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import {
  AlertCircle,
  User,
  Instagram,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { T } from "@/components/board/tokens";
import {
  useInstagramMessages,
  useSetInstagramPriority,
  useSendInstagramMessage,
  useSyncInstagramMessages,
} from "@/hooks/instagram";
import {
  instagramKeys,
  type InstagramConversation,
} from "@/types/instagram.types";
import { InstagramMessageBubble } from "./InstagramMessageBubble";
import { InstagramMessageInput } from "./InstagramMessageInput";
import { InstagramWindowIndicator } from "./InstagramWindowIndicator";
import { InstagramPriorityBadge } from "./InstagramPriorityBadge";
import { InstagramContactInfoPanel } from "./InstagramContactInfoPanel";
import { CreateLeadFromIGDialog } from "./CreateLeadFromIGDialog";
import { InstagramScheduleDialog } from "./InstagramScheduleDialog";

// Alpha tints — T has solid colors only
const GREEN_BG = "rgba(95,208,138,0.20)";
// mut3 literal — does not exist in T
const MUT3 = "rgba(255,255,255,0.28)";

// Reusable board icon-button — mirrors .iconbtn from mock
function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 9,
        background: T.surface3,
        border: `1px solid ${hover ? T.line2 : T.line2}`,
        color: hover ? T.ink : T.mut,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "color .12s, border-color .12s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// Skeleton block helper
function SkeletonBlock({
  w,
  h,
  rounded,
}: {
  w?: number | string;
  h: number;
  rounded?: number;
}) {
  return (
    <div
      style={{
        width: w ?? "100%",
        height: h,
        borderRadius: rounded ?? 6,
        background: "rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Skeleton loader for message bubbles
 */
function MessageSkeleton({
  isOutbound = false,
}: {
  isOutbound?: boolean;
}): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        justifyContent: isOutbound ? "flex-end" : "flex-start",
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isOutbound ? "flex-end" : "flex-start",
          gap: 4,
          maxWidth: "72%",
        }}
      >
        <SkeletonBlock w={isOutbound ? 160 : 192} h={32} rounded={16} />
        <SkeletonBlock w={48} h={8} rounded={4} />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for conversation view — preserves outer card contract
 */
function ConversationViewSkeleton(): ReactNode {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: T.surface3,
        borderRadius: 12,
        border: `1px solid ${T.line}`,
        overflow: "hidden",
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderBottom: `1px solid ${T.line}`,
          flexShrink: 0,
        }}
      >
        <SkeletonBlock w={32} h={32} rounded={99} />
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <SkeletonBlock w={96} h={12} />
          <SkeletonBlock w={64} h={8} />
        </div>
        <SkeletonBlock w={64} h={20} rounded={99} />
      </div>

      {/* Messages skeleton */}
      <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
        <MessageSkeleton isOutbound={false} />
        <MessageSkeleton isOutbound={true} />
        <MessageSkeleton isOutbound={false} />
        <MessageSkeleton isOutbound={false} />
        <MessageSkeleton isOutbound={true} />
      </div>

      {/* Input skeleton */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: `1px solid ${T.line}`,
          flexShrink: 0,
        }}
      >
        <SkeletonBlock h={42} rounded={11} />
      </div>
    </div>
  );
}

interface InstagramConversationViewProps {
  /** Full conversation object from parent - avoids redundant fetch */
  conversation: InstagramConversation;
  integrationId: string;
  /** When true, disables message input (e.g., token expired) */
  isTokenExpired?: boolean;
  /** When provided, renders a close (X) board icon-button in the header */
  onClose?: () => void;
}

export function InstagramConversationView({
  conversation: initialConversation,
  integrationId: _integrationId,
  isTokenExpired = false,
  onClose,
}: InstagramConversationViewProps): ReactNode {
  const conversationId = initialConversation.id;
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const hasSyncedRef = useRef<string | null>(null);

  // Sync messages mutation
  const syncMessages = useSyncInstagramMessages();
  const isSyncing = syncMessages.isPending;

  // Use the passed conversation directly — no need to re-fetch
  const conversation = initialConversation;

  // Fetch messages from local DB
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useInstagramMessages(conversationId);

  const messages = messagesData?.messages || [];

  // Auto-sync messages when conversation changes (non-blocking)
  useEffect(() => {
    if (conversationId && hasSyncedRef.current !== conversationId) {
      hasSyncedRef.current = conversationId;
      syncMessages.mutate(
        { conversationId },
        {
          onError: (error) => {
            // Log but don't block UI — sync failure shouldn't prevent viewing cached messages
            console.warn("[InstagramConversationView] Sync failed:", error);
            toast.error("Failed to sync latest messages");
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Manual refresh handler
  const handleRefresh = () => {
    syncMessages.mutate({ conversationId });
  };

  // Send message using hook
  const sendMessage = useSendInstagramMessage();

  // Priority toggle
  const setPriority = useSetInstagramPriority();

  const handleTogglePriority = async () => {
    if (!conversation) return;

    try {
      await setPriority.mutateAsync({
        conversationId,
        isPriority: !conversation.is_priority,
      });
      toast.success(
        conversation.is_priority
          ? "Removed from priority"
          : "Added to priority",
      );
    } catch {
      toast.error("Failed to update priority");
    }
  };

  // Scroll to bottom when messages load or new message sent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSendMessage = (text: string) => {
    sendMessage.mutate(
      { conversationId, messageText: text },
      {
        onSuccess: () => {
          // Optionally show success toast
        },
        onError: (err) => {
          toast.error(
            `Failed to send: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
        },
      },
    );
  };

  // Loading state — only block on messages query (conversation is passed from parent)
  if (isLoadingMessages && messages.length === 0) {
    return <ConversationViewSkeleton />;
  }

  // Error state — preserves outer card contract
  if (messagesError) {
    const error = messagesError;
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: T.surface3,
          borderRadius: 12,
          border: `1px solid ${T.line}`,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 280, padding: "0 16px" }}>
          <AlertCircle
            style={{
              width: 32,
              height: 32,
              margin: "0 auto 8px",
              color: T.red,
            }}
          />
          <p
            style={{
              font: `600 12px ${T.data}`,
              color: T.mut,
              margin: "0 0 4px",
            }}
          >
            Failed to load conversation
          </p>
          <p
            style={{
              font: `500 11px ${T.data}`,
              color: T.mut2,
              margin: "0 0 14px",
            }}
          >
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isSyncing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 14px",
              borderRadius: 8,
              background: T.surface4,
              border: `1px solid ${T.line2}`,
              color: isSyncing ? T.mut2 : T.ink,
              font: `600 12px ${T.data}`,
              cursor: isSyncing ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw
              style={{ width: 13, height: 13 }}
              className={isSyncing ? "animate-spin" : undefined}
            />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // conversation is always defined (required prop from parent)
  const displayName =
    conversation.participant_name ||
    conversation.participant_username ||
    "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Group messages by date for date separators
  const messagesByDate: { date: Date; messages: typeof messages }[] = [];
  let currentDate: Date | null = null;
  let currentMessages: typeof messages = [];

  // Messages are in reverse chronological order, reverse for display
  const sortedMessages = [...messages].reverse();

  for (const message of sortedMessages) {
    // Handle null sent_at by using current date as fallback
    const messageDate = message.sent_at
      ? new Date(message.sent_at)
      : new Date();
    if (!currentDate || !isSameDay(currentDate, messageDate)) {
      if (currentMessages.length > 0) {
        messagesByDate.push({ date: currentDate!, messages: currentMessages });
      }
      currentDate = messageDate;
      currentMessages = [message];
    } else {
      currentMessages.push(message);
    }
  }
  if (currentMessages.length > 0 && currentDate) {
    messagesByDate.push({ date: currentDate, messages: currentMessages });
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: T.surface3,
        borderRadius: 12,
        border: `1px solid ${T.line}`,
        overflow: "hidden",
      }}
    >
      {/* Conversation header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderBottom: `1px solid ${T.line}`,
          background: `linear-gradient(180deg, ${T.surface4}, ${T.surface3})`,
          flexShrink: 0,
        }}
      >
        {/* Gradient avatar — Instagram brand gradient */}
        <div style={{ flexShrink: 0 }}>
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={conversation.participant_profile_picture_url || undefined}
              alt={displayName}
            />
            <AvatarFallback
              style={{
                background:
                  "linear-gradient(135deg, #8a3ab9, #e95950 55%, #fccc63)",
                color: "#fff",
                font: `800 11px ${T.disp}`,
                borderRadius: 99,
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name and username */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                font: `700 16px ${T.data}`,
                color: T.ink,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "60%",
              }}
            >
              {conversation.participant_username
                ? `@${conversation.participant_username}`
                : displayName}
            </span>
            {conversation.hasLinkedLead && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 20,
                  padding: "0 8px",
                  borderRadius: 7,
                  background: GREEN_BG,
                  color: T.green,
                  font: `700 10px ${T.data}`,
                  flexShrink: 0,
                }}
              >
                <User style={{ width: 10, height: 10 }} />
                Lead
              </div>
            )}
          </div>
          {conversation.participant_name &&
            conversation.participant_username && (
              <p
                style={{
                  font: `600 12px ${T.data}`,
                  color: T.mut,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conversation.participant_name}
              </p>
            )}
        </div>

        {/* Window indicator */}
        <InstagramWindowIndicator
          canReplyUntil={conversation.can_reply_until}
          variant="badge"
        />

        {/* Actions row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <InstagramPriorityBadge
            isPriority={conversation.is_priority}
            prioritySetAt={conversation.priority_set_at}
            priorityNotes={conversation.priority_notes}
            onClick={handleTogglePriority}
            disabled={setPriority.isPending}
            variant="button"
          />
          {!conversation.hasLinkedLead && (
            <button
              type="button"
              onClick={() => setShowCreateLeadDialog(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 30,
                padding: "0 11px",
                borderRadius: 8,
                background: "transparent",
                border: `1px solid ${T.line2}`,
                color: T.mut,
                font: `600 12px ${T.data}`,
                cursor: "pointer",
                transition: "color .12s, border-color .12s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = T.ink;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = T.mut;
              }}
            >
              <UserPlus style={{ width: 13, height: 13 }} />
              Create Lead
            </button>
          )}
          <IconButton
            onClick={handleRefresh}
            disabled={isSyncing}
            title="Refresh messages"
          >
            <RefreshCw
              style={{ width: 15, height: 15 }}
              className={isSyncing ? "animate-spin" : undefined}
            />
          </IconButton>
          {onClose && (
            <IconButton onClick={onClose} title="Close">
              <X style={{ width: 15, height: 15 }} />
            </IconButton>
          )}
        </div>
      </div>

      {/* Contact info panel (collapsible) */}
      <InstagramContactInfoPanel conversation={conversation} />

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
            }}
          >
            <Instagram
              style={{
                width: 32,
                height: 32,
                color: MUT3,
                marginBottom: 8,
              }}
            />
            <p
              style={{
                font: `600 12px ${T.data}`,
                color: T.mut,
                margin: "0 0 4px",
              }}
            >
              No messages yet
            </p>
            <p style={{ font: `500 11px ${T.data}`, color: T.mut2, margin: 0 }}>
              Start the conversation by sending a message
            </p>
          </div>
        ) : (
          <>
            {messagesByDate.map(({ date, messages: dayMessages }) => (
              <div key={date.toISOString()}>
                {/* Date separator — .datesep from mock */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    margin: "8px 0",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: T.line }} />
                  <span
                    style={{
                      font: `700 9.5px ${T.mono}`,
                      letterSpacing: "0.14em",
                      color: MUT3,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {format(date, "MMMM d, yyyy")}
                  </span>
                  <div style={{ flex: 1, height: 1, background: T.line }} />
                </div>

                {/* Messages for this date */}
                {dayMessages.map((message, index) => (
                  <InstagramMessageBubble
                    key={message.id}
                    message={message}
                    isGrouped={
                      index > 0 &&
                      dayMessages[index - 1].direction === message.direction
                    }
                  />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message composer */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: `1px solid ${T.line}`,
          flexShrink: 0,
        }}
      >
        <InstagramMessageInput
          canReplyUntil={conversation.can_reply_until}
          onSend={handleSendMessage}
          onScheduleClick={() => setShowScheduleDialog(true)}
          isSending={sendMessage.isPending}
          disabled={isTokenExpired}
          placeholder={`Message @${conversation.participant_username || displayName}`}
          conversation={conversation}
          recentMessages={sortedMessages.slice(-5)}
        />
      </div>

      {/* Create Lead Dialog */}
      <CreateLeadFromIGDialog
        open={showCreateLeadDialog}
        onOpenChange={setShowCreateLeadDialog}
        conversation={conversation}
      />

      {/* Schedule Message Dialog */}
      <InstagramScheduleDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        conversation={conversation}
        onScheduled={() => {
          // Refetch scheduled messages after scheduling
          queryClient.invalidateQueries({
            queryKey: instagramKeys.scheduled(conversationId),
          });
        }}
      />
    </div>
  );
}
