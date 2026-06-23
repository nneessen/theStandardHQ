// src/features/analytics/tabs/TeamTab.tsx
// People-centric view: the smart-moves game plan, the agent performance table,
// and client segmentation.

import { ROW_1, ROW_3_WIDE } from "./grid";
import {
  ActionFeedPanel,
  AgentTablePanel,
  ClientSegmentsPanel,
  Cell,
} from "./panels";

export function TeamTab() {
  return (
    <>
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
