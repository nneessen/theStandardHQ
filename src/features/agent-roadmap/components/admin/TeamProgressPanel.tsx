// src/features/agent-roadmap/components/admin/TeamProgressPanel.tsx
//
// Super-admin team progress monitoring. Full implementation in Commit 7.
// This placeholder keeps the route navigable so the editor's "Team progress"
// buttons compile and redirect somewhere.

import { Users } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

interface TeamProgressPanelProps {
  roadmapId: string;
}

export function TeamProgressPanel({
  roadmapId: _roadmapId,
}: TeamProgressPanelProps) {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Empty className="py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users className="h-6 w-6 text-zinc-400" />
          </EmptyMedia>
          <EmptyTitle>Team progress</EmptyTitle>
          <EmptyDescription>
            Coming soon — this view will show per-user completion for every
            agent on the team.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
