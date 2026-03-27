// src/features/chat-bot/components/ConversationThread.tsx
// Message thread dialog for a single conversation

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Bot,
  User,
  RefreshCw,
  Phone,
  PhoneCall,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useChatBotMessages,
  useSyncMessagesToClose,
  type ChatBotConversation,
} from "../hooks/useChatBot";

interface ConversationThreadProps {
  conversation: ChatBotConversation | null;
  open: boolean;
  onClose: () => void;
}

export function ConversationThread({
  conversation,
  open,
  onClose,
}: ConversationThreadProps) {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: messagesData, isLoading } = useChatBotMessages(
    conversation?.id || null,
    page,
    limit,
  );

  // Auto-sync bot messages → Close when conversation opens
  const sync = useSyncMessagesToClose(conversation?.id || null);
  const syncedConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      open &&
      conversation?.id &&
      conversation.closeLeadId &&
      syncedConvRef.current !== conversation.id
    ) {
      syncedConvRef.current = conversation.id;
      sync.mutate();
    }
    if (!open) {
      syncedConvRef.current = null;
    }
  }, [open, conversation?.id, conversation?.closeLeadId]);

  // Filter out email messages — this is an SMS/voice conversation viewer
  const allMessages = messagesData?.data || [];
  const messages = allMessages.filter((m) => m.channel !== "email");
  const total = messagesData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Auto-scroll to bottom (newest messages) when messages load or dialog opens
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages.length, isLoading, open]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="px-3 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-zinc-400" />
            {conversation?.leadName ??
              conversation?.leadPhone ??
              "Unknown Lead"}
          </DialogTitle>
          {conversation && (
            <div className="flex items-center gap-2 mt-1">
              {conversation.localPhone && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {conversation.localPhone}
                </span>
              )}
              {conversation.channel && conversation.channel !== "email" && (
                <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                  {conversation.channel === "sms" && (
                    <Phone className="h-2.5 w-2.5" />
                  )}
                  {conversation.channel === "voice" && (
                    <PhoneCall className="h-2.5 w-2.5" />
                  )}
                  <span className="uppercase">{conversation.channel}</span>
                </span>
              )}
              <Badge
                className={cn(
                  "text-[9px] h-3.5 px-1",
                  conversation.status === "open" ||
                    conversation.status === "awaiting_reply"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    : conversation.status === "scheduling" ||
                        conversation.status === "scheduled"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {conversation.status}
              </Badge>
              {sync.isPending && (
                <span className="text-[9px] text-zinc-400 flex items-center gap-0.5">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  Syncing to Close…
                </span>
              )}
              {sync.isSuccess && sync.data && sync.data.synced > 0 && (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400">
                  {sync.data.synced} synced to Close
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                No messages yet
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-1.5",
                    msg.direction === "outbound"
                      ? "justify-end"
                      : "justify-start",
                  )}
                >
                  {msg.direction === "inbound" && (
                    <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-2.5 py-1.5",
                      msg.direction === "outbound"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100",
                    )}
                  >
                    <p className="text-[11px] whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    <div
                      className={cn(
                        "flex items-center gap-1 mt-0.5",
                        msg.direction === "outbound"
                          ? "text-blue-200"
                          : "text-zinc-400 dark:text-zinc-500",
                      )}
                    >
                      <span className="text-[9px]">
                        {formatTime(msg.createdAt)}
                      </span>
                      {msg.senderType === "bot" && (
                        <span className="text-[8px] flex items-center gap-0.5 opacity-70">
                          <Bot className="h-2 w-2" />
                          AI
                        </span>
                      )}
                    </div>
                  </div>
                  {msg.direction === "outbound" && (
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        msg.senderType === "human"
                          ? "bg-zinc-600"
                          : "bg-blue-600",
                      )}
                    >
                      {msg.senderType === "human" ? (
                        <User className="h-2.5 w-2.5 text-white" />
                      ) : (
                        <Bot className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3 w-3 mr-0.5" />
              Prev
            </Button>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
