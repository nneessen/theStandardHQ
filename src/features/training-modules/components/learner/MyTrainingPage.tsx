// src/features/training-modules/components/learner/MyTrainingPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Target, Clock, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "assignments", label: "Assignments", count: assignments.length },
    { id: "presentations", label: "Presentations" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "badges", label: "Badges" },
    ...(canManage ? [{ id: "modules" as const, label: "Modules" }] : []),
  ];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      {/* Header with stats */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            My Training
          </h1>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <XpDisplay xp={stats?.total_xp || 0} />
          <StreakIndicator days={stats?.current_streak_days || 0} />
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-blue-500" />
            <span className="font-medium">{stats?.modules_completed || 0}</span>
            <span className="text-zinc-500">completed</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-zinc-400" />
            <span className="font-medium">
              {Math.round((stats?.total_time_spent_seconds || 0) / 3600)}h
            </span>
            <span className="text-zinc-500">spent</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1 rounded text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
