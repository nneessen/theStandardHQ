import {
  type ElementType,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Check,
  Construction,
  CreditCard,
  Loader2,
  Lock,
  PhoneCall,
  Settings2,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CloseCrmLogo } from "@/components/logos/CloseCrmLogo";
import { useImo } from "@/contexts/ImoContext";
import {
  BlockedLeadStatusSelector,
  ChatBotApiError,
  useChatBotAgent,
  useChatBotCloseLeadStatuses,
  useCreateVoiceAgent,
  useStartVoiceTrial,
  useChatBotVoiceSetupState,
  useConnectClose,
  useDisconnectClose,
  useChatBotRetellLlm,
  useChatBotRetellRuntime,
  useChatBotRetellVoices,
  useChatBotVoiceEntitlement,
  useChatBotVoiceUsage,
  useChatBotVoiceCloneStatus,
  useUpdateBotConfig,
} from "@/features/chat-bot";
import { ConnectionCard } from "@/features/chat-bot";
import { useUserActiveAddons } from "@/hooks/subscription";
import {
  PREMIUM_VOICE_ADDON_NAME,
  PREMIUM_VOICE_LAUNCH_PRICE_MONTHLY_CENTS,
} from "@/lib/subscription/voice-addon";
import {
  VoiceAgentLanding,
  type VoiceAgentSetupStep,
} from "./components/VoiceAgentLanding";
import { VoiceAgentConnectionCard } from "./components/VoiceAgentConnectionCard";
import { VoiceAgentRetellStudioCard } from "./components/VoiceAgentRetellStudioCard";
import { VoiceAgentRuntimeCard } from "./components/VoiceAgentRuntimeCard";
import { VoiceAgentStatusCard } from "./components/VoiceAgentStatusCard";
import { VoiceAgentUsageCard } from "./components/VoiceAgentUsageCard";
import { VoiceCallRulesCard } from "./components/VoiceCallRulesCard";
import { VoiceGuardrailsCard } from "./components/VoiceGuardrailsCard";
import {
  isVoiceAgentProvisioned,
  isVoiceAgentProvisioningPending,
} from "./lib/voice-agent-contract";
import {
  normalizeNextActionKey,
  parseVoiceSnapshot,
  type VoiceNextActionKey,
} from "./lib/voice-agent-helpers";
import { VoiceAgentOverviewTab } from "./components/VoiceAgentOverviewTab";
import { VoiceCloneStatusCard } from "./components/VoiceCloneStatusCard";

const VOICE_LAUNCH_INCLUDED_MINUTES = 500;
const VOICE_LAUNCH_INCLUDED_MINUTES_TRIAL = 15;

type VoiceTabId = "overview" | "plans" | "setup" | "stats" | "admin";
type VoiceSetupTabId =
  | "voice"
  | "instructions"
  | "call-flow"
  | "advanced"
  | "launch";

const ENTITLEMENT_ACTIVE_STATUSES = new Set(["active", "trialing"]);
const BILLING_NEXT_ACTION_KEYS = new Set<VoiceNextActionKey>([
  "resolve_billing",
  "resolve_suspension",
  "replenish_minutes",
  "reactivate_voice",
]);
const INLINE_ACTIVATION_KEYS = new Set<VoiceNextActionKey>([
  "activate_trial",
  "activate_voice",
]);
const SETUP_REDIRECT_ACTION_KEYS = new Set<VoiceNextActionKey>([
  "wait_for_provisioning",
  "publish_agent",
  "connect_calendar",
  "review_guardrails",
]);

function isServiceIssue(error: unknown) {
  return error instanceof ChatBotApiError && error.isServiceError;
}

function isNonProvisioningError(error: unknown) {
  return (
    error instanceof ChatBotApiError &&
    !error.isNotProvisioned &&
    !error.isServiceError
  );
}

function getLocalVoiceEnvWarning(error: unknown): string | null {
  if (!(error instanceof ChatBotApiError)) return null;
  if (
    error.message.includes(
      "Chat bot service is not configured in this local edge environment.",
    )
  ) {
    return "Local voice setup is blocked because the local edge function is missing its upstream chat bot API env. Start the Supabase functions server with the project .env so voice reads can load.";
  }

  return null;
}

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildSetupSteps({
  voiceAccessActive,
  closeConnected,
  voiceAgentCreated,
  voiceAgentProvisioning,
  voiceProfileReady,
  promptReady,
  callFlowReady,
  launchReady,
}: {
  voiceAccessActive: boolean;
  closeConnected: boolean;
  voiceAgentCreated: boolean;
  voiceAgentProvisioning: boolean;
  voiceProfileReady: boolean;
  promptReady: boolean;
  callFlowReady: boolean;
  launchReady: boolean;
}): VoiceAgentSetupStep[] {
  const rawSteps = [
    {
      id: "voice-access",
      title: "Voice access",
      description: voiceAccessActive
        ? "Your workspace can provision and edit a managed voice agent."
        : "Voice is not activated for this workspace yet. Activation or billing has to be resolved before agent creation.",
      complete: voiceAccessActive,
    },
    {
      id: "close",
      title: "Close CRM",
      description: closeConnected
        ? "Your Close CRM connection is active for inbound voice routing and lead lookups."
        : "Connect Close CRM first. Inbound calls and lead records come from Close CRM.",
      complete: closeConnected,
    },
    {
      id: "line",
      title: voiceAgentCreated ? "Voice Agent" : "Create Your Voice Agent",
      description: voiceAgentCreated
        ? "Your voice agent is ready for setup."
        : voiceAgentProvisioning
          ? "Your voice agent is being created now. Setup unlocks as soon as the draft is ready."
          : "Create the voice agent for this workspace before editing can start.",
      complete: voiceAgentCreated,
    },
    {
      id: "profile",
      title: "Voice & greeting",
      description: voiceProfileReady
        ? "A voice and opening line are already in place."
        : "Choose the spoken voice and write the opening greeting.",
      complete: voiceProfileReady,
    },
    {
      id: "prompt",
      title: "Prompt & instructions",
      description: promptReady
        ? "The core instructions are already written."
        : "Explain what the agent should say, do, and when it should transfer.",
      complete: promptReady,
    },
    {
      id: "call-flow",
      title: "Call flow",
      description: callFlowReady
        ? "Availability and handoff rules are configured."
        : "Choose when the agent answers and how calls should route.",
      complete: callFlowReady,
    },
    {
      id: "launch",
      title: "Go live",
      description: launchReady
        ? "The live voice agent is already published."
        : "Save the draft, then publish once the experience sounds right.",
      complete: launchReady,
    },
  ];

  const firstIncompleteIndex = rawSteps.findIndex((step) => !step.complete);

  return rawSteps.map((step, index) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    state: step.complete
      ? "complete"
      : firstIncompleteIndex === index
        ? "current"
        : "upcoming",
  }));
}

