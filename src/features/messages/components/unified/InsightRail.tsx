// src/features/messages/components/unified/InsightRail.tsx
// Right rail: "how am I pacing / who do I owe / where's volume coming from".
// Send pace + follow-ups + 7-day channel mix — all from real aggregates.

import { BarChart3, Bell, Zap } from "lucide-react";
import { T } from "@/components/board/tokens";
import { QuotaMeter } from "./atoms";
import type { OpenTarget } from "./types";
import { useSendPace } from "../../hooks/useSendPace";
import type { UnifiedInboxData } from "../../hooks/useUnifiedInbox";

function RailCard({
  icon,
  label,
  caption,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: T.surface3,
        border: `1px solid ${T.line}`,
        borderRadius: 13,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: T.mut, display: "inline-flex" }}>{icon}</span>
        <span
          style={{
            font: `800 13px ${T.disp}`,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: T.ink,
          }}
        >
          {label}
        </span>
        {caption && (
          <span
            style={{
              marginLeft: "auto",
              font: `700 11px ${T.mono}`,
              color: T.mut2,
              letterSpacing: "0.06em",
            }}
          >
            {caption}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function InsightRail({
  data,
  onOpenThread,
}: {
  data: UnifiedInboxData;
  onOpenThread: (target: OpenTarget) => void;
}) {
  const pace = useSendPace();
  const { followups, channelMix } = data;

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        height: "100%",
        overflowY: "auto",
        background: "linear-gradient(180deg, var(--rail1), var(--rail2))", // --rail1/--rail2
        borderLeft: `1px solid ${T.line}`,
        padding: "22px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Send pace */}
      <RailCard
        icon={<Zap size={15} />}
        label="Send pace"
        caption="RESETS 12 AM"
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ font: `800 30px ${T.disp}`, color: T.cream }}>
            {pace.sent}
          </span>
          <span style={{ font: `600 12.5px ${T.data}`, color: T.mut2 }}>
            / {pace.cap} sent today
          </span>
        </div>
        <QuotaMeter
          sent={pace.sent}
          cap={pace.cap}
          scheduled={pace.scheduled}
        />
        <div style={{ font: `600 11.5px ${T.data}`, color: T.mut2 }}>
          <span style={{ color: T.blue }}>{pace.remaining}</span> left ·{" "}
          <span style={{ color: T.blue }}>{pace.scheduled}</span> scheduled
        </div>
      </RailCard>

      {/* Follow-ups */}
      <RailCard
        icon={<Bell size={15} />}
        label="Follow-ups"
        caption={followups.length > 0 ? `${followups.length} DUE` : undefined}
      >
        {followups.length === 0 ? (
          <div style={{ font: `500 12px ${T.data}`, color: T.mut }}>
            You're all caught up — nothing waiting on a reply.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {followups.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() =>
                  onOpenThread({ channel: f.channel, refId: f.refId })
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    flexShrink: 0,
                    background: f.state === "over" ? T.red : T.amber,
                  }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      font: `700 13px ${T.data}`,
                      color: T.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.name}
                  </span>
                  {f.task && (
                    <span
                      style={{
                        display: "block",
                        font: `600 11.5px ${T.data}`,
                        color: T.mut2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {f.task}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    font: `700 10px ${T.mono}`,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: f.state === "over" ? T.red : T.amber,
                  }}
                >
                  {f.when}
                </span>
              </button>
            ))}
          </div>
        )}
      </RailCard>

      {/* Channel mix */}
      <RailCard
        icon={<BarChart3 size={15} />}
        label="Channel mix"
        caption="7 DAYS"
      >
        {channelMix.hasData ? (
          <>
            <div
              style={{
                height: 9,
                borderRadius: 99,
                overflow: "hidden",
                display: "flex",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{ width: `${channelMix.emailPct}%`, background: T.blue }}
              />
              <div
                style={{
                  width: `${channelMix.instagramPct}%`,
                  background: T.violet,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <Legend color={T.blue} label="Email" pct={channelMix.emailPct} />
              <Legend
                color={T.violet}
                label="Instagram"
                pct={channelMix.instagramPct}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
                paddingTop: 3,
                borderTop: `1px solid ${T.line}`,
              }}
            >
              <Fact
                label="Open rate"
                value={`${channelMix.emailOpenRate}%`}
                tone={T.green}
              />
              <Fact
                label="Click rate"
                value={`${channelMix.emailClickRate}%`}
              />
            </div>
          </>
        ) : (
          <div style={{ font: `500 12px ${T.data}`, color: T.mut }}>
            No sends in the last 7 days.
          </div>
        )}
      </RailCard>
    </div>
  );
}

function Legend({
  color,
  label,
  pct,
}: {
  color: string;
  label: string;
  pct: number;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{ width: 8, height: 8, borderRadius: 99, background: color }}
      />
      <span style={{ font: `600 12px ${T.data}`, color: T.mut }}>
        {label} <span style={{ color: T.ink, fontWeight: 700 }}>{pct}%</span>
      </span>
    </span>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ font: `600 12px ${T.data}`, color: T.mut }}>{label}</span>
      <span
        style={{
          font: `800 13px ${T.disp}`,
          color: tone ?? T.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}
