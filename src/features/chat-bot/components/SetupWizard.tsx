// src/features/chat-bot/components/SetupWizard.tsx
// Post-subscribe step-by-step guided configuration wizard

import { useState, useCallback } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Rocket,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConnectionCard } from "./ConnectionCard";
import { LeadSourceSelector } from "./LeadSourceSelector";
import { LeadStatusSelector } from "./LeadStatusSelector";
import {
  getConnectionStateLabel,
  resolveConnectionState,
} from "../lib/connection-state";
import {
  type ChatBotAgent,
  useChatBotCloseStatus,
  useChatBotCloseLeadStatuses,
  useChatBotCalendlyStatus,
  useChatBotGoogleStatus,
  useConnectClose,
  useDisconnectClose,
  useGetCalendlyAuthUrl,
  useDisconnectCalendly,
  useGetGoogleAuthUrl,
  useDisconnectGoogle,
  useUpdateBotConfig,
} from "../hooks/useChatBot";

// ─── Steps ──────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: "Connect Close" },
  { id: 2, title: "Connect Calendar" },
  { id: 3, title: "Lead Sources" },
  { id: 4, title: "Outbound Statuses" },
  { id: 5, title: "Done" },
] as const;

// ─── Props ──────────────────────────────────────────────────────

interface SetupWizardProps {
  agent: ChatBotAgent;
  onComplete: () => void;
}

// ─── Component ──────────────────────────────────────────────────

