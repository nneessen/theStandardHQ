import { Board } from "./Board";
import { Num } from "./Num";
import { T } from "./tokens";

export interface TickerProps {
  /** [label, value] pairs, e.g. ["ANN. PREMIUM", "$0"]. */
  items: Array<[string, string]>;
  /** Left tab label (default "◈ ORG"). */
  tab?: string;
  style?: React.CSSProperties;
}

/**
 * Bottom broadcast ticker — a blue tab + a marquee-style row of org/override
 * values with amber dot separators. Ported from TheBoard.jsx `Ticker`.
 */
export function Ticker({ items, tab = "◈ ORG", style }: TickerProps) {
  return (
    <Board pad={0} style={{ overflow: "hidden", ...style }} rivets={false}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <div
          style={{
            flexShrink: 0,
            padding: "14px 16px",
            background: T.blue,
            color: "#08152b",
            font: `800 11px ${T.mono}`,
            letterSpacing: "0.12em",
            alignSelf: "stretch",
            display: "flex",
            alignItems: "center",
          }}
        >
          {tab}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: "12px 20px",
            overflow: "hidden",
          }}
        >
          {items.map(([label, value], i) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  font: `700 10px ${T.mono}`,
                  letterSpacing: "0.08em",
                  color: T.mut2,
                }}
              >
                {label}
              </span>
              <Num text={value} size="xs" />
              {i < items.length - 1 && (
                <span
                  aria-hidden
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    background: T.amber,
                    marginLeft: 13,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Board>
  );
}
