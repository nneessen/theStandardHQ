// src/features/chat-bot/components/SetupTab.tsx
// Bot configuration + Close CRM / Calendly connection management + lead source/status config

import { useState } from "react";
import {
  Globe,
  Power,
  Tag,
  ListChecks,
  Check,
  Loader2,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConnectionCard } from "./ConnectionCard";
import { AgentProfileSection } from "./AgentProfileSection";
import { LeadSourceSelector } from "./LeadSourceSelector";
import { LeadStatusSelector } from "./LeadStatusSelector";
import {
  useChatBotAgent,
  useChatBotCloseStatus,
  useChatBotCalendlyStatus,
  useChatBotCalendlyEventTypes,
  useConnectClose,
  useDisconnectClose,
  useGetCalendlyAuthUrl,
  useDisconnectCalendly,
  useUpdateBotConfig,
} from "../hooks/useChatBot";
import { CalendarHealthBanner } from "./CalendarHealthBanner";

// Common US timezones
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export function SetupTab() {
  const { data: agent } = useChatBotAgent();
  const { data: closeStatus, isLoading: closeLoading } =
    useChatBotCloseStatus();
  const { data: calendlyStatus, isLoading: calendlyLoading } =
    useChatBotCalendlyStatus();
  const {
    data: eventTypes,
    isLoading: eventTypesLoading,
    isError: eventTypesError,
    error: eventTypesErrorObj,
    refetch: refetchEventTypes,
  } = useChatBotCalendlyEventTypes(calendlyStatus?.connected || false);

  const connectClose = useConnectClose();
  const disconnectClose = useDisconnectClose();
  const getCalendlyAuth = useGetCalendlyAuthUrl();
  const disconnectCalendly = useDisconnectCalendly();
  const updateConfig = useUpdateBotConfig();

  // Local state for lead source/status editing
  const [leadSources, setLeadSources] = useState<string[] | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<string[] | null>(null);
  const [sourcesDirty, setSourcesDirty] = useState(false);
  const [statusesDirty, setStatusesDirty] = useState(false);
  const [eventTypeMappings, setEventTypeMappings] = useState<
    { leadSource: string; eventTypeSlug: string }[] | null
  >(null);
  const [eventTypeDirty, setEventTypeDirty] = useState(false);

  // Resolve displayed values: local edits override agent data
  const displayedSources = leadSources ?? agent?.autoOutreachLeadSources ?? [];
  const displayedStatuses = leadStatuses ?? agent?.allowedLeadStatuses ?? [];

  const handleCalendlyConnect = async () => {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("tab", "setup");
    try {
      const result = await getCalendlyAuth.mutateAsync(returnUrl.toString());
      console.log("[Calendly] Auth URL response:", result);
      if (result?.url) {
        window.location.href = result.url;
      } else {
        console.error("[Calendly] No URL in response:", result);
        toast.error("Failed to get Calendly auth URL — no URL returned.");
      }
    } catch (err) {
      console.error("[Calendly] Auth URL error:", err);
    }
  };

  const handleToggleBot = () => {
    if (!agent) return;
    updateConfig.mutate({ botEnabled: !agent.botEnabled });
  };

  const handleTimezoneChange = (tz: string) => {
    updateConfig.mutate({ timezone: tz });
  };

  const handleSaveSources = () => {
    updateConfig.mutate(
      { autoOutreachLeadSources: displayedSources },
      {
        onSuccess: () => {
          setSourcesDirty(false);
        },
      },
    );
  };

  const handleSaveStatuses = () => {
    updateConfig.mutate(
      { allowedLeadStatuses: displayedStatuses },
      {
        onSuccess: () => {
          setStatusesDirty(false);
        },
      },
    );
  };

  const displayedEventTypeMappings =
    eventTypeMappings ?? agent?.leadSourceEventTypeMappings ?? [];

  // Client-side validation for event type mappings
  const hasInvalidMappings = displayedEventTypeMappings.some(
    (m) => !m.leadSource.trim() || !m.eventTypeSlug.trim(),
  );
  const hasDuplicateMappings = (() => {
    const seen = new Set<string>();
    for (const m of displayedEventTypeMappings) {
      const key = m.leadSource.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  })();
  const mappingsValid = !hasInvalidMappings && !hasDuplicateMappings;

  const handleSaveEventType = () => {
    updateConfig.mutate(
      { leadSourceEventTypeMappings: displayedEventTypeMappings },
      {
        onSuccess: () => {
          setEventTypeDirty(false);
          setEventTypeMappings(null);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      {/* Bot Config Section */}
      <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
          Bot Configuration
        </h2>

        <div className="space-y-2.5">
          {/* Bot enabled toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Power className="h-3 w-3 text-zinc-400" />
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                Bot Enabled
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-6 px-2 text-[10px]",
                agent?.botEnabled
                  ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                  : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
              )}
              disabled={updateConfig.isPending}
              onClick={handleToggleBot}
            >
              {agent?.botEnabled ? (
                <Badge className="text-[9px] h-3.5 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  ON
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[9px] h-3.5 px-1 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  OFF
                </Badge>
              )}
            </Button>
          </div>

          {/* Timezone selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-zinc-400" />
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                Timezone
              </span>
            </div>
            <Select
              value={agent?.timezone || "America/New_York"}
              onValueChange={handleTimezoneChange}
              disabled={updateConfig.isPending}
            >
              <SelectTrigger className="h-7 text-[11px] w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz} className="text-[11px]">
                    {tz.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Agent Profile */}
      <AgentProfileSection />

      {/* Close CRM Connection */}
      <ConnectionCard
        title="Close CRM"
        icon={
          <div className="w-6 h-6 rounded bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white dark:text-zinc-900">
              CRM
            </span>
          </div>
        }
        connected={closeStatus?.connected || false}
        statusLabel={
          closeStatus?.orgName
            ? `Organization: ${closeStatus.orgName}`
            : undefined
        }
        isLoading={closeLoading}
        onConnect={(apiKey) => connectClose.mutate(apiKey)}
        connectLoading={connectClose.isPending}
        apiKeyPlaceholder="Close API key (api_...)"
        onDisconnect={() => disconnectClose.mutate()}
        disconnectLoading={disconnectClose.isPending}
      />

      {/* Calendly Connection */}
      <ConnectionCard
        title="Calendly"
        icon={
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">CAL</span>
          </div>
        }
        connected={calendlyStatus?.connected || false}
        statusLabel={
          calendlyStatus?.connected
            ? calendlyStatus.userName
              ? `${calendlyStatus.userName} (${calendlyStatus.userEmail})`
              : "Connected to Calendly"
            : undefined
        }
        isLoading={calendlyLoading}
        onOAuthConnect={handleCalendlyConnect}
        oauthLoading={getCalendlyAuth.isPending}
        oauthLabel="Connect Calendly"
        onDisconnect={() => disconnectCalendly.mutate()}
        disconnectLoading={disconnectCalendly.isPending}
      />

      {/* Calendar Health Check */}
      <CalendarHealthBanner enabled={calendlyStatus?.connected || false} />

      {/* Lead Source → Event Type Mappings */}
      {calendlyStatus?.connected && (
        <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="h-3 w-3 text-zinc-400" />
            <h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Lead Source Event Types
            </h2>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">
            Map each lead source to a specific Calendly event type. Unmapped
            sources fall back to auto-detection.
          </p>

          {eventTypesLoading ? (
            <div className="h-7 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ) : eventTypesError ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[10px] text-amber-700 dark:text-amber-400">
                {eventTypesErrorObj &&
                "isServiceError" in eventTypesErrorObj &&
                eventTypesErrorObj.isServiceError
                  ? "Bot service temporarily unavailable."
                  : "Failed to load event types."}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[9px] text-amber-600 hover:text-amber-800 ml-auto"
                onClick={() => refetchEventTypes()}
              >
                <RefreshCw className="h-3 w-3 mr-0.5" />
                Retry
              </Button>
            </div>
          ) : eventTypes && eventTypes.length > 0 ? (
            <div className="space-y-2">
              {displayedEventTypeMappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mapping.leadSource}
                    onChange={(e) => {
                      const updated = [...displayedEventTypeMappings];
                      updated[index] = {
                        ...updated[index],
                        leadSource: e.target.value,
                      };
                      setEventTypeMappings(updated);
                      setEventTypeDirty(true);
                    }}
                    placeholder="e.g. Sitka Life"
                    disabled={updateConfig.isPending}
                    className="flex-1 h-7 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-[11px]"
                  />
                  <Select
                    value={mapping.eventTypeSlug || "__none__"}
                    onValueChange={(val) => {
                      const updated = [...displayedEventTypeMappings];
                      updated[index] = {
                        ...updated[index],
                        eventTypeSlug: val === "__none__" ? "" : val,
                      };
                      setEventTypeMappings(updated);
                      setEventTypeDirty(true);
                    }}
                    disabled={updateConfig.isPending}
                  >
                    <SelectTrigger className="h-7 text-[11px] flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="text-[11px]">
                        Select event type
                      </SelectItem>
                      {eventTypes.map((et) => (
                        <SelectItem
                          key={et.slug}
                          value={et.slug}
                          className="text-[11px]"
                        >
                          {et.name} ({et.duration} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] text-red-500 hover:text-red-700"
                    disabled={updateConfig.isPending}
                    onClick={() => {
                      const updated = displayedEventTypeMappings.filter(
                        (_, i) => i !== index,
                      );
                      setEventTypeMappings(updated);
                      setEventTypeDirty(true);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] border-dashed"
                disabled={updateConfig.isPending}
                onClick={() => {
                  setEventTypeMappings([
                    ...displayedEventTypeMappings,
                    { leadSource: "", eventTypeSlug: "" },
                  ]);
                  setEventTypeDirty(true);
                }}
              >
                + Add Mapping
              </Button>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              No event types found. Create an event type in Calendly first.
            </p>
          )}

          {(hasInvalidMappings || hasDuplicateMappings) &&
            displayedEventTypeMappings.length > 0 && (
              <div className="mt-2 space-y-1">
                {hasInvalidMappings && (
                  <p className="text-[10px] text-red-500">
                    Each mapping must have both a lead source and an event type.
                  </p>
                )}
                {hasDuplicateMappings && (
                  <p className="text-[10px] text-red-500">
                    Duplicate lead sources detected. Each source can only be
                    mapped once.
                  </p>
                )}
              </div>
            )}

          {eventTypeDirty && (
            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                size="sm"
                className="h-7 text-[10px]"
                disabled={updateConfig.isPending || !mappingsValid}
                onClick={handleSaveEventType}
              >
                {updateConfig.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lead Sources */}
      <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <Tag className="h-3 w-3 text-zinc-400" />
          <h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Lead Sources
          </h2>
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">
          The bot will respond to leads from these sources and do proactive
          outreach for new leads.
        </p>
        <LeadSourceSelector
          selected={displayedSources}
          onChange={(sources) => {
            setLeadSources(sources);
            setSourcesDirty(true);
          }}
          disabled={updateConfig.isPending}
        />
        {sourcesDirty && (
          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={updateConfig.isPending}
              onClick={handleSaveSources}
            >
              {updateConfig.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Lead Statuses */}
      <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
        <div className="flex items-center gap-1.5 mb-2">
          <ListChecks className="h-3 w-3 text-zinc-400" />
          <h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Lead Statuses
          </h2>
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">
          The bot will only respond to leads in these statuses. Leads in other
          statuses will be skipped.
        </p>
        <LeadStatusSelector
          selected={displayedStatuses}
          onChange={(statuses) => {
            setLeadStatuses(statuses);
            setStatusesDirty(true);
          }}
          disabled={updateConfig.isPending}
        />
        {statusesDirty && (
          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={updateConfig.isPending}
              onClick={handleSaveStatuses}
            >
              {updateConfig.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
