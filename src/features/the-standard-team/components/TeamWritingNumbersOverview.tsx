// src/features/the-standard-team/components/TeamWritingNumbersOverview.tsx

import { useMemo, useState } from "react";
import { ArrowRight, Search, Loader2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bar, Cap, FlapTile, EmptyState, Pill, T } from "@/components/board";
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
  const slotCoverage = totalSlots === 0 ? 0 : totalFilled / totalSlots;

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
        const pct = totalCarriers === 0 ? 0 : filled / totalCarriers;
        return { agent, filled, pct };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [downlineAgents, fillByAgent, totalCarriers, search]);

  const isLoading = carriersLoading || numbersLoading;

  if (downlineAgents.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <EmptyState
          icon={<Users size={20} />}
          title="No downlines yet"
          hint="Once you have approved downline agents, their writing-number coverage appears here."
          pad={40}
        />
      </div>
    );
  }

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
          <Cap>Team Coverage</Cap>
          <span
            style={{
              font: `700 11px ${T.mono}`,
              color: T.mut2,
              letterSpacing: "0.08em",
            }}
          >
            {totalFilled}/{totalSlots} SLOTS FILLED
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
          <FlapTile
            sm
            label="Agents"
            value={downlineAgents.length}
            tone="blue"
          />
          <FlapTile sm label="Slots Filled" value={totalFilled} tone="green" />
          <FlapTile
            sm
            label="Coverage"
            value={`${Math.round(slotCoverage * 100)}%`}
          />
        </div>
        <Bar
          pct={slotCoverage}
          tone={
            slotCoverage >= 0.8
              ? "green"
              : slotCoverage >= 0.4
                ? "amber"
                : "red"
          }
          height={8}
        />
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
            placeholder="Search agents"
            className="h-8 pl-7 text-xs w-56"
          />
        </div>
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
            Loading team coverage…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Search size={20} />}
            title="No agents match"
            hint="Adjust the search to find a downline agent."
            pad={40}
          />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map(({ agent, filled, pct }) => {
              const fullName =
                [agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
                agent.email;
              const tone = pct >= 0.8 ? "green" : pct >= 0.4 ? "amber" : "red";
              const depth = agent.hierarchy_depth ?? 0;

              return (
                <li
                  key={agent.id}
                  className="hover:bg-white/[0.03]"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 18px",
                    borderBottom: `1px solid ${T.line}`,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          font: `600 13px ${T.data}`,
                          color: T.ink,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fullName}
                      </span>
                      <Pill
                        tone={depth <= 1 ? "blue" : "amber"}
                        style={{ padding: "3px 8px", fontSize: 10 }}
                      >
                        {depth <= 1 ? "Direct" : `L${depth}`}
                      </Pill>
                    </div>
                    <div
                      style={{
                        font: `500 11px ${T.data}`,
                        color: T.mut2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 2,
                      }}
                    >
                      {agent.email}
                    </div>
                  </div>

                  <div
                    className="hidden sm:flex"
                    style={{
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 5,
                      width: 192,
                    }}
                  >
                    <Bar
                      pct={pct}
                      tone={tone}
                      height={6}
                      style={{ width: "100%" }}
                    />
                    <span
                      style={{
                        font: `700 10px ${T.mono}`,
                        color: T.mut,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {filled}/{totalCarriers}
                    </span>
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
