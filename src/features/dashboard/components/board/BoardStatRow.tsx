import { Board, Cap, Num, T } from "@/components/board";

export interface BoardStat {
  label: string;
  value: string;
  /** Right-aligned delta/percent label (e.g. "8%" or "—"). */
  note?: string;
}

/**
 * Three-up secondary stat row (Commissions / Policies / Pipeline).
 * Ported from TheBoard.jsx `StatRow`.
 */
export function BoardStatRow({ cells }: { cells: BoardStat[] }) {
  return (
    <div
      style={{
        display: "grid",
        // auto-fit wraps the stat cells on narrow screens instead of forcing N
        // fixed columns that overflow on mobile.
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
      {cells.map((c) => (
        <Board key={c.label} pad={18}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Cap>{c.label}</Cap>
            <span style={{ font: `700 11px ${T.mono}`, color: T.mut }}>
              {c.note ?? "—"}
            </span>
          </div>
          <Num text={c.value} size="md" />
        </Board>
      ))}
    </div>
  );
}
