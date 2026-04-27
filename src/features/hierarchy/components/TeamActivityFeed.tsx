// src/features/hierarchy/components/TeamActivityFeed.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  UserMinus,
  TrendingUp,
  Award,
  AlertTriangle,
  Activity,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { UserProfile } from "@/types/hierarchy.types";

// Extended agent type
interface Agent extends UserProfile {
  name?: string;
  is_active?: boolean;
  parent_agent_id?: string | null;
}

interface ActivityItem {
  id: string;
  type: "joined" | "left" | "promoted" | "achievement" | "warning";
  agent: string;
  message: string;
  timestamp: Date;
  details?: string;
}

interface TeamActivityFeedProps {
  agents: Agent[];
}

// Helper function to get relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}

export function TeamActivityFeed({ agents }: TeamActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Build activities from actual agent data
    const buildActivities = () => {
      const activityList: ActivityItem[] = [];
      const now = new Date();

      agents.forEach((agent, _index) => {
        // Check if agent recently joined (based on created_at)
        const createdDate = new Date(
          agent.created_at || new Date().toISOString(),
        );
        const daysSinceJoined = Math.floor(
          (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceJoined <= 30) {
          activityList.push({
            id: `join-${agent.id}`,
            type: "joined",
            agent: agent.name || agent.email,
            message: "joined the team",
            timestamp: createdDate,
            details: `Level ${agent.contract_level || 100}`,
          });
        }

        // Check for inactive agents (warning)
        if (!agent.is_active && daysSinceJoined > 30) {
          activityList.push({
            id: `inactive-${agent.id}`,
            type: "warning",
            agent: agent.name || agent.email,
            message: "became inactive",
            timestamp: new Date(agent.updated_at || new Date().toISOString()),
            details: "Review agent status",
          });
        }

        // Note: Real achievements, promotions would come from actual
        // database events/logs that track these changes over time
      });

      // Sort by timestamp, most recent first
      activityList.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );

      setActivities(activityList);
      setIsLoading(false);
    };

    if (agents && agents.length > 0) {
      buildActivities();
    } else {
      setActivities([]);
      setIsLoading(false);
    }
  }, [agents]);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "joined":
        return (
          <UserPlus className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        );
      case "left":
        return <UserMinus className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case "promoted":
        return (
          <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
        );
      case "achievement":
        return <Award className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
      case "warning":
        return (
          <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
        );
      default:
        return <Activity className="h-3 w-3 text-v2-ink-muted" />;
    }
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "joined":
      case "achievement":
        return "text-emerald-600 dark:text-emerald-400";
      case "left":
      case "warning":
        return "text-red-600 dark:text-red-400";
      case "promoted":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-v2-ink-muted";
    }
  };

  const displayedActivities = showAll ? activities : activities.slice(0, 5);

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
            Recent Activity
          </div>
          {activities.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="h-5 px-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-0.5" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-0.5" />
                  Show All
                </>
              )}
            </Button>
          )}
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Activity className="h-6 w-6 text-v2-ink-subtle mb-1" />
            <p className="text-[11px] text-v2-ink-muted">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2 py-1">
                <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] leading-tight">
                    <span className="font-medium text-v2-ink">
                      {activity.agent}
                    </span>
                    <span className={`ml-1 ${getActivityColor(activity.type)}`}>
                      {activity.message}
                    </span>
                  </div>
                  {activity.details && (
                    <div className="text-[10px] text-v2-ink-muted">
                      {activity.details}
                    </div>
                  )}
                  <div className="text-[9px] text-v2-ink-subtle mt-0.5">
                    {getRelativeTime(activity.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-3 pt-2 border-t border-v2-ring">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="text-center">
              <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                +{activities.filter((a) => a.type === "joined").length}
              </div>
              <div className="text-v2-ink-muted">Joined</div>
            </div>
            <div className="text-center">
              <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                {activities.filter((a) => a.type === "promoted").length}
              </div>
              <div className="text-v2-ink-muted">Promoted</div>
            </div>
            <div className="text-center">
              <div className="font-mono font-semibold text-red-600 dark:text-red-400">
                -{activities.filter((a) => a.type === "left").length}
              </div>
              <div className="text-v2-ink-muted">Left</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
