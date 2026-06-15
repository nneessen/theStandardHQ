// src/features/messages/components/unified/FeedColumn.tsx
// The center column: a single Unread toggle + sort/select toolbar, an optional
// bulk-action bar, and the day-grouped feed of cards. Channel selection lives in
// the page tabs (not duplicated here). Owns only its local selection UI.

import { useMemo, useState } from "react";
import { CheckSquare, Inbox, ListChecks, Star, Archive, X } from "lucide-react";
import { T } from "@/components/board/tokens";
import { FeedChip, tint } from "./atoms";
import { FeedCard } from "./FeedCard";
import type { OpenTarget } from "./types";
import type {
  FeedSort,
  UnifiedInboxData,
  UnifiedThread,
} from "../../hooks/useUnifiedInbox";

interface FeedColumnProps {
  data: UnifiedInboxData;
  unreadOnly: boolean;
  setUnreadOnly: (v: boolean) => void;
  sort: FeedSort;
  setSort: (s: FeedSort) => void;
  onOpenThread: (target: OpenTarget) => void;
  onBulkStar: (threads: UnifiedThread[]) => void;
  onBulkArchive: (threads: UnifiedThread[]) => void;
  /** When a thread is open in the reading pane the feed shrinks to a list rail. */
  narrow?: boolean;
  /** UnifiedThread.key of the conversation currently open (highlighted). */
  openKey?: string | null;
}

function DayDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "6px 0 2px",
      }}
    >
      <span style={{ flex: 1, height: 1, background: T.line }} />
      <span
        style={{
          font: `700 10px ${T.mono}`,
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.28)", // --mut3, per handoff (matched exactly)
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: T.line }} />
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: "0 11px",
        borderRadius: 8,
        background: active ? tint("blue", 0.14) : "rgba(255,255,255,0.06)",
        border: `1px solid ${active ? tint("blue", 0.4) : T.line2}`,
        color: active ? T.blue : T.mut,
        font: `700 12.5px ${T.data}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function FeedColumn({
  data,
  unreadOnly,
  setUnreadOnly,
  sort,
  setSort,
  onOpenThread,
  onBulkStar,
  onBulkArchive,
  narrow = false,
  openKey = null,
}: FeedColumnProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const byKey = useMemo(() => {
    const m = new Map<string, UnifiedThread>();
    for (const g of data.groups) for (const t of g.threads) m.set(t.key, t);
    return m;
  }, [data.groups]);

  const selectedThreads = useMemo(
    () =>
      [...selected].map((k) => byKey.get(k)).filter(Boolean) as UnifiedThread[],
    [selected, byKey],
  );
  const emailSelectedCount = selectedThreads.filter(
    (t) => t.channel === "email",
  ).length;

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  return (
    <div
      style={{
        flex: narrow ? "0 0 384px" : 1,
        width: narrow ? 384 : undefined,
        minWidth: 0,
        height: "100%",
        overflowY: "auto",
        borderRight: narrow ? `1px solid ${T.line}` : undefined,
      }}
    >
      <div
        style={{
          padding: narrow ? "20px 18px" : "20px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 13,
        }}
      >
        {/* Filter + tools row (channel is chosen via the page tabs, not here) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 2,
          }}
        >
          <FeedChip
            active={unreadOnly}
            count={data.unreadCount}
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            Unread
          </FeedChip>
          <span style={{ flex: 1 }} />
          <ToolbarButton
            active={selectMode}
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          >
            <ListChecks size={13} /> Select
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setSort(sort === "newest" ? "oldest" : "newest")}
          >
            {sort === "newest" ? "Newest" : "Oldest"}
          </ToolbarButton>
        </div>

        {/* Bulk-action bar */}
        {selectMode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 13px",
              borderRadius: 10,
              background: tint("blue", 0.1),
              border: `1px solid ${tint("blue", 0.28)}`,
            }}
          >
            <CheckSquare size={15} style={{ color: T.blue }} />
            <span style={{ font: `700 12.5px ${T.data}`, color: T.ink }}>
              {selected.size} selected
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                onBulkStar(selectedThreads);
                exitSelect();
              }}
              style={bulkBtn(selected.size > 0)}
            >
              <Star size={13} /> Star
            </button>
            <button
              type="button"
              disabled={emailSelectedCount === 0}
              onClick={() => {
                onBulkArchive(
                  selectedThreads.filter((t) => t.channel === "email"),
                );
                exitSelect();
              }}
              style={bulkBtn(emailSelectedCount > 0)}
              title={
                emailSelectedCount === 0
                  ? "Archive applies to email threads"
                  : undefined
              }
            >
              <Archive size={13} /> Archive
            </button>
            <button
              type="button"
              onClick={exitSelect}
              style={{
                ...bulkBtn(true),
                background: "transparent",
                color: T.mut,
              }}
            >
              <X size={13} /> Cancel
            </button>
          </div>
        )}

        {/* Feed */}
        {data.isLoading ? (
          <FeedMessage>Loading your inbox…</FeedMessage>
        ) : data.isEmpty ? (
          <EmptyInbox />
        ) : data.groups.length === 0 ? (
          <FeedMessage>
            {unreadOnly
              ? "No unread conversations."
              : "No messages match this filter."}
          </FeedMessage>
        ) : (
          data.groups.map((group) => (
            <div
              key={group.label}
              style={{ display: "flex", flexDirection: "column", gap: 13 }}
            >
              <DayDivider label={group.label} />
              {group.threads.map((t) => (
                <FeedCard
                  key={t.key}
                  thread={t}
                  selectMode={selectMode}
                  selected={selected.has(t.key)}
                  isOpen={t.key === openKey}
                  onToggleSelect={() => toggleSelect(t.key)}
                  onOpen={() =>
                    onOpenThread({ channel: t.channel, refId: t.refId })
                  }
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function bulkBtn(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 12px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${T.line2}`,
    color: T.ink,
    font: `700 12px ${T.data}`,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.45,
  };
}

function FeedMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "40px 0",
        textAlign: "center",
        color: T.mut,
        font: `500 13px ${T.data}`,
      }}
    >
      {children}
    </div>
  );
}

function EmptyInbox() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "56px 0",
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: 999,
          background: T.surface3,
          border: `1px solid ${T.line}`,
        }}
      >
        <Inbox size={22} style={{ color: T.mut2 }} />
      </span>
      <div style={{ font: `700 14px ${T.data}`, color: T.ink }}>
        No conversations yet
      </div>
      <div style={{ font: `500 12px ${T.data}`, color: T.mut, maxWidth: 280 }}>
        Email threads and Instagram DMs will appear here as they arrive.
      </div>
    </div>
  );
}
