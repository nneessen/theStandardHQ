// src/features/the-standard-team/components/AgentDetailView.tsx

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Board, Cap, Pill, T } from "@/components/board";
import { AgentCarrierContractsCard } from "@/features/contracting";
import type { TheStandardAgent } from "../hooks/useTheStandardAgents";
import { MyWritingNumbersView } from "./MyWritingNumbersView";

interface AgentDetailViewProps {
  agent: TheStandardAgent;
  isSelf: boolean;
  onBack: () => void;
}

export function AgentDetailView({
  agent,
  isSelf,
  onBack,
}: AgentDetailViewProps) {
  const fullName =
    [agent.first_name, agent.last_name].filter(Boolean).join(" ") ||
    agent.email;
  const depth = agent.hierarchy_depth ?? 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* header */}
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
        <Button type="button" variant="ghost" size="xs" onClick={onBack}>
          <ArrowLeft className="h-3 w-3" />
          Back to team
        </Button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                font: `700 14px ${T.data}`,
                color: T.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {fullName}
            </span>
            <Pill
              tone={isSelf ? "blue" : depth <= 1 ? "green" : "amber"}
              style={{ padding: "3px 9px", fontSize: 10 }}
            >
              {isSelf
                ? "Me"
                : depth <= 1
                  ? "Direct downline"
                  : `Downline L${depth}`}
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
      </div>

      {/* body: writing numbers + carrier contracts */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]"
        style={{
          flex: 1,
          minHeight: 0,
          gap: 12,
          padding: 12,
          overflow: "auto",
        }}
      >
        <Board
          pad={0}
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              borderBottom: `1px solid ${T.line}`,
            }}
          >
            <Cap>Writing Numbers</Cap>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MyWritingNumbersView
              agentId={agent.id}
              agentLabel={isSelf ? undefined : fullName}
            />
          </div>
        </Board>

        <aside className="min-h-0 lg:sticky lg:top-0">
          <AgentCarrierContractsCard
            agentId={agent.id}
            title="Carrier Contracts"
            description={
              isSelf
                ? "Toggle the carriers you are actively contracted with."
                : "Toggle whether this downline currently has an active carrier contract."
            }
          />
        </aside>
      </div>
    </div>
  );
}
