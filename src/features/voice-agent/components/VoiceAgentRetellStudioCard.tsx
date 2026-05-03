import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import type {
  ChatBotRetellConnection,
  ChatBotRetellRuntime,
  ChatBotRetellVoice,
  ChatBotRetellVoiceSearchHit,
} from "@/features/chat-bot";
import {
  useAddRetellVoice,
  usePublishRetellAgentDraft,
  useSearchRetellVoices,
  useUpdateRetellAgentDraft,
  useUpdateRetellLlm,
} from "@/features/chat-bot";
import { cn } from "@/lib/utils";
import {
  extractEditableRetellAgent,
  extractEditableRetellLlm,
  formatRetellJson,
  parseRetellJson,
  RETELL_VOICE_PROVIDERS,
} from "../lib/retell-config";
import {
  buildStructuredRetellAgentForm,
  buildStructuredRetellLlmForm,
  diffStructuredRetellAgentForm,
  diffStructuredRetellLlmForm,
  extractGreetingsFromDynamicVariables,
  mergeGreetingsIntoDynamicVariables,
  type RetellStructuredAgentForm,
  type RetellStructuredLlmForm,
  validateStructuredRetellAgentForm,
  validateStructuredRetellLlmForm,
} from "../lib/retell-studio";
import { DEFAULT_WORKFLOW_GREETINGS } from "../lib/prompt-wizard-presets";
import { isVoiceAgentProvisioningPending } from "../lib/voice-agent-contract";
import { VoiceGreetingView } from "./studio/VoiceGreetingView";
import { InstructionsView } from "./studio/InstructionsView";
import { CallBehaviorSection } from "./studio/CallBehaviorSection";
import { AdvancedView } from "./studio/AdvancedView";
import { LaunchView } from "./studio/LaunchView";

export type VoiceAgentRetellStudioView =
  | "voice"
  | "instructions"
  | "call-flow"
  | "advanced"
  | "launch"
  | "admin";

interface VoiceAgentRetellStudioCardProps {
  connection: ChatBotRetellConnection | undefined;
  runtime: ChatBotRetellRuntime | null | undefined;
  llm: Record<string, unknown> | null | undefined;
  voices: ChatBotRetellVoice[];
  runtimeLoading: boolean;
  llmLoading: boolean;
  voicesLoading: boolean;
  provisioningState?: string | null;
  view?: VoiceAgentRetellStudioView;
  activeCloneVoiceId?: string | null;
  /** True if the agent has been published at least once (from setup-state OR runtime). */
  agentPublished?: boolean;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Invalid JSON";
}

function formatRelativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getViewCopy(view: VoiceAgentRetellStudioView) {
  switch (view) {
    case "voice":
      return {
        eyebrow: "Step 1",
        title: "Voice & Greeting",
        description:
          "Pick the voice, set the opening line, and shape how the AI Voice Agent sounds on live calls.",
      };
    case "instructions":
      return {
        eyebrow: "Step 2",
        title: "Prompt & Instructions",
        description:
          "Write the operating instructions in plain language so the agent knows how to guide the conversation.",
      };
    case "call-flow":
      return {
        eyebrow: "Step 3",
        title: "Call Behavior",
        description:
          "Fine-tune how the agent handles silence, filler words, background ambiance, and voicemail.",
      };
    case "advanced":
      return {
        eyebrow: "Step 4",
        title: "Advanced Setup",
        description:
          "Optional controls for model behavior, knowledge, connected actions, and extra call guardrails.",
      };
    case "launch":
      return {
        eyebrow: "Step 5",
        title: "Review & Publish",
        description:
          "Review your draft, save anything still pending, then publish when you are ready to go live.",
      };
    default:
      return {
        eyebrow: "Admin",
        title: "Advanced Voice Controls",
        description:
          "Admin-only controls for advanced tuning, raw payload edits, and support workflows.",
      };
  }
}

function ValidationList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 dark:border-destructive/60 dark:bg-destructive/10">
      <p className="text-[11px] font-semibold text-destructive">
        Fix these fields before saving
      </p>
      <ul className="mt-2 space-y-1 text-[11px] text-destructive">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function updateFormField<TForm extends object, TKey extends keyof TForm>(
  setter: React.Dispatch<React.SetStateAction<TForm>>,
  key: TKey,
  value: TForm[TKey],
) {
  setter((current) => ({ ...current, [key]: value }));
}

