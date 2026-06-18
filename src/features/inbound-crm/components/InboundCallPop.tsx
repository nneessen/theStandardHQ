// src/features/inbound-crm/components/InboundCallPop.tsx
// The live inbound-call screen-pop. Appears the instant a call routes to the agent (the
// inbound_calls INSERT) and auto-dismisses when the call ends. Shows caller identity + book match,
// and lets the agent capture in-call disposition — call type, the carrier they're calling in from,
// and notes — saved onto their own call row via crm_set_call_disposition.
//
// Styling uses the board `T` tokens as INLINE LITERAL hex, so the palette is correct regardless of
// DOM ancestry (the pop renders above .theme-v2 and above ImoProvider — hence imo_id-scoped queries).
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { T } from "@/components/board/tokens";
import type { InboundCallRow } from "../types";
import {
  useInboundCallClient,
  useInboundCallPolicyCount,
} from "../hooks/useInboundCallClient";
import {
  useInboundCallTypes,
  useInboundCarriers,
  useInboundCallDisposition,
} from "../hooks/useInboundCallDisposition";

function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const m = raw.replace(/[^\d]/g, "").match(/^1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : raw;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: T.mut,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontFamily: T.mono,
  marginBottom: 3,
  display: "block",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: T.surface3,
  color: T.ink,
  border: `1px solid ${T.line2}`,
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: 13,
  fontFamily: T.data,
};

export function InboundCallPop({
  call,
  onDismiss,
}: {
  call: InboundCallRow;
  onDismiss: () => void;
}) {
  const { data: client } = useInboundCallClient(call.client_id);
  const { data: policyCount } = useInboundCallPolicyCount(call.client_id);
  const { data: callTypes = [] } = useInboundCallTypes(call.imo_id);
  const { data: carriers = [] } = useInboundCarriers(call.imo_id);
  const disposition = useInboundCallDisposition();

  const [callTypeId, setCallTypeId] = useState<string>(call.call_type_id ?? "");
  const [carrierId, setCarrierId] = useState<string>(
    call.inquiry_carrier_id ?? "",
  );
  const [notes, setNotes] = useState<string>(call.notes ?? "");

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

  const save = () => {
    disposition.mutate(
      {
        requestTag: call.request_tag,
        callTypeId: callTypeId || null,
        inquiryCarrierId: carrierId || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => toast.success("Call details saved"),
        onError: (e: Error) => toast.error(e.message || "Could not save"),
      },
    );
  };

  return (
    <div
      role="alertdialog"
      aria-label="Incoming call"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 200,
        width: 320,
        maxHeight: "calc(100vh - 2rem)",
        overflowY: "auto",
        background: T.surface5,
        border: `1px solid ${T.line2}`,
        boxShadow: T.panelShadow,
        borderRadius: 10,
        padding: "0.85rem 1rem",
        color: T.ink,
        fontFamily: T.data,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* caller header */}
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

      <div style={{ borderTop: `1px solid ${T.line}`, margin: "2px 0" }} />

      {/* in-call disposition */}
      <div>
        <label style={labelStyle}>Call type</label>
        <select
          value={callTypeId}
          onChange={(e) => setCallTypeId(e.target.value)}
          style={fieldStyle}
        >
          <option value="">— select —</option>
          {callTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Current carrier</label>
        <select
          value={carrierId}
          onChange={(e) => setCarrierId(e.target.value)}
          style={fieldStyle}
        >
          <option value="">— select —</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Reason for calling, details…"
          style={{ ...fieldStyle, resize: "vertical", minHeight: 52 }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            color: T.mut,
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
        <button
          onClick={save}
          disabled={disposition.isPending}
          style={{
            background: T.green,
            color: "#0a1a10",
            border: "none",
            borderRadius: 6,
            padding: "5px 16px",
            fontSize: 12,
            fontWeight: 600,
            cursor: disposition.isPending ? "default" : "pointer",
            opacity: disposition.isPending ? 0.6 : 1,
            fontFamily: T.data,
          }}
        >
          {disposition.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
