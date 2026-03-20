import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Library,
  Loader2,
  Mic2,
  Search,
  Sparkles,
  UploadCloud,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export type VoiceAgentRetellStudioView =
  | "voice"
  | "instructions"
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
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Invalid JSON";
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

function BuilderSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {icon}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StepChecklistItem({
  label,
  complete,
  detail,
}: {
  label: string;
  complete: boolean;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        complete
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
          {label}
        </p>
        <Badge
          className={
            complete
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }
        >
          {complete ? "Ready" : "Needs attention"}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
        {detail}
      </p>
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
}: VoiceAgentRetellStudioCardProps) {
  const updateRetellAgentDraft = useUpdateRetellAgentDraft();
  const publishRetellAgentDraft = usePublishRetellAgentDraft();
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
      // If already playing this voice, stop it
      if (playingVoiceId === voiceId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingVoiceId(null);
        return;
      }

      // Stop any currently playing audio
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
  const draftPendingPublish = runtime?.agent?.is_published === false;
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
        The workspace is connected, but The Standard HQ could not load the
        current voice draft right now. This is likely a backend sync issue, not
        something that needs to be fixed from this screen.
      </p>
    </div>
  );

  const advancedStructuredContent = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <BuilderSection
        icon={<Bot className="h-4 w-4" />}
        title="Knowledge, connected actions, and model"
        description="Optional controls for knowledge sources, connected actions, and the underlying model."
      >
        {!llm && !llmLoading ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            Advanced prompt controls are unavailable until this workspace is
            using the Standard HQ voice model setup.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="retell-llm-model">Model</Label>
                <Input
                  id="retell-llm-model"
                  value={llmForm.model}
                  onChange={(event) =>
                    updateFormField(setLlmForm, "model", event.target.value)
                  }
                  placeholder="gpt-4o-mini"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retell-llm-temperature">
                  Model temperature
                </Label>
                <Input
                  id="retell-llm-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step="0.05"
                  value={llmForm.modelTemperature}
                  onChange={(event) =>
                    updateFormField(
                      setLlmForm,
                      "modelTemperature",
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retell-kb-ids">Knowledge sources</Label>
              <Textarea
                id="retell-kb-ids"
                value={llmForm.knowledgeBaseIds}
                onChange={(event) =>
                  updateFormField(
                    setLlmForm,
                    "knowledgeBaseIds",
                    event.target.value,
                  )
                }
                className="min-h-[110px] font-mono text-xs"
                placeholder={"kb_123\nkb_456"}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
              <div className="pr-4">
                <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Strict connected actions
                </p>
                <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                  Enforce stricter function-call payloads.
                </p>
              </div>
              <Switch
                checked={llmForm.toolCallStrictMode}
                onCheckedChange={(checked) =>
                  updateFormField(setLlmForm, "toolCallStrictMode", checked)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retell-general-tools">Connected actions</Label>
              <Textarea
                id="retell-general-tools"
                value={llmForm.generalTools}
                onChange={(event) =>
                  updateFormField(
                    setLlmForm,
                    "generalTools",
                    event.target.value,
                  )
                }
                className="min-h-[180px] font-mono text-xs"
                spellCheck={false}
                placeholder={'[\n  {\n    "name": "lookup_policy"\n  }\n]'}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retell-mcps">Advanced connections</Label>
              <Textarea
                id="retell-mcps"
                value={llmForm.mcps}
                onChange={(event) =>
                  updateFormField(setLlmForm, "mcps", event.target.value)
                }
                className="min-h-[180px] font-mono text-xs"
                spellCheck={false}
                placeholder={'[\n  {\n    "name": "crm"\n  }\n]'}
              />
            </div>
          </div>
        )}
      </BuilderSection>

      <BuilderSection
        icon={<Mic2 className="h-4 w-4" />}
        title="Advanced voice behavior"
        description="Optional tuning for STT mode, denoising, voicemail timing, and call duration settings."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="retell-stt-mode">STT mode</Label>
            <Input
              id="retell-stt-mode"
              value={agentForm.sttMode}
              onChange={(event) =>
                updateFormField(setAgentForm, "sttMode", event.target.value)
              }
              placeholder="fast"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retell-denoising-mode">Denoising mode</Label>
            <Input
              id="retell-denoising-mode"
              value={agentForm.denoisingMode}
              onChange={(event) =>
                updateFormField(
                  setAgentForm,
                  "denoisingMode",
                  event.target.value,
                )
              }
              placeholder="auto"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retell-ring-duration">Ring duration (ms)</Label>
            <Input
              id="retell-ring-duration"
              type="number"
              min={1000}
              max={600000}
              step="1000"
              value={agentForm.ringDurationMs}
              onChange={(event) =>
                updateFormField(
                  setAgentForm,
                  "ringDurationMs",
                  event.target.value,
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retell-max-call-duration">
              Max call duration (ms)
            </Label>
            <Input
              id="retell-max-call-duration"
              type="number"
              min={30000}
              max={28800000}
              step="1000"
              value={agentForm.maxCallDurationMs}
              onChange={(event) =>
                updateFormField(
                  setAgentForm,
                  "maxCallDurationMs",
                  event.target.value,
                )
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
            <div className="pr-4">
              <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                Allow keypad input
              </p>
              <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                Let callers use DTMF input during the call.
              </p>
            </div>
            <Switch
              checked={agentForm.allowUserDtmf}
              onCheckedChange={(checked) =>
                updateFormField(setAgentForm, "allowUserDtmf", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
            <div className="pr-4">
              <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                Voicemail detection
              </p>
              <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                Turn voicemail-specific behavior on or off.
              </p>
            </div>
            <Switch
              checked={agentForm.enableVoicemailDetection}
              onCheckedChange={(checked) =>
                updateFormField(
                  setAgentForm,
                  "enableVoicemailDetection",
                  checked,
                )
              }
            />
          </div>
        </div>
      </BuilderSection>
    </div>
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
          {draftPendingPublish ? (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Draft needs publishing
            </Badge>
          ) : (
            runtime?.agent?.is_published === true && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Live
              </Badge>
            )
          )}
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
            ? "The Standard HQ is still finishing the managed workspace and loading the live draft. This step unlocks automatically as soon as the draft is available."
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
                  onClick={() => publishRetellAgentDraft.mutate()}
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

          {view === "voice" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <BuilderSection
                  icon={<Bot className="h-4 w-4" />}
                  title="Identity & opening line"
                  description="Give the agent a recognizable name, choose its language, and decide how it should greet callers."
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="voice-agent-name">Agent name</Label>
                      <Input
                        id="voice-agent-name"
                        value={agentForm.agentName}
                        onChange={(event) =>
                          updateFormField(
                            setAgentForm,
                            "agentName",
                            event.target.value,
                          )
                        }
                        placeholder="The Standard HQ Assistant"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.8fr_1.2fr]">
                      <div className="space-y-1.5">
                        <Label htmlFor="retell-language">Language</Label>
                        <Input
                          id="retell-language"
                          value={agentForm.language}
                          onChange={(event) =>
                            updateFormField(
                              setAgentForm,
                              "language",
                              event.target.value,
                            )
                          }
                          placeholder="en-US"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="retell-begin-message">
                          Opening line
                        </Label>
                        <Textarea
                          id="retell-begin-message"
                          value={llmForm.beginMessage}
                          onChange={(event) =>
                            updateFormField(
                              setLlmForm,
                              "beginMessage",
                              event.target.value,
                            )
                          }
                          disabled={!llm && !llmLoading}
                          className="min-h-[96px] text-xs"
                          placeholder="Hi, this is your AI Voice Agent from The Standard HQ..."
                        />
                      </div>
                    </div>
                  </div>
                </BuilderSection>

                <BuilderSection
                  icon={<Mic2 className="h-4 w-4" />}
                  title="Voice & tone"
                  description="Choose the actual voice, then tune how fast and how dynamically it should respond."
                >
                  <div className="space-y-4">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                            Current draft voice
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {selectedVoice
                              ? `${selectedVoice.voice_name} • ${selectedVoice.provider}`
                              : selectedVoiceId || "No voice selected yet"}
                          </p>
                        </div>
                        {selectedVoice && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="retell-voice-speed">
                          Speaking pace
                        </Label>
                        <Input
                          id="retell-voice-speed"
                          type="number"
                          min={0.25}
                          max={4}
                          step="0.05"
                          value={agentForm.voiceSpeed}
                          onChange={(event) =>
                            updateFormField(
                              setAgentForm,
                              "voiceSpeed",
                              event.target.value,
                            )
                          }
                          placeholder="1.0"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="retell-voice-temperature">
                          Voice energy
                        </Label>
                        <Input
                          id="retell-voice-temperature"
                          type="number"
                          min={0}
                          max={2}
                          step="0.05"
                          value={agentForm.voiceTemperature}
                          onChange={(event) =>
                            updateFormField(
                              setAgentForm,
                              "voiceTemperature",
                              event.target.value,
                            )
                          }
                          placeholder="1.0"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="retell-responsiveness">
                          How quickly it should respond
                        </Label>
                        <Input
                          id="retell-responsiveness"
                          type="number"
                          min={0}
                          max={1}
                          step="0.05"
                          value={agentForm.responsiveness}
                          onChange={(event) =>
                            updateFormField(
                              setAgentForm,
                              "responsiveness",
                              event.target.value,
                            )
                          }
                          placeholder="0.5"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="retell-interruption-sensitivity">
                          How easily it should yield
                        </Label>
                        <Input
                          id="retell-interruption-sensitivity"
                          type="number"
                          min={0}
                          max={1}
                          step="0.05"
                          value={agentForm.interruptionSensitivity}
                          onChange={(event) =>
                            updateFormField(
                              setAgentForm,
                              "interruptionSensitivity",
                              event.target.value,
                            )
                          }
                          placeholder="0.5"
                        />
                      </div>
                    </div>
                  </div>
                </BuilderSection>
              </div>

              <BuilderSection
                icon={<Library className="h-4 w-4" />}
                title="Voice library"
                description="Search a provider catalog, import a voice into your workspace, and choose which one this agent should use."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="voice-search-provider">Provider</Label>
                        <select
                          id="voice-search-provider"
                          value={voiceProvider}
                          onChange={(event) => {
                            const newProvider = event.target
                              .value as (typeof RETELL_VOICE_PROVIDERS)[number];
                            setVoiceProvider(newProvider);
                            setSearchResults([]);
                            if (searchQuery.trim()) {
                              searchRetellVoices.mutate(
                                {
                                  searchQuery: searchQuery.trim(),
                                  voiceProvider: newProvider,
                                },
                                {
                                  onSuccess: (result) =>
                                    setSearchResults(result.voices ?? []),
                                },
                              );
                            }
                          }}
                          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          {RETELL_VOICE_PROVIDERS.map((provider) => (
                            <option key={provider} value={provider}>
                              {provider}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="voice-search-query">
                          Search voices
                        </Label>
                        <Input
                          id="voice-search-query"
                          value={searchQuery}
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                          placeholder="warm, clear female, insurance..."
                        />
                      </div>

                      <Button
                        onClick={handleSearchVoices}
                        disabled={
                          searchRetellVoices.isPending || !searchQuery.trim()
                        }
                        className="w-full"
                      >
                        {searchRetellVoices.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Searching
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-3.5 w-3.5" />
                            Search Provider Voices
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {searchResults.length === 0 ? (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                          Search results will appear here.
                        </div>
                      ) : (
                        searchResults.slice(0, 3).map((result) => (
                          <div
                            key={`${result.provider_voice_id}-${result.public_user_id ?? "public"}`}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                          >
                            <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                              {result.name ?? "Unnamed voice"}
                            </p>
                            <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                              {result.description ?? "No description provided."}
                            </p>
                            <Button
                              size="sm"
                              className="mt-3"
                              onClick={() => handleAddVoice(result)}
                              disabled={
                                addRetellVoice.isPending ||
                                !result.provider_voice_id ||
                                !result.name
                              }
                            >
                              {addRetellVoice.isPending
                                ? "Adding..."
                                : "Import Voice"}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {voicesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                      </div>
                    ) : filteredVoices.length === 0 ? (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                        {voices.length === 0
                          ? "No imported voices yet. Search above to bring one into your workspace."
                          : `No imported voices from ${voiceProvider}. Search above or switch providers.`}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {filteredVoices.map((voice) => {
                          const isSelected = voice.voice_id === selectedVoiceId;

                          return (
                            <div
                              key={voice.voice_id}
                              className={cn(
                                "rounded-lg border px-3 py-3",
                                isSelected
                                  ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20"
                                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <WandSparkles className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                                      {voice.voice_name}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                      {voice.provider}
                                    </Badge>
                                    {voice.gender && (
                                      <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                        {voice.gender}
                                      </Badge>
                                    )}
                                    {isSelected && (
                                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        Selected
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {voice.preview_audio_url && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={() =>
                                        handlePreviewVoice(
                                          voice.voice_id,
                                          voice.preview_audio_url!,
                                        )
                                      }
                                    >
                                      {playingVoiceId === voice.voice_id ? (
                                        <VolumeX className="h-3.5 w-3.5" />
                                      ) : (
                                        <Volume2 className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={
                                      isSelected ? "secondary" : "outline"
                                    }
                                    onClick={() =>
                                      updateFormField(
                                        setAgentForm,
                                        "voiceId",
                                        voice.voice_id,
                                      )
                                    }
                                  >
                                    {isSelected ? "Selected" : "Use Voice"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </BuilderSection>
            </div>
          )}

          {view === "instructions" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <BuilderSection
                icon={<Sparkles className="h-4 w-4" />}
                title="What should this agent do?"
                description="Describe the role clearly in plain language, including what it should say, what it should collect, and when it should transfer the caller."
              >
                {!llm && !llmLoading ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                    Prompt editing becomes available when this workspace is
                    using the Standard HQ voice model setup.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="retell-general-prompt">
                        Voice agent instructions
                      </Label>
                      <Textarea
                        id="retell-general-prompt"
                        value={llmForm.generalPrompt}
                        onChange={(event) =>
                          updateFormField(
                            setLlmForm,
                            "generalPrompt",
                            event.target.value,
                          )
                        }
                        className="min-h-[260px] text-xs"
                        placeholder="Explain who the agent is, what calls it should handle, when it should transfer to a person, and how it should speak."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="retell-boosted-keywords">
                        Important names, products, or phrases
                      </Label>
                      <Textarea
                        id="retell-boosted-keywords"
                        value={agentForm.boostedKeywords}
                        onChange={(event) =>
                          updateFormField(
                            setAgentForm,
                            "boostedKeywords",
                            event.target.value,
                          )
                        }
                        className="min-h-[120px] text-xs"
                        placeholder={
                          "The Standard HQ\nMedicare\nquoted follow-up"
                        }
                      />
                    </div>
                  </div>
                )}
              </BuilderSection>

              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Write this like operator guidance
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                    Focus on the customer experience: how the agent should greet
                    people, qualify them, handle objections, and know when to
                    hand the conversation to a person.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Basic setup comes first
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                    Finish the main customer experience first, then use the
                    Advanced step for model settings, knowledge, connected
                    actions, and extra guardrails if you need them.
                  </p>
                </div>
              </div>
            </div>
          )}

          {view === "launch" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <BuilderSection
                icon={<UploadCloud className="h-4 w-4" />}
                title="Review your draft"
                description="Make sure the most important launch items are ready before you publish the agent live."
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <StepChecklistItem
                    label="Voice selected"
                    complete={voiceReady}
                    detail={
                      voiceReady
                        ? selectedVoice?.voice_name || selectedVoiceId
                        : "Choose a voice in Step 1 before publishing."
                    }
                  />
                  <StepChecklistItem
                    label="Opening line"
                    complete={openingLineReady}
                    detail={
                      openingLineReady
                        ? "The agent has an opening greeting saved in the draft."
                        : "Add the first thing the agent should say in Step 1."
                    }
                  />
                  <StepChecklistItem
                    label="Instructions written"
                    complete={instructionsReady}
                    detail={
                      instructionsReady
                        ? "The draft includes the operating instructions for the call."
                        : "Add the prompt and behavior guidance in Step 2."
                    }
                  />
                  <StepChecklistItem
                    label="Current live state"
                    complete={runtime?.agent?.is_published === true}
                    detail={
                      runtime?.agent?.is_published === true
                        ? "A published version is already live."
                        : "This workspace still needs a published draft to go live."
                    }
                  />
                </div>
              </BuilderSection>

              <div className="space-y-4">
                <BuilderSection
                  icon={<Mic2 className="h-4 w-4" />}
                  title="Current draft snapshot"
                  description="A quick read of the draft you are about to publish."
                >
                  <div className="space-y-3">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Voice
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {selectedVoice
                          ? `${selectedVoice.voice_name} • ${selectedVoice.provider}`
                          : selectedVoiceId || "No voice selected"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Opening line
                      </p>
                      <p className="mt-1 text-[12px] leading-6 text-zinc-900 dark:text-zinc-100">
                        {openingLineReady
                          ? llmForm.beginMessage
                          : "No opening line saved yet."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Prompt status
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {instructionsReady
                          ? "Instructions are saved in the draft."
                          : "Instructions still need to be added."}
                      </p>
                    </div>
                  </div>
                </BuilderSection>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Publish flow
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                    Save the draft first if you changed voice, greeting, or
                    instructions. Once the draft is saved, publish it to make
                    the latest version live.
                  </p>
                </div>
              </div>
            </div>
          )}

          {view === "advanced" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Advanced options are optional
                </p>
                <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                  Use these settings when you need deeper control over model
                  behavior, knowledge, connected actions, or extra call
                  safeguards. Basic setup can still be completed without
                  changing anything here.
                </p>
              </div>

              {advancedStructuredContent}
            </div>
          )}

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
