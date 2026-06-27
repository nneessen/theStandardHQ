// src/features/analytics/tabs/TeamTab.tsx
// People-centric view: team retention, the smart-moves game plan, the agent
// performance table, and client segmentation.

import { BoardPersistency } from "@/features/dashboard";
import { useTeamPersistency } from "@/hooks/policies";
import { ROW_1, ROW_3_WIDE } from "./grid";
import {
  ActionFeedPanel,
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

      {/* Action feed | Agent table (2-wide) */}
      <div className={ROW_3_WIDE}>
        <Cell section="game_plan" minHeight={420}>
          <ActionFeedPanel />
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
