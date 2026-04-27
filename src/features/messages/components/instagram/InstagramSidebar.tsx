// src/features/messages/components/instagram/InstagramSidebar.tsx

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Search, RefreshCw, Star, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useInstagramConversations,
  useSyncInstagramConversations,
} from "@/hooks/instagram";
import { InstagramConversationItem } from "./InstagramConversationItem";
import type {
  InstagramIntegration,
  InstagramConversation,
} from "@/types/instagram.types";

/**
 * Skeleton loader for conversation items
 */
function ConversationSkeleton(): ReactNode {
  return (
    <div className="flex items-start gap-2 p-2">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2 w-16" />
      </div>
    </div>
  );
}

interface InstagramSidebarProps {
  integration: InstagramIntegration;
  selectedConversationId: string | null;
  onConversationSelect: (conversation: InstagramConversation) => void;
}

export function InstagramSidebar({
  integration,
  selectedConversationId,
  onConversationSelect,
}: InstagramSidebarProps): ReactNode {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState(false);
  const hasSyncedRef = useRef<string | null>(null);

  const { data: conversations = [], isLoading } = useInstagramConversations(
    integration.id,
    {
      isPriority: filterPriority || undefined,
    },
  );

  // Sync hook for fetching from Instagram API
  const syncConversations = useSyncInstagramConversations();
  const isSyncing = syncConversations.isPending;

  // Auto-sync on first load (non-blocking) - only once per integration
  // Includes timeout mechanism to prevent infinite spinner if Edge Function hangs
  useEffect(() => {
    if (integration.id && hasSyncedRef.current !== integration.id) {
      hasSyncedRef.current = integration.id;

      // Set timeout to reset mutation if it hangs (Edge Function timeout is 60s, we use 30s)
      const timeoutId = setTimeout(() => {
        if (syncConversations.isPending) {
          syncConversations.reset();
          console.warn(
            "[InstagramSidebar] Sync timed out after 30s, resetting state",
          );
        }
      }, 30000);

      syncConversations.mutate(
        { integrationId: integration.id },
        {
          onSettled: () => {
            clearTimeout(timeoutId);
          },
          onError: (error) => {
            console.warn("[InstagramSidebar] Sync failed:", error);
            toast.error("Failed to sync conversations");
            // Do NOT reset hasSyncedRef here - it causes infinite retry loop
            // User can manually refresh to retry
          },
        },
      );

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration.id]);

  // Handler for manual refresh
  const handleRefresh = () => {
    syncConversations.mutate({ integrationId: integration.id });
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.participant_username?.toLowerCase().includes(query) ||
      conv.participant_name?.toLowerCase().includes(query) ||
      conv.last_message_preview?.toLowerCase().includes(query)
    );
  });

  // Count priority conversations
  const priorityCount = conversations.filter((c) => c.is_priority).length;
  const unreadCount = conversations.reduce((acc, c) => acc + c.unread_count, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-2 py-2 border-b border-v2-ring">
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-v2-ink truncate">
              @{integration.instagram_username}
            </span>
            {unreadCount > 0 && (
              <span className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-medium flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0"
            onClick={handleRefresh}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 pl-7 pr-7 text-[10px] bg-v2-canvas border-v2-ring"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-v2-ring">
        <button
          onClick={() => setFilterPriority(false)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
            !filterPriority
              ? "bg-v2-ring text-v2-ink"
              : "text-v2-ink-muted hover:text-v2-ink",
          )}
        >
          <MessageSquare className="h-3 w-3" />
          All
          <span className="text-[9px] font-normal opacity-70">
            {conversations.length}
          </span>
        </button>
        <button
          onClick={() => setFilterPriority(true)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
            filterPriority
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              : "text-v2-ink-muted hover:text-v2-ink",
          )}
        >
          <Star className="h-3 w-3" />
          Priority
          {priorityCount > 0 && (
            <span className="text-[9px] font-normal opacity-70">
              {priorityCount}
            </span>
          )}
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
        {isLoading || (isSyncing && conversations.length === 0) ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <MessageSquare className="h-6 w-6 text-v2-ink-subtle mb-2" />
            <p className="text-[10px] text-v2-ink-muted">
              {searchQuery
                ? "No conversations match your search"
                : filterPriority
                  ? "No priority conversations"
                  : "No conversations yet"}
            </p>
            {!searchQuery && !filterPriority && (
              <p className="text-[9px] text-v2-ink-subtle mt-1">
                Conversations will appear when users message your Instagram
                account
              </p>
            )}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <InstagramConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.id}
              onClick={() => onConversationSelect(conversation)}
            />
          ))
        )}
      </div>
    </div>
  );
}
