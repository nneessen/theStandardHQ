import { Board, Cap, Num, StatusDot, T } from "@/components/board";

export type FlagSeverity = "info" | "warning" | "danger" | "error";

export interface BoardFlag {
  type: FlagSeverity;
  title: string;
  message: string;
}

// severity → [status word, color]
const TAG: Record<FlagSeverity, [string, string]> = {
  warning: ["DELAYED", T.amber],
  danger: ["HALTED", T.red],
  error: ["HALTED", T.red],
  info: ["BOARDING", T.blue],
};

/**
 * Alerts reframed as a flight departure board.
 * Ported from TheBoard.jsx `Flags`.
 */
export function BoardFlags({ alerts }: { alerts: BoardFlag[] }) {
  return (
    <Board pad={0} rivets={false} style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <Cap>Flags · Departure Status</Cap>
        <Num
          text={String(alerts.length).padStart(2, "0")}
          size="xs"
          color={T.amber}
        />
      </div>
      {alerts.length === 0 ? (
        <div
          style={{
            padding: "16px 20px",
            fontSize: 13,
            color: T.mut,
          }}
        >
          All clear — no flags this period.
        </div>
      ) : (
        alerts.map((a, i) => {
          const [status, col] = TAG[a.type];
          return (
            <div
              key={`${a.title}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "13px 20px",
                borderBottom:
                  i < alerts.length - 1 ? `1px solid ${T.line}` : "none",
              }}
            >
              <StatusDot color={col} size={8} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: `800 14.5px ${T.disp}`,
                    color: T.ink,
                    letterSpacing: "0.01em",
                  }}
                >
                  {a.title}
                </div>
                <div style={{ fontSize: 12.5, color: T.mut, marginTop: 1 }}>
                  {a.message}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  flexShrink: 0,
                }}
              >
                <Num text={status} size="xs" color={col} />
              </div>
            </div>
          );
        })
      )}
    </Board>
  );
}
