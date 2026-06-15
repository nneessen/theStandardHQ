// src/features/messages/components/unified/UnifiedInboxView.tsx
// The unified feed body: blended (or channel-scoped) feed + insight rail + a
// thread drawer. Drives the "All inboxes", "Email" and "Instagram" tabs — the
// `channel` prop scopes the same feed so every channel tab looks identical.
// Owns feed-local state (unread / sort / open thread) and wires bulk actions to
// the real per-channel mutations.

import { useState } from "react";
import { toast } from "sonner";
import {
  useActiveInstagramIntegration,
  useSetInstagramPriority,
} from "@/hooks/instagram";
import { useThreads } from "../../hooks/useThreads";
import {
  type FeedChannel,
  type FeedSort,
  type UnifiedThread,
  useUnifiedInbox,
} from "../../hooks/useUnifiedInbox";
import { InstagramTabContent } from "../instagram/InstagramTabContent";
import { FeedColumn } from "./FeedColumn";
import { InsightRail } from "./InsightRail";
import { ThreadDrawer, type OpenTarget } from "./ThreadDrawer";

export function UnifiedInboxView({
  searchQuery,
  channel = "all",
}: {
  searchQuery: string;
  channel?: FeedChannel;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sort, setSort] = useState<FeedSort>("newest");
  const [openTarget, setOpenTarget] = useState<OpenTarget | null>(null);

  const { data: igIntegration } = useActiveInstagramIntegration();
  const data = useUnifiedInbox({
    search: searchQuery,
    channel,
    unreadOnly,
    sort,
  });

  // Bulk actions reuse the real per-channel mutations (shared query cache).
  const { toggleStar, archive } = useThreads({ filter: "all" });
  const setPriority = useSetInstagramPriority();

  function handleBulkStar(threads: UnifiedThread[]) {
    if (threads.length === 0) return;
    for (const t of threads) {
      if (t.channel === "email") toggleStar(t.refId, true);
      else setPriority.mutate({ conversationId: t.refId, isPriority: true });
    }
    toast.success(
      `Starred ${threads.length} conversation${threads.length === 1 ? "" : "s"}`,
    );
  }

  function handleBulkArchive(threads: UnifiedThread[]) {
    const emails = threads.filter((t) => t.channel === "email");
    if (emails.length === 0) return;
    for (const t of emails) archive(t.refId);
    toast.success(
      `Archived ${emails.length} thread${emails.length === 1 ? "" : "s"}`,
    );
  }

  // Instagram tab with no active connection → show the connect / onboarding
  // state (preserves the old workspace's onboarding) instead of an empty feed.
  if (channel === "instagram" && !igIntegration) {
    return (
      <div className="h-full overflow-hidden">
        <InstagramTabContent selectedConversation={null} isActive />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <FeedColumn
        data={data}
        unreadOnly={unreadOnly}
        setUnreadOnly={setUnreadOnly}
        sort={sort}
        setSort={setSort}
        onOpenThread={setOpenTarget}
        onBulkStar={handleBulkStar}
        onBulkArchive={handleBulkArchive}
      />
      <InsightRail data={data} onOpenThread={setOpenTarget} />
      <ThreadDrawer target={openTarget} onClose={() => setOpenTarget(null)} />
    </div>
  );
}
