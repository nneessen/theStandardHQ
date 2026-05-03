// src/features/recruiting/admin/SchedulingItemConfig.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Calendar,
  CalendarDays,
  Video,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveSchedulingIntegrations } from "@/hooks/integrations";
import type {
  SchedulingIntegrationType,
  SchedulingChecklistMetadata,
} from "@/types/integration.types";
import {
  INTEGRATION_TYPE_LABELS,
  isValidIntegrationUrl,
} from "@/types/integration.types";
import { createSchedulingMetadata } from "@/types/checklist-metadata.types";

interface SchedulingItemConfigProps {
  metadata: SchedulingChecklistMetadata | null;
  onChange: (
    metadata: SchedulingChecklistMetadata & { _type: "scheduling_booking" },
  ) => void;
}

const INTEGRATION_ICONS: Record<SchedulingIntegrationType, typeof Calendar> = {
  calendly: Calendar,
  google_calendar: CalendarDays,
  zoom: Video,
  google_meet: Video,
};

export function SchedulingItemConfig({
  metadata,
  onChange,
}: SchedulingItemConfigProps) {
  const { data: integrations, isLoading } = useActiveSchedulingIntegrations();

  const [schedulingType, setSchedulingType] =
    useState<SchedulingIntegrationType>(
      metadata?.scheduling_type ?? "calendly",
    );
  const [useCustomUrl, setUseCustomUrl] = useState(
    !!metadata?.custom_booking_url,
  );
  const [customUrl, setCustomUrl] = useState(
    metadata?.custom_booking_url ?? "",
  );
  const [instructions, setInstructions] = useState(
    metadata?.instructions ?? "",
  );
  const [urlError, setUrlError] = useState<string | null>(null);

  // Get integration for selected type
  const selectedIntegration = integrations?.find(
    (i) => i.integration_type === schedulingType,
  );

  // Track previous metadata to prevent infinite loops
  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Stable callback that builds and sends metadata
  const notifyChange = useCallback(() => {
    // Determine the booking URL - custom URL takes precedence, then integration URL
    const resolvedBookingUrl =
      useCustomUrl && customUrl
        ? customUrl
        : selectedIntegration?.booking_url || "";

    const schedulingData: SchedulingChecklistMetadata = {
      scheduling_type: schedulingType,
      // CRITICAL: booking_url must be captured at config time so recruits can access it
      booking_url: resolvedBookingUrl,
      // Keep custom_booking_url for backwards compatibility
      custom_booking_url: useCustomUrl && customUrl ? customUrl : undefined,
      instructions:
        instructions || selectedIntegration?.instructions || undefined,
      integration_id: selectedIntegration?.id,
      // Capture Zoom-specific fields
      meeting_id: selectedIntegration?.meeting_id || undefined,
      passcode: selectedIntegration?.passcode || undefined,
    };

    const newMetadata = createSchedulingMetadata(schedulingData);

    const metadataString = JSON.stringify(newMetadata);
    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    schedulingType,
    useCustomUrl,
    customUrl,
    instructions,
    selectedIntegration?.id,
    selectedIntegration?.booking_url,
    selectedIntegration?.instructions,
    selectedIntegration?.meeting_id,
    selectedIntegration?.passcode,
  ]);

  // Update parent when values change
  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const validateCustomUrl = (url: string) => {
    if (!url) {
      setUrlError(null);
      return;
    }
    if (!isValidIntegrationUrl(schedulingType, url)) {
      setUrlError(`Invalid ${INTEGRATION_TYPE_LABELS[schedulingType]} URL`);
    } else {
      setUrlError(null);
    }
  };

  const handleCustomUrlChange = (url: string) => {
    setCustomUrl(url);
    validateCustomUrl(url);
  };

  const Icon = INTEGRATION_ICONS[schedulingType];

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Scheduling Configuration
        </span>
      </div>

      {/* Scheduling Type */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Scheduling Type
        </Label>
        <Select
          value={schedulingType}
          onValueChange={(value: SchedulingIntegrationType) => {
            setSchedulingType(value);
            // Reset custom URL when changing type
            if (useCustomUrl) {
              setCustomUrl("");
              setUrlError(null);
            }
          }}
        >
          <SelectTrigger className="h-7 text-[11px] bg-white  border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="calendly" className="text-[11px]">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Calendly
              </div>
            </SelectItem>
            <SelectItem value="google_calendar" className="text-[11px]">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3 w-3" />
                Google Calendar
              </div>
            </SelectItem>
            <SelectItem value="zoom" className="text-[11px]">
              <div className="flex items-center gap-2">
                <Video className="h-3 w-3" />
                Zoom
              </div>
            </SelectItem>
            <SelectItem value="google_meet" className="text-[11px]">
              <div className="flex items-center gap-2">
                <Video className="h-3 w-3" />
                Google Meet
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Integration Status */}
      {!isLoading && (
        <div className="space-y-1">
          {selectedIntegration ? (
            <div className="flex items-center gap-2 p-1.5 bg-success/10 rounded shadow-sm">
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 border-success/40 text-success dark:border-success dark:text-success"
              >
                Connected
              </Badge>
              <span className="text-[10px] text-success truncate flex-1">
                {selectedIntegration.display_name ||
                  selectedIntegration.booking_url}
              </span>
              <a
                href={selectedIntegration.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-success hover:text-success dark:hover:text-success"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-1.5 bg-warning/10 rounded shadow-sm">
              <AlertCircle className="h-3 w-3 text-warning" />
              <span className="text-[10px] text-warning">
                No {INTEGRATION_TYPE_LABELS[schedulingType]} integration
                configured.{" "}
                <button
                  type="button"
                  onClick={() => setUseCustomUrl(true)}
                  className="underline hover:no-underline"
                >
                  Use custom URL
                </button>{" "}
                or{" "}
                <a
                  href="/settings"
                  className="underline hover:no-underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  configure in Settings
                </a>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Custom URL Toggle & Input */}
      {(useCustomUrl || !selectedIntegration) && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Custom Booking URL
            {!selectedIntegration && (
              <span className="text-destructive ml-0.5">*</span>
            )}
          </Label>
          <Input
            value={customUrl}
            onChange={(e) => handleCustomUrlChange(e.target.value)}
            placeholder={`https://${schedulingType === "zoom" ? "zoom.us/j/..." : schedulingType === "calendly" ? "calendly.com/..." : "calendar.google.com/..."}`}
            className={`h-7 text-[11px] bg-white  border-border ${
              urlError ? "border-destructive dark:border-destructive" : ""
            }`}
          />
          {urlError && (
            <p className="text-[10px] text-destructive">{urlError}</p>
          )}
          {selectedIntegration && useCustomUrl && (
            <button
              type="button"
              onClick={() => {
                setUseCustomUrl(false);
                setCustomUrl("");
                setUrlError(null);
              }}
              className="text-[10px] text-muted-foreground underline hover:no-underline"
            >
              Use configured integration instead
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Instructions for Recruit
          <span className="text-muted-foreground ml-1">(optional)</span>
        </Label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g., Please book a 30-minute call at your earliest convenience."
          className="text-[11px] min-h-12 bg-white  border-border"
        />
      </div>
    </div>
  );
}
