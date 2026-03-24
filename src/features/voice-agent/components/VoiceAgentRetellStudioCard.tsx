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
  type RetellStructuredAgentForm,
  type RetellStructuredLlmForm,
  validateStructuredRetellAgentForm,
  validateStructuredRetellLlmForm,
} from "../lib/retell-studio";
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
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 dark:border-red-950/60 dark:bg-red-950/20">
      <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">
        Fix these fields before saving
      </p>
      <ul className="mt-2 space-y-1 text-[11px] text-red-700 dark:text-red-300">
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
  const [agentFormErrors, setAgentFormErrors] = useState<string[]>([]);
  const [llmFormErrors, setLlmFormErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceProvider, setVoiceProvider] =
    useState<(typeof RETELL_VOICE_PROVIDERS)[number]>("elevenlabs");
  const [searchResults, setSearchResults] = useState<
    ChatBotRetellVoiceSearchHit[]
  >([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
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
  }, [savedLlmForm]);

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
  const agentJsonDirty = agentJson.trim() !== savedAgentJson.trim();
  const llmJsonDirty = llmJson.trim() !== savedLlmJson.trim();
  const hasStructuredUnsavedChanges =
    structuredAgentDirty || structuredLlmDirty;
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
  // agentPublished = "has been published at least once" (from setup-state OR runtime)
  // is_published = "current draft matches live version" (Retell-specific, goes false after any draft change)
  const isLive = agentPublished || runtime?.agent?.is_published === true;
  const hasUnpublishedDraftChanges =
    !inPublishGrace && isLive && runtime?.agent?.is_published === false;
  const neverPublished =
    !inPublishGrace && !isLive && runtime?.agent?.is_published === false;
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

  const openingLineReady = llmForm.beginMessage.trim().length > 0;
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

    if (llm && structuredLlmDirty) {
      const patch = diffStructuredRetellLlmForm(llmForm, savedLlmForm);
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
    setAgentFormErrors([]);
    setLlmFormErrors([]);
  };

  const renderConnectionGate = (title: string, description: string) => (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );

  const renderUnavailableRuntime = () => (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-950/60 dark:bg-amber-950/20">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Live voice data is temporarily unavailable
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-amber-800 dark:text-amber-200">
        The workspace is connected, but the system could not load the current
        voice draft right now. This is likely a backend sync issue, not
        something that needs to be fixed from this screen.
      </p>
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
              {viewCopy.eyebrow}
            </p>
          </div>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {viewCopy.title}
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            {viewCopy.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {neverPublished ? (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Draft needs publishing
            </Badge>
          ) : isLive ? (
            <>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {inPublishGrace
                  ? "Live \u00b7 Just published"
                  : typeof runtime?.agent?.last_modification_timestamp ===
                      "number"
                    ? `Live \u00b7 ${formatRelativeTime(runtime.agent.last_modification_timestamp)}`
                    : "Live"}
              </Badge>
              {hasUnpublishedDraftChanges && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Unpublished changes
                </Badge>
              )}
            </>
          ) : null}
          {hasUnsavedChanges && (
            <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              Unsaved changes
            </Badge>
          )}
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
        <div className="mt-4 flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-12 dark:border-zinc-800 dark:bg-zinc-950/40">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : !runtime ? (
        renderUnavailableRuntime()
      ) : (
        <div className="mt-4 space-y-4">
          {/* Save / Reset / Publish bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                {view === "launch"
                  ? "Save anything pending, then publish the current draft"
                  : view === "advanced" || view === "admin"
                    ? "Save advanced changes carefully"
                    : "Save your changes to the current draft"}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
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
              beginMessage={llmForm.beginMessage}
              onBeginMessageChange={(value) =>
                handleLlmFormChange("beginMessage", value)
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
              llmForm={llmForm}
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
                className="rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                      Advanced setup
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
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

                <CollapsibleContent className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
                  {advancedStructuredContent}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible
                open={jsonOpen}
                onOpenChange={setJsonOpen}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div>
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                      Raw advanced data
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
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

                <CollapsibleContent className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
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
                        <p className="text-[11px] text-red-600 dark:text-red-400">
                          {agentJsonError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
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
                        <p className="text-[11px] text-red-600 dark:text-red-400">
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
