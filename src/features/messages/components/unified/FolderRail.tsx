// src/features/messages/components/unified/FolderRail.tsx
// Left folder rail for the unified inbox. Restores the Inbox / Starred / Sent /
// Archived navigation (+ Instagram folders + dynamic labels) that Option C
// dropped. Sections are gated by the active tab channel so there's a single
// channel axis (the page tabs); selecting a folder narrows the feed via the
// `folder` option on useUnifiedInbox. Every item is wired to real counts — no
// placeholder folders (Drafts/Spam/Trash are omitted: no schema backing).

import { useState } from "react";
import {
  Archive,
  CircleDot,
  Inbox,
  Instagram,
  Mail,
  Send,
  Star,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { T } from "@/components/board/tokens";
import {
  useActiveInstagramIntegration,
  useInstagramConversations,
} from "@/hooks/instagram";
import { tint } from "./atoms";
import { useFolderCounts } from "../../hooks/useFolderCounts";
import type { FeedChannel, InboxLabel } from "../../hooks/useUnifiedInbox";

const MUT3 = "rgba(255,255,255,0.28)";
const LABEL_DOT: Record<string, string> = {
  blue: T.blue,
  violet: T.violet,
  amber: T.amber,
  red: T.red,
  green: T.green,
  cyan: T.cyan,
};

export function FolderRail({
  channel,
  folder,
  onSelect,
  labels,
}: {
  channel: FeedChannel;
  folder: string;
  onSelect: (folder: string) => void;
  labels: InboxLabel[];
}) {
  const { counts, totalUnread } = useFolderCounts();
  const { data: integration } = useActiveInstagramIntegration();
  const { data: conversations = [] } = useInstagramConversations(
    integration?.id,
  );
  const igTotal = conversations.length;
  const igUnread = conversations.filter(
    (c) => (c.unread_count ?? 0) > 0,
  ).length;
  const igPriority = conversations.filter((c) => c.is_priority).length;

  const showEmail = channel === "all" || channel === "email";
  const showIg =
    (channel === "all" || channel === "instagram") && !!integration;

  const topLabel =
    channel === "instagram"
      ? "All DMs"
      : channel === "email"
        ? "All mail"
        : "All inboxes";
  const TopIcon = channel === "instagram" ? Instagram : Mail;
  const topCount = channel === "instagram" ? igTotal : counts.all;

  return (
    <div
      style={{
        width: 236,
        flexShrink: 0,
        height: "100%",
        overflowY: "auto",
        background: "linear-gradient(180deg, var(--rail1), var(--rail2))",
        borderRight: `1px solid ${T.line}`,
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Item
        icon={TopIcon}
        label={topLabel}
        count={topCount}
        active={folder === "all"}
        accent="blue"
        onClick={() => onSelect("all")}
      />

      {showEmail && (
        <>
          <Group label="Email" />
          <Item
            icon={Inbox}
            label="Inbox"
            count={counts.inbox}
            active={folder === "email:inbox"}
            accent="blue"
            onClick={() => onSelect("email:inbox")}
          />
          <Item
            icon={CircleDot}
            label="Unread"
            count={totalUnread}
            active={folder === "email:unread"}
            accent="blue"
            onClick={() => onSelect("email:unread")}
          />
          <Item
            icon={Star}
            label="Starred"
            count={counts.starred}
            active={folder === "email:starred"}
            accent="blue"
            onClick={() => onSelect("email:starred")}
          />
          <Item
            icon={Send}
            label="Sent"
            count={counts.sent}
            active={folder === "email:sent"}
            accent="blue"
            onClick={() => onSelect("email:sent")}
          />
          <Item
            icon={Archive}
            label="Archived"
            count={counts.archived}
            active={folder === "email:archived"}
            accent="blue"
            onClick={() => onSelect("email:archived")}
          />
        </>
      )}

      {showIg && (
        <>
          <Group label="Instagram" />
          {channel === "all" && (
            <Item
              icon={Instagram}
              label="All DMs"
              count={igTotal}
              active={folder === "ig:all"}
              accent="violet"
              onClick={() => onSelect("ig:all")}
            />
          )}
          <Item
            icon={CircleDot}
            label="Unread"
            count={igUnread}
            active={folder === "ig:unread"}
            accent="violet"
            onClick={() => onSelect("ig:unread")}
          />
          <Item
            icon={Zap}
            label="Priority"
            count={igPriority}
            active={folder === "ig:priority"}
            accent="violet"
            onClick={() => onSelect("ig:priority")}
          />
        </>
      )}

      {labels.length > 0 && (
        <>
          <Group label="Labels" />
          {labels.map((l) => (
            <Item
              key={l.name}
              dot={LABEL_DOT[l.tone] ?? T.mut}
              label={l.name}
              count={l.count}
              active={folder === `label:${l.name}`}
              accent="blue"
              onClick={() => onSelect(`label:${l.name}`)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function Group({ label }: { label: string }) {
  return (
    <div
      style={{
        font: `700 10px ${T.mono}`,
        letterSpacing: "0.18em",
        color: MUT3,
        textTransform: "uppercase",
        padding: "14px 10px 7px",
      }}
    >
      {label}
    </div>
  );
}

function Item({
  icon: Icon,
  dot,
  label,
  count,
  active,
  accent,
  onClick,
}: {
  icon?: LucideIcon;
  dot?: string;
  label: string;
  count?: number;
  active: boolean;
  accent: "blue" | "violet";
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const accentColor = accent === "violet" ? T.violet : T.blue;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 34,
        padding: "0 10px",
        borderRadius: 9,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        background: active
          ? tint(accent, 0.14)
          : hover
            ? "rgba(255,255,255,0.05)"
            : "transparent",
        border: `1px solid ${active ? tint(accent, 0.3) : "transparent"}`,
        color: active ? T.ink : T.mut,
        font: `600 13px ${T.data}`,
      }}
    >
      {Icon ? (
        <Icon size={16} style={{ flexShrink: 0, opacity: 0.85 }} />
      ) : (
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 99,
            background: dot,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {count != null && count > 0 && (
        <span
          style={{
            font: `700 11px ${T.mono}`,
            color: active ? accentColor : T.mut2,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
