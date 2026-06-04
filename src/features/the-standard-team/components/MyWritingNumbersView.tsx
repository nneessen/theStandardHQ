// src/features/the-standard-team/components/MyWritingNumbersView.tsx

import { useMemo, useState } from "react";
import { Check, Pencil, Search, X, Loader2, IdCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Bar,
  Cap,
  FlapTile,
  EmptyState,
  StatusDot,
  T,
} from "@/components/board";
import { useActiveCarriers } from "@/hooks/carriers";
import {
  useAgentWritingNumbers,
  useUpsertWritingNumber,
} from "../hooks/useAgentWritingNumbers";

interface MyWritingNumbersViewProps {
  agentId: string;
  agentLabel?: string;
  readOnly?: boolean;
}

export function MyWritingNumbersView({
  agentId,
  agentLabel,
  readOnly = false,
}: MyWritingNumbersViewProps) {
  const { data: carriers = [], isLoading: carriersLoading } =
    useActiveCarriers();
  const { data: writingNumbers = [], isLoading: numbersLoading } =
    useAgentWritingNumbers([agentId]);
  const upsert = useUpsertWritingNumber();

  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const numberByCarrier = useMemo(() => {
    const map = new Map<string, (typeof writingNumbers)[number]>();
    writingNumbers.forEach((wn) => {
      if (wn.agent_id === agentId) map.set(wn.carrier_id, wn);
    });
    return map;
  }, [writingNumbers, agentId]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return carriers
      .filter((carrier) => {
        if (query && !carrier.name.toLowerCase().includes(query)) return false;
        if (missingOnly && numberByCarrier.has(carrier.id)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [carriers, numberByCarrier, search, missingOnly]);

  const filledCount = numberByCarrier.size;
  const totalCarriers = carriers.length;
  const missingCount = Math.max(0, totalCarriers - filledCount);
  const coverage = totalCarriers === 0 ? 0 : filledCount / totalCarriers;
  const coverageTone =
    coverage >= 0.8 ? "green" : coverage >= 0.4 ? "amber" : "red";

  const startEdit = (carrierId: string, currentValue: string) => {
    setEditingCarrierId(carrierId);
    setDraftValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingCarrierId(null);
    setDraftValue("");
  };

  const saveEdit = async () => {
    if (!editingCarrierId) return;
    const existing = numberByCarrier.get(editingCarrierId);
    const trimmed = draftValue.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    await upsert.mutateAsync({
      agentId,
      carrierId: editingCarrierId,
      writingNumber: trimmed,
      existingId: existing?.id,
    });
    cancelEdit();
  };

  const isLoading = carriersLoading || numbersLoading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* snapshot band */}
      <div
        style={{
          padding: "16px 18px",
          borderBottom: `1px solid ${T.line}`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Cap>
            {agentLabel ? `Coverage — ${agentLabel}` : "Carrier Coverage"}
          </Cap>
          <span
            style={{
              font: `700 11px ${T.mono}`,
              color: T.mut2,
              letterSpacing: "0.08em",
            }}
          >
            {filledCount}/{totalCarriers} CARRIERS
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
            gap: 10,
          }}
        >
          <FlapTile sm label="Saved" value={filledCount} tone="green" />
          <FlapTile
            sm
            label="Missing"
            value={missingCount}
            tone={missingCount > 0 ? "amber" : "default"}
          />
          <FlapTile sm label="Carriers" value={totalCarriers} />
        </div>
        <Bar pct={coverage} tone={coverageTone} height={8} />
      </div>

      {/* toolbar */}
      <div
        style={{
          padding: "10px 18px",
          borderBottom: `1px solid ${T.line}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
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
            className="h-8 pl-7 text-xs w-56"
          />
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            font: `500 12px ${T.data}`,
            color: T.mut,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
            className="h-3 w-3"
          />
          Missing only
        </label>
      </div>

      {/* list */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {isLoading ? (
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
            Loading carriers…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IdCard size={20} />}
            title={
              missingOnly
                ? "All carriers have writing numbers"
                : "No carriers match"
            }
            hint={
              missingOnly
                ? "Every active carrier has a writing number saved."
                : "Adjust the search to find a carrier."
            }
            pad={40}
          />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((carrier) => {
              const existing = numberByCarrier.get(carrier.id);
              const isEditing = editingCarrierId === carrier.id;
              const value = existing?.writing_number ?? "";

              return (
                <li
                  key={carrier.id}
                  className="hover:bg-white/[0.03]"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 18px",
                    borderBottom: `1px solid ${T.line}`,
                  }}
                >
                  <StatusDot
                    color={existing ? T.green : T.mut2}
                    size={8}
                    glow={!!existing}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: `600 13px ${T.data}`,
                      color: T.ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {carrier.name}
                  </span>

                  {isEditing ? (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Input
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        placeholder="Writing number"
                        className="h-7 text-xs w-44"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={saveEdit}
                        disabled={upsert.isPending || !draftValue.trim()}
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
                        onClick={cancelEdit}
                        aria-label="Cancel"
                      >
                        <X className="h-3.5 w-3.5" style={{ color: T.red }} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span
                        style={{
                          font: `700 13px ${T.mono}`,
                          fontVariantNumeric: "tabular-nums",
                          color: existing ? T.cream : T.mut2,
                          fontStyle: existing ? "normal" : "italic",
                        }}
                      >
                        {existing?.writing_number ?? "—"}
                      </span>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => startEdit(carrier.id, value)}
                        >
                          <Pencil className="h-3 w-3" />
                          {existing ? "Edit" : "Add"}
                        </Button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
