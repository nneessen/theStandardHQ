// src/features/the-standard-team/components/WritingNumbersMatrixView.tsx

import { useMemo, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useActiveCarriers } from "@/hooks/carriers";
import type { TheStandardAgent } from "../hooks/useTheStandardAgents";
import {
  useAgentWritingNumbers,
  useUpsertWritingNumber,
} from "../hooks/useAgentWritingNumbers";
import { WritingNumbersTable } from "./WritingNumbersTable";

interface WritingNumbersMatrixViewProps {
  agents: TheStandardAgent[];
}

export function WritingNumbersMatrixView({
  agents,
}: WritingNumbersMatrixViewProps) {
  const agentIds = useMemo(() => agents.map((a) => a.id), [agents]);

  const { data: carriers = [], isLoading: carriersLoading } =
    useActiveCarriers();
  const { data: writingNumbers = [], isLoading: numbersLoading } =
    useAgentWritingNumbers(agentIds, { enabled: agentIds.length > 0 });
  const upsert = useUpsertWritingNumber();

  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);

  const numberByPair = useMemo(() => {
    const set = new Set<string>();
    writingNumbers.forEach((wn) => {
      set.add(`${wn.agent_id}-${wn.carrier_id}`);
    });
    return set;
  }, [writingNumbers]);

  const visibleCarriers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return carriers
      .filter((carrier) => {
        if (query && !carrier.name.toLowerCase().includes(query)) return false;
        if (missingOnly) {
          const allFilled = agentIds.every((id) =>
            numberByPair.has(`${id}-${carrier.id}`),
          );
          if (allFilled) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [carriers, agentIds, numberByPair, search, missingOnly]);

  const isLoading = carriersLoading || numbersLoading;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-2">
        <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          {agents.length} agent{agents.length === 1 ? "" : "s"} ·{" "}
          {visibleCarriers.length} of {carriers.length} carriers
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
          Has missing
        </label>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-v2-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading matrix...
          </div>
        ) : visibleCarriers.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-v2-ink-muted">
            No carriers match the current filter.
          </div>
        ) : (
          <WritingNumbersTable
            agents={agents}
            carriers={visibleCarriers}
            writingNumbers={writingNumbers}
            layout="carriers-rows"
            onUpsertWritingNumber={(params) => upsert.mutate(params)}
          />
        )}
      </div>
    </div>
  );
}
