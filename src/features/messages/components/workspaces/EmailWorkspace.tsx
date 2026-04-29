// src/features/messages/components/workspaces/EmailWorkspace.tsx
// Email workspace: folders rail + thread list + thread detail.
// Owns its own selection + folder state so MessagesPage stays thin.

import { useState } from "react";
import {
  Inbox,
  Send,
  Star,
  Archive,
  Mail,
  Inbox as InboxIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MessagesLayout } from "../layout/MessagesLayout";
import { ThreadList } from "../inbox/ThreadList";
import { ThreadView } from "../thread/ThreadView";
import { useEmailQuota } from "../../hooks/useSendEmail";
import { useFolderCounts } from "../../hooks/useFolderCounts";

type FolderType = "all" | "inbox" | "sent" | "starred" | "archived";

interface EmailWorkspaceProps {
  searchQuery: string;
}

export function EmailWorkspace({ searchQuery }: EmailWorkspaceProps) {
  const [activeFolder, setActiveFolder] = useState<FolderType>("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { counts } = useFolderCounts();
  const { remainingDaily, percentUsed, quota } = useEmailQuota();

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
    <div className="h-full flex gap-2 overflow-hidden">
      {/* Folders rail */}
      <aside className="w-40 flex-shrink-0 flex flex-col bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft overflow-hidden">
        <div className="p-2 flex-1 flex flex-col min-h-0">
          <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide px-2 mb-1.5">
            Folders
          </div>
          <nav className="space-y-0.5">
            {folders.map((folder) => {
              const Icon = folder.icon;
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] transition-colors",
                    isActive
                      ? "bg-v2-ring text-v2-ink font-medium"
                      : "text-v2-ink-muted hover:text-v2-ink hover:bg-v2-canvas",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{folder.label}</span>
                  {folder.count > 0 && (
                    <span className="text-[10px] font-medium text-v2-ink-muted">
                      {folder.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          {/* Quota lives here, with the email folders, not in the page header */}
          <div className="border-t border-v2-ring pt-2 mt-2 px-1">
            <div className="flex justify-between text-[10px] text-v2-ink-muted mb-1">
              <span>Daily quota</span>
              <span className="font-medium text-v2-ink-muted">
                {quota ? `${quota.dailyUsed}/${quota.dailyLimit}` : "0/50"}
              </span>
            </div>
            <div className="h-1.5 bg-v2-ring rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  percentUsed > 90
                    ? "bg-red-500"
                    : percentUsed > 70
                      ? "bg-amber-500"
                      : "bg-blue-500",
                )}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <p className="text-[9px] text-v2-ink-subtle mt-1">
              {remainingDaily} remaining today
            </p>
          </div>
        </div>
      </aside>

      {/* Threads + detail (resizable list, flexible detail) */}
      <div className="flex-1 min-w-0">
        <MessagesLayout
          list={
            <ThreadList
              searchQuery={searchQuery}
              selectedThreadId={selectedThreadId}
              onThreadSelect={setSelectedThreadId}
              filter={activeFolder}
            />
          }
          detail={
            selectedThreadId ? (
              <ThreadView
                threadId={selectedThreadId}
                onClose={() => setSelectedThreadId(null)}
              />
            ) : (
              <EmptyEmailDetail folder={activeFolder} />
            )
          }
        />
      </div>
    </div>
  );
}

function EmptyEmailDetail({ folder }: { folder: FolderType }) {
  const labels: Record<FolderType, string> = {
    all: "all conversations",
    inbox: "your inbox",
    sent: "sent messages",
    starred: "starred messages",
    archived: "archived messages",
  };

  return (
    <div className="h-full flex items-center justify-center bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div className="text-center max-w-xs px-6">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-v2-canvas border border-v2-ring mb-3">
          <InboxIcon className="h-5 w-5 text-v2-ink-subtle" />
        </div>
        <p className="text-[12px] font-medium text-v2-ink mb-1">
          No conversation selected
        </p>
        <p className="text-[11px] text-v2-ink-muted">
          Pick a thread from {labels[folder]} on the left, or compose a new
          message.
        </p>
      </div>
    </div>
  );
}
