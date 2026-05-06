// src/features/the-standard-team/components/AgentDetailView.tsx

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border flex items-center gap-3 flex-wrap">
        <Button type="button" variant="ghost" size="xs" onClick={onBack}>
          <ArrowLeft className="h-3 w-3" />
          Back to team
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[13px] font-semibold text-v2-ink dark:text-v2-ink truncate">
              {fullName}
            </h2>
            {isSelf ? (
              <Badge variant="info" size="sm">
                Me
              </Badge>
            ) : depth <= 1 ? (
              <Badge variant="secondary" size="sm">
                Direct downline
              </Badge>
            ) : (
              <Badge variant="outline" size="sm">
                Downline L{depth}
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
            {agent.email}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-2.5 p-2.5 overflow-auto">
        <section className="min-w-0 min-h-0 bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink dark:text-v2-ink">
              Writing Numbers
            </h3>
          </div>
          <MyWritingNumbersView
            agentId={agent.id}
            agentLabel={isSelf ? undefined : fullName}
          />
        </section>

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
