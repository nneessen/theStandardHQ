// src/features/contracting/components/hub/MyContractingPanel.tsx
// "As a downline/agent" (mockup C — My Contracting): a single board card with a
// status chipstrip, my per-carrier table (Carrier · Status · Writing # · Submitted
// · Approved), and the path to contract under a different upline when I'm blocked.
// Newly-eligible carriers live in the always-on Action Center, not here.

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  UserPlus,
  X,
  Loader2,
  IdCard,
  Check,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Board, EmptyState, StatusDot, T } from "@/components/board";
import { useIsMobile } from "@/hooks/ui";
import { Pager } from "./Pager";
import { StatusTag, statusColor, STATUS_OPTIONS } from "./StatusTag";
import { RequestDifferentUplineDialog } from "./RequestDifferentUplineDialog";
import { CarrierContractingInfo } from "./CarrierContractingInfo";
import { HeldUnderCell } from "./HeldUnderCell";
import {
  useMyContracts,
  useMySponsorships,
  useCancelSponsorship,
  useMyUserId,
  useSetContractStatus,
  useHubCarriers,
} from "../../hooks/useContractingHub";
import type { ContractStatus } from "../../services/contractingHubService";
import type { CarrierContractingInstructions } from "@/types/carrier.types";

const ROWS_PAGE = 25;

const cardHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 14px",
  borderBottom: `1px solid ${T.line}`,
};
const chipstrip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  padding: "10px 14px",
  borderBottom: `1px solid ${T.line}`,
  flexWrap: "wrap",
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 14px",
  borderBottom: `1px solid ${T.line}`,
};
const colHead: React.CSSProperties = {
  ...rowStyle,
  padding: "7px 14px",
  color: T.mut2,
  font: `700 10px ${T.mono}`,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
const dateCol: React.CSSProperties = {
  width: 70,
  textAlign: "right",
  font: `500 11px ${T.data}`,
  color: T.mut2,
  fontVariantNumeric: "tabular-nums",
};

function CountChip({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone: string;
}) {
  const on = n > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <StatusDot
        color={on ? tone : T.mut2}
        size={7}
        glow={on && tone === T.green}
      />
      <span style={{ font: `800 13px ${T.mono}`, color: on ? tone : T.mut2 }}>
        {n}
      </span>
      <span
        style={{ font: `600 11.5px ${T.data}`, color: on ? T.mut : T.mut2 }}
      >
        {label}
      </span>
    </span>
  );
}

