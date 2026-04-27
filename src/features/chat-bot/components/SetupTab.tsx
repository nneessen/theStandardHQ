import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  Clock,
  Globe,
  ListChecks,
  Loader2,
  Phone,
  PlugZap,
  Power,
  RefreshCw,
  Settings2,
  ShieldBan,
  Smartphone,
  Tag,
  User,
  MessageSquare,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { AgentProfileSection } from "./AgentProfileSection";
import { BlockedLeadStatusSelector } from "./BlockedLeadStatusSelector";
import { CalendarHealthBanner } from "./CalendarHealthBanner";
import { ConnectionCard } from "./ConnectionCard";
import { LeadSourceSelector } from "./LeadSourceSelector";
import { LeadStatusSelector } from "./LeadStatusSelector";
import { ResponseScheduleSection } from "./ResponseScheduleSection";
import { IntroMessageVariantsEditor } from "./IntroMessageVariantsEditor";
import { StatusTriggerSequenceEditor } from "./StatusTriggerSequenceEditor";
import {
  getConnectionStateLabel,
  resolveConnectionState,
} from "../lib/connection-state";
import {
  useChatBotAgent,
  useChatBotCalendlyEventTypes,
  useChatBotCalendlyStatus,
  useChatBotCloseLeadStatuses,
  useChatBotCloseStatus,
  useChatBotGoogleStatus,
  useChatBotPhoneNumbers,
  useConnectClose,
  useDisconnectCalendly,
  useDisconnectClose,
  useDisconnectGoogle,
  useGetCalendlyAuthUrl,
  useGetGoogleAuthUrl,
  useUpdateBotConfig,
  useUpdateBusinessHours,
} from "../hooks/useChatBot";

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

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink">
          {icon}
        </div>
        <div>
          <h2 className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-v2-ring bg-white px-3 py-2 dark:border-v2-ring dark:bg-v2-card">
      <p className="text-[9px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
        {label}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
        {value}
      </p>
    </div>
  );
}

