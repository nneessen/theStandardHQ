// src/features/the-standard-team/components/TeamWritingNumbersOverview.tsx

import { useMemo, useState } from "react";
import { ArrowRight, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useActiveCarriers } from "@/hooks/carriers";
import type { TheStandardAgent } from "../hooks/useTheStandardAgents";
import { useAgentWritingNumbers } from "../hooks/useAgentWritingNumbers";

interface TeamWritingNumbersOverviewProps {
  agents: TheStandardAgent[];
  currentUserId?: string | null;
  onSelectAgent: (agentId: string) => void;
}

export function TeamWritingNumbersOverview({
  agents,
  currentUserId,
  onSelectAgent,
}: TeamWritingNumbersOverviewProps) {
  const downlineAgents = useMemo(
    () => agents.filter((agent) => agent.id !== currentUserId),
    [agents, currentUserId],
  );

  const downlineIds = useMemo(
    () => downlineAgents.map((a) => a.id),
    [downlineAgents],
  );

  const { data: carriers = [], isLoading: carriersLoading } =
    useActiveCarriers();
  const { data: writingNumbers = [], isLoading: numbersLoading } =
    useAgentWritingNumbers(downlineIds, { enabled: downlineIds.length > 0 });

  const [search, setSearch] = useState("");

  const fillByAgent = useMemo(() => {
    const map = new Map<string, number>();
    writingNumbers.forEach((wn) => {
      map.set(wn.agent_id, (map.get(wn.agent_id) ?? 0) + 1);
    });
    return map;
  }, [writingNumbers]);

  const totalCarriers = carriers.length;
  const totalSlots = totalCarriers * downlineAgents.length;
  const totalFilled = downlineAgents.reduce(
    (acc, agent) => acc + (fillByAgent.get(agent.id) ?? 0),
    0,
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return downlineAgents
      .filter((agent) => {
        if (!query) return true;
        const name = `${agent.first_name ?? ""} ${agent.last_name ?? ""}`
          .trim()
          .toLowerCase();
        return (
          name.includes(query) || agent.email.toLowerCase().includes(query)
        );
      })
      .map((agent) => {
        const filled = fillByAgent.get(agent.id) ?? 0;
        const pct = totalCarriers === 0 ? 0 : (filled / totalCarriers) * 100;
        return { agent, filled, pct };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [downlineAgents, fillByAgent, totalCarriers, search]);

  const isLoading = carriersLoading || numbersLoading;

  if (downlineAgents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink">
          No downlines yet
        </p>
        <p className="mt-1 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle max-w-md">
          Once you have approved downline agents, you&apos;ll see their writing
          number coverage here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-2">
        <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {downlineAgents.length}
          </span>{" "}
          agent{downlineAgents.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {totalFilled}
          </span>{" "}
          of {totalSlots} slots filled
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-v2-ink-subtle absolute left-2 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents"
            className="h-8 pl-7 text-xs w-56"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-v2-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading team coverage...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-v2-ink-muted">
            No agents match this search.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ agent, filled, pct }) => {
              const fullName =
                [agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
                agent.email;
              const tone =
                pct >= 80
                  ? "bg-success"
                  : pct >= 40
                    ? "bg-warning"
                    : "bg-destructive";
              const depth = agent.hierarchy_depth ?? 0;

              return (
                <li
                  key={agent.id}
                  className="px-3 py-2 hover:bg-muted/40 flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-medium text-v2-ink dark:text-v2-ink truncate">
                        {fullName}
                      </p>
                      {depth <= 1 ? (
                        <Badge variant="secondary" size="sm">
                          Direct
                        </Badge>
                      ) : (
                        <Badge variant="outline" size="sm">
                          L{depth}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                      {agent.email}
                    </p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-1 w-48">
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", tone)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      {filled}/{totalCarriers}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onSelectAgent(agent.id)}
                    className="shrink-0"
                  >
                    View
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
