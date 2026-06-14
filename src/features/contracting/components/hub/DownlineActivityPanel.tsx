// src/features/contracting/components/hub/DownlineActivityPanel.tsx
// Always-on awareness surface (rendered under the Action Center, on both tabs): keeps an
// upline aware of everything happening in their downline's contracting — recent status
// changes (submit / approve / deny) and any agents contracting under a DIFFERENT upline.
// Managers see their subtree; super-admins / IMO admins see the whole org (server-scoped).
// Hidden for plain agents (no team, no activity).

import { formatDistanceToNow } from "date-fns";
import { Activity, GitBranch, UserCog } from "lucide-react";
import { Board, Cap, EmptyState, StatusDot, T } from "@/components/board";
import { useMyDownlines } from "@/hooks/hierarchy";
import { useIsMobile } from "@/hooks/ui";
import { StatusTag, statusColor } from "./StatusTag";
import {
  useContractingActivity,
  useDownlineSponsorships,
} from "../../hooks/useContractingHub";
import type {
  ContractingActivityRow,
  DownlineSponsorshipRow,
} from "../../services/contractingHubService";

const box: React.CSSProperties = {
  padding: "10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 188,
  overflow: "auto",
};
const emptyHint: React.CSSProperties = {
  font: `500 12px ${T.data}`,
  color: T.mut2,
  padding: "8px 0",
};
const countTag = (tone: string): React.CSSProperties => ({
  minWidth: 17,
  height: 16,
  padding: "0 5px",
  borderRadius: 999,
  background: tone,
  color: T.bg,
  font: `800 10px ${T.mono}`,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});

function ago(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

function ActivityRow({ r }: { r: ContractingActivityRow }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <StatusDot
        color={statusColor(r.status)}
        size={7}
        glow={r.status === "approved"}
      />
      <span
        style={{
          font: `600 12.5px ${T.data}`,
          color: T.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {r.agentName}
      </span>
      <span
        style={{
          font: `500 11px ${T.data}`,
          color: T.mut,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {r.carrierName}
      </span>
      <span
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <StatusTag status={r.status} />
        <span
          style={{
            font: `500 10px ${T.data}`,
            color: T.mut2,
            whiteSpace: "nowrap",
          }}
        >
          {ago(r.activityAt)}
        </span>
      </span>
    </div>
  );
}

function ArrangementRow({ r }: { r: DownlineSponsorshipRow }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <GitBranch className="h-3.5 w-3.5 shrink-0" style={{ color: T.amber }} />
      <span
        style={{
          font: `600 12.5px ${T.data}`,
          color: T.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {r.requesterName}
        <span style={{ font: `500 11px ${T.data}`, color: T.mut }}>
          {" "}
          · {r.carrierName} under {r.sponsorName}
        </span>
      </span>
      <span style={{ marginLeft: "auto" }}>
        <StatusTag status={r.overallStatus} />
      </span>
    </div>
  );
}

export function DownlineActivityPanel() {
  const isMobile = useIsMobile();
  const downlines = useMyDownlines();
  const activity = useContractingActivity();
  const arrangements = useDownlineSponsorships();

  const aList = activity.data ?? [];
  const sList = arrangements.data ?? [];
  const hasTeam = (downlines.data?.length ?? 0) > 0;

  // Hidden for plain agents: no team AND nothing server-scoped to show. (Avoids a
  // flash by waiting for the team query.)
  if (downlines.isLoading) return null;
  if (!hasTeam && aList.length === 0 && sList.length === 0) return null;

  const colBox: React.CSSProperties = isMobile
    ? { ...box, maxHeight: undefined, overflow: undefined }
    : box;

  return (
    <Board pad={0} style={{ flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 14px",
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <Activity className="h-3.5 w-3.5" style={{ color: T.blue }} />
        <span
          style={{
            font: `700 11px ${T.mono}`,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.mut,
          }}
        >
          Downline Activity
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        }}
      >
        {/* Recent status changes */}
        <div style={colBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Cap>Recent activity</Cap>
            {aList.length > 0 && (
              <span style={countTag(T.blue)}>{aList.length}</span>
            )}
          </div>
          {aList.length === 0 ? (
            <div style={emptyHint}>No recent contracting activity.</div>
          ) : (
            aList.map((r) => (
              <ActivityRow key={`${r.agentId}:${r.carrierId}`} r={r} />
            ))
          )}
        </div>

        {/* Different-upline arrangements */}
        <div
          style={{
            ...colBox,
            ...(isMobile
              ? { borderTop: `1px solid ${T.line}` }
              : { borderLeft: `1px solid ${T.line}` }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <UserCog className="h-3.5 w-3.5" style={{ color: T.amber }} />
            <Cap>Under a different upline</Cap>
            {sList.length > 0 && (
              <span style={countTag(T.amber)}>{sList.length}</span>
            )}
          </div>
          {sList.length === 0 ? (
            <EmptyState
              title="None"
              hint="When a downline requests to contract under another upline, it shows here."
              pad={16}
            />
          ) : (
            sList.map((r) => <ArrangementRow key={r.id} r={r} />)
          )}
        </div>
      </div>
    </Board>
  );
}
