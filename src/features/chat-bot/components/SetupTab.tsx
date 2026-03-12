// src/features/chat-bot/components/SetupTab.tsx
// Bot configuration + Close CRM / Calendly / Google Calendar connection management + lead source/status config

import { useState, useEffect } from "react";
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
  Clock,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useChatBotGoogleStatus,
  useConnectClose,
  useDisconnectClose,
  useGetCalendlyAuthUrl,
  useDisconnectCalendly,
  useGetGoogleAuthUrl,
  useDisconnectGoogle,
  useUpdateBusinessHours,
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SetupTab() {
  const { data: agent } = useChatBotAgent();
  const { data: closeStatus, isLoading: closeLoading } =
    useChatBotCloseStatus();
  const { data: calendlyStatus, isLoading: calendlyLoading } =
    useChatBotCalendlyStatus();
  const { data: googleStatus, isLoading: googleLoading } =
    useChatBotGoogleStatus();
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
  const getGoogleAuth = useGetGoogleAuthUrl();
  const disconnectGoogle = useDisconnectGoogle();
  const updateBusinessHours = useUpdateBusinessHours();
  const updateConfig = useUpdateBotConfig();

  // Derive which calendar provider is connected
  const calendarProvider: "google" | "calendly" | null = googleStatus?.connected
    ? "google"
    : calendlyStatus?.connected
      ? "calendly"
      : null;

  // Local state for lead source/status editing
  const [leadSources, setLeadSources] = useState<string[] | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<string[] | null>(null);
  const [sourcesDirty, setSourcesDirty] = useState(false);
  const [statusesDirty, setStatusesDirty] = useState(false);
  const [eventTypeMappings, setEventTypeMappings] = useState<
    { leadSource: string; eventTypeSlug: string }[] | null
  >(null);
  const [eventTypeDirty, setEventTypeDirty] = useState(false);

  // Business hours local state
  const [bhDays, setBhDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bhStart, setBhStart] = useState("09:00");
  const [bhEnd, setBhEnd] = useState("17:00");
  const [bhDirty, setBhDirty] = useState(false);

  // Initialize business hours from agent data
  useEffect(() => {
    if (agent?.businessHours) {
      setBhDays(agent.businessHours.days);
      setBhStart(agent.businessHours.startTime);
      setBhEnd(agent.businessHours.endTime);
      setBhDirty(false);
    }
  }, [agent?.businessHours]);

  // Resolve displayed values: local edits override agent data
  const displayedSources = leadSources ?? agent?.autoOutreachLeadSources ?? [];
  const displayedStatuses = leadStatuses ?? agent?.allowedLeadStatuses ?? [];

  const handleCalendlyConnect = async () => {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("tab", "setup");
    try {
      const result = await getCalendlyAuth.mutateAsync(returnUrl.toString());
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to get Calendly auth URL — no URL returned.");
      }
    } catch {
      // Error toast handled by hook
    }
  };

  const handleGoogleConnect = async () => {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("tab", "setup");
    try {
      const result = await getGoogleAuth.mutateAsync(returnUrl.toString());
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error(
          "Failed to get Google Calendar auth URL — no URL returned.",
        );
      }
    } catch {
      // Error toast handled by hook
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

  const handleSaveBusinessHours = () => {
    if (bhStart >= bhEnd) {
      toast.error("Start time must be before end time.");
      return;
    }
    if (bhDays.length === 0) {
      toast.error("Select at least one day.");
      return;
    }
    updateBusinessHours.mutate(
      { days: bhDays, startTime: bhStart, endTime: bhEnd },
      {
        onSuccess: () => {
          setBhDirty(false);
        },
      },
    );
  };

  const toggleDay = (day: number) => {
    setBhDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort(),
    );
    setBhDirty(true);
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
      {/* ═══════════ BOT POWER — full-width enable/disable card ═══════════ */}
      {agent && !agent.botEnabled ? (
        <button
          type="button"
          disabled={updateConfig.isPending}
          onClick={handleToggleBot}
          className="group w-full relative overflow-hidden rounded-xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/50 dark:via-yellow-950/40 dark:to-orange-950/40 p-5 text-left transition-all hover:border-amber-500 hover:shadow-lg hover:shadow-amber-200/40 dark:hover:shadow-amber-900/30 disabled:opacity-70"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-200/30 to-transparent dark:from-amber-700/20 rounded-bl-full" />
          <div className="relative flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600 flex items-center justify-center flex-shrink-0 shadow-xl shadow-amber-400/30 dark:shadow-amber-600/30 group-hover:scale-105 transition-transform">
              {updateConfig.isPending ? (
                <Loader2 className="h-7 w-7 text-white animate-spin" />
              ) : (
                <Power className="h-7 w-7 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-amber-900 dark:text-amber-100">
                Your bot is ready — turn it on!
              </p>
              <p className="text-[12px] text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                Everything is configured. Click here to enable the bot and start
                responding to leads, handling objections, and booking
                appointments automatically.
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 group-hover:bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-all group-hover:scale-110">
                <Power className="h-8 w-8 text-white" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Enable
              </span>
            </div>
          </div>
        </button>
      ) : agent?.botEnabled ? (
        <div className="rounded-xl border-2 border-emerald-400 dark:border-emerald-600 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/30 p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-400/30">
              <Power className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-emerald-900 dark:text-emerald-100">
                Bot is active and responding to leads
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                Your bot is live — it will respond to inbound messages and reach
                out to new leads during business hours.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-[11px] border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
              disabled={updateConfig.isPending}
              onClick={handleToggleBot}
            >
              {updateConfig.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : (
                <Power className="h-3 w-3 mr-1.5" />
              )}
              Disable Bot
            </Button>
          </div>
        </div>
      ) : null}

      {/* Bot Config Section */}
      <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
          Bot Configuration
        </h2>

        <div className="space-y-2.5">
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

      {/* Appointment Reminders */}
      {agent && (
        <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Bell className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                  Appointment Reminders
                </h2>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Automatically send an SMS reminder 24 hours before each
                  appointment.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={agent.remindersEnabled ?? false}
              disabled={updateConfig.isPending}
              onClick={() =>
                updateConfig.mutate({
                  remindersEnabled: !(agent.remindersEnabled ?? false),
                })
              }
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-50",
                agent.remindersEnabled
                  ? "bg-violet-600"
                  : "bg-zinc-200 dark:bg-zinc-700",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                  agent.remindersEnabled ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        </div>
      )}

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

      {/* Calendar Connections — show both when none connected, single when one is */}
      {calendarProvider === null ? (
        <>
          {/* Calendly */}
          <ConnectionCard
            title="Calendly"
            icon={
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">CAL</span>
              </div>
            }
            connected={false}
            isLoading={calendlyLoading}
            onOAuthConnect={handleCalendlyConnect}
            oauthLoading={getCalendlyAuth.isPending}
            oauthLabel="Connect Calendly"
            onDisconnect={() => disconnectCalendly.mutate()}
            disconnectLoading={disconnectCalendly.isPending}
          />

          {/* Google Calendar */}
          <ConnectionCard
            title="Google Calendar"
            icon={
              <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center">
                <Calendar className="h-3 w-3 text-white" />
              </div>
            }
            connected={false}
            isLoading={googleLoading}
            onOAuthConnect={handleGoogleConnect}
            oauthLoading={getGoogleAuth.isPending}
            oauthLabel="Connect Google Calendar"
            onDisconnect={() => disconnectGoogle.mutate()}
            disconnectLoading={disconnectGoogle.isPending}
          />
        </>
      ) : calendarProvider === "calendly" ? (
        <ConnectionCard
          title="Calendly"
          icon={
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">CAL</span>
            </div>
          }
          connected={true}
          statusLabel={
            calendlyStatus?.userName
              ? `${calendlyStatus.userName} (${calendlyStatus.userEmail})`
              : "Connected to Calendly"
          }
          isLoading={calendlyLoading}
          onOAuthConnect={handleCalendlyConnect}
          oauthLoading={getCalendlyAuth.isPending}
          oauthLabel="Connect Calendly"
          onDisconnect={() => disconnectCalendly.mutate()}
          disconnectLoading={disconnectCalendly.isPending}
        />
      ) : (
        <ConnectionCard
          title="Google Calendar"
          icon={
            <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center">
              <Calendar className="h-3 w-3 text-white" />
            </div>
          }
          connected={true}
          statusLabel={
            googleStatus?.userEmail
              ? `Connected as ${googleStatus.userEmail}`
              : "Connected to Google Calendar"
          }
          isLoading={googleLoading}
          onOAuthConnect={handleGoogleConnect}
          oauthLoading={getGoogleAuth.isPending}
          oauthLabel="Connect Google Calendar"
          onDisconnect={() => disconnectGoogle.mutate()}
          disconnectLoading={disconnectGoogle.isPending}
        />
      )}

      {/* Calendar Health Check */}
      <CalendarHealthBanner enabled={calendarProvider !== null} />

      {/* Business Hours (Google Calendar only) */}
      {calendarProvider === "google" && (
        <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3 w-3 text-zinc-400" />
            <h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Business Hours
            </h2>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">
            Set available days and times for appointment scheduling via Google
            Calendar.
          </p>

          {/* Day toggles */}
          <div className="flex items-center gap-1 mb-3">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={cn(
                  "h-6 px-2 text-[10px] font-medium rounded-full border transition-colors",
                  bhDays.includes(i)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Time range */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                From
              </span>
              <input
                type="time"
                value={bhStart}
                onChange={(e) => {
                  setBhStart(e.target.value);
                  setBhDirty(true);
                }}
                className="h-7 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-[11px] text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                To
              </span>
              <input
                type="time"
                value={bhEnd}
                onChange={(e) => {
                  setBhEnd(e.target.value);
                  setBhDirty(true);
                }}
                className="h-7 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-[11px] text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Validation error */}
          {bhStart >= bhEnd && bhDirty && (
            <p className="text-[10px] text-red-500 mt-1.5">
              Start time must be before end time.
            </p>
          )}

          {/* Save button */}
          {bhDirty && (
            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                size="sm"
                className="h-7 text-[10px]"
                disabled={
                  updateBusinessHours.isPending ||
                  bhStart >= bhEnd ||
                  bhDays.length === 0
                }
                onClick={handleSaveBusinessHours}
              >
                {updateBusinessHours.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Save Business Hours
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lead Source → Event Type Mappings (Calendly only) */}
      {calendarProvider === "calendly" && (
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