export function VoiceAgentRetellStudioCard({
  connection,
  runtime,
  llm,
  voices,
  runtimeLoading,
  llmLoading,
  voicesLoading,
  provisioningState,
  view = "voice",
  activeCloneVoiceId,
  agentPublished = false,
}: VoiceAgentRetellStudioCardProps) {
  const updateRetellAgentDraft = useUpdateRetellAgentDraft();
  const publishRetellAgentDraft = usePublishRetellAgentDraft();
  const publishSucceededAtRef = useRef<number>(0);
  const updateRetellLlm = useUpdateRetellLlm();
  const searchRetellVoices = useSearchRetellVoices();
  const addRetellVoice = useAddRetellVoice();

  const editableAgent = useMemo(
    () => extractEditableRetellAgent(runtime?.agent),
    [runtime?.agent],
  );
  const editableLlm = useMemo(() => extractEditableRetellLlm(llm), [llm]);
  const savedAgentForm = useMemo(
    () => buildStructuredRetellAgentForm(editableAgent),
    [editableAgent],
  );
  const savedLlmForm = useMemo(
    () => buildStructuredRetellLlmForm(editableLlm),
    [editableLlm],
  );
  const savedAgentJson = useMemo(
    () => formatRetellJson(editableAgent),
    [editableAgent],
  );
  const savedLlmJson = useMemo(
    () => formatRetellJson(editableLlm),
    [editableLlm],
  );

  const [agentForm, setAgentForm] =
    useState<RetellStructuredAgentForm>(savedAgentForm);
  const [llmForm, setLlmForm] = useState<RetellStructuredLlmForm>(savedLlmForm);

  // Per-workflow greetings (extracted from defaultDynamicVariables)
  const savedGreetings = useMemo(() => {
    const extracted = extractGreetingsFromDynamicVariables(
      savedLlmForm.defaultDynamicVariables,
    );
    // Migration: if no greeting_* keys exist but old beginMessage is set,
    // pre-populate inbound greetings with old value, outbound with defaults
    if (
      Object.keys(extracted).length === 0 &&
      savedLlmForm.beginMessage.trim()
    ) {
      return {
        general_inbound: savedLlmForm.beginMessage,
        after_hours_inbound: savedLlmForm.beginMessage,
        missed_appointment: DEFAULT_WORKFLOW_GREETINGS.missed_appointment ?? "",
        reschedule: DEFAULT_WORKFLOW_GREETINGS.reschedule ?? "",
        quoted_followup: DEFAULT_WORKFLOW_GREETINGS.quoted_followup ?? "",
      };
    }
    return extracted;
  }, [savedLlmForm.defaultDynamicVariables, savedLlmForm.beginMessage]);
  const [workflowGreetings, setWorkflowGreetings] =
    useState<Record<string, string>>(savedGreetings);
  const [agentFormErrors, setAgentFormErrors] = useState<string[]>([]);
  const [llmFormErrors, setLlmFormErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceProvider, setVoiceProvider] =
    useState<(typeof RETELL_VOICE_PROVIDERS)[number]>("elevenlabs");
  const [searchResults, setSearchResults] = useState<
    ChatBotRetellVoiceSearchHit[]
  >([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [addingVoiceId, setAddingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [agentJson, setAgentJson] = useState(savedAgentJson);
  const [agentJsonError, setAgentJsonError] = useState<string | null>(null);
  const [llmJson, setLlmJson] = useState(savedLlmJson);
  const [llmJsonError, setLlmJsonError] = useState<string | null>(null);

  const handlePreviewVoice = useCallback(
    (voiceId: string, previewUrl: string) => {
      if (playingVoiceId === voiceId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingVoiceId(null);
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      setPlayingVoiceId(voiceId);
      audio.play().catch(() => setPlayingVoiceId(null));
      audio.addEventListener("ended", () => {
        setPlayingVoiceId(null);
        audioRef.current = null;
      });
    },
    [playingVoiceId],
  );

  useEffect(() => {
    setAgentForm(savedAgentForm);
    setAgentFormErrors([]);
  }, [savedAgentForm]);

  useEffect(() => {
    setLlmForm(savedLlmForm);
    setLlmFormErrors([]);
    setWorkflowGreetings(savedGreetings);
  }, [savedLlmForm, savedGreetings]);

  useEffect(() => {
    setAgentJson(savedAgentJson);
    setAgentJsonError(null);
  }, [savedAgentJson]);

  useEffect(() => {
    setLlmJson(savedLlmJson);
    setLlmJsonError(null);
  }, [savedLlmJson]);

  const structuredAgentDirty =
    JSON.stringify(agentForm) !== JSON.stringify(savedAgentForm);
  const structuredLlmDirty =
    JSON.stringify(llmForm) !== JSON.stringify(savedLlmForm);
  const greetingsDirty =
    JSON.stringify(workflowGreetings) !== JSON.stringify(savedGreetings);
  const agentJsonDirty = agentJson.trim() !== savedAgentJson.trim();
  const llmJsonDirty = llmJson.trim() !== savedLlmJson.trim();
  const hasStructuredUnsavedChanges =
    structuredAgentDirty || structuredLlmDirty || greetingsDirty;
  const hasAdminJsonChanges = agentJsonDirty || llmJsonDirty;
  const hasUnsavedChanges =
    view === "admin"
      ? hasStructuredUnsavedChanges || hasAdminJsonChanges
      : hasStructuredUnsavedChanges;
  const isBuilderSaving =
    updateRetellAgentDraft.isPending || updateRetellLlm.isPending;
  const PUBLISH_GRACE_MS = 120_000;
  const inPublishGrace =
    publishSucceededAtRef.current > 0 &&
    Date.now() - publishSucceededAtRef.current < PUBLISH_GRACE_MS;
  // Trust the actual publish state from Retell, not connection-based guesses.
  const isLive = runtime?.agent?.is_published === true || agentPublished;
  const selectedVoiceId = agentForm.voiceId.trim();
  const selectedVoice = voices.find(
    (voice) => voice.voice_id === selectedVoiceId,
  );
  const filteredVoices = voices.filter(
    (voice) => voice.provider === voiceProvider,
  );
  const viewCopy = getViewCopy(view);
  const voiceAgentProvisioning =
    isVoiceAgentProvisioningPending(provisioningState);

  const openingLineReady = Object.values(workflowGreetings).some(
    (g) => g.trim().length > 0,
  );
  const instructionsReady = llmForm.generalPrompt.trim().length > 0;
  const voiceReady = selectedVoiceId.length > 0;

  const handleAgentFormChange = useCallback(
    <K extends keyof RetellStructuredAgentForm>(
      key: K,
      value: RetellStructuredAgentForm[K],
    ) => {
      updateFormField(setAgentForm, key, value);
    },
    [],
  );

  const handleLlmFormChange = useCallback(
    <K extends keyof RetellStructuredLlmForm>(
      key: K,
      value: RetellStructuredLlmForm[K],
    ) => {
      updateFormField(setLlmForm, key, value);
    },
    [],
  );

  const handleSaveBuilder = async () => {
    const nextAgentErrors = validateStructuredRetellAgentForm(agentForm);
    const nextLlmErrors = llm ? validateStructuredRetellLlmForm(llmForm) : [];

    setAgentFormErrors(nextAgentErrors);
    setLlmFormErrors(nextLlmErrors);

    if (nextAgentErrors.length > 0 || nextLlmErrors.length > 0) {
      return;
    }

    const tasks: Promise<unknown>[] = [];

    if (structuredAgentDirty) {
      const patch = diffStructuredRetellAgentForm(agentForm, savedAgentForm);
      if (Object.keys(patch).length > 0) {
        tasks.push(updateRetellAgentDraft.mutateAsync(patch));
      }
    }

    if (llm && (structuredLlmDirty || greetingsDirty)) {
      const effectiveLlmForm: RetellStructuredLlmForm = {
        ...llmForm,
        beginMessage: "",
        defaultDynamicVariables: mergeGreetingsIntoDynamicVariables(
          llmForm.defaultDynamicVariables,
          workflowGreetings,
        ),
      };
      const patch = diffStructuredRetellLlmForm(effectiveLlmForm, savedLlmForm);
      if (Object.keys(patch).length > 0) {
        tasks.push(updateRetellLlm.mutateAsync(patch));
      }
    }

    if (tasks.length === 0) return;

    try {
      await Promise.all(tasks);
      setAgentFormErrors([]);
      setLlmFormErrors([]);
    } catch {
      // mutation hooks already surface toasts
    }
  };

  const handleSearchVoices = () => {
    if (!searchQuery.trim()) return;

    searchRetellVoices.mutate(
      {
        searchQuery: searchQuery.trim(),
        voiceProvider,
      },
      {
        onSuccess: (result) => {
          setSearchResults(result.voices ?? []);
        },
      },
    );
  };

  const handleAddVoice = (result: ChatBotRetellVoiceSearchHit) => {
    if (!result.provider_voice_id || !result.name) return;

    setAddingVoiceId(result.provider_voice_id);
    addRetellVoice.mutate(
      {
        providerVoiceId: result.provider_voice_id,
        voiceName: result.name,
        publicUserId: result.public_user_id,
        voiceProvider,
      },
      {
        onSuccess: (voice) => {
          updateFormField(setAgentForm, "voiceId", voice.voiceId);
          setAddingVoiceId(null);
        },
        onError: () => {
          setAddingVoiceId(null);
        },
      },
    );
  };

  const handleVoiceProviderChange = useCallback(
    (newProvider: (typeof RETELL_VOICE_PROVIDERS)[number]) => {
      setVoiceProvider(newProvider);
      setSearchResults([]);
      if (searchQuery.trim()) {
        searchRetellVoices.mutate(
          {
            searchQuery: searchQuery.trim(),
            voiceProvider: newProvider,
          },
          {
            onSuccess: (result) => setSearchResults(result.voices ?? []),
          },
        );
      }
    },
    [searchQuery, searchRetellVoices],
  );

  const handleSaveAgentJson = () => {
    try {
      const patch = parseRetellJson(agentJson);
      setAgentJsonError(null);
      updateRetellAgentDraft.mutate(patch);
    } catch (error) {
      setAgentJsonError(getErrorMessage(error));
    }
  };

  const handleSaveLlmJson = () => {
    try {
      const patch = parseRetellJson(llmJson);
      setLlmJsonError(null);
      updateRetellLlm.mutate(patch);
    } catch (error) {
      setLlmJsonError(getErrorMessage(error));
    }
  };

  const handleResetBuilder = () => {
    setAgentForm(savedAgentForm);
    setLlmForm(savedLlmForm);
    setWorkflowGreetings(savedGreetings);
    setAgentFormErrors([]);
    setLlmFormErrors([]);
  };

  const renderConnectionGate = (title: string, description: string) => (
    <div className="p-4">
      <div className="rounded-lg border border-border/50 bg-muted/50 px-4 py-4">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );

  const renderUnavailableRuntime = () => (
    <div className="p-4">
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 dark:border-warning/40 dark:bg-warning/10">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <p className="text-[12px] font-bold text-warning dark:text-warning">
            Live voice data is temporarily unavailable
          </p>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-warning">
          The workspace is connected, but the system could not load the current
          voice draft right now. This is likely a backend sync issue, not
          something that needs to be fixed from this screen.
        </p>
      </div>
    </div>
  );

  // Admin-only advanced structured content (used in admin collapsible)
  const advancedStructuredContent = (
    <AdvancedView
      agentForm={agentForm}
      onAgentFormChange={handleAgentFormChange}
      llmForm={llmForm}
      onLlmFormChange={handleLlmFormChange}
      llmAvailable={!!llm}
      llmLoading={llmLoading}
    />
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm">
      {/* ── Dark header bar — matches overview hero ── */}
      <div className="relative overflow-hidden bg-v2-card-dark px-4 py-3">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="studio-grid"
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
            <rect width="100%" height="100%" fill="url(#studio-grid)" />
          </svg>
        </div>
        {/* Glow orb */}
        <div
          className="absolute top-1/2 -left-16 w-48 h-48 -translate-y-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(226, 255, 204, 0.15)" }}
        />
        <div className="relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
              style={{ backgroundColor: "rgba(226, 255, 204, 0.22)" }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#6366f1" }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p
                  className="text-[13px] font-bold text-white tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {viewCopy.title}
                </p>
                <span className="text-[9px] font-medium uppercase tracking-widest text-white/50">
                  {viewCopy.eyebrow}
                </span>
              </div>
              <p className="text-[10px] leading-4 text-white/60 max-w-xl">
                {viewCopy.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
            {isLive ? (
              <Badge className="bg-success/20 text-success border border-success/30 text-[9px]">
                {inPublishGrace
                  ? "Live \u00b7 Just published"
                  : typeof runtime?.agent?.last_modification_timestamp ===
                      "number"
                    ? `Live \u00b7 ${formatRelativeTime(runtime.agent.last_modification_timestamp)}`
                    : "Live"}
              </Badge>
            ) : runtime?.agent?.is_published === false ? (
              <Badge className="bg-warning/20 text-warning border border-warning/30 text-[9px]">
                Draft needs publishing
              </Badge>
            ) : null}
            {hasUnsavedChanges && (
              <Badge className="bg-white/10 text-white border border-white/20 dark:bg-white/15 dark:text-white dark:border-white/30 text-[9px]">
                Unsaved changes
              </Badge>
            )}
          </div>
        </div>
      </div>

      {!connection?.connected ? (
        renderConnectionGate(
          voiceAgentProvisioning
            ? "Your voice agent is being created now"
            : view === "launch"
              ? "Publishing unlocks after your voice agent is ready"
              : "Your voice agent is not ready yet",
          voiceAgentProvisioning
            ? "The system is still finishing the managed workspace and loading the live draft. This step unlocks automatically as soon as the draft is available."
            : view === "launch"
              ? "Use the launch tab to review readiness, but publishing only becomes available after the voice agent has been created and loaded here."
              : "Create the voice agent first. Once it exists, this step will load the live draft so you can configure it here.",
        )
      ) : runtimeLoading ? (
        <div className="flex items-center justify-center px-4 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !runtime ? (
        renderUnavailableRuntime()
      ) : (
        <div className="p-4 space-y-4">
          {/* Save / Reset / Publish bar */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-foreground">
                {view === "launch"
                  ? "Save anything pending, then publish the current draft"
                  : view === "advanced" || view === "admin"
                    ? "Save advanced changes carefully"
                    : "Save your changes to the current draft"}
              </p>
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                {view === "launch"
                  ? "Publishing makes the latest saved draft live. If you changed voice, greeting, or instructions, save the draft first."
                  : "Draft changes stay editable until you publish them live."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetBuilder}
                disabled={!hasStructuredUnsavedChanges}
              >
                Reset Draft
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSaveBuilder()}
                disabled={isBuilderSaving || !hasStructuredUnsavedChanges}
              >
                {isBuilderSaving ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Saving
                  </>
                ) : (
                  "Save Draft"
                )}
              </Button>
              {(view === "launch" || view === "admin") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    publishRetellAgentDraft.mutate(undefined, {
                      onSuccess: () => {
                        publishSucceededAtRef.current = Date.now();
                      },
                    })
                  }
                  disabled={
                    publishRetellAgentDraft.isPending ||
                    hasStructuredUnsavedChanges
                  }
                >
                  {publishRetellAgentDraft.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Publishing
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mr-2 h-3.5 w-3.5" />
                      Publish Draft
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <ValidationList errors={agentFormErrors} />
          <ValidationList errors={llmFormErrors} />

          {/* ═══ View delegates ═══ */}

          {view === "voice" && (
            <VoiceGreetingView
              agentForm={agentForm}
              onAgentFormChange={handleAgentFormChange}
              workflowGreetings={workflowGreetings}
              onWorkflowGreetingChange={(key, value) =>
                setWorkflowGreetings((prev) => ({ ...prev, [key]: value }))
              }
              llmAvailable={!!llm}
              llmLoading={llmLoading}
              voices={voices}
              voicesLoading={voicesLoading}
              selectedVoiceId={selectedVoiceId}
              selectedVoice={selectedVoice}
              voiceProvider={voiceProvider}
              onVoiceProviderChange={handleVoiceProviderChange}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchResults={searchResults}
              onSearch={handleSearchVoices}
              searchPending={searchRetellVoices.isPending}
              onAddVoice={handleAddVoice}
              addVoicePending={addRetellVoice.isPending}
              addingVoiceId={addingVoiceId}
              playingVoiceId={playingVoiceId}
              onPreviewVoice={handlePreviewVoice}
              filteredVoices={filteredVoices}
              activeCloneVoiceId={activeCloneVoiceId}
            />
          )}

          {view === "instructions" && (
            <InstructionsView
              generalPrompt={llmForm.generalPrompt}
              onGeneralPromptChange={(value) =>
                handleLlmFormChange("generalPrompt", value)
              }
              boostedKeywords={agentForm.boostedKeywords}
              onBoostedKeywordsChange={(value) =>
                handleAgentFormChange("boostedKeywords", value)
              }
              llmAvailable={!!llm}
              llmLoading={llmLoading}
            />
          )}

          {view === "call-flow" && (
            <CallBehaviorSection
              agentForm={agentForm}
              onAgentFormChange={handleAgentFormChange}
            />
          )}

          {view === "launch" && (
            <LaunchView
              voiceReady={voiceReady}
              openingLineReady={openingLineReady}
              instructionsReady={instructionsReady}
              isPublished={isLive}
              selectedVoiceId={selectedVoiceId}
              selectedVoice={selectedVoice}
              workflowGreetings={workflowGreetings}
              lastModifiedAt={
                typeof runtime?.agent?.last_modification_timestamp === "number"
                  ? runtime.agent.last_modification_timestamp
                  : null
              }
              justPublished={inPublishGrace}
            />
          )}

          {view === "advanced" && advancedStructuredContent}

          {view === "admin" && (
            <div className="space-y-4">
              <Collapsible
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
                className="rounded-lg border border-v2-ring dark:border-v2-ring"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                      Advanced setup
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-v2-ink-muted dark:text-v2-ink-subtle">
                      Advanced tuning for model behavior, knowledge, tools, and
                      call handling.
                    </p>
                  </div>

                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          advancedOpen ? "rotate-180" : "rotate-0",
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="border-t border-v2-ring px-4 py-4 dark:border-v2-ring">
                  {advancedStructuredContent}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible
                open={jsonOpen}
                onOpenChange={setJsonOpen}
                className="rounded-lg border border-v2-ring dark:border-v2-ring"
              >
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div>
                    <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                      Raw advanced data
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-v2-ink-muted dark:text-v2-ink-subtle">
                      Keep this for support and power-user cases only.
                    </p>
                  </div>

                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          jsonOpen ? "rotate-180" : "rotate-0",
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="border-t border-v2-ring px-3 py-3 dark:border-v2-ring">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                          Advanced agent data
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAgentJson(savedAgentJson)}
                            disabled={!agentJsonDirty}
                          >
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveAgentJson}
                            disabled={
                              updateRetellAgentDraft.isPending ||
                              !agentJsonDirty
                            }
                          >
                            Save JSON
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={agentJson}
                        onChange={(event) => setAgentJson(event.target.value)}
                        className="min-h-[360px] font-mono text-xs"
                        spellCheck={false}
                      />
                      {agentJsonError && (
                        <p className="text-[11px] text-destructive">
                          {agentJsonError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
                          Advanced prompt data
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLlmJson(savedLlmJson)}
                            disabled={!llmJsonDirty}
                          >
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveLlmJson}
                            disabled={
                              updateRetellLlm.isPending || !llmJsonDirty
                            }
                          >
                            Save JSON
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={llmJson}
                        onChange={(event) => setLlmJson(event.target.value)}
                        className="min-h-[360px] font-mono text-xs"
                        spellCheck={false}
                      />
                      {llmJsonError && (
                        <p className="text-[11px] text-destructive">
                          {llmJsonError}
                        </p>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
