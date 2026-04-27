// src/features/recruiting/components/ActivityTab.tsx
import { Activity, AlertCircle } from "lucide-react";

interface ActivityEntry {
  id: string;
  action_type: string;
  created_at: string;
}

interface ActivityTabProps {
  activityLog: ActivityEntry[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function ActivityTab({
  activityLog,
  isLoading,
  error,
}: ActivityTabProps) {
  if (error) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-xs text-red-500">Failed to load activity log</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Activity className="h-8 w-8 text-v2-ink-subtle mx-auto mb-2 animate-pulse" />
        <p className="text-xs text-v2-ink-muted">Loading activity...</p>
      </div>
    );
  }

  if (!activityLog || activityLog.length === 0) {
    return (
      <div className="py-8 text-center">
        <Activity className="h-8 w-8 text-v2-ink-subtle mx-auto mb-2" />
        <p className="text-xs text-v2-ink-muted">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {activityLog.slice(0, 20).map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-2 py-1.5 px-2 rounded bg-v2-card border border-v2-ring/60"
        >
          <Activity className="h-3 w-3 text-v2-ink-subtle mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-v2-ink-muted truncate">
              {activity.action_type.replace(/_/g, " ")}
            </p>
            <p className="text-[10px] text-v2-ink-subtle">
              {new Date(activity.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