function getNextStepCopy(steps: VoiceAgentSetupStep[]) {
  const current = steps.find((step) => step.state === "current");
  if (current) {
    return {
      title: current.title,
      description: current.description,
    };
  }

  return {
    title: "Voice setup is ready",
    description:
      "Your draft is configured. Review it occasionally, then publish again any time you change the voice, greeting, or prompt.",
  };
}

function isVoiceAccessActive(status: string | null | undefined) {
  return typeof status === "string"
    ? ENTITLEMENT_ACTIVE_STATUSES.has(status.trim().toLowerCase())
    : false;
}

function getDefaultNextActionCopy(key: VoiceNextActionKey) {
  switch (key) {
    case "activate_trial":
      return {
        title: "Activate your voice trial",
        description:
          "Voice access has to be active before a managed voice agent can be created.",
      };
    case "resolve_billing":
      return {
        title: "Resolve voice billing",
        description:
          "Voice access is blocked until the workspace billing issue is resolved.",
      };
    case "resolve_suspension":
      return {
        title: "Resolve the voice suspension",
        description:
          "Voice access is suspended for this workspace until the account issue is cleared.",
      };
    case "replenish_minutes":
      return {
        title: "Replenish voice minutes",
        description:
          "The workspace needs more voice minutes before additional voice actions can continue.",
      };
    case "reactivate_voice":
      return {
        title: "Reactivate voice access",
        description:
          "Voice was previously deactivated for this workspace and must be reactivated first.",
      };
    case "activate_voice":
      return {
        title: "Voice is not activated yet",
        description:
          "Activate voice access for this workspace before you try to create a managed voice agent.",
      };
    case "connect_close":
      return {
        title: "Connect Close CRM",
        description:
          "Connect Close CRM first so inbound calls and lead lookups can be routed correctly.",
      };
    case "create_agent":
      return {
        title: "Create your voice agent",
        description:
          "This workspace is ready to provision its managed Retell agent now.",
      };
    case "wait_for_provisioning":
      return {
        title: "Creating your voice agent",
        description:
          "The managed voice workspace is provisioning now. This usually takes less than a minute.",
      };
    case "repair_agent":
      return {
        title: "Repair the managed voice agent",
        description:
          "The backend detected a voice-agent mismatch and the linked agent needs repair.",
      };
    case "publish_agent":
      return {
        title: "Publish your draft",
        description:
          "The agent is provisioned and editable. Review the draft, then publish it live.",
      };
    case "connect_calendar":
      return {
        title: "Finish setup",
        description:
          "The agent is provisioned. Complete the remaining setup work before you go live.",
      };
    case "review_guardrails":
      return {
        title: "Review your live setup",
        description:
          "The voice agent is already provisioned. Review guardrails and launch settings before further changes.",
      };
    default:
      return {
        title: "Review voice setup",
        description:
          "Check the current voice setup state and continue the next required step.",
      };
  }
}

function getNextActionCopy({
  key,
  label,
  description,
  fallback,
}: {
  key: VoiceNextActionKey;
  label?: string | null;
  description?: string | null;
  fallback: ReturnType<typeof getNextStepCopy>;
}) {
  const defaults = getDefaultNextActionCopy(key);

  return {
    title: isFilledString(label) ? label : defaults.title || fallback.title,
    description: isFilledString(description)
      ? description
      : defaults.description || fallback.description,
  };
}

function getSetupTabForNextAction(key: VoiceNextActionKey): VoiceSetupTabId {
  switch (key) {
    case "publish_agent":
    case "review_guardrails":
      return "launch";
    case "connect_calendar":
      return "call-flow";
    default:
      return "voice";
  }
}

function SetupStepButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      }`}
    >
      <p className="text-[12px] font-semibold">{label}</p>
      <p
        className={`mt-1 text-[10px] leading-5 ${
          active
            ? "text-zinc-300 dark:text-zinc-700"
            : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {description}
      </p>
    </button>
  );
}

