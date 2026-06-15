// src/features/messages/components/unified/FeedCard.tsx
// `.fcard` — one self-sufficient conversation card in the unified feed. Carries
// its own channel glyph, status (label/receipt/follow-up) and an inline
// quick-reply. No avatars, no left accent strip; unread = subtle blue wash.

import { useState } from "react";
import { Reply } from "lucide-react";
import { T } from "@/components/board/tokens";
import {
  ChannelGlyph,
  FollowUpPill,
  LabelTag,
  ReadReceipt,
  tint,
} from "./atoms";
import { QuickReply } from "./QuickReply";
import type { UnifiedThread } from "../../hooks/useUnifiedInbox";

interface FeedCardProps {
  thread: UnifiedThread;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}

export function FeedCard({
  thread,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
}: FeedCardProps) {
  const [hover, setHover] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const unread = thread.unread;

  const bg = unread ? "rgba(91,155,255,0.05)" : hover ? "#262626" : T.surface2;
  const border = unread ? tint("blue", 0.22) : hover ? T.line2 : T.line;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => (selectMode ? onToggleSelect() : onOpen())}
      style={{
        padding: "17px 19px",
        borderRadius: 14,
        background: bg,
        border: `1px solid ${border}`,
        cursor: "pointer",
        transition: "background .12s, border-color .12s",
      }}
    >
      <div style={{ display: "flex", gap: 13 }}>
        {selectMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            style={{
              marginTop: 3,
              width: 15,
              height: 15,
              accentColor: T.blue,
              flexShrink: 0,
            }}
          />
        )}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Row 1 — glyph · name · address · time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              minWidth: 0,
            }}
          >
            <ChannelGlyph channel={thread.channel} />
            {unread && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: T.blue,
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                font: `800 15px ${T.disp}`,
                color: T.cream,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "44%",
                flexShrink: 0,
              }}
            >
              {thread.from}
            </span>
            {thread.addr && (
              <span
                style={{
                  font: `600 12.5px ${T.data}`,
                  color: T.mut2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {thread.addr}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <span
              style={{
                font: `600 12px ${T.data}`,
                color: T.mut2,
                flexShrink: 0,
              }}
            >
              {thread.time}
            </span>
          </div>

          {/* Subject (email only) */}
          {thread.subject && (
            <div
              style={{
                font: `700 14.5px ${T.data}`,
                color: T.ink,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {thread.subject}
            </div>
          )}

          {/* Preview */}
          {thread.preview && (
            <div
              style={{
                font: `500 13.5px/1.5 ${T.data}`,
                color: T.mut,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {thread.preview}
            </div>
          )}

          {/* Foot — status chips + quick reply */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {thread.label && (
              <LabelTag tone={thread.label.tone}>{thread.label.name}</LabelTag>
            )}
            <ReadReceipt state={thread.receipt} />
            {thread.followup && (
              <FollowUpPill
                state={thread.followup.state}
                when={thread.followup.when}
              />
            )}
            <span style={{ flex: 1 }} />
            {!selectMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReplyOpen((v) => !v);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 30,
                  padding: "0 11px",
                  borderRadius: 8,
                  background: T.surface2,
                  border: `1px solid ${T.line2}`,
                  color: replyOpen ? T.blue : T.ink,
                  font: `600 12px ${T.data}`,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Reply size={13} strokeWidth={2.2} /> Quick reply
              </button>
            )}
          </div>

          {replyOpen && !selectMode && (
            <QuickReply
              channel={thread.channel}
              refId={thread.refId}
              to={thread.addr || thread.from}
              subject={thread.subject}
              onDone={() => setReplyOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
