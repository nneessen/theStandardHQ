import { ArrowUp } from "lucide-react";
import { Board, Cap, Num, SplitFlap, StatusDot, T } from "@/components/board";

export interface BoardHeroProps {
  /** Eyebrow, e.g. "Premium Written · MTD". */
  premiumEyebrow: string;
  /** Formatted premium, e.g. "$2,040". */
  premiumValue: string;
  /** 0–1 progress toward the premium target. */
  premiumPct: number;
  /** Right-of-bar label, e.g. "5% OF $34K". */
  premiumBarLabel: string;
  /** Caption under the bar (already composed). */
  premiumCaption: React.ReactNode;
  /** Real leaderboard rank (1-based) or null when unranked/loading. */
  rank: number | null;
  /** Display name beside the rank. */
  rankName: string | null;
  /** Total ranked entries (for "of N" context). */
  rankTotal: number;
}

/**
 * The hero row — Premium Written (1.6fr) + Rank (1fr split-flap).
 * Ported from TheBoard.jsx `Hero`. All values are real (passed from the
 * dashboard's existing data hooks + useMyRank).
 */
export function BoardHero({
  premiumEyebrow,
  premiumValue,
  premiumPct,
  premiumBarLabel,
  premiumCaption,
  rank,
  rankName,
  rankTotal,
}: BoardHeroProps) {
  const pctWidth = `${Math.max(0, Math.min(1, premiumPct)) * 100}%`;
  const isLeader = rank === 1;

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Board pad={24} style={{ backgroundImage: T.brushed }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Cap>{premiumEyebrow}</Cap>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: `700 10px ${T.mono}`,
              color: T.amber,
              letterSpacing: "0.1em",
            }}
          >
            <StatusDot color={T.amber} size={6} />
            LIVE
          </span>
        </div>
        <div style={{ margin: "20px 0 18px" }}>
          <Num text={premiumValue} size="xl" lit />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: "rgba(0,0,0,0.4)",
              overflow: "hidden",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                width: pctWidth,
                height: "100%",
                background: T.blue,
                boxShadow: `0 0 10px ${T.blue}`,
              }}
            />
          </div>
          <span
            style={{
              font: `700 12px ${T.mono}`,
              color: T.mut,
              whiteSpace: "nowrap",
            }}
          >
            {premiumBarLabel}
          </span>
        </div>
        <div style={{ marginTop: 16, fontSize: 13.5, color: T.mut }}>
          {premiumCaption}
        </div>
      </Board>

      <Board
        pad={24}
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Cap>Rank</Cap>
        <SplitFlap
          text={rank ? `#${String(rank).padStart(2, "0")}` : "--"}
          size="lg"
          lit
        />
        {rankName && (
          <div
            style={{
              font: `800 15px ${T.disp}`,
              color: T.ink,
              letterSpacing: "0.02em",
              textAlign: "center",
            }}
          >
            {rankName}
          </div>
        )}
        {rank != null &&
          (isLeader ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 999,
                background: "rgba(95,208,138,0.12)",
                color: T.green,
                font: `800 11px ${T.data}`,
              }}
            >
              <ArrowUp size={13} strokeWidth={3} /> Holding the lead
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 999,
                background: "rgba(107,151,255,0.12)",
                color: T.blue,
                font: `800 11px ${T.data}`,
              }}
            >
              Rank {rank}
              {rankTotal ? ` of ${rankTotal}` : ""}
            </div>
          ))}
      </Board>
    </div>
  );
}