export function MyContractingPanel() {
  const isMobile = useIsMobile();
  const contracts = useMyContracts();
  const sponsorships = useMySponsorships();
  const cancelMut = useCancelSponsorship();
  const me = useMyUserId();
  const carriers = useHubCarriers();
  const setStatus = useSetContractStatus();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCarrier, setDialogCarrier] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const rows = useMemo(() => contracts.data ?? [], [contracts.data]);

  // per-carrier "what to expect" instructions, keyed by carrier id
  const carrierMetaById = useMemo(() => {
    const m = new Map<string, CarrierContractingInstructions | null>();
    for (const c of carriers.data ?? []) m.set(c.id, c.contracting);
    return m;
  }, [carriers.data]);

  // carriers in my org I don't yet have a contract row for — the "Add carrier" menu
  const addable = useMemo(() => {
    const have = new Set(rows.map((r) => r.carrierId));
    return (carriers.data ?? [])
      .filter((c) => !have.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [carriers.data, rows]);

  const saveWriting = async (carrierId: string) => {
    const v = draft.trim();
    setEditKey(null);
    if (!v || !me.data) return;
    await setStatus.mutateAsync({
      agentId: me.data,
      carrierId,
      status: "approved",
      writingNumber: v,
    });
  };
  const counts = useMemo(() => {
    const c = { approved: 0, inProgress: 0, denied: 0 };
    for (const r of rows) {
      if (r.status === "approved") c.approved++;
      else if (r.status === "submitted" || r.status === "pending")
        c.inProgress++;
      else if (r.status === "denied") c.denied++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => r.carrierName.toLowerCase().includes(q))
      : rows;
    return list
      .slice()
      .sort((a, b) => a.carrierName.localeCompare(b.carrierName));
  }, [rows, search]);

  useEffect(() => setPage(1), [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PAGE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (pageSafe - 1) * ROWS_PAGE,
    pageSafe * ROWS_PAGE,
  );

  const isLoading = contracts.isLoading;

  const openDialog = (carrierId: string | null) => {
    setDialogCarrier(carrierId);
    setDialogOpen(true);
  };

  return (
    <Board
      pad={0}
      style={{
        height: isMobile ? undefined : "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div style={isMobile ? { ...cardHead, flexWrap: "wrap" } : cardHead}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: `700 15px ${T.disp}`, color: T.ink }}>
            My carrier contracting
          </div>
          <div style={{ font: `500 11px ${T.data}`, color: T.mut2 }}>
            {rows.length} carrier{rows.length === 1 ? "" : "s"} ·{" "}
            {counts.approved} approved
          </div>
        </div>
        <div
          style={{
            marginLeft: isMobile ? 0 : "auto",
            width: isMobile ? "100%" : undefined,
            display: "flex",
            alignItems: "center",
            flexWrap: isMobile ? "wrap" : "nowrap",
            gap: 8,
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2"
              style={{ color: T.mut2 }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search carriers"
              className="h-8 pl-7 text-xs w-48"
            />
          </div>
          {addable.length > 0 && (
            <Select
              value=""
              onValueChange={(carrierId) =>
                me.data &&
                setStatus.mutate({
                  agentId: me.data,
                  carrierId,
                  status: "submitted",
                })
              }
            >
              <SelectTrigger className="h-8 text-xs w-[150px]">
                <SelectValue placeholder="+ Add carrier" />
              </SelectTrigger>
              <SelectContent>
                {addable.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openDialog(null)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Request different upline
          </Button>
        </div>
      </div>

      {/* chipstrip */}
      <div style={chipstrip}>
        <CountChip label="approved" n={counts.approved} tone={T.green} />
        <CountChip label="in progress" n={counts.inProgress} tone={T.blue} />
        <CountChip label="denied" n={counts.denied} tone={T.red} />
      </div>

      {/* table */}
      <div
        style={
          isMobile ? undefined : { flex: 1, minHeight: 0, overflow: "auto" }
        }
      >
        {isLoading ? (
          <Loading label="Loading your carriers…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IdCard size={20} />}
            title={
              rows.length === 0
                ? "No carrier contracts yet"
                : "No carriers match"
            }
            hint={
              rows.length === 0
                ? "Use “Add carrier” above to start tracking a carrier contract, or pick one from the Action Center’s “Newly eligible” box."
                : "Adjust the search to find a carrier."
            }
            pad={40}
          />
        ) : (
          <>
            {/* Only the wide fixed-column table scrolls sideways on mobile —
                the Pager below stays at viewport width. */}
            <div style={isMobile ? { overflowX: "auto" } : undefined}>
              <div style={isMobile ? { minWidth: 840 } : undefined}>
                <div style={colHead}>
                  <span style={{ flex: 1, minWidth: 0 }}>Carrier</span>
                  <span style={{ width: 128 }}>Status</span>
                  <span style={{ width: 150 }}>Writing #</span>
                  <span style={{ width: 150 }}>Held under</span>
                  <span style={{ width: 70, textAlign: "right" }}>
                    Submitted
                  </span>
                  <span style={{ width: 70, textAlign: "right" }}>
                    Approved
                  </span>
                  <span style={{ width: 96 }} />
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {pageRows.map((r) => {
                    const blocked = r.status === "denied";
                    const editing = editKey === r.carrierId;
                    return (
                      <li
                        key={r.carrierId}
                        className="hover:bg-white/[0.03]"
                        style={rowStyle}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <StatusDot
                            color={statusColor(r.status)}
                            size={8}
                            glow={r.status === "approved"}
                          />
                          <span
                            style={{
                              font: `600 13px ${T.data}`,
                              color: T.ink,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.carrierName}
                          </span>
                          <CarrierContractingInfo
                            carrierName={r.carrierName}
                            instructions={
                              carrierMetaById.get(r.carrierId) ?? null
                            }
                          />
                        </span>
                        <span style={{ width: 128 }}>
                          <Select
                            value={r.status}
                            onValueChange={(v) =>
                              me.data &&
                              setStatus.mutate({
                                agentId: me.data,
                                carrierId: r.carrierId,
                                status: v as ContractStatus,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </span>
                        <span
                          style={{
                            width: 150,
                            display: "flex",
                            justifyContent: "flex-start",
                          }}
                        >
                          {r.status === "approved" ? (
                            editing ? (
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Input
                                  value={draft}
                                  onChange={(e) => setDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      saveWriting(r.carrierId);
                                    if (e.key === "Escape") setEditKey(null);
                                  }}
                                  autoFocus
                                  placeholder="Writing #"
                                  className="h-7 text-xs w-28"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => saveWriting(r.carrierId)}
                                  aria-label="Save"
                                >
                                  <Check
                                    className="h-3.5 w-3.5"
                                    style={{ color: T.green }}
                                  />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditKey(null)}
                                  aria-label="Cancel"
                                >
                                  <X
                                    className="h-3.5 w-3.5"
                                    style={{ color: T.red }}
                                  />
                                </Button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditKey(r.carrierId);
                                  setDraft(r.writingNumber ?? "");
                                }}
                                className="inline-flex items-center gap-1.5 hover:opacity-80"
                                style={{
                                  font: `700 12.5px ${T.mono}`,
                                  color: r.writingNumber ? T.cream : T.mut2,
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {r.writingNumber ?? "Add #"}
                                <Pencil
                                  className="h-3 w-3"
                                  style={{ color: T.mut2 }}
                                />
                              </button>
                            )
                          ) : (
                            <span
                              style={{
                                font: `700 12.5px ${T.mono}`,
                                color: T.mut2,
                              }}
                            >
                              —
                            </span>
                          )}
                        </span>
                        <HeldUnderCell
                          agentId={me.data ?? ""}
                          carrierId={r.carrierId}
                          heldUnderId={r.heldUnderId}
                          heldUnderName={r.heldUnderName}
                          heldUnderUserName={r.heldUnderUserName}
                        />
                        <span style={dateCol}>{r.submittedDate ?? "—"}</span>
                        <span style={dateCol}>{r.approvedDate ?? "—"}</span>
                        <span
                          style={{
                            width: 96,
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          {blocked && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="shrink-0"
                              onClick={() => openDialog(r.carrierId)}
                            >
                              <UserPlus className="h-3 w-3" />
                              Try alt upline
                            </Button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <Pager
              page={pageSafe}
              pageSize={ROWS_PAGE}
              total={filtered.length}
              onPage={setPage}
            />
          </>
        )}

        {/* my outgoing sponsorship requests */}
        {(sponsorships.data?.length ?? 0) > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div
              style={{
                padding: "12px 14px 8px",
                font: `700 11px ${T.mono}`,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.mut2,
              }}
            >
              My alternate-sponsor requests
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {sponsorships.data!.map((s) => {
                const pending =
                  s.overallStatus === "pending_sponsor" ||
                  s.overallStatus === "pending_sponsor_upline";
                return (
                  <li key={s.id} style={rowStyle}>
                    <StatusDot color={statusColor(s.overallStatus)} size={8} />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        font: `600 13px ${T.data}`,
                        color: T.ink,
                      }}
                    >
                      {s.carrierName}
                      <span
                        style={{
                          font: `500 11px ${T.data}`,
                          color: T.mut2,
                          marginLeft: 8,
                        }}
                      >
                        under {s.sponsorName}
                      </span>
                    </span>
                    <StatusTag status={s.overallStatus} />
                    {pending && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => cancelMut.mutate(s.id)}
                        disabled={cancelMut.isPending}
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <RequestDifferentUplineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultCarrierId={dialogCarrier}
      />
    </Board>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 128,
        gap: 8,
        font: `500 12px ${T.data}`,
        color: T.mut,
      }}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
