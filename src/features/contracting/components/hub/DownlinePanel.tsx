// src/features/contracting/components/hub/DownlinePanel.tsx
// "As an upline" (mockup C): side-by-side roster (left) + selected-agent detail (right),
// both visible at once. Inline status + writing-number edits (is_upline_of-authorized).

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Users, Check, X, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Board, EmptyState, Pill, StatusDot, T } from "@/components/board";
import { useMyDownlines } from "@/hooks/hierarchy";
import { useIsMobile } from "@/hooks/ui";
import { Pager } from "./Pager";
import { statusColor, STATUS_OPTIONS } from "./StatusTag";
import { HeldUnderCell } from "./HeldUnderCell";
import {
  useDownlineContracts,
  useHubCarriers,
  useSetContractStatus,
} from "../../hooks/useContractingHub";
import type { DownlineContractRow } from "../../services/contractingHubService";

type ContractStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "denied"
  | "terminated";

const ROSTER_PAGE = 25;

const cardHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 14px",
  borderBottom: `1px solid ${T.line}`,
};
const detailRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 14px",
  borderBottom: `1px solid ${T.line}`,
};

export function DownlinePanel() {
  const isMobile = useIsMobile();
  const downlines = useMyDownlines();
  const contracts = useDownlineContracts();
  const carriers = useHubCarriers();
  const setStatus = useSetContractStatus();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);

  const byAgent = useMemo(() => {
    const m = new Map<string, DownlineContractRow[]>();
    for (const r of contracts.data ?? []) {
      const a = m.get(r.agentId) ?? [];
      a.push(r);
      m.set(r.agentId, a);
    }
    return m;
  }, [contracts.data]);

  const roster = useMemo(() => {
    const list = (downlines.data ?? []).map((d) => {
      const rows = byAgent.get(d.id) ?? [];
      const name =
        [d.first_name, d.last_name].filter(Boolean).join(" ").trim() || d.email;
      return {
        id: d.id,
        name,
        email: d.email,
        level: d.contract_level ?? null,
        approved: rows.filter((r) => r.status === "approved").length,
        inProgress: rows.filter(
          (r) => r.status === "submitted" || r.status === "pending",
        ).length,
        denied: rows.filter((r) => r.status === "denied").length,
        total: rows.length,
      };
    });
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.email.toLowerCase().includes(q),
        )
      : list;
    return filtered.sort(
      (a, b) =>
        b.inProgress - a.inProgress ||
        b.total - a.total ||
        a.name.localeCompare(b.name),
    );
  }, [downlines.data, byAgent, search]);

  // auto-select the first agent so the detail pane is never empty
  useEffect(() => {
    if (!selected && roster.length > 0) setSelected(roster[0].id);
  }, [selected, roster]);

  // pagination — keeps the roster usable at hundreds of agents
  useEffect(() => setPage(1), [search]);
  const totalPages = Math.max(1, Math.ceil(roster.length / ROSTER_PAGE));
  const pageSafe = Math.min(page, totalPages);
  const pageRoster = roster.slice(
    (pageSafe - 1) * ROSTER_PAGE,
    pageSafe * ROSTER_PAGE,
  );

  const isLoading = downlines.isLoading || contracts.isLoading;

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 8,
          font: `500 12px ${T.data}`,
          color: T.mut,
        }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your team…
      </div>
    );
  }
  if ((downlines.data?.length ?? 0) === 0) {
    return (
      <Board
        pad={0}
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyState
          icon={<Users size={20} />}
          title="No downline yet"
          hint="Once you have agents reporting to you, you'll track and manage their carrier contracting here."
          pad={40}
        />
      </Board>
    );
  }

  const agent = roster.find((r) => r.id === selected);
  const rows = selected
    ? (byAgent.get(selected) ?? [])
        .slice()
        .sort((a, b) => a.carrierName.localeCompare(b.carrierName))
    : [];
  const used = new Set(rows.map((r) => r.carrierId));
  const addable = (carriers.data ?? []).filter((c) => !used.has(c.id));

  const saveWriting = async (carrierId: string) => {
    const v = draft.trim();
    setEditKey(null);
    if (!v || !selected) return;
    await setStatus.mutateAsync({
      agentId: selected,
      carrierId,
      status: "approved",
      writingNumber: v,
    });
  };

  return (
    <div
      style={
        isMobile
          ? { display: "flex", flexDirection: "column", gap: 14 }
          : {
              display: "grid",
              gridTemplateColumns: "340px 1fr",
              gap: 14,
              height: "100%",
              minHeight: 0,
            }
      }
    >
      {/* ── Roster (left / top on mobile) ── */}
      <Board
        pad={0}
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
          // On mobile the roster sits above the detail pane in one scrolling
          // column — cap it so the auto-selected agent's detail stays reachable.
          maxHeight: isMobile ? "45vh" : undefined,
        }}
      >
        <div style={cardHead}>
          <Users className="h-3.5 w-3.5" style={{ color: T.blue }} />
          <span
            style={{
              font: `700 11px ${T.mono}`,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.mut,
            }}
          >
            My Team
          </span>
          <span
            style={{
              marginLeft: "auto",
              font: `700 11px ${T.mono}`,
              color: T.mut2,
            }}
          >
            {roster.length}
          </span>
        </div>
        <div
          style={{ position: "relative", borderBottom: `1px solid ${T.line}` }}
        >
          <Search
            className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: T.mut2 }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents"
            className="h-9 pl-8 text-xs border-0 rounded-none shadow-none focus-visible:ring-0"
          />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {roster.length === 0 ? (
            <EmptyState
              icon={<Search size={18} />}
              title="No agents match"
              hint="Adjust the search."
              pad={32}
            />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {pageRoster.map((e) => {
                const on = e.id === selected;
                return (
                  <li
                    key={e.id}
                    onClick={() => setSelected(e.id)}
                    className="hover:bg-white/[0.03]"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 14px",
                      borderBottom: `1px solid ${T.line}`,
                      cursor: "pointer",
                      background: on ? "rgba(91,155,255,0.10)" : "transparent",
                      boxShadow: on ? `inset 3px 0 0 ${T.blue}` : "none",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            font: `600 12.5px ${T.data}`,
                            color: T.ink,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {e.name}
                        </span>
                        {e.level != null && (
                          <span
                            style={{ font: `600 9px ${T.mono}`, color: T.mut2 }}
                          >
                            L{e.level}
                          </span>
                        )}
                      </div>
                    </div>
                    <Cnt n={e.approved} color={T.green} />
                    <Cnt n={e.inProgress} color={T.amber} />
                    <Cnt n={e.denied} color={T.red} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Pager
          page={pageSafe}
          pageSize={ROSTER_PAGE}
          total={roster.length}
          onPage={setPage}
        />
      </Board>

      {/* ── Detail (right) ── */}
      <Board
        pad={0}
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {!agent ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EmptyState
              icon={<Users size={20} />}
              title="Select an agent"
              hint="Pick an agent on the left to manage their carrier contracting."
              pad={40}
            />
          </div>
        ) : (
          <>
            <div style={cardHead}>
              <span style={{ font: `700 15px ${T.disp}`, color: T.ink }}>
                {agent.name}
              </span>
              {agent.level != null && (
                <Pill tone="blue" style={{ padding: "3px 8px", fontSize: 10 }}>
                  L{agent.level}
                </Pill>
              )}
              {addable.length > 0 && (
                <div style={{ marginLeft: "auto" }}>
                  <Select
                    value=""
                    onValueChange={(carrierId) =>
                      selected &&
                      setStatus.mutate({
                        agentId: selected,
                        carrierId,
                        status: "submitted",
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-[170px]">
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
                </div>
              )}
            </div>
            <div
              style={
                isMobile
                  ? { overflowX: "auto" }
                  : { flex: 1, minHeight: 0, overflow: "auto" }
              }
            >
              {rows.length === 0 ? (
                <EmptyState
                  title="No carriers yet"
                  hint="Use “Add carrier” above to start a contracting request for this agent."
                  pad={40}
                />
              ) : (
                <div style={isMobile ? { minWidth: 600 } : undefined}>
                  <div
                    style={{
                      ...detailRow,
                      padding: "7px 14px",
                      color: T.mut2,
                      font: `700 10px ${T.mono}`,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ flex: 1 }}>Carrier</span>
                    <span style={{ width: 150 }}>Writing #</span>
                    <span style={{ width: 150 }}>Held under</span>
                    <span style={{ width: 130 }}>Status</span>
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {rows.map((r) => {
                      const editing = editKey === r.carrierId;
                      return (
                        <li
                          key={r.carrierId}
                          className="hover:bg-white/[0.03]"
                          style={detailRow}
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
                            agentId={r.agentId}
                            carrierId={r.carrierId}
                            heldUnderId={r.heldUnderId}
                            heldUnderName={r.heldUnderName}
                            heldUnderUserName={r.heldUnderUserName}
                          />

                          <span style={{ width: 130 }}>
                            <Select
                              value={r.status}
                              onValueChange={(v) =>
                                selected &&
                                setStatus.mutate({
                                  agentId: selected,
                                  carrierId: r.carrierId,
                                  status: v as ContractStatus,
                                })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-[124px]">
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
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </Board>
    </div>
  );
}

function Cnt({ n, color }: { n: number; color: string }) {
  return (
    <span
      style={{
        minWidth: 20,
        textAlign: "center",
        font: `800 11.5px ${T.mono}`,
        color: n > 0 ? color : T.mut2,
        opacity: n > 0 ? 1 : 0.5,
      }}
    >
      {n}
    </span>
  );
}
