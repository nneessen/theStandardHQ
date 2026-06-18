// src/features/inbound-crm/components/InboundCallPop.tsx
// The live inbound-call screen-pop: a small fixed top-right card that appears the instant a call
// routes to the agent (the inbound_calls INSERT) and auto-dismisses when the call ends. v1 is
// INFORMATIONAL — caller identity + book match + on-file policy count — giving the agent context as
// the dialer connects them. (No "Open client" action yet: the client console is Phase 4, and a
// button that dead-ends would violate the no-dead-UI rule.)
//
// Styling uses the board `T` tokens as INLINE LITERAL hex values, so the palette is correct
// regardless of where in the tree this renders (no .theme-v2 CSS-var ancestry needed).
import { X } from "lucide-react";
import { T } from "@/components/board/tokens";
import type { InboundCallRow } from "../types";
import {
  useInboundCallClient,
  useInboundCallPolicyCount,
} from "../hooks/useInboundCallClient";

function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const m = raw.replace(/[^\d]/g, "").match(/^1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : raw;
}

export function InboundCallPop({
  call,
  onDismiss,
}: {
  call: InboundCallRow;
  onDismiss: () => void;
}) {
  const { data: client } = useInboundCallClient(call.client_id);
  const { data: policyCount } = useInboundCallPolicyCount(call.client_id);

  const name = client?.name ?? (call.client_id ? "Loading…" : "New caller");
  const phone = formatPhone(call.phone_e164 ?? call.ani);
  const context = [call.state, call.call_program ?? call.offer_id]
    .filter(Boolean)
    .join(" · ");
  const matched = !!call.client_id;
  const match = matched
    ? policyCount == null
      ? "Existing client"
      : `Existing client — ${policyCount} ${policyCount === 1 ? "policy" : "policies"} on file`
    : "Not in your book yet";

  return (
    <div
      role="alertdialog"
      aria-label="Incoming call"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 200, // above Dialog (z-100) and the toaster
        width: 300,
        background: T.surface5,
        border: `1px solid ${T.line2}`,
        boxShadow: T.panelShadow,
        borderRadius: 10,
        padding: "0.85rem 1rem",
        color: T.ink,
        fontFamily: T.data,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              color: T.green,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontFamily: T.mono,
            }}
          >
            ● Incoming call
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: T.ink,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          {phone && <div style={{ fontSize: 13, color: T.mut }}>{phone}</div>}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: T.mut2,
            padding: 2,
            lineHeight: 0,
          }}
        >
          <X size={15} />
        </button>
      </div>

      {context && <div style={{ fontSize: 12, color: T.mut }}>{context}</div>}

      <div style={{ fontSize: 12, color: matched ? T.green : T.amber }}>
        {match}
      </div>

      <div
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}
      >
        <button
          onClick={onDismiss}
          style={{
            background: T.surface3,
            color: T.ink,
            border: `1px solid ${T.line2}`,
            borderRadius: 6,
            padding: "5px 14px",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: T.data,
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
