// src/features/training-modules/components/learner/MyTrainingPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Target, Clock, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillNav } from "@/components/v2";
import { useMyTrainingAssignments } from "../../hooks/useTrainingAssignments";
import { useTrainingUserStats } from "../../hooks/useTrainingGamification";
import { useCanManageTraining } from "../../hooks/useCanManageTraining";
import { AssignmentsTab } from "./AssignmentsTab";
import { XpDisplay } from "../gamification/XpDisplay";
import { StreakIndicator } from "../gamification/StreakIndicator";
import { BadgeGrid } from "../gamification/BadgeGrid";
import { LeaderboardTable } from "../gamification/LeaderboardTable";
import { ModulesManagementTab } from "../admin/ModulesManagementTab";
import { BadgesManagementTab } from "../admin/BadgesManagementTab";
import { PresentationSubmissionList } from "../presentations/PresentationSubmissionList";
import { PresentationComplianceTable } from "../presentations/PresentationComplianceTable";
import {
  PresentationWeekPicker,
  getCurrentWeekStart,
} from "../presentations/PresentationWeekPicker";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { useQueryClient } from "@tanstack/react-query";
import { assignmentKeys } from "../../hooks/useTrainingAssignments";
import { presentationKeys } from "../../hooks/usePresentationSubmissions";
import { trainingModuleKeys } from "../../hooks/useTrainingModules";

type TabId =
  | "assignments"
  | "presentations"
  | "leaderboard"
  | "badges"
  | "modules";

export default function MyTrainingPage() {
  const { data: assignments = [], isLoading } = useMyTrainingAssignments();
  const { data: stats } = useTrainingUserStats();
  const { user } = useAuth();
  const { agency } = useImo();
  const canManage = useCanManageTraining();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("assignments");
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);

  useEffect(() => {
    const keyMap: Record<TabId, readonly string[]> = {
      assignments: assignmentKeys.all,
      presentations: presentationKeys.all,
      leaderboard: ["training-gamification"],
      badges: ["training-gamification"],
      modules: trainingModuleKeys.all,
    };
    queryClient.invalidateQueries({ queryKey: [...keyMap[activeTab]] });
  }, [activeTab, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "assignments", label: `Assignments (${assignments.length})` },
    { id: "presentations", label: "Presentations" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "badges", label: "Badges" },
    ...(canManage ? [{ id: "modules" as const, label: "Modules" }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Compact header with inline stats */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <BookOpen className="h-4 w-4 text-v2-ink" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              My Training
            </h1>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-v2-ink-muted leading-tight">
            <XpDisplay xp={stats?.total_xp || 0} />
            <StreakIndicator days={stats?.current_streak_days || 0} />
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3 text-info" />
              <span className="text-v2-ink font-semibold">
                {stats?.modules_completed || 0}
              </span>
              completed
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 text-v2-ink-subtle" />
              <span className="text-v2-ink font-semibold">
                {Math.round((stats?.total_time_spent_seconds || 0) / 3600)}h
              </span>
              spent
            </span>
          </div>
        </div>
      </header>

      <PillNav
        size="sm"
        activeValue={activeTab}
        onChange={(v) => setActiveTab(v as TabId)}
        items={tabs.map((t) => ({ label: t.label, value: t.id }))}
      />

      <div>
        {activeTab === "assignments" && (
          <AssignmentsTab assignments={assignments} />
        )}

        {activeTab === "presentations" && (
          <div className="space-y-3">
            {/* Toolbar: week picker + new submission button */}
            <div className="flex items-center justify-between">
              <PresentationWeekPicker
                weekStart={weekStart}
                onChange={setWeekStart}
              />
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={() =>
                  navigate({ to: "/my-training/presentations/record" })
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                New Submission
              </Button>
            </div>

            {/* Manager compliance table */}
            {canManage && agency && (
              <PresentationComplianceTable
                agencyId={agency.id}
                weekStart={weekStart}
              />
            )}

            {/* Submissions list */}
            <PresentationSubmissionList
              filters={{
                weekStart,
                ...(canManage ? {} : { userId: user?.id || "" }),
                ...(agency ? { agencyId: agency.id } : {}),
              }}
              showSubmitter={canManage}
            />
          </div>
        )}

        {activeTab === "leaderboard" && agency && (
          <LeaderboardTable agencyId={agency.id} />
        )}

        {activeTab === "badges" && (
          <div className="space-y-3">
            {canManage && <BadgesManagementTab />}
            <BadgeGrid />
          </div>
        )}

        {activeTab === "modules" && canManage && <ModulesManagementTab />}
      </div>
    </div>
  );
}
