// src/features/contracting/components/hub/StatusTag.tsx
// Board-styled status chips for carrier_contracts / sponsorship states.
import { Pill, T, type PillTone } from "@/components/board";

const META: Record<string, { label: string; tone: PillTone | null }> = {
  approved: { label: "Approved", tone: "green" },
  submitted: { label: "Submitted", tone: "blue" },
  pending: { label: "Pending", tone: "amber" },
  denied: { label: "Denied", tone: "red" },
  terminated: { label: "Terminated", tone: null },
  // sponsorship overall states
  pending_sponsor: { label: "Awaiting sponsor", tone: "amber" },
  pending_sponsor_upline: { label: "Awaiting upline", tone: "amber" },
  cancelled: { label: "Cancelled", tone: null },
};

export const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "terminated", label: "Terminated" },
];

export function statusColor(status: string): string {
  switch (status) {
    case "approved":
      return T.green;
    case "submitted":
    case "pending_sponsor":
    case "pending_sponsor_upline":
      return T.blue;
    case "pending":
      return T.amber;
    case "denied":
      return T.red;
    default:
      return T.mut2;
  }
}

export function StatusTag({ status }: { status: string }) {
  const m = META[status] ?? { label: status.replace(/_/g, " "), tone: null };
  if (!m.tone) {
    return (
      <span
        style={{
          font: `700 10px ${T.mono}`,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.mut2,
        }}
      >
        {m.label}
      </span>
    );
  }
  return (
    <Pill tone={m.tone} style={{ padding: "4px 9px", fontSize: 10 }}>
      {m.label}
    </Pill>
  );
}
