// src/features/messages/components/inbox/ThreadList.tsx
// List of email threads with zinc palette styling

import { useThreads } from "../../hooks/useThreads";
import { ThreadListItem } from "./ThreadListItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, Search } from "lucide-react";

interface ThreadListProps {
  searchQuery: string;
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  filter:
    | "all"
    | "inbox"
    | "sent"
    | "starred"
    | "drafts"
    | "scheduled"
    | "archived";
}

export function ThreadList({
  searchQuery,
  selectedThreadId,
  onThreadSelect,
  filter,
}: ThreadListProps) {
  const { threads, isLoading, error } = useThreads({
    search: searchQuery || undefined,
    filter,
  });

  if (isLoading) {
    return <ThreadListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-v2-ink-muted">
        <p className="text-[11px]">Failed to load messages</p>
        <p className="text-[10px] mt-1 text-v2-ink-subtle">{error.message}</p>
      </div>
    );
  }

  if (!threads || threads.length === 0) {
    return <EmptyState filter={filter} hasSearch={!!searchQuery} />;
  }

  return (
    <ScrollArea className="flex-1">
      <div>
        {threads.map((thread) => (
          <ThreadListItem
            key={thread.id}
            thread={thread}
            isSelected={selectedThreadId === thread.id}
            onClick={() => onThreadSelect(thread.id)}
            isSentView={filter === "sent"}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full bg-v2-ring" />
            <Skeleton className="h-3 w-28 bg-v2-ring" />
            <Skeleton className="h-3 w-12 ml-auto bg-v2-ring" />
          </div>
          <Skeleton className="h-3 w-full bg-v2-ring" />
          <Skeleton className="h-3 w-3/4 bg-v2-ring" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  filter: string;
  hasSearch: boolean;
}

function EmptyState({ filter, hasSearch }: EmptyStateProps) {
  if (hasSearch) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Search className="h-8 w-8 mb-3 text-v2-ink-subtle" />
        <p className="text-[11px] text-v2-ink-muted">No messages found</p>
        <p className="text-[10px] mt-1 text-v2-ink-subtle">
          Try a different search term
        </p>
      </div>
    );
  }

  const messages: Record<string, { title: string; subtitle: string }> = {
    all: {
      title: "No messages",
      subtitle: "Your messages will appear here",
    },
    inbox: {
      title: "Your inbox is empty",
      subtitle: "Messages you receive will appear here",
    },
    sent: {
      title: "No sent messages",
      subtitle: "Messages you send will appear here",
    },
    starred: {
      title: "No starred messages",
      subtitle: "Star important messages for quick access",
    },
    drafts: {
      title: "No drafts",
      subtitle: "Unsent messages will be saved here",
    },
    scheduled: {
      title: "No scheduled messages",
      subtitle: "Schedule emails to send later",
    },
    archived: {
      title: "No archived messages",
      subtitle: "Archive messages to clean up your inbox",
    },
  };

  const { title, subtitle } = messages[filter] || messages.inbox;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <Inbox className="h-8 w-8 mb-3 text-v2-ink-subtle" />
      <p className="text-[11px] text-v2-ink-muted">{title}</p>
      <p className="text-[10px] mt-1 text-v2-ink-subtle">{subtitle}</p>
    </div>
  );
}
