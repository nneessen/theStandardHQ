import { type ReactNode } from "react";
import {
  Bot,
  Library,
  Loader2,
  Mic2,
  Search,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ChatBotRetellVoice,
  ChatBotRetellVoiceSearchHit,
} from "@/features/chat-bot";
import { RETELL_VOICE_PROVIDERS } from "../../lib/retell-config";
import {
  AGENT_FIELD_HINTS,
  LLM_FIELD_HINTS,
} from "../../lib/retell-field-hints";
import type { RetellStructuredAgentForm } from "../../lib/retell-studio";
import { FieldHint } from "./FieldHint";

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

interface VoiceGreetingViewProps {
  agentForm: RetellStructuredAgentForm;
  onAgentFormChange: <K extends keyof RetellStructuredAgentForm>(
    key: K,
    value: RetellStructuredAgentForm[K],
  ) => void;
  beginMessage: string;
  onBeginMessageChange: (value: string) => void;
  llmAvailable: boolean;
  llmLoading: boolean;
  // Voice library
  voices: ChatBotRetellVoice[];
  voicesLoading: boolean;
  selectedVoiceId: string;
  selectedVoice: ChatBotRetellVoice | undefined;
  voiceProvider: (typeof RETELL_VOICE_PROVIDERS)[number];
  onVoiceProviderChange: (
    provider: (typeof RETELL_VOICE_PROVIDERS)[number],
  ) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: ChatBotRetellVoiceSearchHit[];
  onSearch: () => void;
  searchPending: boolean;
  onAddVoice: (result: ChatBotRetellVoiceSearchHit) => void;
  addVoicePending: boolean;
  playingVoiceId: string | null;
  onPreviewVoice: (voiceId: string, previewUrl: string) => void;
  filteredVoices: ChatBotRetellVoice[];
}

export function VoiceGreetingView({
  agentForm,
  onAgentFormChange,
  beginMessage,
  onBeginMessageChange,
  llmAvailable,
  llmLoading,
  voices,
  voicesLoading,
  selectedVoiceId,
  selectedVoice,
  voiceProvider,
  onVoiceProviderChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSearch,
  searchPending,
  onAddVoice,
  addVoicePending,
  playingVoiceId,
  onPreviewVoice,
  filteredVoices,
}: VoiceGreetingViewProps) {
  return (
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
                  onAgentFormChange("agentName", event.target.value)
                }
                placeholder="e.g. Sarah"
              />
              <FieldHint>{AGENT_FIELD_HINTS.agentName}</FieldHint>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-1.5">
                <Label htmlFor="retell-language">Language</Label>
                <Input
                  id="retell-language"
                  value={agentForm.language}
                  onChange={(event) =>
                    onAgentFormChange("language", event.target.value)
                  }
                  placeholder="en-US"
                />
                <FieldHint>{AGENT_FIELD_HINTS.language}</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retell-begin-message">Opening line</Label>
                <Textarea
                  id="retell-begin-message"
                  value={beginMessage}
                  onChange={(event) => onBeginMessageChange(event.target.value)}
                  disabled={!llmAvailable && !llmLoading}
                  className="min-h-[96px] text-xs"
                  placeholder="Hi, thanks for calling [Your Agency]. This is [Name], how can I help you today?"
                />
                <FieldHint>{LLM_FIELD_HINTS.beginMessage}</FieldHint>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/30">
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">
                      Examples:
                    </span>{" "}
                    "Hi, thanks for calling [Agency]. This is [Name], how can I
                    help?" · "Hi [Name], this is [Agent] from [Agency], calling
                    about your quote."
                  </p>
                </div>
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
                <Label htmlFor="retell-voice-speed">Speaking pace</Label>
                <Input
                  id="retell-voice-speed"
                  type="number"
                  min={0.25}
                  max={4}
                  step="0.05"
                  value={agentForm.voiceSpeed}
                  onChange={(event) =>
                    onAgentFormChange("voiceSpeed", event.target.value)
                  }
                  placeholder="1.0"
                />
                <FieldHint>{AGENT_FIELD_HINTS.voiceSpeed}</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retell-voice-temperature">Voice energy</Label>
                <Input
                  id="retell-voice-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step="0.05"
                  value={agentForm.voiceTemperature}
                  onChange={(event) =>
                    onAgentFormChange("voiceTemperature", event.target.value)
                  }
                  placeholder="1.0"
                />
                <FieldHint>{AGENT_FIELD_HINTS.voiceTemperature}</FieldHint>
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
                    onAgentFormChange("responsiveness", event.target.value)
                  }
                  placeholder="0.5"
                />
                <FieldHint>{AGENT_FIELD_HINTS.responsiveness}</FieldHint>
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
                    onAgentFormChange(
                      "interruptionSensitivity",
                      event.target.value,
                    )
                  }
                  placeholder="0.5"
                />
                <FieldHint>
                  {AGENT_FIELD_HINTS.interruptionSensitivity}
                </FieldHint>
              </div>
            </div>

            {/* Auto-adapt toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <div className="pr-4">
                  <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Auto-adapt speaking speed
                  </p>
                  <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                    {AGENT_FIELD_HINTS.enableDynamicVoiceSpeed}
                  </p>
                </div>
                <Switch
                  checked={agentForm.enableDynamicVoiceSpeed}
                  onCheckedChange={(checked) =>
                    onAgentFormChange("enableDynamicVoiceSpeed", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <div className="pr-4">
                  <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Auto-adapt response timing
                  </p>
                  <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                    {AGENT_FIELD_HINTS.enableDynamicResponsiveness}
                  </p>
                </div>
                <Switch
                  checked={agentForm.enableDynamicResponsiveness}
                  onCheckedChange={(checked) =>
                    onAgentFormChange("enableDynamicResponsiveness", checked)
                  }
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
                  onChange={(event) =>
                    onVoiceProviderChange(
                      event.target
                        .value as (typeof RETELL_VOICE_PROVIDERS)[number],
                    )
                  }
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
                <Label htmlFor="voice-search-query">Search voices</Label>
                <Input
                  id="voice-search-query"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="warm, clear female, insurance..."
                />
              </div>

              <Button
                onClick={onSearch}
                disabled={searchPending || !searchQuery.trim()}
                className="w-full"
              >
                {searchPending ? (
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
                      onClick={() => onAddVoice(result)}
                      disabled={
                        addVoicePending ||
                        !result.provider_voice_id ||
                        !result.name
                      }
                    >
                      {addVoicePending ? "Adding..." : "Import Voice"}
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
                {filteredVoices.map((voice, idx) => {
                  const isSelected = voice.voice_id === selectedVoiceId;

                  return (
                    <div
                      key={`${voice.voice_id}-${idx}`}
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
                                onPreviewVoice(
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
                            variant={isSelected ? "secondary" : "outline"}
                            onClick={() =>
                              onAgentFormChange("voiceId", voice.voice_id)
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
  );
}
