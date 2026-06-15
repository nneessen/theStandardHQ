// src/features/messages/components/unified/InboxHeader.tsx
// `.mh` — the Messages header: brand block + stat strip + quota meter (top row),
// then the channel tab bar with search + Compose (bar row). Shared across all
// Messages tabs so the page outline doesn't shape-shift.

import { Mail, PenSquare, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { T } from "@/components/board/tokens";
import { QuotaMeter, tint } from "./atoms";

export interface HeaderTab {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface InboxHeaderProps {
  tabs: HeaderTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  stats: { unread: number; threads: number; openRate: number };
  pace: { sent: number; cap: number; scheduled: number; remaining: number };
  search: string;
  onSearch: (v: string) => void;
  showSearch: boolean;
  showCompose: boolean;
  onCompose: () => void;
}

export function InboxHeader({
  tabs,
  activeTab,
  onTabChange,
  stats,
  pace,
  search,
  onSearch,
  showSearch,
  showCompose,
  onCompose,
}: InboxHeaderProps) {
  return (
    <header
      style={{
        background: "linear-gradient(180deg, #202020, #1b1b1b)", // --head1/--head2
        borderBottom: `1px solid ${T.line}`,
        borderRadius: 12,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "20px 28px 16px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 42,
            height: 42,
            borderRadius: 12,
            background: tint("blue", 0.16),
            boxShadow: `inset 0 0 0 1px ${tint("blue", 0.3)}`,
            color: T.blue,
            flexShrink: 0,
          }}
        >
          <Mail size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: `700 11px ${T.mono}`,
              letterSpacing: "0.22em",
              color: T.mut2,
              textTransform: "uppercase",
            }}
          >
            Communications
          </div>
          <h1
            style={{
              font: `800 28px ${T.disp}`,
              color: T.cream,
              textTransform: "uppercase",
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Messages
          </h1>
        </div>

        {/* Stat strip */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "stretch",
            flexWrap: "wrap",
          }}
        >
          <StatCell value={stats.unread} label="Unread" first />
          <StatCell value={stats.threads} label="Threads" />
          <StatCell
            value={`${stats.openRate}%`}
            label="Open rate"
            tone={T.green}
          />
          {/* Quota meter cell */}
          <div
            style={{
              padding: "2px 22px",
              borderLeft: `1px solid ${T.line}`,
              minWidth: 188,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                style={{
                  font: `800 24px ${T.disp}`,
                  color: T.cream,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pace.sent} / {pace.cap}
              </span>
            </div>
            <div
              style={{
                font: `700 10px ${T.mono}`,
                letterSpacing: "0.16em",
                color: T.mut2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Sent today
            </div>
            <QuotaMeter
              sent={pace.sent}
              cap={pace.cap}
              scheduled={pace.scheduled}
            />
            <div
              style={{
                font: `600 10.5px ${T.data}`,
                color: T.mut2,
                marginTop: 5,
              }}
            >
              <span style={{ color: T.blue }}>{pace.remaining}</span> left ·{" "}
              <span style={{ color: T.blue }}>{pace.scheduled}</span> scheduled
            </div>
          </div>
        </div>
      </div>

      {/* Bar row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 54,
          borderTop: `1px solid ${T.line}`,
          padding: "0 28px",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            height: "100%",
            gap: 2,
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            const accent = tab.id === "instagram" ? T.violet : T.blue;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "0 14px",
                  height: "100%",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: active ? T.ink : T.mut,
                  font: `${active ? 700 : 600} 13px ${T.data}`,
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={15} />
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 17,
                      height: 17,
                      padding: "0 5px",
                      borderRadius: 999,
                      font: `700 10px ${T.mono}`,
                      background: active
                        ? tint(tab.id === "instagram" ? "violet" : "blue", 0.18)
                        : "rgba(255,255,255,0.08)",
                      color: active ? accent : T.mut,
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      left: 8,
                      right: 8,
                      bottom: -1,
                      height: 2,
                      borderRadius: 2,
                      background: accent,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <span style={{ flex: 1 }} />

        {showSearch && (
          <div style={{ position: "relative", width: 280, maxWidth: "40vw" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 11,
                top: "50%",
                transform: "translateY(-50%)",
                color: T.mut2,
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search messages, people, carriers…"
              style={{
                width: "100%",
                height: 38,
                paddingLeft: 33,
                paddingRight: 44,
                borderRadius: 10,
                background: T.surface3,
                border: `1px solid ${T.line2}`,
                color: T.ink,
                font: `500 13px ${T.data}`,
                outline: "none",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                font: `700 10px ${T.mono}`,
                color: T.mut2,
                border: `1px solid ${T.line2}`,
                borderRadius: 5,
                padding: "1px 5px",
              }}
            >
              ⌘K
            </span>
          </div>
        )}

        {showCompose && (
          <button
            type="button"
            onClick={onCompose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginLeft: 10,
              height: 38,
              padding: "0 16px",
              borderRadius: 10,
              background: T.cream,
              color: "#141414",
              font: `700 13px ${T.data}`,
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
            }}
          >
            <PenSquare size={15} strokeWidth={2.2} />
            Compose
          </button>
        )}
      </div>
    </header>
  );
}

function StatCell({
  value,
  label,
  tone,
  first,
}: {
  value: string | number;
  label: string;
  tone?: string;
  first?: boolean;
}) {
  return (
    <div
      style={{
        padding: "2px 22px",
        borderLeft: first ? undefined : `1px solid ${T.line}`,
      }}
    >
      <div
        style={{
          font: `800 24px ${T.disp}`,
          color: tone ?? T.cream,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: `700 10px ${T.mono}`,
          letterSpacing: "0.16em",
          color: T.mut2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
