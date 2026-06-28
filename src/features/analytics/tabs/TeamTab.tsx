// src/features/analytics/tabs/TeamTab.tsx
// People-centric view: team retention, team inbound economics, the agent
// performance table, and client segmentation.

import { BoardPersistency } from "@/features/dashboard";
import { useTeamPersistency } from "@/hooks/policies";
import { ROW_1, ROW_3_WIDE } from "./grid";
import {
  TeamInboundEconomicsPanel,
  AgentTablePanel,
  ClientSegmentsPanel,
  Cell,
} from "./panels";

export function TeamTab() {
  // Team persistency — own + downline retention at 3/6/9/12 months. This is the
  // team-scoped view (the individual's own persistency lives on the Overview tab).
  // Only render once a milestone has real data (the RPC always returns 4 rows).
  const { data: teamPersistency } = useTeamPersistency();

  return (
    <>
      {/* Team persistency band (full width) */}
      {teamPersistency?.some((b) => b.issuedCount > 0) && (
        <div style={{ marginBottom: 24 }}>
          <BoardPersistency buckets={teamPersistency} scope="team" />
        </div>
      )}

      {/* Team inbound economics | Agent table (2-wide) */}
      <div className={ROW_3_WIDE}>
        <Cell section="agent_performance" minHeight={420}>
          <TeamInboundEconomicsPanel />
        </Cell>
        <Cell section="agent_performance" span={2} minHeight={420}>
          <AgentTablePanel />
        </Cell>
      </div>

      {/* Client segments (full width) */}
      <div className={ROW_1}>
        <Cell section="client_segmentation" minHeight={300}>
          <ClientSegmentsPanel />
        </Cell>
      </div>
    </>
  );
}
