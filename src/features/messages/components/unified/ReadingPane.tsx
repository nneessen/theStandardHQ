// src/features/messages/components/unified/ReadingPane.tsx
// In-page reading pane for the unified inbox. Replaces the old right-side
// ThreadDrawer overlay: the opened conversation lives as a sibling column to the
// feed (master–detail), so the inbox is never covered. Reuses the existing
// detail views (ThreadView for email, InstagramConversationView for IG), which
// are styled in the board language so the pane matches the rest of Messages.

import { T } from "@/components/board/tokens";
import {
  useActiveInstagramIntegration,
  useInstagramConversation,
} from "@/hooks/instagram";
import { ThreadView } from "../thread/ThreadView";
import { InstagramConversationView } from "../instagram/InstagramConversationView";
import type { OpenTarget } from "./types";

export function ReadingPane({
  target,
  onClose,
}: {
  target: OpenTarget;
  onClose: () => void;
}) {
  const isIg = target.channel === "instagram";
  const { data: integration } = useActiveInstagramIntegration();
  const { data: conversation } = useInstagramConversation(
    isIg ? target.refId : undefined,
  );

  return (
    <div
      data-testid="reading-pane"
      style={{
        flex: 1,
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderLeft: `1px solid ${T.line}`,
        background: T.bg,
      }}
    >
      {target.channel === "email" ? (
        <ThreadView
          key={target.refId}
          threadId={target.refId}
          onClose={onClose}
        />
      ) : conversation && integration ? (
        <InstagramConversationView
          key={target.refId}
          conversation={conversation}
          integrationId={integration.id}
          onClose={onClose}
        />
      ) : (
        <div style={{ padding: 24, color: T.mut, font: `500 13px ${T.data}` }}>
          Loading conversation…
        </div>
      )}
    </div>
  );
}
