import {
  Bot,
  Library,
  Loader2,
  Mic,
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ChatBotRetellVoice,
  ChatBotRetellVoiceSearchHit,
} from "@/features/chat-bot";
import { RETELL_VOICE_PROVIDERS } from "../../lib/retell-config";
import { AGENT_FIELD_HINTS } from "../../lib/retell-field-hints";
import {
  DEFAULT_WORKFLOW_GREETINGS,
  WORKFLOW_CATEGORIES,
  WORKFLOW_PRESETS,
} from "../../lib/prompt-wizard-presets";
import type { RetellStructuredAgentForm } from "../../lib/retell-studio";
import { FieldHint } from "./FieldHint";
import { BuilderSection } from "./BuilderSection";

interface VoiceGreetingViewProps {
  agentForm: RetellStructuredAgentForm;
  onAgentFormChange: <K extends keyof RetellStructuredAgentForm>(
    key: K,
    value: RetellStructuredAgentForm[K],
  ) => void;
  workflowGreetings: Record<string, string>;
  onWorkflowGreetingChange: (workflowKey: string, value: string) => void;
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
  activeCloneVoiceId?: string | null;
}

export function VoiceGreetingView({
  agentForm,
  onAgentFormChange,
  workflowGreetings,
  onWorkflowGreetingChange,
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
  activeCloneVoiceId,
}: VoiceGreetingViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <BuilderSection
          icon={<Bot className="h-4 w-4" />}
          title="Name & greetings"
          description="Set the agent's display name and per-workflow opening greetings."
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

            <div className="space-y-2.5">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                The first thing the agent says, based on the call type. Use{" "}
                <code className="text-[9px]">{"{{agent_name}}"}</code>,{" "}
                <code className="text-[9px]">{"{{company_name}}"}</code>, and{" "}
                <code className="text-[9px]">{"{{lead_name}}"}</code> as
                placeholders.
              </p>

              {(
                [
                  {
                    label: "Inbound",
                    keys: WORKFLOW_CATEGORIES.inbound,
                    pt: false,
                  },
                  {
                    label: "Outbound",
                    keys: WORKFLOW_CATEGORIES.outbound,
                    pt: true,
                  },
                ] as const
              ).map((group) => (
                <div key={group.label} className="space-y-2">
                  <p
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500",
                      group.pt && "pt-1",
                    )}
                  >
                    {group.label}
                  </p>
                  {group.keys.map((key) => {
                    const preset = WORKFLOW_PRESETS.find((p) => p.key === key);
                    if (!preset) return null;
                    return (
                      <div key={key} className="space-y-1">
                        <Label
                          htmlFor={`greeting-${key}`}
                          className="text-[11px]"
                        >
                          {preset.label}
                        </Label>
                        <Textarea
                          id={`greeting-${key}`}
                          value={workflowGreetings[key] ?? ""}
                          onChange={(e) =>
                            onWorkflowGreetingChange(key, e.target.value)
                          }
                          disabled={!llmAvailable && !llmLoading}
                          className="min-h-[60px] text-xs"
                          placeholder={DEFAULT_WORKFLOW_GREETINGS[key]}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Speaking pace slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Speaking pace</Label>
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {Number(agentForm.voiceSpeed || 1).toFixed(1)}x
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={[Number(agentForm.voiceSpeed || 1)]}
                  onValueChange={([v]) =>
                    onAgentFormChange("voiceSpeed", v.toFixed(2))
                  }
                />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Slower</span>
                  <span className="text-emerald-500">1.0 = normal</span>
                  <span>Faster</span>
                </div>
              </div>

              {/* Voice energy slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Voice energy</Label>
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {Number(agentForm.voiceTemperature || 1).toFixed(1)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={2}
                  step={0.1}
                  value={[Number(agentForm.voiceTemperature || 1)]}
                  onValueChange={([v]) =>
                    onAgentFormChange("voiceTemperature", v.toFixed(1))
                  }
                />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Calm</span>
                  <span className="text-emerald-500">1.0 = natural</span>
                  <span>Expressive</span>
                </div>
              </div>

              {/* Response speed slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Response speed</Label>
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {Number(agentForm.responsiveness || 0.5).toFixed(1)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[Number(agentForm.responsiveness || 0.5)]}
                  onValueChange={([v]) =>
                    onAgentFormChange("responsiveness", v.toFixed(2))
                  }
                />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Patient</span>
                  <span className="text-emerald-500">0.5 = balanced</span>
                  <span>Snappy</span>
                </div>
              </div>

              {/* Interruption sensitivity slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">
                    Interruption sensitivity
                  </Label>
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {Number(agentForm.interruptionSensitivity || 0.5).toFixed(
                      1,
                    )}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[Number(agentForm.interruptionSensitivity || 0.5)]}
                  onValueChange={([v]) =>
                    onAgentFormChange("interruptionSensitivity", v.toFixed(2))
                  }
                />
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Persistent</span>
                  <span className="text-emerald-500">0.5 = balanced</span>
                  <span>Yields easily</span>
                </div>
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
        description="Pick a voice for your agent, or search to import new ones."
      >
        <div className="space-y-3">
          {/* Search bar — compact horizontal layout */}
          <div className="flex items-end gap-2">
            <div className="space-y-1 flex-shrink-0">
              <Label htmlFor="voice-search-provider" className="text-[10px]">
                Provider
              </Label>
              <select
                id="voice-search-provider"
                value={voiceProvider}
                onChange={(event) =>
                  onVoiceProviderChange(
                    event.target
                      .value as (typeof RETELL_VOICE_PROVIDERS)[number],
                  )
                }
                className="flex h-8 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                {RETELL_VOICE_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 flex-1">
              <Label htmlFor="voice-search-query" className="text-[10px]">
                Search voices
              </Label>
              <Input
                id="voice-search-query"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="warm, clear female, insurance..."
                className="h-8 text-xs"
              />
            </div>
            <Button
              onClick={onSearch}
              disabled={searchPending || !searchQuery.trim()}
              size="sm"
              className="h-8 flex-shrink-0"
            >
              {searchPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Search results — compact */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                Search results
              </p>
              {searchResults.slice(0, 3).map((result) => (
                <div
                  key={`${result.provider_voice_id}-${result.public_user_id ?? "public"}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {result.name ?? "Unnamed voice"}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {result.description ?? "No description"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] flex-shrink-0"
                    onClick={() => onAddVoice(result)}
                    disabled={
                      addVoicePending ||
                      !result.provider_voice_id ||
                      !result.name
                    }
                  >
                    {addVoicePending ? "Adding..." : "Import"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Imported voices — compact rows */}
          <div>
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Your voices
            </p>
            {voicesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            ) : filteredVoices.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                {voices.length === 0
                  ? "No imported voices yet. Search above to add one."
                  : `No voices from ${voiceProvider}. Try a different provider.`}
              </div>
            ) : (
              <div className="max-h-[240px] overflow-y-auto overscroll-contain space-y-1.5 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                {filteredVoices.map((voice, idx) => {
                  const isSelected = voice.voice_id === selectedVoiceId;
                  const isClone =
                    !!activeCloneVoiceId &&
                    voice.voice_id === activeCloneVoiceId;
                  return (
                    <div
                      key={`${voice.voice_id}-${idx}`}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                        isSelected
                          ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20"
                          : isClone
                            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                            : "border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/30",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isClone ? (
                          <Mic className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <WandSparkles className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {voice.voice_name}
                            </p>
                            {isClone && (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[8px] px-1 py-0 leading-tight">
                                Cloned
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                              {voice.provider}
                            </span>
                            {voice.gender && (
                              <span className="text-[9px] text-zinc-500 dark:text-zinc-400">
                                · {voice.gender}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {voice.preview_audio_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() =>
                              onPreviewVoice(
                                voice.voice_id,
                                voice.preview_audio_url!,
                              )
                            }
                          >
                            {playingVoiceId === voice.voice_id ? (
                              <VolumeX className="h-3 w-3" />
                            ) : (
                              <Volume2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isSelected ? "secondary" : "outline"}
                          className="h-7 text-[10px]"
                          onClick={() =>
                            onAgentFormChange("voiceId", voice.voice_id)
                          }
                        >
                          {isSelected ? "Selected" : "Use"}
                        </Button>
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
