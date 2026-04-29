// src/features/messages/components/workspaces/InstagramWorkspace.tsx
// Instagram workspace: conversations sidebar + active conversation pane.

import { useState } from "react";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { useResizableSidebar, useIsMobile } from "@/hooks/ui";
import {
  useActiveInstagramIntegration,
  useInstagramConversations,
} from "@/hooks/instagram";
import { InstagramSidebar } from "../instagram/InstagramSidebar";
import { InstagramTabContent } from "../instagram/InstagramTabContent";

interface InstagramWorkspaceProps {
  isActive: boolean;
}

export function InstagramWorkspace({ isActive }: InstagramWorkspaceProps) {
  const isMobile = useIsMobile();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);

  const { data: integration } = useActiveInstagramIntegration();
  // Conversations are needed to derive the live selected object (not a
  // stale local copy) — important after cache invalidation.
  const { data: conversations = [] } = useInstagramConversations(
    integration?.id,
    {},
  );

  const selectedConversation = selectedConversationId
    ? (conversations.find((c) => c.id === selectedConversationId) ?? null)
    : null;

  const sidebar = useResizableSidebar({
    storageKey: "messages-instagram-sidebar-width",
    defaultWidth: 220,
    minWidth: 180,
    maxWidth: 400,
  });

  // No integration = let InstagramTabContent render its connect/empty state full-width.
  if (!integration) {
    return (
      <div className="h-full overflow-hidden">
        <InstagramTabContent selectedConversation={null} isActive={isActive} />
      </div>
    );
  }

  const showSidebar = !isMobile || !selectedConversation;

  return (
    <div className="h-full flex gap-2 overflow-hidden">
      {showSidebar && (
        <ResizablePanel
          width={isMobile ? 280 : sidebar.width}
          isResizing={!isMobile && sidebar.isResizing}
          onMouseDown={isMobile ? () => {} : sidebar.handleMouseDown}
          className="flex flex-col overflow-hidden bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft"
        >
          <InstagramSidebar
            integration={integration}
            selectedConversationId={selectedConversationId}
            onConversationSelect={(c) => setSelectedConversationId(c.id)}
          />
        </ResizablePanel>
      )}

      <div className="flex-1 min-w-0 overflow-hidden">
        <InstagramTabContent
          selectedConversation={selectedConversation}
          isActive={isActive}
          onBack={
            isMobile && selectedConversation
              ? () => setSelectedConversationId(null)
              : undefined
          }
        />
      </div>
    </div>
  );
}
