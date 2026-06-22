import { Folder, Layers } from "lucide-react";
import { T } from "@/components/board";
import {
  ACCENT,
  CATEGORY_ACCENT,
  tint,
  type AccentKey,
  type Category,
} from "./guideAttributes";

/** Which slice of the library the browser is showing. */
export type Scope =
  | { kind: "all" }
  | { kind: "carrier"; id: string; name: string; accent: AccentKey }
  | { kind: "category"; category: Category };

export interface RailCarrier {
  id: string;
  name: string;
  accent: AccentKey;
  count: number;
}

export interface RailCategory {
  category: Category;
  count: number;
}

interface CarrierRailProps {
  scope: Scope;
  onScope: (scope: Scope) => void;
  total: number;
  carriers: RailCarrier[];
  categories: RailCategory[];
}

const EYEBROW: React.CSSProperties = {
  font: `700 9.5px ${T.mono}`,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: T.mut2,
  padding: "0 6px",
  marginBottom: 4,
};

const COUNT: React.CSSProperties = {
  font: `600 11px ${T.mono}`,
  color: T.mut2,
  fontVariantNumeric: "tabular-nums",
  marginLeft: "auto",
  flexShrink: 0,
};

function Row({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent?: AccentKey;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/railrow"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: 34,
        padding: "0 8px 0 10px",
        borderRadius: 7,
        textAlign: "left",
        background: active && accent ? tint(accent, 12) : "transparent",
        color: active ? T.ink : T.mut,
        transition: "background 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = tint("slate", 8);
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {active && accent ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 6,
            bottom: 6,
            width: 2.5,
            borderRadius: 2,
            background: ACCENT[accent],
          }}
        />
      ) : null}
      {children}
    </button>
  );
}

/**
 * Pane 1 — the carrier rail. Three labelled groups: a single "All documents"
 * entry, one folder-icon row per carrier (color-coded, never a monogram), and
 * read-only category filter rows (colored dot + name). This is the part of the
 * UI that grows, so it scrolls independently.
 */
export function CarrierRail({
  scope,
  onScope,
  total,
  carriers,
  categories,
}: CarrierRailProps) {
  return (
    <div
      style={{
        background: T.panelGradient,
        borderRight: `1px solid ${T.line}`,
        padding: "16px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      <div>
        <div style={EYEBROW}>Library</div>
        <Row
          active={scope.kind === "all"}
          accent="blue"
          onClick={() => onScope({ kind: "all" })}
        >
          <Layers
            className="h-4 w-4 shrink-0"
            style={{ color: scope.kind === "all" ? T.blue : T.mut2 }}
          />
          <span className="truncate" style={{ font: `600 13px ${T.data}` }}>
            All documents
          </span>
          <span style={COUNT}>{total}</span>
        </Row>
      </div>

      <div style={{ minHeight: 0 }}>
        <div style={EYEBROW}>Carriers</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {carriers.map((c) => {
            const active = scope.kind === "carrier" && scope.id === c.id;
            return (
              <Row
                key={c.id}
                active={active}
                accent={c.accent}
                onClick={() =>
                  onScope({
                    kind: "carrier",
                    id: c.id,
                    name: c.name,
                    accent: c.accent,
                  })
                }
              >
                <Folder
                  className="h-4 w-4 shrink-0"
                  style={{ color: ACCENT[c.accent] }}
                  fill={active ? tint(c.accent, 26) : "transparent"}
                />
                <span
                  className="truncate"
                  style={{ font: `600 13px ${T.data}` }}
                  title={c.name}
                >
                  {c.name}
                </span>
                <span style={COUNT}>{c.count}</span>
              </Row>
            );
          })}
        </div>
      </div>

      {categories.length > 0 ? (
        <div>
          <div style={EYEBROW}>Categories</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {categories.map((c) => {
              const active =
                scope.kind === "category" && scope.category === c.category;
              const accent = CATEGORY_ACCENT[c.category];
              return (
                <Row
                  key={c.category}
                  active={active}
                  accent={accent}
                  onClick={() =>
                    onScope({ kind: "category", category: c.category })
                  }
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: ACCENT[accent],
                    }}
                  />
                  <span
                    className="truncate"
                    style={{ font: `600 12.5px ${T.data}` }}
                  >
                    {c.category}
                  </span>
                  <span style={COUNT}>{c.count}</span>
                </Row>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
