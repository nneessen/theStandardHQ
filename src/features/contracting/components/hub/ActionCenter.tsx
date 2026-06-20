// src/features/contracting/components/hub/ActionCenter.tsx
// Always-on top rail (mockup C): two side-by-side boxes —
// NEWLY ELIGIBLE (what just opened up for me) · APPROVALS NEEDED (sponsorships I owe).

import { Sparkles, Inbox, ArrowRight, Check, X } from "lucide-react";
import { Board, Cap, StatusDot, T } from "@/components/board";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/ui";
import {
  useApproveSponsorship,
  useMyUserId,
  useNewlyEligibleCarriers,
  useSetContractStatus,
  useSponsorshipInbox,
} from "../../hooks/useContractingHub";
import type { SponsorshipInboxRow } from "../../services/contractingHubService";

const boxStyle: React.CSSProperties = {
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 210,
  overflow: "auto",
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
const emptyHint: React.CSSProperties = {
  font: `500 12px ${T.data}`,
  color: T.mut2,
  padding: "10px 0",
};

function ApprovalRow({ row }: { row: SponsorshipInboxRow }) {
  const approve = useApproveSponsorship();
  const busy = approve.isPending;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        paddingBottom: 8,
        borderBottom: `1px dashed ${T.line}`,
      }}
    >
      <div style={{ font: `600 12.5px ${T.data}`, color: T.ink }}>
        <span
          style={{
            font: `800 9px ${T.mono}`,
            letterSpacing: "0.06em",
            color: T.blue,
          }}
        >
          {row.myStep === "sponsor" ? "AS SPONSOR" : "FINAL"}
        </span>{" "}
        {row.requesterName}
        <span style={{ color: T.mut, fontWeight: 500 }}>
          {" "}
          · {row.carrierName} under {row.sponsorName}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StatusDot
          color={
            row.sponsorApprovalStatus === "approved"
              ? T.green
              : row.myStep === "sponsor"
                ? T.blue
                : T.mut2
          }
          size={6}
        />
        <span style={{ font: `500 10.5px ${T.data}`, color: T.mut }}>
          step 1
          {row.sponsorUplineApprovalStatus !== "skipped" ? " · step 2" : ""}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          <Button
            type="button"
            size="xs"
            onClick={() => approve.mutate({ requestId: row.id, approve: true })}
            disabled={busy}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() =>
              approve.mutate({ requestId: row.id, approve: false })
            }
            disabled={busy}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActionCenter() {
  const me = useMyUserId();
  const isMobile = useIsMobile();
  const eligible = useNewlyEligibleCarriers();
  const inbox = useSponsorshipInbox();
  const setStatus = useSetContractStatus();
  const eList = eligible.data ?? [];
  const aList = inbox.data ?? [];

  // On mobile let the boxes grow with content (no capped scroll window inside an
  // already-short column); desktop keeps the fixed-height board look.
  const box: React.CSSProperties = isMobile
    ? { ...boxStyle, maxHeight: undefined, overflow: undefined }
    : boxStyle;

  return (
    <Board pad={0} style={{ flexShrink: 0 }}>
      <div
        style={{
          padding: "9px 14px",
          borderBottom: `1px solid ${T.line}`,
          font: `700 11px ${T.mono}`,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.mut,
        }}
      >
        Action Center
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        }}
      >
        {/* NEWLY ELIGIBLE */}
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: T.blue }} />
            <Cap>Newly eligible</Cap>
            {eList.length > 0 && (
              <span style={countTag(T.blue)}>{eList.length}</span>
            )}
          </div>
          {eList.length === 0 ? (
            <div style={emptyHint}>Nothing new — you&apos;re up to date.</div>
          ) : (
            eList.map((c) => (
              <div
                key={c.carrierId}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <StatusDot color={T.blue} size={7} glow />
                <span style={{ font: `600 12.5px ${T.data}`, color: T.ink }}>
                  {c.carrierName}
                </span>
                <span style={{ font: `500 10.5px ${T.data}`, color: T.mut2 }}>
                  upline approved{c.approvedDate ? ` · ${c.approvedDate}` : ""}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="ml-auto shrink-0"
                  onClick={() =>
                    me.data &&
                    setStatus.mutate({
                      agentId: me.data,
                      carrierId: c.carrierId,
                      status: "pending",
                    })
                  }
                  disabled={setStatus.isPending}
                >
                  Start request
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* APPROVALS NEEDED */}
        <div
          style={{
            ...box,
            ...(isMobile
              ? { borderTop: `1px solid ${T.line}` }
              : { borderLeft: `1px solid ${T.line}` }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Inbox className="h-3.5 w-3.5" style={{ color: T.amber }} />
            <Cap>Approvals needed</Cap>
            {aList.length > 0 && (
              <span style={countTag(T.amber)}>{aList.length}</span>
            )}
          </div>
          {aList.length === 0 ? (
            <div style={emptyHint}>
              No sponsorship approvals waiting on you.
            </div>
          ) : (
            aList.map((row) => <ApprovalRow key={row.id} row={row} />)
          )}
        </div>
      </div>
    </Board>
  );
}