function CreateVoiceAgentCard({
  title,
  description,
  statusLabel,
  statusTone,
  onPrimaryAction,
  primaryActionLabel,
  primaryActionDisabled,
  errorMessage,
  actionUnavailable,
  isSuperAdmin,
}: {
  title: string;
  description: string;
  statusLabel: string;
  statusTone: "created" | "creating" | "required";
  onPrimaryAction: () => void;
  primaryActionLabel: ReactNode;
  primaryActionDisabled: boolean;
  errorMessage?: string | null;
  actionUnavailable?: boolean;
  isSuperAdmin?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          <p className="mt-1 text-[12px] leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>

        <Badge
          className={
            statusTone === "created"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : statusTone === "creating"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }
        >
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl" />

        <Button
          onClick={onPrimaryAction}
          disabled={primaryActionDisabled || actionUnavailable}
        >
          {primaryActionLabel}
        </Button>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-[11px] leading-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                Voice agent creation is unavailable right now
              </p>
              <p className="mt-1">{errorMessage}</p>
              {isSuperAdmin && actionUnavailable && (
                <p className="mt-2">
                  This environment is missing the latest voice-agent create
                  route. Deploy the updated voice API and edge function before
                  testing this step.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function VoiceAgentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<VoiceTabId>("overview");
  const [activeSetupTab, setActiveSetupTab] =
    useState<VoiceSetupTabId>("voice");

  // ── Checkout success detection ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success(
        "Voice addon activated! Create your voice agent to get started.",
      );
      window.history.replaceState({}, "", window.location.pathname);
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    }
  }, [queryClient]);
  const { isSuperAdmin } = useImo();
  const { activeAddons, isLoading: addonsLoading } = useUserActiveAddons();
  const voiceAddon = activeAddons.find(
    (addon) => addon.addon?.name === PREMIUM_VOICE_ADDON_NAME,
  );
  // ── Setup-state is the CANONICAL source of truth ──
  // Load on every mount. The backend returns the real state machine
  // (nextAction.key, agent.exists, connections, readiness).
  const {
    data: voiceSetupState,
    error: voiceSetupStateError,
    isLoading: voiceSetupStateLoading,
    refetch: refetchVoiceSetupState,
    isRefetching: voiceSetupStateRefetching,
  } = useChatBotVoiceSetupState();

  const voiceSnapshot = parseVoiceSnapshot(
    voiceAddon?.voice_entitlement_snapshot,
  );

  // Agent query is only needed for the full editor (setup/stats/admin tabs).
  const shouldLoadAgent =
    activeTab === "setup" || activeTab === "stats" || activeTab === "admin";
  const { data: agent, error: agentError } = useChatBotAgent(shouldLoadAgent);

  const {
    data: voiceEntitlement,
    error: voiceEntitlementError,
    isLoading: entitlementLoading,
    refetch: refetchEntitlement,
    isRefetching: entitlementRefetching,
  } = useChatBotVoiceEntitlement(
    activeTab === "stats" || activeTab === "overview",
  );

  const shouldLoadVoiceUsage =
    (activeTab === "stats" || activeTab === "overview") &&
    Boolean(voiceAddon || voiceEntitlement);
  const {
    data: voiceUsage,
    error: voiceUsageError,
    isLoading: usageLoading,
    refetch: refetchUsage,
    isRefetching: usageRefetching,
  } = useChatBotVoiceUsage(shouldLoadVoiceUsage);
  const createVoiceAgent = useCreateVoiceAgent();
  const startVoiceTrial = useStartVoiceTrial();
  const connectClose = useConnectClose();
  const disconnectClose = useDisconnectClose();

  // ── Derive all booleans from setup-state first, fallback to legacy ──
  const closeConnected =
    voiceSetupState?.connections?.close?.connected === true ||
    Boolean(agent?.connections?.close?.connected);
  const retellConnected =
    voiceSetupState?.connections?.retell?.connected === true ||
    Boolean(agent?.connections?.retell?.connected);
  const voiceAgentProvisioningStatus =
    voiceSetupState?.agent?.provisioningStatus ??
    (retellConnected ? "ready" : null);
  const voiceAgentProvisioning = isVoiceAgentProvisioningPending(
    voiceAgentProvisioningStatus,
  );
  // Trust backend setup-state when available. Only fall back to connection
  // status when setup-state is null (loading/error), preventing stale
  // retellConnected from overriding the backend's "agent doesn't exist".
  const voiceAgentCreated = voiceSetupState
    ? voiceSetupState.agent?.exists === true ||
      isVoiceAgentProvisioned(voiceAgentProvisioningStatus)
    : retellConnected || isVoiceAgentProvisioned(voiceAgentProvisioningStatus);
  const shouldLoadRetellDetails =
    (activeTab === "setup" || activeTab === "admin") && retellConnected;
  const {
    data: retellRuntime,
    error: retellRuntimeError,
    isLoading: retellRuntimeLoading,
  } = useChatBotRetellRuntime(shouldLoadRetellDetails);
  const {
    data: retellLlm,
    error: retellLlmError,
    isLoading: retellLlmLoading,
  } = useChatBotRetellLlm(shouldLoadRetellDetails);
  const {
    data: retellVoices = [],
    error: retellVoicesError,
    isLoading: retellVoicesLoading,
  } = useChatBotRetellVoices(shouldLoadRetellDetails);
  // Trust backend setup-state as canonical. Only fall back to local addon
  // status when setup-state is unavailable (null/error), not as an OR override.
  const voiceAccessActive = voiceSetupState
    ? voiceSetupState.readiness?.entitlementActive === true
    : isVoiceAccessActive(voiceEntitlement?.status ?? voiceSnapshot?.status) ||
      voiceAddon?.status === "active";
  // "published" and "is_published" both mean "draft matches live version" —
  // they go false after any draft edit, even if the agent is live and taking calls.
  // retellRuntime is only loaded on setup/admin tabs, so also use voiceSetupState
  // and retellConnected which are available on ALL tabs (including overview).
  const voiceAgentPublished =
    voiceSetupState?.agent?.published === true ||
    retellRuntime?.agent?.is_published === true ||
    isFilledString(retellRuntime?.connection?.fromNumber) ||
    isFilledString(retellRuntime?.connection?.closePhoneNumber) ||
    isFilledString(retellRuntime?.connection?.retellAgentId) ||
    // retellConnected comes from voiceSetupState — available on overview tab too.
    // If retell is connected AND the agent exists, it has been published.
    (retellConnected && voiceAgentCreated);

  const externalAgentId = voiceSetupState?.agent?.id ?? agent?.id ?? null;

  const shouldLoadCloneStatus =
    (activeTab === "overview" ||
      (activeTab === "setup" && activeSetupTab === "voice")) &&
    voiceAgentCreated &&
    voiceAccessActive;
  const { data: voiceCloneStatus, isLoading: cloneStatusLoading } =
    useChatBotVoiceCloneStatus(shouldLoadCloneStatus);

  // ── Blocked lead statuses (contact control) ──
  const shouldLoadCloseStatuses =
    (activeTab === "setup" && activeSetupTab === "call-flow") ||
    activeTab === "admin";
  const { data: closeLeadStatuses, isLoading: closeLeadStatusesLoading } =
    useChatBotCloseLeadStatuses(shouldLoadCloseStatuses && closeConnected);
  const updateBotConfig = useUpdateBotConfig();
  const [blockedStatuses, setBlockedStatuses] = useState<string[] | null>(null);
  const [blockedDirty, setBlockedDirty] = useState(false);
  const displayedBlockedStatuses =
    blockedStatuses ?? agent?.blockedLeadStatuses ?? [];
  const handleSaveBlockedStatuses = () => {
    updateBotConfig.mutate(
      { blockedLeadStatuses: displayedBlockedStatuses },
      { onSuccess: () => setBlockedDirty(false) },
    );
  };

  // ── nextAction.key: trust setup-state, fallback only when absent ──
  const setupStateNextActionKey = normalizeNextActionKey(
    voiceSetupState?.nextAction?.key,
  );
  const fallbackNextActionKey: VoiceNextActionKey = !voiceAccessActive
    ? "activate_voice"
    : !closeConnected
      ? "connect_close"
      : voiceAgentProvisioning
        ? "wait_for_provisioning"
        : !voiceAgentCreated
          ? "create_agent"
          : voiceAgentPublished
            ? "review_guardrails"
            : "publish_agent";
  // Setup-state is canonical — use fallback only when setup-state has no answer
  const voiceNextActionKey =
    setupStateNextActionKey !== "unknown"
      ? setupStateNextActionKey
      : fallbackNextActionKey;

  const canOpenSetup =
    voiceAgentCreated ||
    voiceAgentProvisioning ||
    SETUP_REDIRECT_ACTION_KEYS.has(voiceNextActionKey);

  const showServiceWarning =
    isServiceIssue(voiceSetupStateError) ||
    isServiceIssue(agentError) ||
    isServiceIssue(voiceEntitlementError) ||
    isServiceIssue(voiceUsageError) ||
    isServiceIssue(retellRuntimeError) ||
    isServiceIssue(retellLlmError) ||
    isServiceIssue(retellVoicesError);

  const hasUnexpectedError =
    isNonProvisioningError(voiceSetupStateError) ||
    isNonProvisioningError(agentError) ||
    isNonProvisioningError(voiceEntitlementError) ||
    isNonProvisioningError(voiceUsageError) ||
    isNonProvisioningError(retellRuntimeError) ||
    isNonProvisioningError(retellLlmError) ||
    isNonProvisioningError(retellVoicesError);
  const hasDegradedState = showServiceWarning || hasUnexpectedError;
  const localVoiceEnvWarning =
    getLocalVoiceEnvWarning(voiceSetupStateError) ??
    getLocalVoiceEnvWarning(agentError) ??
    getLocalVoiceEnvWarning(voiceEntitlementError) ??
    getLocalVoiceEnvWarning(voiceUsageError) ??
    getLocalVoiceEnvWarning(retellRuntimeError) ??
    getLocalVoiceEnvWarning(retellLlmError) ??
    getLocalVoiceEnvWarning(retellVoicesError);

  // Setup-state is sufficient for initial page render — don't block on agent query
  const isLoading = addonsLoading || voiceSetupStateLoading;

  const statsCardLoading =
    activeTab === "stats" &&
    !voiceSetupState?.entitlement &&
    !voiceSetupState?.usage &&
    (entitlementLoading || usageLoading);

  const launchPriceLabel = `$${(
    PREMIUM_VOICE_LAUNCH_PRICE_MONTHLY_CENTS / 100
  ).toFixed(0)}/mo`;

  const voiceProfileReady =
    (isFilledString(retellRuntime?.agent?.voice_id) &&
      isFilledString(retellLlm?.begin_message)) ||
    voiceNextActionKey === "publish_agent" ||
    voiceNextActionKey === "connect_calendar" ||
    voiceNextActionKey === "review_guardrails";
  const promptReady =
    isFilledString(retellLlm?.general_prompt) ||
    voiceNextActionKey === "publish_agent" ||
    voiceNextActionKey === "connect_calendar" ||
    voiceNextActionKey === "review_guardrails";
  const callFlowReady = Boolean(
    agent?.voiceEnabled ||
    agent?.afterHoursInboundEnabled ||
    agent?.voiceFollowUpEnabled ||
    agent?.voiceHumanHandoffEnabled ||
    agent?.voiceVoicemailEnabled ||
    isFilledString(agent?.voiceTransferNumber) ||
    voiceNextActionKey === "publish_agent" ||
    voiceNextActionKey === "connect_calendar" ||
    voiceNextActionKey === "review_guardrails",
  );
  const launchReady = voiceAgentPublished;

  const setupSteps = buildSetupSteps({
    voiceAccessActive,
    closeConnected,
    voiceAgentCreated,
    voiceAgentProvisioning,
    voiceProfileReady,
    promptReady,
    callFlowReady,
    launchReady,
  });
  const completedSteps = setupSteps.filter(
    (step) => step.state === "complete",
  ).length;
  const nextStep = getNextActionCopy({
    key: voiceNextActionKey,
    label: voiceSetupState?.nextAction?.label,
    description: voiceSetupState?.nextAction?.description,
    fallback: getNextStepCopy(setupSteps),
  });
  const createActionUnavailable =
    createVoiceAgent.error instanceof ChatBotApiError &&
    createVoiceAgent.error.isNotProvisioned;
  const createAgentErrorMessage = createActionUnavailable
    ? "Voice agent creation is not available in this environment yet."
    : (createVoiceAgent.error?.message ?? null);
  // Create is gated by the backend's nextAction.key — not local boolean assembly.
  // The backend returns "create_agent" only when entitlement is active and the
  // agent doesn't exist yet, so we don't need to re-check those conditions.
  const canCreateVoiceAgent =
    voiceNextActionKey === "create_agent" &&
    !voiceAgentCreated &&
    !voiceAgentProvisioning;
  const createCardTitle =
    !voiceAccessActive && BILLING_NEXT_ACTION_KEYS.has(voiceNextActionKey)
      ? "Voice access is not active yet"
      : voiceNextActionKey === "connect_close"
        ? "Step 1. Connect Close CRM first"
        : "Step 2. Create Your Voice Agent";
  const createCardDescription = voiceAgentCreated
    ? "The setup tab now contains the full editor for voice selection, greeting, prompt, call routing, and publishing."
    : voiceAgentProvisioning
      ? "The Standard HQ is finishing the managed workspace and loading the live draft. Setup will unlock automatically as soon as it is ready."
      : canCreateVoiceAgent
        ? "This creates the voice agent for this workspace inside The Standard HQ. After that, voice, instructions, call flow, advanced options, and launch controls unlock in Setup."
        : !voiceAccessActive
          ? "Voice access must be activated for this workspace before a managed voice agent can be created."
          : nextStep.description;
  const createCardStatusLabel = voiceAgentCreated
    ? "Created"
    : voiceAgentProvisioning
      ? "Creating"
      : canCreateVoiceAgent
        ? "Required"
        : "Blocked";
  const createCardStatusTone = voiceAgentCreated
    ? ("created" as const)
    : voiceAgentProvisioning
      ? ("creating" as const)
      : ("required" as const);
  const createCardPrimaryActionLabel = voiceAgentCreated ? (
    "Voice Agent Created"
  ) : voiceAgentProvisioning ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Finishing Setup
    </>
  ) : createVoiceAgent.isPending ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Creating Agent
    </>
  ) : canCreateVoiceAgent ? (
    "Create Your Voice Agent"
  ) : voiceNextActionKey === "connect_close" ? (
    "Connect Close CRM First"
  ) : !voiceAccessActive ? (
    "Voice Access Required"
  ) : (
    "Create Unavailable"
  );
  const createCardPrimaryActionDisabled =
    createVoiceAgent.isPending ||
    voiceAgentCreated ||
    voiceAgentProvisioning ||
    !canCreateVoiceAgent;

  const handleRefresh = () => {
    void refetchVoiceSetupState();
    void refetchEntitlement();
    if (shouldLoadVoiceUsage) {
      void refetchUsage();
    }
  };

  const handleCreateVoiceAgent = () => {
    if (!canCreateVoiceAgent || createVoiceAgent.isPending) return;
    createVoiceAgent.mutate({ templateKey: "default_sales" });
  };

  const tabs = useMemo(() => {
    const result: {
      id: VoiceTabId;
      label: string;
      icon: ElementType;
      locked?: boolean;
    }[] = [
      { id: "overview", label: "Overview", icon: Sparkles },
      { id: "plans", label: "Plans", icon: CreditCard },
      {
        id: "setup",
        label: "Setup",
        icon: Settings2,
        locked: !canOpenSetup,
      },
      {
        id: "stats",
        label: "Stats",
        icon: Activity,
        locked: !voiceAgentCreated,
      },
    ];
    if (isSuperAdmin) {
      result.push({ id: "admin", label: "Admin", icon: Wrench });
    }
    return result;
  }, [canOpenSetup, isSuperAdmin, voiceAgentCreated]);

  const landingPrimaryActionHref = BILLING_NEXT_ACTION_KEYS.has(
    voiceNextActionKey,
  )
    ? "/billing"
    : undefined;
  const landingPrimaryActionLabel = (() => {
    if (
      INLINE_ACTIVATION_KEYS.has(voiceNextActionKey) &&
      startVoiceTrial.isPending
    ) {
      return "Activating...";
    }
    switch (voiceNextActionKey) {
      case "activate_trial":
      case "activate_voice":
        return "Start Free Trial";
      case "resolve_billing":
        return "Resolve Billing";
      case "resolve_suspension":
        return "Resolve Suspension";
      case "replenish_minutes":
        return "Add Minutes";
      case "reactivate_voice":
        return "Reactivate Voice";
      case "connect_close":
        return "Connect Close CRM";
      case "create_agent":
        return "Create Voice Agent";
      case "wait_for_provisioning":
        return "Refresh Status";
      case "repair_agent":
        return "Repair Agent";
      case "publish_agent":
        return "Open Setup & Publish";
      case "review_guardrails":
        return "Review Setup";
      case "connect_calendar":
        return "Finish Setup";
      default:
        return canOpenSetup ? "Open Setup" : "View Billing";
    }
  })();
  const landingPrimaryActionDisabled =
    voiceNextActionKey === "wait_for_provisioning"
      ? voiceSetupStateRefetching || entitlementRefetching || usageRefetching
      : INLINE_ACTIVATION_KEYS.has(voiceNextActionKey)
        ? startVoiceTrial.isPending
        : false;
  const handleLandingPrimaryAction = () => {
    // Billing actions navigate via href — no tab switch needed
    if (BILLING_NEXT_ACTION_KEYS.has(voiceNextActionKey)) return;

    // Inline activation — call trial mutation directly (guard against double-click)
    if (INLINE_ACTIVATION_KEYS.has(voiceNextActionKey)) {
      if (startVoiceTrial.isPending) return;
      startVoiceTrial.mutate();
      return;
    }

    if (voiceNextActionKey === "wait_for_provisioning") {
      handleRefresh();
      return;
    }

    // Post-create actions go to the appropriate setup sub-tab
    if (canOpenSetup) {
      setActiveSetupTab(getSetupTabForNextAction(voiceNextActionKey));
      setActiveTab("setup");
    }
  };

  const statusBadge = hasDegradedState ? (
    <Badge className="h-4 bg-red-100 px-1.5 text-[9px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
      Service Issue
    </Badge>
  ) : voiceAgentPublished ? (
    <Badge className="h-4 bg-emerald-100 px-1.5 text-[9px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      Live
    </Badge>
  ) : voiceAgentProvisioning ? (
    <Badge className="h-4 bg-amber-100 px-1.5 text-[9px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      Provisioning
    </Badge>
  ) : voiceAgentCreated ? (
    <Badge className="h-4 bg-amber-100 px-1.5 text-[9px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      Draft
    </Badge>
  ) : !voiceAccessActive ? (
    <Badge className="h-4 bg-zinc-100 px-1.5 text-[9px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      Not Activated
    </Badge>
  ) : (
    <Badge className="h-4 bg-zinc-100 px-1.5 text-[9px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      Not Created
    </Badge>
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-zinc-50 p-3 dark:bg-zinc-950">
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col space-y-2.5 bg-zinc-50 p-3 dark:bg-zinc-950">
      {/* Hero Header — identical structure to ChatBotPage */}
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="va-grid"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#va-grid)" />
          </svg>
        </div>
        <div
          className="absolute top-1/3 -left-16 w-64 h-64 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
        />
        <div
          className="absolute bottom-0 -right-16 w-48 h-48 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(139,92,246,0.08)" }}
        />
        <div className="relative px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{ backgroundColor: "rgba(99,102,241,0.2)" }}
            >
              <PhoneCall className="h-4 w-4 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white dark:text-black tracking-tight">
                AI Voice Agent
              </h1>
              <p className="text-[10px] text-white/50 dark:text-black/40">
                Automated AI phone calls for follow-ups and inbound
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">{statusBadge}</div>
        </div>
      </div>

      {/* Under Construction Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-700 dark:bg-amber-950/30">
        <Construction className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
            Under Construction
          </p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            The AI Voice Agent is actively being built. Configuration and
            calling features are not yet available for general use.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 rounded-md bg-zinc-200/50 p-0.5 dark:bg-zinc-800/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (!tab.locked) setActiveTab(tab.id);
            }}
            className={cn(
              "flex items-center justify-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-medium transition-all whitespace-nowrap flex-shrink-0",
              tab.locked
                ? "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
                : activeTab === tab.id
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300",
            )}
            title={tab.locked ? "Create voice agent first" : undefined}
          >
            {tab.locked ? (
              <Lock className="h-3 w-3" />
            ) : (
              <tab.icon className="h-3 w-3" />
            )}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && (
          <VoiceAgentOverviewTab
            voiceAccessActive={voiceAccessActive}
            voiceAgentPublished={voiceAgentPublished}
            setupSteps={setupSteps}
            completedSteps={completedSteps}
            nextStepTitle={nextStep.title}
            primaryActionLabel={landingPrimaryActionLabel}
            primaryActionHref={landingPrimaryActionHref}
            primaryActionDisabled={landingPrimaryActionDisabled}
            onPrimaryAction={handleLandingPrimaryAction}
            onNavigateToSetup={() => {
              setActiveSetupTab("voice");
              setActiveTab("setup");
            }}
            onNavigateToStats={() => setActiveTab("stats")}
            onNavigateToPlans={() => setActiveTab("plans")}
            voiceEntitlement={voiceEntitlement}
            voiceUsage={voiceUsage}
            voiceSetupState={voiceSetupState}
            voiceSnapshot={voiceSnapshot}
            trialIncludedMinutes={VOICE_LAUNCH_INCLUDED_MINUTES_TRIAL}
            includedMinutes={VOICE_LAUNCH_INCLUDED_MINUTES}
            voiceCloneStatus={voiceCloneStatus}
            cloneStatusLoading={cloneStatusLoading}
            voiceAgentCreated={voiceAgentCreated}
            externalAgentId={externalAgentId}
            onNavigateToVoiceClone={() => {
              void navigate({ to: "/voice-agent/clone" });
            }}
          />
        )}

        {activeTab === "plans" && (
          <div className="space-y-3">
            <VoiceAgentLanding
              voiceAccessActive={voiceAccessActive}
              launchPriceLabel={launchPriceLabel}
              includedMinutes={VOICE_LAUNCH_INCLUDED_MINUTES}
              trialIncludedMinutes={VOICE_LAUNCH_INCLUDED_MINUTES_TRIAL}
              showServiceWarning={hasDegradedState}
              localDevWarning={localVoiceEnvWarning}
              isRefreshing={
                voiceSetupStateRefetching ||
                entitlementRefetching ||
                usageRefetching
              }
              onRefresh={handleRefresh}
              primaryActionLabel={landingPrimaryActionLabel}
              primaryActionHref={landingPrimaryActionHref}
              primaryActionDisabled={landingPrimaryActionDisabled}
              onPrimaryAction={handleLandingPrimaryAction}
              setupSteps={setupSteps}
              completedSteps={completedSteps}
              nextStepTitle={nextStep.title}
              nextStepDescription={nextStep.description}
              closeConnected={closeConnected}
              voiceAgentCreated={voiceAgentCreated}
              voiceAgentPublished={voiceAgentPublished}
              voiceAgentProvisioning={voiceAgentProvisioning}
              onNavigateToSetup={() => {
                setActiveSetupTab("voice");
                setActiveTab("setup");
              }}
              canOpenSetup={canOpenSetup}
            />

            {/* Create flow — shown when voice active but agent not yet created */}
            {voiceAccessActive && !voiceAgentCreated && (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
                        Connect Close CRM
                      </p>
                      <p className="mt-1 text-[12px] leading-6 text-zinc-600 dark:text-zinc-400">
                        The voice agent uses Close CRM to identify the lead,
                        decide whether AI is allowed to answer, and save call
                        results back to the lead record.
                      </p>
                    </div>

                    <Badge
                      className={
                        closeConnected
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }
                    >
                      {closeConnected ? "Connected" : "Required"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                    <ConnectionCard
                      title="Close CRM"
                      icon={
                        <CloseCrmLogo className="h-4 w-auto text-zinc-900 dark:text-zinc-100" />
                      }
                      connected={closeConnected}
                      statusLabel={
                        voiceSetupState?.connections?.close?.orgName
                          ? `Connected to ${voiceSetupState.connections.close.orgName}`
                          : agent?.connections?.close?.orgName
                            ? `Connected to ${agent.connections.close.orgName}`
                            : closeConnected
                              ? "Connected"
                              : undefined
                      }
                      onConnect={(apiKey) => connectClose.mutate(apiKey)}
                      connectLoading={connectClose.isPending}
                      apiKeyPlaceholder="Close API key (api_...)"
                      onDisconnect={
                        closeConnected
                          ? () => disconnectClose.mutate()
                          : undefined
                      }
                      disconnectLoading={disconnectClose.isPending}
                    />

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                        What this step does
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                        If you already use AI Chat Bot, this connection may
                        already exist. If not, create or copy a Close API key
                        from <span className="font-medium">Close Settings</span>
                        {" > "}
                        <span className="font-medium">API Keys</span>, then
                        connect it here.
                      </p>
                    </div>
                  </div>
                </div>

                <CreateVoiceAgentCard
                  title={createCardTitle}
                  description={createCardDescription}
                  statusLabel={createCardStatusLabel}
                  statusTone={createCardStatusTone}
                  onPrimaryAction={handleCreateVoiceAgent}
                  primaryActionLabel={createCardPrimaryActionLabel}
                  primaryActionDisabled={createCardPrimaryActionDisabled}
                  errorMessage={createAgentErrorMessage}
                  actionUnavailable={createActionUnavailable}
                  isSuperAdmin={isSuperAdmin}
                />
              </>
            )}
          </div>
        )}

        {activeTab === "setup" && (
          <div className="space-y-3">
            {!canOpenSetup ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Create your voice agent first
                </p>
                <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                  Go to the Plans tab to connect Close CRM and create the voice
                  agent, then come back here for voice, instructions, call flow,
                  advanced controls, and launch.
                </p>
              </div>
            ) : voiceAgentProvisioning && !retellConnected ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Your voice agent is being created now
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-amber-800 dark:text-amber-200">
                    The Standard HQ is finishing the managed workspace and
                    loading the live draft. You can stay on this page while it
                    finishes, or return to the Plans tab and refresh in a
                    moment.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
                        Setup Steps
                      </p>
                      <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
                        Move through these steps in order. Advanced settings
                        stay separate so the main setup flow stays clear.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <ShieldCheck className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        {completedSteps} of {setupSteps.length} launch steps
                        ready
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-5">
                    <SetupStepButton
                      active={activeSetupTab === "voice"}
                      label="1. Voice"
                      description="Voice, greeting, and tone"
                      onClick={() => setActiveSetupTab("voice")}
                    />
                    <SetupStepButton
                      active={activeSetupTab === "instructions"}
                      label="2. Instructions"
                      description="Prompt and behavior guidance"
                      onClick={() => setActiveSetupTab("instructions")}
                    />
                    <SetupStepButton
                      active={activeSetupTab === "call-flow"}
                      label="3. Call Flow"
                      description="Availability, transfers, and follow-up"
                      onClick={() => setActiveSetupTab("call-flow")}
                    />
                    <SetupStepButton
                      active={activeSetupTab === "advanced"}
                      label="4. Advanced"
                      description="Optional model, tools, and guardrails"
                      onClick={() => setActiveSetupTab("advanced")}
                    />
                    <SetupStepButton
                      active={activeSetupTab === "launch"}
                      label="5. Launch"
                      description="Readiness review and publish"
                      onClick={() => setActiveSetupTab("launch")}
                    />
                  </div>

                  {!closeConnected && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                      <div className="mb-2 flex items-center gap-2">
                        <CloseCrmLogo className="h-4 w-auto text-amber-700 dark:text-amber-300" />
                        <span className="font-semibold">
                          Close CRM required
                        </span>
                      </div>
                      Calls come through your Close number, and the lead record
                      the AI Voice Agent works with lives in Close CRM.
                    </div>
                  )}
                </div>

                <div
                  className={
                    activeSetupTab === "call-flow" ? "hidden" : "block"
                  }
                >
                  {activeSetupTab === "launch" && (
                    <div className="mb-3">
                      <VoiceAgentConnectionCard
                        connection={agent?.connections?.retell}
                        closeConnected={Boolean(
                          voiceSetupState?.connections?.close?.connected ??
                          agent?.connections?.close?.connected,
                        )}
                      />
                    </div>
                  )}

                  {activeSetupTab === "voice" &&
                    voiceAgentCreated &&
                    voiceAccessActive && (
                      <div className="mb-3">
                        <VoiceCloneStatusCard
                          cloneStatus={voiceCloneStatus}
                          isLoading={cloneStatusLoading}
                          agentId={externalAgentId}
                        />
                      </div>
                    )}

                  <VoiceAgentRetellStudioCard
                    connection={agent?.connections?.retell}
                    runtime={retellRuntime}
                    llm={retellLlm}
                    voices={retellVoices}
                    runtimeLoading={retellRuntimeLoading}
                    llmLoading={retellLlmLoading}
                    voicesLoading={retellVoicesLoading}
                    provisioningState={voiceAgentProvisioningStatus}
                    activeCloneVoiceId={voiceCloneStatus?.activeVoiceId}
                    agentPublished={voiceAgentPublished}
                    view={
                      activeSetupTab === "voice"
                        ? "voice"
                        : activeSetupTab === "instructions"
                          ? "instructions"
                          : activeSetupTab === "advanced"
                            ? "advanced"
                            : "launch"
                    }
                  />
                </div>

                {activeSetupTab === "call-flow" && (
                  <div className="space-y-3">
                    <VoiceAgentRuntimeCard agent={agent} />

                    {/* Blocked Lead Statuses — who the voice agent should NOT call */}
                    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-start gap-3">
                        <ShieldBan className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                        <div className="flex-1 space-y-1">
                          <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                            Blocked Lead Statuses
                          </p>
                          <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                            The voice agent will not place or answer calls for
                            leads with any of these statuses. This applies to
                            both inbound and outbound calls.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <BlockedLeadStatusSelector
                          options={closeLeadStatuses}
                          selected={displayedBlockedStatuses}
                          onChange={(statuses) => {
                            setBlockedStatuses(statuses);
                            setBlockedDirty(true);
                          }}
                          disabled={updateBotConfig.isPending}
                          closeConnected={closeConnected}
                          isLoadingStatuses={closeLeadStatusesLoading}
                        />
                        {blockedDirty && (
                          <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                            <Button
                              size="sm"
                              className="h-7 text-[10px]"
                              disabled={updateBotConfig.isPending}
                              onClick={handleSaveBlockedStatuses}
                            >
                              {updateBotConfig.isPending ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="mr-1 h-3 w-3" />
                              )}
                              Save Changes
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <VoiceCallRulesCard
                      voiceSetupState={voiceSetupState}
                      closeLeadStatuses={closeLeadStatuses}
                      closeConnected={closeConnected}
                      closeLeadStatusesLoading={closeLeadStatusesLoading}
                    />

                    <VoiceGuardrailsCard voiceSetupState={voiceSetupState} />

                    <VoiceAgentRetellStudioCard
                      connection={agent?.connections?.retell}
                      runtime={retellRuntime}
                      llm={retellLlm}
                      voices={retellVoices}
                      runtimeLoading={retellRuntimeLoading}
                      llmLoading={retellLlmLoading}
                      voicesLoading={retellVoicesLoading}
                      provisioningState={voiceAgentProvisioningStatus}
                      view="call-flow"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
                Voice Stats
              </p>
              <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
                Your plan, sync status, and minute usage live here in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.95fr_1.05fr]">
              <VoiceAgentStatusCard
                hasVoiceAddon={Boolean(voiceAddon)}
                syncStatus={voiceAddon?.voice_sync_status}
                lastSyncedAt={voiceAddon?.voice_last_synced_at}
                lastSyncAttemptAt={voiceAddon?.voice_last_sync_attempt_at}
                lastSyncHttpStatus={voiceAddon?.voice_last_sync_http_status}
                voiceEntitlement={voiceEntitlement}
                voiceSetupState={voiceSetupState}
                snapshot={voiceSnapshot}
                showServiceWarning={hasDegradedState}
                retellConnected={retellConnected}
              />

              <VoiceAgentUsageCard
                isLoading={statsCardLoading}
                launchIncludedMinutes={VOICE_LAUNCH_INCLUDED_MINUTES}
                voiceSetupState={voiceSetupState}
                voiceEntitlement={voiceEntitlement}
                voiceUsage={voiceUsage}
                snapshot={voiceSnapshot}
                showServiceWarning={hasDegradedState}
              />
            </div>
          </div>
        )}

        {activeTab === "admin" && isSuperAdmin && (
          <div className="space-y-3">
            {!agent ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  No workspace is available for admin voice controls yet
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
                    Super-Admin Controls
                  </p>
                  <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
                    Internal setup, advanced tuning, and raw payload editing
                    stay isolated here so the customer flow remains clean.
                  </p>
                </div>

                <VoiceAgentConnectionCard
                  connection={agent.connections?.retell}
                  closeConnected={Boolean(
                    voiceSetupState?.connections?.close?.connected ??
                    agent.connections?.close?.connected,
                  )}
                  isSuperAdmin
                />

                <VoiceAgentRetellStudioCard
                  connection={agent.connections?.retell}
                  runtime={retellRuntime}
                  llm={retellLlm}
                  voices={retellVoices}
                  runtimeLoading={retellRuntimeLoading}
                  llmLoading={retellLlmLoading}
                  voicesLoading={retellVoicesLoading}
                  view="admin"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