export function SetupWizard({ agent, onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [leadSources, setLeadSources] = useState<string[]>(
    agent.autoOutreachLeadSources || [],
  );
  const [leadStatuses, setLeadStatuses] = useState<string[]>(
    agent.allowedLeadStatuses || [],
  );
  const [sourcesSaved, setSourcesSaved] = useState(
    (agent.autoOutreachLeadSources?.length ?? 0) > 0,
  );
  const [statusesSaved, setStatusesSaved] = useState(
    (agent.allowedLeadStatuses?.length ?? 0) > 0,
  );

  // Queries
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
  const { data: closeLeadStatuses } =
    useChatBotCloseLeadStatuses(closeConnected);
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

  // Mutations
  const connectClose = useConnectClose();
  const disconnectClose = useDisconnectClose();
  const getCalendlyAuth = useGetCalendlyAuthUrl();
  const disconnectCalendly = useDisconnectCalendly();
  const getGoogleAuth = useGetGoogleAuthUrl();
  const disconnectGoogle = useDisconnectGoogle();
  const updateConfig = useUpdateBotConfig();

  // Derive which calendar provider is connected
  const calendarProvider: "google" | "calendly" | null =
    googleConnectionState === "connected"
      ? "google"
      : calendlyConnectionState === "connected"
        ? "calendly"
        : null;

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

  const handleSaveSources = () => {
    updateConfig.mutate(
      { autoOutreachLeadSources: leadSources },
      {
        onSuccess: () => setSourcesSaved(true),
      },
    );
  };

  const handleSaveStatuses = () => {
    updateConfig.mutate(
      { allowedLeadStatuses: leadStatuses },
      {
        onSuccess: () => setStatusesSaved(true),
      },
    );
  };

  const handleFinish = () => {
    updateConfig.mutate(
      { botEnabled: true },
      { onSuccess: () => onComplete() },
    );
  };

  // Step completion checks
  const isStepComplete = useCallback(
    (stepId: number): boolean => {
      switch (stepId) {
        case 1:
          return closeConnected;
        case 2:
          return calendarProvider !== null;
        case 3:
          return sourcesSaved && leadSources.length > 0;
        case 4:
          return statusesSaved && leadStatuses.length > 0;
        case 5:
          return false;
        default:
          return false;
      }
    },
    [
      closeStatus,
      calendlyStatus,
      googleStatus,
      sourcesSaved,
      statusesSaved,
      leadSources,
      leadStatuses,
    ],
  );

  const canAdvance = isStepComplete(currentStep);

  return (
    <div className="space-y-3">
      {/* Stepper */}
      <div className="p-3 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const isComplete = isStepComplete(step.id);
            const isCurrent = step.id === currentStep;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-medium w-full",
                    isCurrent
                      ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                      : isComplete
                        ? "text-emerald-600 dark:text-emerald-400 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                        : "text-v2-ink-subtle dark:text-v2-ink-muted hover:bg-v2-canvas dark:hover:bg-v2-card-tinted",
                  )}
                >
                  {isComplete ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                      <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold",
                        isCurrent
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                          : "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink-subtle dark:text-v2-ink-muted",
                      )}
                    >
                      {step.id}
                    </div>
                  )}
                  <span className="truncate hidden sm:inline">
                    {step.title}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="w-4 h-px bg-v2-ring dark:bg-v2-ring-strong flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-4 border border-v2-ring dark:border-v2-ring bg-v2-card rounded-lg min-h-[200px]">
        {/* Step 1: Connect Close */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                Connect your Close CRM
              </h3>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-1">
                The bot needs access to your Close CRM to receive inbound SMS
                messages and send replies. You'll need your Close API key
                (Settings &gt; API Keys in Close).
              </p>
            </div>
            <ConnectionCard
              title="Close CRM"
              icon={
                <div className="w-6 h-6 rounded bg-v2-ink dark:bg-v2-card-tinted flex items-center justify-center">
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
          </div>
        )}

        {/* Step 2: Connect Calendar (Calendly or Google Calendar) */}
        {currentStep === 2 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                Connect your calendar
              </h3>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-1">
                The bot checks your real calendar availability to offer
                appointment times, and books events when leads confirm. Connect
                either Calendly or Google Calendar.
              </p>
            </div>

            {calendarProvider === null ? (
              <>
                <ConnectionCard
                  title="Calendly"
                  icon={
                    <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
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
                    <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center">
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
                oauthLabel="Connect Google Calendar"
                onDisconnect={() => disconnectGoogle.mutate()}
                disconnectLoading={disconnectGoogle.isPending}
              />
            )}
          </div>
        )}

        {/* Step 3: Lead Sources */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                Configure Lead Sources
              </h3>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-1">
                Select which lead sources the bot should respond to. These
                should match the "Lead Source" custom field values on your Close
                leads. The bot will also do proactive outreach for new leads
                from these sources.
              </p>
            </div>
            <LeadSourceSelector
              selected={leadSources}
              onChange={(sources) => {
                setLeadSources(sources);
                setSourcesSaved(false);
              }}
              disabled={updateConfig.isPending}
            />
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                className="h-7 text-[10px]"
                disabled={leadSources.length === 0 || updateConfig.isPending}
                onClick={handleSaveSources}
              >
                {updateConfig.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {sourcesSaved ? "Saved" : "Save Lead Sources"}
              </Button>
              {sourcesSaved && (
                <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  <Check className="h-2 w-2 mr-0.5" />
                  Saved
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Outbound Lead Statuses */}
        {currentStep === 4 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                Configure Outbound Statuses
              </h3>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-1">
                Select which lead statuses trigger automated outbound outreach
                (intro SMS, drip campaigns). This does not affect inbound — use
                Blocked Lead Statuses in the Audience tab to prevent the bot
                from responding entirely.
              </p>
            </div>
            <LeadStatusSelector
              options={closeLeadStatuses}
              selected={leadStatuses}
              onChange={(statuses) => {
                setLeadStatuses(statuses);
                setStatusesSaved(false);
              }}
              disabled={updateConfig.isPending}
            />
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                className="h-7 text-[10px]"
                disabled={leadStatuses.length === 0 || updateConfig.isPending}
                onClick={handleSaveStatuses}
              >
                {updateConfig.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {statusesSaved ? "Saved" : "Save Outbound Statuses"}
              </Button>
              {statusesSaved && (
                <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  <Check className="h-2 w-2 mr-0.5" />
                  Saved
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {currentStep === 5 && (
          <div className="space-y-3 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto">
              <Rocket className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-v2-ink dark:text-v2-ink">
                Setup Complete
              </h3>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-1 max-w-sm mx-auto">
                Your bot is configured and ready to go. When you click the
                button below, the bot will be enabled and will start responding
                to inbound SMS leads and will send automated outreach to leads
                matching your configured sources and statuses.
              </p>
            </div>

            {/* Summary */}
            <div className="text-left max-w-sm mx-auto space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-[10px]">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                  Close CRM:{" "}
                  {getConnectionStateLabel(closeConnectionState, {
                    connected: closeStatus?.orgName || "Connected",
                    disconnected: "Not connected",
                    unavailable: "Connection status unavailable",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                  Calendar:{" "}
                  {calendarProvider === "calendly"
                    ? "Calendly connected"
                    : calendarProvider === "google"
                      ? "Google Calendar connected"
                      : calendlyConnectionState === "unavailable" ||
                          googleConnectionState === "unavailable"
                        ? "Connection status unavailable"
                        : "Not connected"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                  Lead Sources:{" "}
                  {leadSources.length > 0 ? leadSources.join(", ") : "None"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                  Outbound Statuses: {leadStatuses.length} selected
                </span>
              </div>
            </div>

            <Button
              className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white mt-3"
              disabled={updateConfig.isPending}
              onClick={handleFinish}
            >
              {updateConfig.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Rocket className="h-3 w-3 mr-1" />
              )}
              Enable Bot & Go to Dashboard
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentStep < 5 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          >
            <ChevronLeft className="h-3 w-3 mr-0.5" />
            Back
          </Button>
          <Button
            size="sm"
            className="h-7 text-[10px]"
            disabled={!canAdvance}
            onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
          >
            Next
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