export function SetupTab() {
  const { data: agent } = useChatBotAgent();
  const {
    data: closeStatus,
    error: closeStatusError,
    isLoading: closeLoading,
  } = useChatBotCloseStatus();
  const closeConnectionState = resolveConnectionState({
    connected: closeStatus?.connected,
    error: closeStatusError,
  });
  const closeConnected = closeConnectionState === "connected";
  const { data: closeLeadStatuses, isLoading: closeLeadStatusesLoading } =
    useChatBotCloseLeadStatuses(closeConnected);
  const { data: phoneNumbers, isLoading: phoneNumbersLoading } =
    useChatBotPhoneNumbers(closeConnected);
  const {
    data: calendlyStatus,
    error: calendlyStatusError,
    isLoading: calendlyLoading,
  } = useChatBotCalendlyStatus();
  const {
    data: googleStatus,
    error: googleStatusError,
    isLoading: googleLoading,
  } = useChatBotGoogleStatus();
  const calendlyConnectionState = resolveConnectionState({
    connected: calendlyStatus?.connected,
    error: calendlyStatusError,
  });
  const googleConnectionState = resolveConnectionState({
    connected: googleStatus?.connected,
    error: googleStatusError,
  });
  const {
    data: eventTypes,
    isLoading: eventTypesLoading,
    isError: eventTypesError,
    error: eventTypesErrorObj,
    refetch: refetchEventTypes,
  } = useChatBotCalendlyEventTypes(calendlyConnectionState === "connected");

  const connectClose = useConnectClose();
  const disconnectClose = useDisconnectClose();
  const getCalendlyAuth = useGetCalendlyAuthUrl();
  const disconnectCalendly = useDisconnectCalendly();
  const getGoogleAuth = useGetGoogleAuthUrl();
  const disconnectGoogle = useDisconnectGoogle();
  const updateBusinessHours = useUpdateBusinessHours();
  const updateConfig = useUpdateBotConfig();

  const calendarProvider: "google" | "calendly" | null =
    googleConnectionState === "connected"
      ? "google"
      : calendlyConnectionState === "connected"
        ? "calendly"
        : null;

  const [leadSources, setLeadSources] = useState<string[] | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<string[] | null>(null);
  const [blockedStatuses, setBlockedStatuses] = useState<string[] | null>(null);
  const [sourcesDirty, setSourcesDirty] = useState(false);
  const [statusesDirty, setStatusesDirty] = useState(false);
  const [blockedDirty, setBlockedDirty] = useState(false);
  const [eventTypeMappings, setEventTypeMappings] = useState<
    { leadSource: string; eventTypeSlug: string }[] | null
  >(null);
  const [eventTypeDirty, setEventTypeDirty] = useState(false);

  const [bhDays, setBhDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bhStart, setBhStart] = useState("09:00");
  const [bhEnd, setBhEnd] = useState("17:00");
  const [bhDirty, setBhDirty] = useState(false);

  useEffect(() => {
    if (agent?.businessHours) {
      setBhDays(agent.businessHours.days);
      setBhStart(agent.businessHours.startTime);
      setBhEnd(agent.businessHours.endTime);
      setBhDirty(false);
    }
  }, [agent?.businessHours]);

  const [notifPhone, setNotifPhone] = useState(agent?.notificationPhone ?? "");
  const [notifPhoneDirty, setNotifPhoneDirty] = useState(false);
  useEffect(() => {
    setNotifPhone(agent?.notificationPhone ?? "");
    setNotifPhoneDirty(false);
  }, [agent?.notificationPhone]);

  const [reEngageDelay, setReEngageDelay] = useState(
    String(agent?.reEngagementDelayHours ?? 48),
  );
  const [reEngageAttempts, setReEngageAttempts] = useState(
    String(agent?.reEngagementMaxAttempts ?? 2),
  );

  useEffect(() => {
    setReEngageDelay(String(agent?.reEngagementDelayHours ?? 48));
    setReEngageAttempts(String(agent?.reEngagementMaxAttempts ?? 2));
  }, [agent?.reEngagementDelayHours, agent?.reEngagementMaxAttempts]);

  const reEngageDirty =
    String(agent?.reEngagementDelayHours ?? 48) !== reEngageDelay ||
    String(agent?.reEngagementMaxAttempts ?? 2) !== reEngageAttempts;
  const reEngageDelayParsed = Number.parseInt(reEngageDelay, 10);
  const reEngageAttemptsParsed = Number.parseInt(reEngageAttempts, 10);
  const reEngageValid =
    Number.isInteger(reEngageDelayParsed) &&
    reEngageDelayParsed >= 1 &&
    reEngageDelayParsed <= 720 &&
    Number.isInteger(reEngageAttemptsParsed) &&
    reEngageAttemptsParsed >= 1 &&
    reEngageAttemptsParsed <= 10;

  const displayedSources = leadSources ?? agent?.autoOutreachLeadSources ?? [];
  const displayedStatuses = leadStatuses ?? agent?.allowedLeadStatuses ?? [];
  const displayedBlockedStatuses =
    blockedStatuses ?? agent?.blockedLeadStatuses ?? [];
  const displayedEventTypeMappings =
    eventTypeMappings ?? agent?.leadSourceEventTypeMappings ?? [];

  const hasInvalidMappings = displayedEventTypeMappings.some(
    (mapping) => !mapping.leadSource.trim() || !mapping.eventTypeSlug.trim(),
  );
  const hasDuplicateMappings = (() => {
    const seen = new Set<string>();
    for (const mapping of displayedEventTypeMappings) {
      const key = mapping.leadSource.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  })();
  const mappingsValid = !hasInvalidMappings && !hasDuplicateMappings;

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
      // handled in hook
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
      // handled in hook
    }
  };

  const handleToggleBot = () => {
    if (!agent) return;
    updateConfig.mutate({ botEnabled: !agent.botEnabled });
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

  const handleSaveBlockedStatuses = () => {
    updateConfig.mutate(
      { blockedLeadStatuses: displayedBlockedStatuses },
      {
        onSuccess: () => {
          setBlockedDirty(false);
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

  const toggleDay = (day: number) => {
    setBhDays((previous) =>
      previous.includes(day)
        ? previous.filter((value) => value !== day)
        : [...previous, day].sort(),
    );
    setBhDirty(true);
  };

  const calendarLabel =
    calendarProvider === "google"
      ? "Google Calendar"
      : calendarProvider === "calendly"
        ? "Calendly"
        : calendlyConnectionState === "unavailable" ||
            googleConnectionState === "unavailable"
          ? "Connection unavailable"
          : "Not connected";

  return (
    <div className="space-y-4">
      {agent && !agent.botEnabled ? (
        <button
          type="button"
          disabled={updateConfig.isPending}
          onClick={handleToggleBot}
          className="group relative w-full overflow-hidden rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-5 text-left transition-all hover:border-amber-500 hover:shadow-lg hover:shadow-amber-200/40 disabled:opacity-70 dark:border-amber-500 dark:from-amber-950/50 dark:via-yellow-950/40 dark:to-orange-950/40 dark:hover:shadow-amber-900/30"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-gradient-to-bl from-amber-200/30 to-transparent dark:from-amber-700/20" />
          <div className="relative flex items-center gap-5">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-400/30 transition-transform group-hover:scale-105 dark:from-amber-500 dark:to-orange-600 dark:shadow-amber-600/30">
              {updateConfig.isPending ? (
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              ) : (
                <Power className="h-7 w-7 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-amber-900 dark:text-amber-100">
                Your bot is ready — turn it on!
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                Everything is configured. Click here to enable the bot and start
                responding to leads, handling objections, and booking
                appointments automatically.
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 transition-all group-hover:scale-110 group-hover:bg-emerald-600 group-hover:shadow-emerald-500/50">
                <Power className="h-8 w-8 text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Enable
              </span>
            </div>
          </div>
        </button>
      ) : agent?.botEnabled ? (
        <div className="rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-green-50 p-4 dark:border-emerald-600 dark:from-emerald-950/40 dark:to-green-950/30">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-md shadow-emerald-400/30">
              <Power className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-emerald-900 dark:text-emerald-100">
                Bot is active and responding to leads
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                Your bot is live and will follow the response schedule you set
                below.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-shrink-0 border-red-300 px-3 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              disabled={updateConfig.isPending}
              onClick={handleToggleBot}
            >
              {updateConfig.isPending ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Power className="mr-1.5 h-3 w-3" />
              )}
              Disable Bot
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-v2-ring bg-v2-canvas/70 p-4 dark:border-v2-ring dark:bg-v2-card/60">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-v2-ink shadow-sm dark:bg-v2-card dark:text-v2-ink">
                <Settings2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold text-v2-ink dark:text-v2-ink">
                  Configuration Workspace
                </h2>
                <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Split by section so you can adjust behavior without a long
                  single-column form.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            <SummaryTile
              label="Timezone"
              value={agent?.timezone ?? "America/New_York"}
            />
            <SummaryTile label="Calendar" value={calendarLabel} />
            <SummaryTile
              label="CRM"
              value={getConnectionStateLabel(closeConnectionState, {
                connected: "Close connected",
                disconnected: "Not connected",
                unavailable: "Connection unavailable",
              })}
            />
            <SummaryTile
              label="Outbound Audience"
              value={`${agent?.autoOutreachLeadSources?.length ?? 0} sources / ${agent?.allowedLeadStatuses?.length ?? 0} statuses`}
            />
            <SummaryTile
              label="Blocked Statuses"
              value={`${agent?.blockedLeadStatuses?.length ?? 0} blocked`}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="automation" className="space-y-3">
        <TabsList
          variant="segment"
          className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-v2-card-tinted p-1 lg:grid-cols-5 dark:bg-v2-card-tinted/70"
        >
          <TabsTrigger
            value="automation"
            variant="segment"
            size="sm"
            className="h-9 gap-2"
          >
            <Power className="h-3.5 w-3.5" />
            <span className="text-[10px] lg:text-[11px]">Automation</span>
          </TabsTrigger>
          <TabsTrigger
            value="profile"
            variant="segment"
            size="sm"
            className="h-9 gap-2"
          >
            <User className="h-3.5 w-3.5" />
            <span className="text-[10px] lg:text-[11px]">Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            variant="segment"
            size="sm"
            className="h-9 gap-2"
          >
            <PlugZap className="h-3.5 w-3.5" />
            <span className="text-[10px] lg:text-[11px]">Integrations</span>
          </TabsTrigger>
          <TabsTrigger
            value="audience"
            variant="segment"
            size="sm"
            className="h-9 gap-2"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] lg:text-[11px]">Audience</span>
          </TabsTrigger>
          <TabsTrigger
            value="sequences"
            variant="segment"
            size="sm"
            className="h-9 gap-2"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-[10px] lg:text-[11px]">Sequences</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automation" className="mt-0">
          <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-3">
              <SectionCard
                icon={<Globe className="h-4 w-4" />}
                title="Timezone"
                description="Used as the fallback when a lead does not have a valid timezone."
              >
                <Select
                  value={agent?.timezone || "America/New_York"}
                  onValueChange={(timezone) =>
                    updateConfig.mutate({ timezone })
                  }
                  disabled={updateConfig.isPending}
                >
                  <SelectTrigger className="h-9 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((timezone) => (
                      <SelectItem
                        key={timezone}
                        value={timezone}
                        className="text-[11px]"
                      >
                        {timezone.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SectionCard>

              {closeConnected ? (
                <SectionCard
                  icon={<Phone className="h-4 w-4" />}
                  title="Primary Phone Number"
                  description="Default outbound number for new leads. Used when no state mapping matches."
                >
                  {phoneNumbersLoading ? (
                    <div className="flex items-center gap-2 text-[10px] text-v2-ink-muted">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading phone numbers...
                    </div>
                  ) : phoneNumbers && phoneNumbers.length > 0 ? (
                    <Select
                      value={agent?.primaryPhone || "__none__"}
                      onValueChange={(value) =>
                        updateConfig.mutate({
                          primaryPhone: value === "__none__" ? null : value,
                        })
                      }
                      disabled={updateConfig.isPending}
                    >
                      <SelectTrigger className="h-9 text-[11px]">
                        <SelectValue placeholder="No primary phone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-[11px]">
                          None (use round-robin / Close default)
                        </SelectItem>
                        {phoneNumbers.map((pn) => (
                          <SelectItem
                            key={pn.id}
                            value={pn.phone}
                            className="text-[11px]"
                          >
                            {pn.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                        No phone numbers found in your Close account.
                      </p>
                      {agent?.primaryPhone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted">
                            Current: {agent.primaryPhone}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700"
                            disabled={updateConfig.isPending}
                            onClick={() =>
                              updateConfig.mutate({ primaryPhone: null })
                            }
                          >
                            Clear
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </SectionCard>
              ) : null}

              {agent ? (
                <SectionCard
                  icon={<Bell className="h-4 w-4" />}
                  title="Appointment Reminders"
                  description="Send automated SMS reminders before each scheduled appointment."
                >
                  <div className="space-y-0 divide-y divide-v2-ring rounded-lg border border-v2-ring bg-v2-canvas dark:divide-v2-ring dark:border-v2-ring dark:bg-v2-canvas/40">
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-v2-ink-subtle" />
                        <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                          24-hour reminder
                        </p>
                      </div>
                      <Switch
                        checked={agent.remindersEnabled ?? false}
                        onCheckedChange={(checked) =>
                          updateConfig.mutate({ remindersEnabled: checked })
                        }
                        disabled={updateConfig.isPending}
                        variant="success"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-v2-ink-subtle" />
                        <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                          1-hour reminder
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          agent.remindersEnabled
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-v2-ink-subtle dark:text-v2-ink-muted",
                        )}
                      >
                        {agent.remindersEnabled ? "Enabled" : "Off"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-v2-ink-subtle" />
                        <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                          15-minute reminder
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          agent.remindersEnabled
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-v2-ink-subtle dark:text-v2-ink-muted",
                        )}
                      >
                        {agent.remindersEnabled ? "Enabled" : "Off"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    The toggle controls all three reminders. Each is sent
                    automatically at the specified interval before the
                    appointment.
                  </p>
                </SectionCard>
              ) : null}

              {agent ? (
                <SectionCard
                  icon={<Smartphone className="h-4 w-4" />}
                  title="Appointment SMS Notification"
                  description="Receive a text when your bot books an appointment."
                >
                  <div className="space-y-2">
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={notifPhone}
                      onChange={(e) => {
                        setNotifPhone(e.target.value);
                        setNotifPhoneDirty(true);
                      }}
                      className="h-9 text-[11px]"
                    />
                    {notifPhoneDirty && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 px-3 text-[10px]"
                          disabled={updateConfig.isPending}
                          onClick={() => {
                            const cleaned = notifPhone.replace(/[^\d+]/g, "");
                            if (cleaned && !/^\+?1?\d{10,14}$/.test(cleaned)) {
                              toast.error(
                                "Enter a valid phone number (e.g. +15551234567).",
                              );
                              return;
                            }
                            let normalized = cleaned;
                            if (normalized && !normalized.startsWith("+")) {
                              normalized =
                                normalized.length === 10
                                  ? `+1${normalized}`
                                  : `+${normalized}`;
                            }
                            updateConfig.mutate(
                              {
                                notificationPhone: normalized || null,
                              },
                              {
                                onSuccess: () => setNotifPhoneDirty(false),
                              },
                            );
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => {
                            setNotifPhone(agent.notificationPhone ?? "");
                            setNotifPhoneDirty(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    {agent.notificationPhone && !notifPhoneDirty && (
                      <p className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Notifications will be sent to {agent.notificationPhone}
                      </p>
                    )}
                    {!agent.notificationPhone && !notifPhoneDirty && (
                      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                        No phone set. You won&apos;t receive SMS notifications
                        for booked appointments.
                      </p>
                    )}
                  </div>
                </SectionCard>
              ) : null}

              {agent ? (
                <SectionCard
                  icon={<RefreshCw className="h-4 w-4" />}
                  title="Stale Lead Re-Engagement"
                  description="Automatically re-engage leads that stop responding after initial outreach."
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2.5 dark:border-v2-ring dark:bg-v2-canvas/40">
                      <div>
                        <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                          Enable re-engagement
                        </p>
                        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                          Send follow-up messages to stale leads automatically.
                          Hard declines are always excluded.
                        </p>
                      </div>
                      <Switch
                        checked={agent.reEngagementEnabled ?? false}
                        onCheckedChange={(checked) =>
                          updateConfig.mutate({ reEngagementEnabled: checked })
                        }
                        disabled={updateConfig.isPending}
                        variant="success"
                      />
                    </div>

                    <div
                      className={cn(
                        "space-y-3 rounded-lg border border-v2-ring bg-v2-canvas px-3 py-3 dark:border-v2-ring dark:bg-v2-canvas/40",
                        !(agent.reEngagementEnabled ?? false) && "opacity-50",
                      )}
                    >
                      <label className="space-y-1">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
                          Delay before re-engagement (hours)
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          value={reEngageDelay}
                          onChange={(e) => setReEngageDelay(e.target.value)}
                          disabled={
                            !(agent.reEngagementEnabled ?? false) ||
                            updateConfig.isPending
                          }
                          className="h-8 text-[11px]"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
                          Max attempts per lead
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={reEngageAttempts}
                          onChange={(e) => setReEngageAttempts(e.target.value)}
                          disabled={
                            !(agent.reEngagementEnabled ?? false) ||
                            updateConfig.isPending
                          }
                          className="h-8 text-[11px]"
                        />
                      </label>

                      {reEngageDirty ? (
                        <div className="flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
                          <Button
                            size="sm"
                            className="h-7 text-[10px]"
                            disabled={
                              !reEngageValid ||
                              !(agent.reEngagementEnabled ?? false) ||
                              updateConfig.isPending
                            }
                            onClick={() =>
                              updateConfig.mutate({
                                reEngagementDelayHours: reEngageDelayParsed,
                                reEngagementMaxAttempts: reEngageAttemptsParsed,
                              })
                            }
                          >
                            {updateConfig.isPending ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="mr-1 h-3 w-3" />
                            )}
                            Save
                          </Button>
                          {!reEngageValid ? (
                            <p className="text-[10px] text-red-500">
                              Delay must be 1–720h, attempts 1–10.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard
                icon={<Clock className="h-4 w-4" />}
                title="Schedule Behavior"
                description="Defaults are 08:00-20:30 every day unless you save a custom schedule."
              >
                <div className="space-y-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  <div className="rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2 dark:border-v2-ring dark:bg-v2-canvas/40">
                    Automated replies follow the lead&apos;s timezone when it is
                    available.
                  </div>
                  <div className="rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2 dark:border-v2-ring dark:bg-v2-canvas/40">
                    Same-day booking can end earlier than replies by using a
                    custom cutoff per day.
                  </div>
                </div>
              </SectionCard>
            </div>

            <ResponseScheduleSection />
          </div>
        </TabsContent>

        <TabsContent value="profile" className="mt-0">
          <AgentProfileSection />
        </TabsContent>

        <TabsContent value="integrations" className="mt-0">
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="space-y-3">
              <ConnectionCard
                title="Close CRM"
                icon={
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-v2-ink dark:bg-v2-card-tinted">
                    <span className="text-[8px] font-bold text-white dark:text-v2-ink">
                      CRM
                    </span>
                  </div>
                }
                connected={closeConnected}
                state={closeConnectionState}
                statusLabel={
                  closeStatus?.orgName
                    ? `Organization: ${closeStatus.orgName}`
                    : undefined
                }
                unavailableLabel="We could not verify your Close CRM connection right now. Your existing bot connection may still be active."
                isLoading={closeLoading}
                onConnect={(apiKey) => connectClose.mutate(apiKey)}
                connectLoading={connectClose.isPending}
                apiKeyPlaceholder="Close API key (api_...)"
                onDisconnect={() => disconnectClose.mutate()}
                disconnectLoading={disconnectClose.isPending}
              />

              {calendarProvider === null ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <ConnectionCard
                    title="Calendly"
                    icon={
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
                        <span className="text-[8px] font-bold text-white">
                          CAL
                        </span>
                      </div>
                    }
                    connected={false}
                    state={calendlyConnectionState}
                    isLoading={calendlyLoading}
                    unavailableLabel="We could not verify your Calendly connection right now."
                    onOAuthConnect={handleCalendlyConnect}
                    oauthLoading={getCalendlyAuth.isPending}
                    oauthLabel="Connect Calendly"
                    onDisconnect={() => disconnectCalendly.mutate()}
                    disconnectLoading={disconnectCalendly.isPending}
                  />

                  <ConnectionCard
                    title="Google Calendar"
                    icon={
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-red-500">
                        <Calendar className="h-3 w-3 text-white" />
                      </div>
                    }
                    connected={false}
                    state={googleConnectionState}
                    isLoading={googleLoading}
                    unavailableLabel="We could not verify your Google Calendar connection right now."
                    onOAuthConnect={handleGoogleConnect}
                    oauthLoading={getGoogleAuth.isPending}
                    oauthLabel="Connect Google Calendar"
                    onDisconnect={() => disconnectGoogle.mutate()}
                    disconnectLoading={disconnectGoogle.isPending}
                  />
                </div>
              ) : calendarProvider === "calendly" ? (
                <ConnectionCard
                  title="Calendly"
                  icon={
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
                      <span className="text-[8px] font-bold text-white">
                        CAL
                      </span>
                    </div>
                  }
                  connected={true}
                  state={calendlyConnectionState}
                  statusLabel={
                    calendlyStatus?.userName
                      ? `${calendlyStatus.userName} (${calendlyStatus.userEmail})`
                      : "Connected to Calendly"
                  }
                  unavailableLabel="We could not verify your Calendly connection right now."
                  isLoading={calendlyLoading}
                  onOAuthConnect={handleCalendlyConnect}
                  oauthLoading={getCalendlyAuth.isPending}
                  oauthLabel="Reconnect Calendly"
                  onDisconnect={() => disconnectCalendly.mutate()}
                  disconnectLoading={disconnectCalendly.isPending}
                />
              ) : (
                <ConnectionCard
                  title="Google Calendar"
                  icon={
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-red-500">
                      <Calendar className="h-3 w-3 text-white" />
                    </div>
                  }
                  connected={true}
                  state={googleConnectionState}
                  statusLabel={
                    googleStatus?.userEmail
                      ? `Connected as ${googleStatus.userEmail}`
                      : "Connected to Google Calendar"
                  }
                  unavailableLabel="We could not verify your Google Calendar connection right now."
                  isLoading={googleLoading}
                  onOAuthConnect={handleGoogleConnect}
                  oauthLoading={getGoogleAuth.isPending}
                  oauthLabel="Reconnect Google Calendar"
                  onDisconnect={() => disconnectGoogle.mutate()}
                  disconnectLoading={disconnectGoogle.isPending}
                />
              )}

              <CalendarHealthBanner enabled={calendarProvider !== null} />
            </div>

            <div className="space-y-3">
              {calendarProvider === "google" ? (
                <SectionCard
                  icon={<Clock className="h-4 w-4" />}
                  title="Business Hours"
                  description="Set available days and times for Google Calendar scheduling."
                >
                  <div className="mb-3 flex flex-wrap gap-1">
                    {DAY_LABELS.map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={cn(
                          "h-7 rounded-full border px-2.5 text-[10px] font-medium transition-colors",
                          bhDays.includes(index)
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-v2-ring-strong bg-white text-v2-ink-muted hover:border-v2-ring-strong dark:border-v2-ring-strong dark:bg-v2-card dark:text-v2-ink-subtle",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
                        Start
                      </span>
                      <input
                        type="time"
                        value={bhStart}
                        onChange={(event) => {
                          setBhStart(event.target.value);
                          setBhDirty(true);
                        }}
                        className="h-8 w-full rounded-md border border-v2-ring-strong bg-white px-2 text-[11px] text-v2-ink dark:border-v2-ring-strong dark:bg-v2-card dark:text-v2-ink"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
                        End
                      </span>
                      <input
                        type="time"
                        value={bhEnd}
                        onChange={(event) => {
                          setBhEnd(event.target.value);
                          setBhDirty(true);
                        }}
                        className="h-8 w-full rounded-md border border-v2-ring-strong bg-white px-2 text-[11px] text-v2-ink dark:border-v2-ring-strong dark:bg-v2-card dark:text-v2-ink"
                      />
                    </label>
                  </div>

                  {bhStart >= bhEnd && bhDirty ? (
                    <p className="mt-2 text-[10px] text-red-500">
                      Start time must be before end time.
                    </p>
                  ) : null}

                  {bhDirty ? (
                    <div className="mt-3 flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
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
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="mr-1 h-3 w-3" />
                        )}
                        Save Business Hours
                      </Button>
                    </div>
                  ) : null}
                </SectionCard>
              ) : null}

              {calendarProvider === "calendly" ? (
                <SectionCard
                  icon={<Calendar className="h-4 w-4" />}
                  title="Lead Source Event Types"
                  description="Map lead sources to specific Calendly event types."
                >
                  {eventTypesLoading ? (
                    <div className="h-8 rounded bg-v2-card-tinted dark:bg-v2-card-tinted" />
                  ) : eventTypesError ? (
                    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/30">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
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
                        className="ml-auto h-5 px-1.5 text-[9px] text-amber-600 hover:text-amber-800"
                        onClick={() => refetchEventTypes()}
                      >
                        <RefreshCw className="mr-0.5 h-3 w-3" />
                        Retry
                      </Button>
                    </div>
                  ) : eventTypes && eventTypes.length > 0 ? (
                    <div className="space-y-2">
                      {displayedEventTypeMappings.map((mapping, index) => (
                        <div
                          key={`${mapping.leadSource}-${index}`}
                          className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        >
                          <input
                            type="text"
                            value={mapping.leadSource}
                            onChange={(event) => {
                              const updated = [...displayedEventTypeMappings];
                              updated[index] = {
                                ...updated[index],
                                leadSource: event.target.value,
                              };
                              setEventTypeMappings(updated);
                              setEventTypeDirty(true);
                            }}
                            placeholder="e.g. Sitka Life"
                            disabled={updateConfig.isPending}
                            className="h-8 rounded-md border border-v2-ring-strong bg-white px-2 text-[11px] dark:border-v2-ring-strong dark:bg-v2-card"
                          />
                          <Select
                            value={mapping.eventTypeSlug || "__none__"}
                            onValueChange={(value) => {
                              const updated = [...displayedEventTypeMappings];
                              updated[index] = {
                                ...updated[index],
                                eventTypeSlug:
                                  value === "__none__" ? "" : value,
                              };
                              setEventTypeMappings(updated);
                              setEventTypeDirty(true);
                            }}
                            disabled={updateConfig.isPending}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value="__none__"
                                className="text-[11px]"
                              >
                                Select event type
                              </SelectItem>
                              {eventTypes.map((eventType) => (
                                <SelectItem
                                  key={eventType.slug}
                                  value={eventType.slug}
                                  className="text-[11px]"
                                >
                                  {eventType.name} ({eventType.duration} min)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[10px] text-red-500 hover:text-red-700"
                            disabled={updateConfig.isPending}
                            onClick={() => {
                              setEventTypeMappings(
                                displayedEventTypeMappings.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              );
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
                        className="h-8 border-dashed text-[10px]"
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
                    <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      No event types found. Create an event type in Calendly
                      first.
                    </p>
                  )}

                  {(hasInvalidMappings || hasDuplicateMappings) &&
                  displayedEventTypeMappings.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {hasInvalidMappings ? (
                        <p className="text-[10px] text-red-500">
                          Each mapping must have both a lead source and an event
                          type.
                        </p>
                      ) : null}
                      {hasDuplicateMappings ? (
                        <p className="text-[10px] text-red-500">
                          Duplicate lead sources detected. Each source can only
                          be mapped once.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {eventTypeDirty ? (
                    <div className="mt-3 flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
                      <Button
                        size="sm"
                        className="h-7 text-[10px]"
                        disabled={updateConfig.isPending || !mappingsValid}
                        onClick={handleSaveEventType}
                      >
                        {updateConfig.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="mr-1 h-3 w-3" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  ) : null}
                </SectionCard>
              ) : null}

              {calendarProvider === null ? (
                <SectionCard
                  icon={<Calendar className="h-4 w-4" />}
                  title="Calendar Rules"
                  description="Connect a calendar provider to unlock scheduling-specific settings."
                >
                  <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Google Calendar enables business hours. Calendly enables
                    lead-source-to-event-type mapping.
                  </p>
                </SectionCard>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audience" className="mt-0">
          <div className="grid gap-3 xl:grid-cols-2">
            <SectionCard
              icon={<Tag className="h-4 w-4" />}
              title="Lead Sources"
              description="The bot will respond to leads from these sources and can proactively reach out to new leads."
            >
              <LeadSourceSelector
                selected={displayedSources}
                onChange={(sources) => {
                  setLeadSources(sources);
                  setSourcesDirty(true);
                }}
                disabled={updateConfig.isPending}
              />
              {sourcesDirty ? (
                <div className="mt-3 flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
                  <Button
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={updateConfig.isPending}
                    onClick={handleSaveSources}
                  >
                    {updateConfig.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    Save Changes
                  </Button>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              icon={<ListChecks className="h-4 w-4" />}
              title="Outbound Lead Statuses"
              description="Controls which lead statuses trigger automated outbound outreach (intro SMS, drip campaigns). This does not affect inbound — use Blocked Lead Statuses below to prevent the bot from responding entirely."
            >
              <LeadStatusSelector
                options={closeLeadStatuses}
                selected={displayedStatuses}
                onChange={(statuses) => {
                  setLeadStatuses(statuses);
                  setStatusesDirty(true);
                }}
                disabled={updateConfig.isPending}
              />
              {statusesDirty ? (
                <div className="mt-3 flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
                  <Button
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={updateConfig.isPending}
                    onClick={handleSaveStatuses}
                  >
                    {updateConfig.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    Save Changes
                  </Button>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              icon={<ShieldBan className="h-4 w-4" />}
              title="Blocked Lead Statuses"
              description="The bot will not respond to leads with any of these statuses. This applies to both inbound and outbound messages."
            >
              <BlockedLeadStatusSelector
                options={closeLeadStatuses}
                selected={displayedBlockedStatuses}
                onChange={(statuses) => {
                  setBlockedStatuses(statuses);
                  setBlockedDirty(true);
                }}
                disabled={updateConfig.isPending}
                closeConnected={closeConnected}
                isLoadingStatuses={closeLeadStatusesLoading}
              />
              {blockedDirty ? (
                <div className="mt-3 flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
                  <Button
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={updateConfig.isPending}
                    onClick={handleSaveBlockedStatuses}
                  >
                    {updateConfig.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    Save Changes
                  </Button>
                </div>
              ) : null}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="sequences" className="mt-0">
          <div className="space-y-3">
            <IntroMessageVariantsEditor />
            <StatusTriggerSequenceEditor />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
