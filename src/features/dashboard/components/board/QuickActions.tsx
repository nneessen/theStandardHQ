import {
  FilePlus,
  UserPlus,
  Send,
  Receipt,
  MessageSquare,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Board, T } from "@/components/board";

interface ActionCell {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  primary?: boolean;
  soon?: boolean;
}

export interface QuickActionsProps {
  onAddPolicy: () => void;
  onAddToTeam: () => void;
  onSendEmail: () => void;
  onLogExpense: () => void;
  onLeaderboard: () => void;
  /**
   * Show the Discord action. Limited to super-admins (Nick) and Epic Life
   * users (email contains "epiclife"). Hidden for everyone else.
   */
  showDiscord?: boolean;
}

/**
 * Quick actions bar — evenly-split icon action cells. Jarvis lives in the
 * sidebar (Command Center), so it is intentionally not duplicated here.
 * Ported from TheBoard.jsx `QuickActions`. Discord is a placeholder (SOON).
 */
export function QuickActions({
  onAddPolicy,
  onAddToTeam,
  onSendEmail,
  onLogExpense,
  onLeaderboard,
  showDiscord = false,
}: QuickActionsProps) {
  const acts: ActionCell[] = [
    {
      icon: FilePlus,
      label: "Add Policy",
      onClick: onAddPolicy,
      primary: true,
    },
    { icon: UserPlus, label: "Add to Team", onClick: onAddToTeam },
    { icon: Send, label: "Send Email", onClick: onSendEmail },
    { icon: Receipt, label: "Log Expense", onClick: onLogExpense },
    { icon: Trophy, label: "Leaderboard", onClick: onLeaderboard },
    // Discord is gated to super-admins (Nick) + Epic Life emails.
    ...(showDiscord
      ? [{ icon: MessageSquare, label: "Discord", soon: true }]
      : []),
  ];

  return (
    <Board pad={0} rivets={false} className="mb-4 overflow-hidden">
      {/* action cells — auto-fit so they wrap to multiple rows on narrow screens
          instead of overflowing horizontally. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))",
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
                // `border: none` first to drop the UA button border, THEN a
                // single delicate hairline (the old code re-declared `border`
                // after `borderRight`, which reset the width to ~3px and painted
                // a heavy line in the text colour).
                border: "none",
                borderRight:
                  i < acts.length - 1
                    ? "1px solid rgba(236,226,205,0.06)"
                    : "none",
                background: a.primary ? "rgba(91,155,255,0.12)" : "transparent",
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
