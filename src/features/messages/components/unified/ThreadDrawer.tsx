// src/features/messages/components/unified/ThreadDrawer.tsx
// Right-side drawer that opens the full thread when a feed card is clicked.
// Reuses the existing, polished detail views (ThreadView for email,
// InstagramConversationView for IG) rather than re-implementing them.

import { useEffect } from "react";
import { X } from "lucide-react";
import { T } from "@/components/board/tokens";
import {
  useActiveInstagramIntegration,
  useInstagramConversation,
} from "@/hooks/instagram";
import { ThreadView } from "../thread/ThreadView";
import { InstagramConversationView } from "../instagram/InstagramConversationView";
import type { UnifiedChannel } from "../../hooks/useUnifiedInbox";

export interface OpenTarget {
  channel: UnifiedChannel;
  refId: string;
}

export function ThreadDrawer({
  target,
  onClose,
}: {
  target: OpenTarget | null;
  onClose: () => void;
}) {
  const isIg = target?.channel === "instagram";
  const { data: integration } = useActiveInstagramIntegration();
  const { data: conversation } = useInstagramConversation(
    isIg ? target?.refId : undefined,
  );

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        aria-label="Close thread"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          border: "none",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "min(560px, 92vw)",
          height: "100%",
          background: T.surface3,
          borderLeft: `1px solid ${T.line2}`,
          boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "8px 8px 0",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              background: T.surface4,
              border: `1px solid ${T.line2}`,
              color: T.mut,
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {target.channel === "email" ? (
            <ThreadView threadId={target.refId} onClose={onClose} />
          ) : conversation && integration ? (
            <InstagramConversationView
              conversation={conversation}
              integrationId={integration.id}
            />
          ) : (
            <div
              style={{
                padding: 24,
                color: T.mut,
                font: `500 13px ${T.data}`,
              }}
            >
              Loading conversation…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
