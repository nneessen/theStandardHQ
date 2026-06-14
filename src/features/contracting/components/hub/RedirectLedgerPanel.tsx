// src/features/contracting/components/hub/RedirectLedgerPanel.tsx
// "Overrides owed back to you" — when a downline's carrier contract is held under a
// different (in-app) upline, that carrier's overrides route to THAT upline's leg instead
// of yours. They settle those back to you off-book, so this panel tallies the total that
// moved off your leg, grouped by agent → carrier → who now receives it. Returns null when
// there's nothing redirected, so it's invisible until it's relevant.

import { Loader2, ArrowRightLeft } from "lucide-react";
import { Board, T } from "@/components/board";
import { useOverrideRedirectLedger } from "../../hooks/useContractingHub";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 14px",
  borderBottom: `1px solid ${T.line}`,
};

export function RedirectLedgerPanel() {
  const ledger = useOverrideRedirectLedger();
  const rows = ledger.data ?? [];

  if (ledger.isLoading) {
    return (
      <Board pad={0}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            font: `500 12px ${T.data}`,
            color: T.mut,
          }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading redirected overrides…
        </div>
      </Board>
    );
  }
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <Board pad={0}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <ArrowRightLeft className="h-3.5 w-3.5" style={{ color: T.amber }} />
        <span style={{ font: `700 13px ${T.disp}`, color: T.ink }}>
          Overrides owed back to you
        </span>
        <span style={{ font: `500 11px ${T.data}`, color: T.mut2 }}>
          carriers your downline holds under a different upline
        </span>
        <span
          style={{
            marginLeft: "auto",
            font: `800 14px ${T.mono}`,
            color: T.amber,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {money(total)}
        </span>
      </div>

      <div
        style={{
          ...row,
          padding: "7px 14px",
          color: T.mut2,
          font: `700 10px ${T.mono}`,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ flex: 1 }}>Agent</span>
        <span style={{ flex: 1 }}>Carrier</span>
        <span style={{ flex: 1 }}>Now goes to</span>
        <span style={{ width: 70, textAlign: "right" }}>Policies</span>
        <span style={{ width: 110, textAlign: "right" }}>Override $</span>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((r) => (
          <li
            key={`${r.agentId}-${r.carrierId}-${r.recipientId}`}
            style={row}
            className="hover:bg-white/[0.03]"
          >
            <span
              style={{ flex: 1, font: `600 12.5px ${T.data}`, color: T.ink }}
            >
              {r.agentName}
            </span>
            <span
              style={{ flex: 1, font: `500 12.5px ${T.data}`, color: T.mut }}
            >
              {r.carrierName}
            </span>
            <span
              style={{ flex: 1, font: `600 12.5px ${T.data}`, color: T.amber }}
            >
              {r.recipientName}
            </span>
            <span
              style={{
                width: 70,
                textAlign: "right",
                font: `600 12px ${T.mono}`,
                color: T.mut,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.policyCount}
            </span>
            <span
              style={{
                width: 110,
                textAlign: "right",
                font: `700 12.5px ${T.mono}`,
                color: T.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {money(r.totalAmount)}
            </span>
          </li>
        ))}
      </ul>
    </Board>
  );
}
