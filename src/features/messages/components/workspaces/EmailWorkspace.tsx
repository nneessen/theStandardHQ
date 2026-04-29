// src/features/messages/components/workspaces/EmailWorkspace.tsx
// Email workspace: combined thread list (with folder filter chips at top)
// + thread detail. Drops the separate folder sidebar so the page is a
// clean two-column read instead of three.

import { useState } from "react";
import {
  Inbox,
  Send,
  Star,
  Archive,
  Mail,
  Inbox as InboxIcon,
  PenSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MessagesLayout } from "../layout/MessagesLayout";
import { ThreadList } from "../inbox/ThreadList";
import { ThreadView } from "../thread/ThreadView";
import { useFolderCounts } from "../../hooks/useFolderCounts";

type FolderType = "all" | "inbox" | "sent" | "starred" | "archived";

interface EmailWorkspaceProps {
  searchQuery: string;
  onCompose: () => void;
}

export function EmailWorkspace({
  searchQuery,
  onCompose,
}: EmailWorkspaceProps) {
  const [activeFolder, setActiveFolder] = useState<FolderType>("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { counts } = useFolderCounts();

  const folders: {
    id: FolderType;
    label: string;
    icon: typeof Inbox;
    count: number;
  }[] = [
    { id: "all", label: "All", icon: Mail, count: counts.all },
    { id: "inbox", label: "Inbox", icon: Inbox, count: counts.inbox },
    { id: "sent", label: "Sent", icon: Send, count: counts.sent },
    { id: "starred", label: "Starred", icon: Star, count: counts.starred },
    {
      id: "archived",
      label: "Archived",
      icon: Archive,
      count: counts.archived,
    },
  ];

  return (
    <MessagesLayout
      list={
        <div className="flex flex-col h-full">
          {/* Filter chips replace the old folder sidebar.
              Horizontal, scrollable on narrow screens, persistent. */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-v2-ring bg-v2-canvas/40 overflow-x-auto flex-shrink-0">
            {folders.map((f) => {
              const Icon = f.icon;
              const isActive = activeFolder === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFolder(f.id)}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 px-2 rounded-v2-pill text-[10.5px] whitespace-nowrap transition-colors flex-shrink-0",
                    isActive
                      ? "bg-v2-ink text-v2-canvas font-semibold"
                      : "text-v2-ink-muted hover:text-v2-ink hover:bg-v2-ring/40 border border-transparent",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {f.label}
                  {f.count > 0 && (
                    <span
                      className={cn(
                        "text-[9.5px] tabular-nums",
                        isActive ? "text-v2-canvas/80" : "text-v2-ink-subtle",
                      )}
                    >
                      {f.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <ThreadList
              searchQuery={searchQuery}
              selectedThreadId={selectedThreadId}
              onThreadSelect={setSelectedThreadId}
              filter={activeFolder}
            />
          </div>
        </div>
      }
      detail={
        selectedThreadId ? (
          <ThreadView
            threadId={selectedThreadId}
            onClose={() => setSelectedThreadId(null)}
          />
        ) : (
          <EmptyEmailDetail folder={activeFolder} onCompose={onCompose} />
        )
      }
    />
  );
}

function EmptyEmailDetail({
  folder,
  onCompose,
}: {
  folder: FolderType;
  onCompose: () => void;
}) {
  const labels: Record<FolderType, string> = {
    all: "all conversations",
    inbox: "your inbox",
    sent: "sent messages",
    starred: "starred messages",
    archived: "archived messages",
  };

  return (
    <div className="h-full flex items-center justify-center bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div className="text-center max-w-sm px-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-v2-accent-soft border border-v2-ring mb-4">
          <InboxIcon className="h-7 w-7 text-v2-ink" />
        </div>
        <h3 className="text-sm font-semibold text-v2-ink mb-1">
          No conversation selected
        </h3>
        <p className="text-[11px] text-v2-ink-muted mb-4">
          Pick a thread from {labels[folder]} on the left, or start a new one.
        </p>
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-v2-pill bg-v2-ink text-v2-canvas text-[11px] font-medium hover:bg-v2-ink/90 transition-colors"
        >
          <PenSquare className="h-3 w-3" />
          Compose new email
        </button>
      </div>
    </div>
  );
}
