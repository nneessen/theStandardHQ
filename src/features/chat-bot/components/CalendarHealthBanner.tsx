// src/features/chat-bot/components/CalendarHealthBanner.tsx
// Displays calendar configuration health status with actionable error/warning banners.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCalendarHealth } from "../hooks/useChatBot";

export function CalendarHealthBanner({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const {
    data: health,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useCalendarHealth(enabled);
  const [showSuccess, setShowSuccess] = useState(false);

  // Show success banner briefly after a healthy check, then hide it
  useEffect(() => {
    if (health?.healthy && health.issues.length === 0) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
    setShowSuccess(false);
  }, [health]);

  // Nothing to show while loading, or if endpoint not available yet
  if (isLoading || (!health && !isError)) return null;

  // Non-404 error — show a subtle indicator so the user knows something went wrong
  if (isError) {
    return (
      <Alert variant="muted" className="py-2 px-3">
        <AlertCircle className="h-3.5 w-3.5" />
        <AlertTitle className="text-[11px] font-medium mb-0">
          Unable to check calendar configuration
        </AlertTitle>
        <AlertDescription className="text-[10px] opacity-80 mt-0.5 flex items-center gap-2">
          <span>
            We couldn&apos;t verify your calendar configuration right now.
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[9px] text-v2-ink-muted"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-2.5 w-2.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // After loading/error/null guards, health is guaranteed to exist
  if (!health) return null;

  // Healthy with no issues — show brief success then nothing
  if (health.healthy && health.issues.length === 0) {
    if (!showSuccess) return null;
    return (
      <Alert variant="success" className="py-2 px-3">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <AlertTitle className="text-[11px] font-medium mb-0">
          Calendar connected and configured correctly
        </AlertTitle>
        {health.eventType && (
          <AlertDescription className="text-[10px] opacity-80 mt-0.5">
            {health.eventType.name} ({health.eventType.duration} min
            {health.eventType.locationKind
              ? `, ${health.eventType.locationKind.replace(/_/g, " ")}`
              : ""}
            )
          </AlertDescription>
        )}
      </Alert>
    );
  }

  // Has issues — show each one
  const errors = health.issues.filter((i) => i.severity === "error");
  const warnings = health.issues.filter((i) => i.severity === "warning");

  return (
    <div className="space-y-1.5">
      {errors.map((issue) => (
        <Alert key={issue.code} variant="destructive" className="py-2 px-3">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertTitle className="text-[11px] font-medium mb-0">
            Calendar Configuration Error
          </AlertTitle>
          <AlertDescription className="text-[10px] mt-0.5 space-y-0.5">
            <p>{issue.message}</p>
            <p className="opacity-80">{issue.action}</p>
          </AlertDescription>
        </Alert>
      ))}

      {warnings.map((issue) => (
        <Alert key={issue.code} variant="warning" className="py-2 px-3">
          <AlertTriangle className="h-3.5 w-3.5" />
          <AlertTitle className="text-[11px] font-medium mb-0">
            Calendar Configuration Warning
          </AlertTitle>
          <AlertDescription className="text-[10px] mt-0.5 space-y-0.5">
            <p>{issue.message}</p>
            <p className="opacity-80">{issue.action}</p>
          </AlertDescription>
        </Alert>
      ))}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[9px] text-v2-ink-muted"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-2.5 w-2.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
          />
          Recheck
        </Button>
      </div>
    </div>
  );
}
