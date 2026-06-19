// src/features/messages/components/unified/QuickReply.tsx
// Inline quick-reply composer that expands on a feed card. Sends a real,
// threaded reply on the card's own channel — email (threaded via threadId) or
// Instagram DM — without navigating away. Send-only by design (scheduling lives
// in the full composer); no non-functional controls.

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { T } from "@/components/board/tokens";
import { useSendInstagramMessage } from "@/hooks/instagram";
import { useSendEmail } from "../../hooks/useSendEmail";
import type { UnifiedChannel } from "../../hooks/useUnifiedInbox";

interface QuickReplyProps {
  channel: UnifiedChannel;
  refId: string;
  to: string; // email address or @handle (used for email recipient + placeholder)
  subject: string;
  onDone: () => void;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function QuickReply({
  channel,
  refId,
  to,
  subject,
  onDone,
}: QuickReplyProps) {
  const [text, setText] = useState("");
  const { send, isSending } = useSendEmail();
  const igSend = useSendInstagramMessage();
  const busy = isSending || igSend.isPending;
  const canSend =
    text.trim().length > 0 &&
    !busy &&
    (channel === "instagram" || to.includes("@"));

  async function handleSend() {
    const body = text.trim();
    if (!body) return;
    try {
      if (channel === "email") {
        await send({
          to: [to],
          subject: subject ? `Re: ${subject}` : "(no subject)",
          bodyHtml: `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`,
          bodyText: body,
          threadId: refId,
        });
      } else {
        await igSend.mutateAsync({ conversationId: refId, messageText: body });
      }
      toast.success("Reply sent");
      setText("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reply");
    }
  }

  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend();
        }}
        placeholder={
          channel === "email" ? `Reply to ${to}…` : `Message ${to || "DM"}…`
        }
        rows={3}
        style={{
          width: "100%",
          resize: "vertical",
          borderRadius: 10,
          padding: "9px 11px",
          background: T.surface3,
          border: `1px solid ${T.line2}`,
          color: T.ink,
          font: `500 13px ${T.data}`,
          outline: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <span
          style={{
            font: `700 9px ${T.mono}`,
            color: T.mut2,
            letterSpacing: "0.08em",
            marginRight: "auto",
          }}
        >
          ⌘↵ TO SEND
        </span>
        <button
          type="button"
          onClick={onDone}
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${T.line2}`,
            color: T.mut,
            font: `600 12px ${T.data}`,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 14px",
            borderRadius: 8,
            background: "var(--btn-solid-bg)",
            color: "var(--btn-solid-fg)",
            font: `700 12px ${T.data}`,
            cursor: canSend ? "pointer" : "default",
            opacity: canSend ? 1 : 0.5,
          }}
        >
          <Send size={13} strokeWidth={2.4} />
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
