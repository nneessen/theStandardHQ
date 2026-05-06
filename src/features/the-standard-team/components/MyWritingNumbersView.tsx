// src/features/the-standard-team/components/MyWritingNumbersView.tsx

import { useMemo, useState } from "react";
import { Check, Pencil, Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const missingCount = Math.max(0, carriers.length - filledCount);

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
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-2">
        <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {filledCount}
          </span>{" "}
          saved ·{" "}
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {missingCount}
          </span>{" "}
          missing
          {agentLabel ? (
            <span className="ml-2 text-v2-ink-subtle">— {agentLabel}</span>
          ) : null}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-v2-ink-subtle absolute left-2 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search carriers"
            className="h-8 pl-7 text-xs w-56"
          />
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle cursor-pointer select-none">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
            className="h-3 w-3"
          />
          Missing only
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-v2-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading carriers...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-v2-ink-muted">
            {missingOnly
              ? "All carriers have writing numbers saved."
              : "No carriers match the current filter."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((carrier) => {
              const existing = numberByCarrier.get(carrier.id);
              const isEditing = editingCarrierId === carrier.id;
              const value = existing?.writing_number ?? "";

              return (
                <li
                  key={carrier.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      existing ? "bg-success" : "bg-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0 text-[12px] font-medium text-v2-ink dark:text-v2-ink truncate">
                    {carrier.name}
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-1">
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
                        <Check className="h-3.5 w-3.5 text-success" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={cancelEdit}
                        aria-label="Cancel"
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "text-[12px] font-mono tabular-nums",
                          existing
                            ? "text-v2-ink dark:text-v2-ink"
                            : "text-v2-ink-subtle italic",
                        )}
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
