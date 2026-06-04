// src/features/the-standard-team/components/WritingNumbersMatrixView.tsx

import { useMemo, useState } from "react";
import { Search, Loader2, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Cap, EmptyState, T } from "@/components/board";
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* toolbar */}
      <div
        style={{
          padding: "12px 18px",
          borderBottom: `1px solid ${T.line}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Cap>Coverage Matrix</Cap>
          <div
            style={{
              font: `700 11px ${T.mono}`,
              color: T.mut2,
              letterSpacing: "0.08em",
              marginTop: 3,
            }}
          >
            {agents.length} AGENT{agents.length === 1 ? "" : "S"} ·{" "}
            {visibleCarriers.length}/{carriers.length} CARRIERS
          </div>
        </div>
        <div style={{ flex: 1 }} />
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
          Has missing
        </label>
      </div>

      {/* matrix */}
      <div style={{ flex: 1, minHeight: 0 }}>
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
            Loading matrix…
          </div>
        ) : visibleCarriers.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid size={20} />}
            title="No carriers match"
            hint="Adjust the search or the “has missing” filter."
            pad={40}
          />
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
