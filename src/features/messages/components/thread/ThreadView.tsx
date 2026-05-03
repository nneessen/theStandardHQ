// src/features/messages/components/thread/ThreadView.tsx
// Display a full email thread with zinc palette styling

import { useState, useEffect } from "react";
import { useThread } from "../../hooks/useThread";
import { useThreads } from "../../hooks/useThreads";
import { ComposeDialog } from "../compose/ComposeDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  ExternalLink,
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
import { cn } from "@/lib/utils";
import { getInitialsFromEmail } from "@/lib/string";
import { sanitizeHtml } from "@/features/email";

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
      <div className="h-full flex flex-col items-center justify-center p-4 bg-card rounded-v2-md border border-border shadow-v2-soft">
        <p className="text-[11px] text-muted-foreground">
          Failed to load conversation
        </p>
        <p className="text-[10px] mt-1 text-muted-foreground">
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card rounded-v2-md border border-border shadow-v2-soft">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground leading-tight truncate">
              {thread.subject}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {totalMessages} message{totalMessages !== 1 ? "s" : ""}
              </span>
              {thread.isStarred && (
                <Star className="h-3 w-3 text-warning fill-yellow-500" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-6 w-6 p-0",
                thread.isArchived
                  ? "bg-muted text-muted-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={handleArchiveToggle}
              disabled={isArchiving || isUnarchiving}
              title={thread.isArchived ? "Unarchive" : "Archive"}
            >
              <Archive className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-6 w-6 p-0",
                thread.isStarred
                  ? "text-warning hover:text-warning"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={handleToggleStar}
              disabled={isStarring}
              title={thread.isStarred ? "Unstar" : "Star"}
            >
              <Star
                className={cn("h-3 w-3", thread.isStarred && "fill-yellow-500")}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-[11px]" onClick={handleReply}>
                  <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px]"
                  onClick={handleForward}
                >
                  <Forward className="h-3.5 w-3.5 mr-2" /> Forward
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[11px] text-destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive dark:hover:text-destructive"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center py-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                onClick={loadMoreMessages}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Load earlier messages
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Collapsed messages indicator */}
          {collapsedCount > 0 && !hasMore && (
            <div className="flex items-center justify-center py-1.5">
              <span className="text-[10px] text-muted-foreground">
                {collapsedCount} earlier message
                {collapsedCount !== 1 ? "s" : ""} collapsed
              </span>
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
      <div className="flex-shrink-0 border-t border-border p-1.5">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            className="h-6 text-[10px] gap-1 px-2"
            onClick={handleReply}
          >
            <Reply className="h-3 w-3" />
            Reply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1 px-2 text-muted-foreground dark:text-muted-foreground hover:text-foreground"
            onClick={handleReply}
          >
            <ReplyAll className="h-3 w-3" />
            Reply All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1 px-2 text-muted-foreground dark:text-muted-foreground hover:text-foreground"
            onClick={handleForward}
          >
            <Forward className="h-3 w-3" />
            Forward
          </Button>
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeDialog
        open={composeState.open}
        onOpenChange={(open) => setComposeState({ ...composeState, open })}
        replyTo={composeState.replyTo}
        forward={composeState.forward}
      />
    </div>
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

  return (
    <div
      className={cn(
        "rounded-md overflow-hidden transition-all",
        isSent
          ? "bg-info/10/50 dark:bg-info/10 border border-info/30/50 dark:border-info/30"
          : "bg-background border border-border",
      )}
    >
      {/* Header */}
      <button
        className={cn(
          "w-full text-left px-2.5 py-1.5 transition-colors",
          isExpanded ? "border-b border-border/50 /50" : "",
          "hover:bg-muted/50 dark:hover:bg-card-dark/30",
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Avatar
            className={cn(
              "h-6 w-6 flex-shrink-0",
              isSent ? "ring-1 ring-info/40 dark:ring-info" : "",
            )}
          >
            <AvatarFallback
              className={cn(
                "text-[9px] font-medium",
                isSent
                  ? "bg-info/20 dark:bg-info/50 text-info"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-foreground truncate">
                {displayName}
              </span>
              {isSent && (
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[9px] border-info/40 text-info"
                >
                  <Send className="h-2.5 w-2.5 mr-0.5" />
                  Sent
                </Badge>
              )}
              {isAutomated && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] bg-muted"
                >
                  <Bot className="h-2.5 w-2.5 mr-0.5" />
                  Auto
                </Badge>
              )}
            </div>
            {!isExpanded && (
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                {message.bodyText?.slice(0, 80)}...
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isSent && (message.openCount || 0) > 0 && (
              <span
                className="text-[9px] text-muted-foreground flex items-center gap-0.5"
                title="Opens"
              >
                <Eye className="h-3 w-3" />
                {message.openCount}
              </span>
            )}
            {isSent && (message.clickCount || 0) > 0 && (
              <span
                className="text-[9px] text-muted-foreground flex items-center gap-0.5"
                title="Clicks"
              >
                <MousePointer className="h-3 w-3" />
                {message.clickCount}
              </span>
            )}

            <span className="text-[10px] text-muted-foreground">
              {formatMessageDate(message.createdAt)}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Body */}
      {isExpanded && (
        <div>
          {/* Email metadata */}
          <div className="px-2.5 py-1.5 bg-muted/50 dark:bg-muted/30 text-[10px] text-muted-foreground dark:text-muted-foreground space-y-0.5">
            <div className="flex items-start gap-1">
              <span className="font-medium w-8">From:</span>
              <span className="truncate">{message.fromAddress}</span>
            </div>
            <div className="flex items-start gap-1">
              <span className="font-medium w-8">To:</span>
              <span className="truncate">
                {message.toAddresses?.join(", ")}
              </span>
            </div>
            {message.ccAddresses && message.ccAddresses.length > 0 && (
              <div className="flex items-start gap-1">
                <span className="font-medium w-8">CC:</span>
                <span className="truncate">
                  {message.ccAddresses.join(", ")}
                </span>
              </div>
            )}
            <div className="flex items-start gap-1">
              <span className="font-medium w-8">Date:</span>
              <span>{format(new Date(message.createdAt), "PPpp")}</span>
            </div>
          </div>

          {/* Email body */}
          <div
            className={cn(
              "px-3 py-2 text-[11px] leading-relaxed text-muted-foreground",
              "prose prose-sm max-w-none",
              "prose-p:my-1.5 prose-p:leading-relaxed",
              "prose-headings:my-2 prose-headings:font-semibold",
              "prose-ul:my-1.5 prose-ol:my-1.5",
              "prose-li:my-0.5",
              "prose-a:text-info dark:prose-a:text-info prose-a:no-underline hover:prose-a:underline",
              "prose-blockquote:border-l-2 prose-blockquote:border-border  prose-blockquote:pl-2.5 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-blockquote:dark:text-muted-foreground",
              "prose-pre:bg-muted dark:prose-pre:bg-muted prose-pre:text-[10px]",
              "prose-code:text-[10px] prose-code:bg-muted dark:prose-code:bg-muted prose-code:px-1 prose-code:rounded",
              "dark:prose-invert",
            )}
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
              <div className="px-2.5 py-1.5 border-t border-border/50 /50 bg-background/50 dark:bg-muted/30">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                  <Paperclip className="h-3 w-3" />
                  <span>
                    {message.attachments.length} attachment
                    {message.attachments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {message.attachments.map((att, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant="ghost"
                      className="h-5 text-[9px] gap-0.5 px-1.5 bg-muted text-muted-foreground dark:text-muted-foreground hover:text-foreground"
                    >
                      <Paperclip className="h-2.5 w-2.5" />
                      <span className="max-w-[100px] truncate">{att.name}</span>
                      <span className="text-muted-foreground">
                        ({formatFileSize(att.size)})
                      </span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function ThreadViewSkeleton() {
  return (
    <div className="h-full flex flex-col bg-card rounded-v2-md border border-border shadow-v2-soft">
      <div className="p-3 border-b border-border">
        <Skeleton className="h-4 w-48 mb-1.5 bg-muted" />
        <Skeleton className="h-3 w-24 bg-muted" />
      </div>
      <div className="flex-1 p-2 space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border border-border rounded-md p-2.5 bg-background"
          >
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-6 w-6 rounded-full bg-muted" />
              <div className="flex-1">
                <Skeleton className="h-3 w-28 mb-1 bg-muted" />
                <Skeleton className="h-2 w-40 bg-muted" />
              </div>
              <Skeleton className="h-3 w-16 bg-muted" />
            </div>
            <Skeleton className="h-3 w-full mb-1.5 bg-muted" />
            <Skeleton className="h-3 w-3/4 bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions
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
