// src/features/messages/components/instagram/InstagramConversationView.tsx
// Displays Instagram conversation messages and message composer

import { useRef, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import {
  AlertCircle,
  User,
  Instagram,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
      className={cn(
        "flex w-full mt-2",
        isOutbound ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn("max-w-[75%]", isOutbound ? "items-end" : "items-start")}
      >
        <Skeleton
          className={cn(
            "rounded-2xl",
            isOutbound ? "h-8 w-40 rounded-br-md" : "h-8 w-48 rounded-bl-md",
          )}
        />
        <Skeleton className="h-2 w-12 mt-1 mx-1" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for conversation view
 */
function ConversationViewSkeleton(): ReactNode {
  return (
    <div className="h-full flex flex-col bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-v2-ring">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-16" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 overflow-auto p-3">
        <MessageSkeleton isOutbound={false} />
        <MessageSkeleton isOutbound={true} />
        <MessageSkeleton isOutbound={false} />
        <MessageSkeleton isOutbound={false} />
        <MessageSkeleton isOutbound={true} />
      </div>

      {/* Input skeleton */}
      <div className="p-2 border-t border-v2-ring">
        <Skeleton className="h-10 w-full rounded-lg" />
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
}

export function InstagramConversationView({
  conversation: initialConversation,
  integrationId: _integrationId,
  isTokenExpired = false,
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

  // Use the passed conversation directly - no need to re-fetch
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
            // Log but don't block UI - sync failure shouldn't prevent viewing cached messages
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

  // Loading state - only block on messages query (conversation is passed from parent)
  if (isLoadingMessages && messages.length === 0) {
    return <ConversationViewSkeleton />;
  }

  // Error state
  if (messagesError) {
    const error = messagesError;
    return (
      <div className="h-full flex items-center justify-center bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
        <div className="text-center max-w-sm px-4">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
          <p className="text-[11px] text-v2-ink-muted mb-2">
            Failed to load conversation
          </p>
          <p className="text-[10px] text-v2-ink-subtle mb-4">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn("h-3 w-3 mr-1.5", isSyncing && "animate-spin")}
            />
            Try Again
          </Button>
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
    <div className="h-full flex flex-col bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft overflow-hidden">
      {/* Conversation header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-v2-ring">
        {/* Avatar */}
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={conversation.participant_profile_picture_url || undefined}
            alt={displayName}
          />
          <AvatarFallback className="text-[10px] bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Name and username */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-v2-ink truncate">
              {conversation.participant_username
                ? `@${conversation.participant_username}`
                : displayName}
            </span>
            {conversation.hasLinkedLead && (
              <div className="flex-shrink-0 flex items-center gap-0.5 px-1 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 rounded text-[9px] text-emerald-700 dark:text-emerald-400">
                <User className="h-2.5 w-2.5" />
                Lead
              </div>
            )}
          </div>
          {conversation.participant_name &&
            conversation.participant_username && (
              <p className="text-[10px] text-v2-ink-muted truncate">
                {conversation.participant_name}
              </p>
            )}
        </div>

        {/* Window indicator */}
        <InstagramWindowIndicator
          canReplyUntil={conversation.can_reply_until}
          variant="badge"
        />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <InstagramPriorityBadge
            isPriority={conversation.is_priority}
            prioritySetAt={conversation.priority_set_at}
            priorityNotes={conversation.priority_notes}
            onClick={handleTogglePriority}
            disabled={setPriority.isPending}
            variant="button"
          />
          {!conversation.hasLinkedLead && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => setShowCreateLeadDialog(true)}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Create Lead
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Contact info panel (collapsible) */}
      <InstagramContactInfoPanel conversation={conversation} />

      {/* Messages area */}
      <div className="flex-1 overflow-auto p-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Instagram className="h-8 w-8 text-v2-ink-subtle mb-2" />
            <p className="text-[11px] text-v2-ink-muted">No messages yet</p>
            <p className="text-[10px] text-v2-ink-subtle mt-1">
              Start the conversation by sending a message
            </p>
          </div>
        ) : (
          <>
            {messagesByDate.map(({ date, messages: dayMessages }) => (
              <div key={date.toISOString()}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-3">
                  <div className="flex-1 h-px bg-v2-ring" />
                  <span className="px-2 text-[9px] text-v2-ink-subtle">
                    {format(date, "MMMM d, yyyy")}
                  </span>
                  <div className="flex-1 h-px bg-v2-ring" />
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
      <div className="p-2 border-t border-v2-ring">
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
