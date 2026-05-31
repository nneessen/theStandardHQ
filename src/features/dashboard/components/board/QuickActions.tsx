import {
  FilePlus,
  UserPlus,
  Send,
  Receipt,
  MessageSquare,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { Board, JarvisOrbView, T } from "@/components/board";

interface ActionCell {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  primary?: boolean;
  soon?: boolean;
}

export interface QuickActionsProps {
  onJarvis: () => void;
  onAddPolicy: () => void;
  onAddRecruit: () => void;
  onSendEmail: () => void;
  onLogExpense: () => void;
}

/**
 * Quick actions bar — Jarvis launcher (36%) + evenly-split icon action cells.
 * Ported from TheBoard.jsx `QuickActions`. Discord and Slack are placeholders (SOON).
 */
export function QuickActions({
  onJarvis,
  onAddPolicy,
  onAddRecruit,
  onSendEmail,
  onLogExpense,
}: QuickActionsProps) {
  const acts: ActionCell[] = [
    {
      icon: FilePlus,
      label: "Add Policy",
      onClick: onAddPolicy,
      primary: true,
    },
    { icon: UserPlus, label: "Add Recruit", onClick: onAddRecruit },
    { icon: Send, label: "Send Email", onClick: onSendEmail },
    { icon: Receipt, label: "Log Expense", onClick: onLogExpense },
    { icon: MessageSquare, label: "Discord", soon: true },
    { icon: MessagesSquare, label: "Slack", soon: true },
  ];

  return (
    <Board
      pad={0}
      rivets={false}
      style={{ marginBottom: 16, display: "flex", overflow: "hidden" }}
    >
      {/* Jarvis launcher */}
      <button
        type="button"
        onClick={onJarvis}
        aria-label="Open Jarvis"
        style={{
          flex: "0 0 36%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          borderRight: `1px solid ${T.line2}`,
          position: "relative",
          cursor: "pointer",
          background: `radial-gradient(130% 160% at 0% 0%, rgba(70,216,245,0.16), rgba(70,216,245,0.02))`,
          textAlign: "left",
          border: "none",
        }}
      >
        <JarvisOrbView size={58} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                font: `800 19px ${T.disp}`,
                letterSpacing: "0.06em",
                color: T.ink,
              }}
            >
              JARVIS
            </span>
            <span
              style={{
                font: `700 8.5px ${T.mono}`,
                letterSpacing: "0.12em",
                color: T.cyan,
                padding: "2px 6px",
                borderRadius: 4,
                border: `1px solid rgba(70,216,245,0.4)`,
              }}
            >
              AI
            </span>
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12.5,
              color: "rgba(70,216,245,0.8)",
              marginTop: 3,
            }}
          >
            Ask anything, run any task
          </span>
        </span>
        <kbd
          style={{
            font: `700 11px ${T.mono}`,
            color: T.cyan,
            background: "rgba(70,216,245,0.1)",
            borderRadius: 6,
            padding: "6px 9px",
            border: `1px solid rgba(70,216,245,0.35)`,
            flexShrink: 0,
          }}
        >
          ⌘J
        </kbd>
      </button>

      {/* action cells */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${acts.length},1fr)`,
        }}
      >
        {acts.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={a.soon ? undefined : a.onClick}
              disabled={a.soon}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                padding: "14px 4px",
                cursor: a.soon ? "default" : "pointer",
                borderRight:
                  i < acts.length - 1 ? `1px solid ${T.line}` : "none",
                background: a.primary ? "rgba(91,155,255,0.12)" : "transparent",
                border: "none",
                borderRightStyle: i < acts.length - 1 ? "solid" : "none",
              }}
            >
              {a.soon && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    font: `700 7.5px ${T.mono}`,
                    letterSpacing: "0.08em",
                    color: T.amber,
                    border: `1px solid rgba(244,180,58,0.4)`,
                    borderRadius: 4,
                    padding: "2px 4px",
                  }}
                >
                  SOON
                </span>
              )}
              <Icon
                size={27}
                strokeWidth={1.6}
                style={{
                  color: a.primary ? T.blue : T.ink,
                  filter: a.primary
                    ? "drop-shadow(0 0 9px rgba(91,155,255,0.65))"
                    : "none",
                }}
              />
              <span
                style={{
                  font: `700 11px ${T.disp}`,
                  letterSpacing: "0.04em",
                  color: a.primary ? T.ink : T.mut,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {a.label}
              </span>
            </button>
          );
        })}
      </div>
    </Board>
  );
}
