// src/features/contracting/components/hub/HeldUnderCell.tsx
// Inline editor for "Held under a different upline" on a carrier contract row.
// Either the agent (My Contracting tab) or their upline (My Downline tab) can mark
// that this carrier's contract is actually held under someone else — a real app user
// (reroutes overrides to their leg + logs the ledger) OR a free-text outside name
// (suppresses the override up the normal leg). Shared by both tabs.

import { useState } from "react";
import { Pencil, Check, X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { T } from "@/components/board";
import {
  useHeldUnderCandidates,
  useSetContractedUnder,
} from "../../hooks/useContractingHub";

export interface HeldUnderCellProps {
  agentId: string;
  carrierId: string;
  heldUnderId: string | null;
  heldUnderName: string | null;
  /** Resolved display name when heldUnderId points at a real user. */
  heldUnderUserName: string | null;
  width?: number;
}

export function HeldUnderCell({
  agentId,
  carrierId,
  heldUnderId,
  heldUnderName,
  heldUnderUserName,
  width = 150,
}: HeldUnderCellProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [freeText, setFreeText] = useState("");
  const setHeldUnder = useSetContractedUnder();
  const candidates = useHeldUnderCandidates(open ? agentId : null);

  const current = heldUnderId
    ? (heldUnderUserName ?? "Linked upline")
    : (heldUnderName ?? null);

  const list = (candidates.data ?? []).filter((c) =>
    c.agentName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const pickUser = async (id: string) => {
    await setHeldUnder.mutateAsync({ agentId, carrierId, heldUnderId: id });
    setOpen(false);
  };
  const saveFreeText = async () => {
    const v = freeText.trim();
    if (!v) return;
    await setHeldUnder.mutateAsync({
      agentId,
      carrierId,
      heldUnderName: v,
    });
    setFreeText("");
    setOpen(false);
  };
  const clear = async () => {
    await setHeldUnder.mutateAsync({ agentId, carrierId, heldUnderId: null });
    setOpen(false);
  };

  return (
    <span style={{ width, display: "flex", justifyContent: "flex-start" }}>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setFreeText(heldUnderName ?? "");
        }}
      >
        <HeldUnderTrigger current={current} isUser={!!heldUnderId} />
        <PopoverContent align="start" className="w-72 p-0">
          <div
            style={{
              padding: "8px 10px",
              borderBottom: `1px solid ${T.line}`,
              font: `700 10px ${T.mono}`,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: T.mut,
            }}
          >
            Held under a different upline
          </div>

          {/* search team / org for a real user */}
          <div style={{ position: "relative", padding: 8 }}>
            <Search
              className="h-3.5 w-3.5 absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: T.mut2 }}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a person in your org"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div style={{ maxHeight: 180, overflow: "auto" }}>
            {candidates.isLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  font: `500 12px ${T.data}`,
                  color: T.mut,
                }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : list.length === 0 ? (
              <div
                style={{
                  padding: "8px 12px",
                  font: `500 12px ${T.data}`,
                  color: T.mut2,
                }}
              >
                No matching people — use the outside-name box below.
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {list.map((c) => (
                  <li key={c.agentId}>
                    <button
                      type="button"
                      onClick={() => pickUser(c.agentId)}
                      disabled={setHeldUnder.isPending}
                      className="hover:bg-white/[0.04] w-full"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 12px",
                        background:
                          c.agentId === heldUnderId
                            ? "rgba(91,155,255,0.10)"
                            : "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          font: `600 12.5px ${T.data}`,
                          color: T.ink,
                        }}
                      >
                        {c.agentName}
                      </span>
                      {c.agentId === heldUnderId && (
                        <Check
                          className="h-3.5 w-3.5"
                          style={{ color: T.green }}
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* free-text outside upline */}
          <div
            style={{
              borderTop: `1px solid ${T.line}`,
              padding: 8,
              display: "flex",
              gap: 4,
            }}
          >
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveFreeText();
              }}
              placeholder="Or an outside upline's name"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={saveFreeText}
              disabled={!freeText.trim() || setHeldUnder.isPending}
            >
              Save
            </Button>
          </div>

          {(heldUnderId || heldUnderName) && (
            <div
              style={{
                borderTop: `1px solid ${T.line}`,
                padding: 8,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clear}
                disabled={setHeldUnder.isPending}
              >
                <X className="h-3.5 w-3.5" />
                Clear (back to my leg)
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}

function HeldUnderTrigger({
  current,
  isUser,
}: {
  current: string | null;
  isUser: boolean;
}) {
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 hover:opacity-80"
        style={{
          font: `600 12px ${T.data}`,
          color: current ? (isUser ? T.amber : T.mut) : T.mut2,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          maxWidth: "100%",
          overflow: "hidden",
        }}
        title={
          current
            ? `Held under ${current}${isUser ? "" : " (outside)"}`
            : "Mark held under a different upline"
        }
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {current ?? "—"}
        </span>
        <Pencil className="h-3 w-3 shrink-0" style={{ color: T.mut2 }} />
      </button>
    </PopoverTrigger>
  );
}
