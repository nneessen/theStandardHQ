import {
  Bot,
  Download,
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
  addingVoiceId: string | null;
  playingVoiceId: string | null;
  onPreviewVoice: (voiceId: string, previewUrl: string) => void;
  filteredVoices: ChatBotRetellVoice[];
  activeCloneVoiceId?: string | null;
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  lowLabel,
  midLabel,
  highLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: string) => void;
  lowLabel: string;
  midLabel: string;
  highLabel: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold">{label}</Label>
        <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-mono font-bold text-background">
          {value.toFixed(1)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v.toFixed(2))}
      />
      <div className="flex justify-between text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted">
        <span>{lowLabel}</span>
        <span>{midLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
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
  addingVoiceId,
  playingVoiceId,
  onPreviewVoice,
  filteredVoices,
  activeCloneVoiceId,
}: VoiceGreetingViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        {/* ── Name & Greetings ── */}
        <BuilderSection
          icon={<Bot className="h-4 w-4" />}
          title="Name & greetings"
          description="Set the agent's display name and per-workflow opening greetings."
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="voice-agent-name"
                className="text-[11px] font-semibold"
              >
                Agent name
              </Label>
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

            <div className="space-y-3">
              <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-[10px] text-muted-foreground shadow-sm">
                The first thing the agent says, based on the call type. Use{" "}
                <code className="rounded bg-muted px-1 text-[9px] font-mono">
                  {"{{agent_name}}"}
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1 text-[9px] font-mono">
                  {"{{company_name}}"}
                </code>
                , and{" "}
                <code className="rounded bg-muted px-1 text-[9px] font-mono">
                  {"{{lead_name}}"}
                </code>{" "}
                as placeholders.
              </div>

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
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      group.pt &&
                        "pt-3 border-t border-v2-ring dark:border-v2-ring",
                    )}
                  >
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
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

        {/* ── Voice & Tone ── */}
        <BuilderSection
          icon={<Mic2 className="h-4 w-4" />}
          title="Voice & tone"
          description="Choose the actual voice, then tune how fast and how dynamically it should respond."
        >
          <div className="space-y-4">
            {/* Current draft voice — prominent indicator */}
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                selectedVoice
                  ? "border-success/30 bg-success/10/80 dark:border-success/40 dark:bg-success/10"
                  : "border-warning/30 bg-warning/10/80 dark:border-warning/40 dark:bg-warning/10",
              )}
            >
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Current voice
                </p>
                <p className="mt-0.5 text-[12px] font-bold text-v2-ink dark:text-v2-ink truncate">
                  {selectedVoice
                    ? `${selectedVoice.voice_name} · ${selectedVoice.provider}`
                    : selectedVoiceId || "No voice selected yet"}
                </p>
              </div>
              <Badge
                className={cn(
                  "flex-shrink-0 text-[9px]",
                  selectedVoice
                    ? "bg-success/20 text-success dark:bg-success/20 dark:text-success"
                    : "bg-warning/20 text-warning dark:bg-warning/20 dark:text-warning",
                )}
              >
                {selectedVoice ? "Selected" : "Needs selection"}
              </Badge>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SliderField
                label="Speaking pace"
                value={Number(agentForm.voiceSpeed || 1)}
                min={0.5}
                max={1.5}
                step={0.05}
                onChange={(v) => onAgentFormChange("voiceSpeed", v)}
                lowLabel="Slower"
                midLabel="1.0 = normal"
                highLabel="Faster"
              />
              <SliderField
                label="Voice energy"
                value={Number(agentForm.voiceTemperature || 1)}
                min={0}
                max={2}
                step={0.1}
                onChange={(v) => onAgentFormChange("voiceTemperature", v)}
                lowLabel="Calm"
                midLabel="1.0 = natural"
                highLabel="Expressive"
              />
              <SliderField
                label="Response speed"
                value={Number(agentForm.responsiveness || 0.5)}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => onAgentFormChange("responsiveness", v)}
                lowLabel="Patient"
                midLabel="0.5 = balanced"
                highLabel="Snappy"
              />
              <SliderField
                label="Interruption sensitivity"
                value={Number(agentForm.interruptionSensitivity || 0.5)}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) =>
                  onAgentFormChange("interruptionSensitivity", v)
                }
                lowLabel="Persistent"
                midLabel="0.5 = balanced"
                highLabel="Yields easily"
              />
            </div>

            {/* Auto-adapt toggles */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Auto-adapt
              </p>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
                <div className="pr-4">
                  <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
                    Auto-adapt speaking speed
                  </p>
                  <p className="text-[10px] leading-4 text-v2-ink-muted dark:text-v2-ink-subtle">
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

              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
                <div className="pr-4">
                  <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink">
                    Auto-adapt response timing
                  </p>
                  <p className="text-[10px] leading-4 text-v2-ink-muted dark:text-v2-ink-subtle">
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

      {/* ── Voice Library ── */}
      <BuilderSection
        icon={<Library className="h-4 w-4" />}
        title="Voice library"
        description="Pick a voice for your agent, or search to import new ones."
      >
        <div className="space-y-4 overflow-hidden">
          {/* ── Search & Import ── */}
          <div className="overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-v2-ring px-3 py-2 dark:border-v2-ring">
              <Search className="h-3 w-3 text-v2-ink-subtle" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Search & import
              </span>
            </div>
            <div className="p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1 sm:w-[120px] flex-shrink-0">
                  <Label
                    htmlFor="voice-search-provider"
                    className="text-[10px]"
                  >
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
                    className="flex h-8 w-full rounded-md border border-v2-ring bg-white px-2 py-1 text-xs dark:border-v2-ring-strong dark:bg-v2-card"
                  >
                    {RETELL_VOICE_PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 min-w-0 flex-1 overflow-hidden">
                  <Label htmlFor="voice-search-query" className="text-[10px]">
                    Search voices
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      id="voice-search-query"
                      value={searchQuery}
                      onChange={(event) =>
                        onSearchQueryChange(event.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchQuery.trim()) onSearch();
                      }}
                      placeholder="warm, clear female..."
                      className="h-8 text-xs min-w-0 flex-1"
                    />
                    <Button
                      onClick={onSearch}
                      disabled={searchPending || !searchQuery.trim()}
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                    >
                      {searchPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Search Results ── */}
          {searchResults.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                <Download className="h-3 w-3 text-v2-ink-subtle" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Results ({searchResults.length})
                </span>
              </div>
              <div className="divide-y divide-border/40">
                {searchResults.slice(0, 5).map((result) => (
                  <div
                    key={`${result.provider_voice_id}-${result.public_user_id ?? "public"}`}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink truncate">
                        {result.name ?? "Unnamed voice"}
                      </p>
                      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
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
                      {addingVoiceId === result.provider_voice_id
                        ? "Adding..."
                        : "Import"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Your Voices ── */}
          <div className="overflow-hidden rounded-lg border border-border/60">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
              <WandSparkles className="h-3 w-3 text-v2-ink-subtle" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Your voices
              </span>
              {!voicesLoading && filteredVoices.length > 0 && (
                <Badge className="bg-v2-ring text-v2-ink-muted text-[8px] px-1.5 py-0 dark:bg-v2-ring-strong dark:text-v2-ink-muted">
                  {filteredVoices.length}
                </Badge>
              )}
            </div>
            {voicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
              </div>
            ) : filteredVoices.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-v2-ink-subtle dark:text-v2-ink-muted">
                {voices.length === 0
                  ? "No imported voices yet. Search above to add one."
                  : `No voices from ${voiceProvider}. Try a different provider.`}
              </div>
            ) : (
              <div
                className="max-h-[280px] overflow-y-auto overscroll-contain divide-y divide-border/30"
                onWheel={(e) => e.stopPropagation()}
              >
                {filteredVoices.map((voice, idx) => {
                  const isSelected = voice.voice_id === selectedVoiceId;
                  const isClone =
                    !!activeCloneVoiceId &&
                    voice.voice_id === activeCloneVoiceId;
                  return (
                    <div
                      key={`${voice.voice_id}-${idx}`}
                      className={cn(
                        "flex items-center justify-between gap-2 px-3 py-2 transition-colors",
                        isSelected
                          ? "bg-foreground/5 dark:bg-foreground/5"
                          : isClone
                            ? "bg-success/10/50 dark:bg-success/10/10"
                            : "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/40",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        {isClone ? (
                          <Mic className="h-3 w-3 text-success flex-shrink-0" />
                        ) : (
                          <WandSparkles className="h-3 w-3 text-v2-ink-subtle flex-shrink-0" />
                        )}
                        <div className="min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink truncate">
                              {voice.voice_name}
                            </p>
                            {isClone && (
                              <Badge className="bg-success/20 text-success dark:bg-success/20 dark:text-success text-[8px] px-1 py-0 leading-tight">
                                Cloned
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                              {voice.provider}
                            </span>
                            {voice.gender && (
                              <span className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
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
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "h-7 text-[10px]",
                            isSelected && "pointer-events-none",
                          )}
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
