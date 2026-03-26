import { useState } from "react";
import { Bot, ChevronDown, Code2, Mic2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AGENT_FIELD_HINTS,
  LLM_FIELD_HINTS,
} from "../../lib/retell-field-hints";
import { MODEL_PRESETS } from "../../lib/prompt-wizard-presets";
import type {
  RetellStructuredAgentForm,
  RetellStructuredLlmForm,
} from "../../lib/retell-studio";
import { FieldHint } from "./FieldHint";
import { BuilderSection } from "./BuilderSection";

const TEMPERATURE_OPTIONS = [
  {
    value: "0.3",
    label: "Predictable",
    description: "Consistent, safe responses",
  },
  {
    value: "0.7",
    label: "Balanced",
    description: "Good mix of consistency and variety",
  },
  {
    value: "1.0",
    label: "Natural",
    description: "Most human-sounding (recommended)",
  },
  {
    value: "1.3",
    label: "Creative",
    description: "More varied but less predictable",
  },
] as const;

const STT_OPTIONS = [
  { value: "", label: "Default (recommended)" },
  { value: "fast", label: "Fast — quicker responses, slightly less accurate" },
  {
    value: "accurate",
    label: "Accurate — better recognition, slightly slower",
  },
] as const;

const DENOISING_OPTIONS = [
  { value: "", label: "Automatic (recommended)" },
  {
    value: "noise-cancellation",
    label: "Noise cancellation — removes background noise",
  },
] as const;

interface AdvancedViewProps {
  agentForm: RetellStructuredAgentForm;
  onAgentFormChange: <K extends keyof RetellStructuredAgentForm>(
    key: K,
    value: RetellStructuredAgentForm[K],
  ) => void;
  llmForm: RetellStructuredLlmForm;
  onLlmFormChange: <K extends keyof RetellStructuredLlmForm>(
    key: K,
    value: RetellStructuredLlmForm[K],
  ) => void;
  llmAvailable: boolean;
  llmLoading: boolean;
}

function msToSeconds(ms: string | number): string {
  const num = typeof ms === "string" ? parseInt(ms, 10) : ms;
  if (isNaN(num) || num === 0) return "";
  return String(Math.round(num / 1000));
}

function secondsToMs(seconds: string): string {
  const num = parseInt(seconds, 10);
  if (isNaN(num)) return "";
  return String(num * 1000);
}

export function AdvancedView({
  agentForm,
  onAgentFormChange,
  llmForm,
  onLlmFormChange,
  llmAvailable,
  llmLoading,
}: AdvancedViewProps) {
  const [devMode, setDevMode] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-sm">
        <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          These settings are optional
        </p>
        <p className="mt-1 text-[10px] leading-4 text-zinc-600 dark:text-zinc-400">
          Most agents work great with the defaults. Only adjust these if you
          need to fine-tune how your agent thinks, listens, or handles calls.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* AI Model & Behavior */}
        <BuilderSection
          icon={<Bot className="h-4 w-4" />}
          title="AI model & behavior"
          description="Choose how smart and creative your agent should be."
        >
          {!llmAvailable && !llmLoading ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              These controls become available when using the managed voice model
              setup.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Model dropdown */}
                <div className="space-y-1">
                  <Label htmlFor="retell-llm-model" className="text-[11px]">
                    AI model
                  </Label>
                  <Select
                    value={llmForm.model || "gpt-4o-mini"}
                    onValueChange={(v) => onLlmFormChange("model", v)}
                  >
                    <SelectTrigger
                      id="retell-llm-model"
                      className="h-8 text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_PRESETS.map((m) => (
                        <SelectItem
                          key={m.value}
                          value={m.value}
                          className="text-xs"
                        >
                          <div>
                            <span className="font-medium">{m.label}</span>
                            <span className="ml-1.5 text-zinc-500">
                              — {m.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Standard is faster. Enhanced is better with complex
                    conversations.
                  </p>
                </div>

                {/* Temperature dropdown */}
                <div className="space-y-1">
                  <Label
                    htmlFor="retell-llm-temperature"
                    className="text-[11px]"
                  >
                    Response style
                  </Label>
                  <Select
                    value={String(llmForm.modelTemperature || "1.0")}
                    onValueChange={(v) =>
                      onLlmFormChange("modelTemperature", v)
                    }
                  >
                    <SelectTrigger
                      id="retell-llm-temperature"
                      className="h-8 text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPERATURE_OPTIONS.map((t) => (
                        <SelectItem
                          key={t.value}
                          value={t.value}
                          className="text-xs"
                        >
                          <div>
                            <span className="font-medium">{t.label}</span>
                            <span className="ml-1.5 text-zinc-500">
                              — {t.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    "Natural" works best for most agents.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
                <div className="pr-4">
                  <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Strict connected actions
                  </p>
                  <p className="text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
                    {LLM_FIELD_HINTS.toolCallStrictMode}
                  </p>
                </div>
                <Switch
                  checked={llmForm.toolCallStrictMode}
                  onCheckedChange={(checked) =>
                    onLlmFormChange("toolCallStrictMode", checked)
                  }
                />
              </div>

              {/* Developer options — collapsed by default */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                  onClick={() => setDevMode(!devMode)}
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Developer options
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-zinc-400 transition-transform",
                      devMode && "rotate-180",
                    )}
                  />
                </button>
                {devMode && (
                  <div className="space-y-3 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      These are advanced integrations. Most users don't need to
                      touch them.
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Knowledge sources</Label>
                      <Textarea
                        value={llmForm.knowledgeBaseIds}
                        onChange={(e) =>
                          onLlmFormChange("knowledgeBaseIds", e.target.value)
                        }
                        className="min-h-[80px] font-mono text-xs"
                        placeholder={"kb_123\nkb_456"}
                      />
                      <FieldHint>{LLM_FIELD_HINTS.knowledgeBaseIds}</FieldHint>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">
                        Connected actions (JSON)
                      </Label>
                      <Textarea
                        value={llmForm.generalTools}
                        onChange={(e) =>
                          onLlmFormChange("generalTools", e.target.value)
                        }
                        className="min-h-[100px] font-mono text-xs"
                        spellCheck={false}
                        placeholder={'[\n  { "name": "lookup_policy" }\n]'}
                      />
                      <FieldHint>{LLM_FIELD_HINTS.generalTools}</FieldHint>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">
                        MCP connections (JSON)
                      </Label>
                      <Textarea
                        value={llmForm.mcps}
                        onChange={(e) =>
                          onLlmFormChange("mcps", e.target.value)
                        }
                        className="min-h-[100px] font-mono text-xs"
                        spellCheck={false}
                        placeholder={'[\n  { "name": "crm" }\n]'}
                      />
                      <FieldHint>{LLM_FIELD_HINTS.mcps}</FieldHint>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </BuilderSection>

        {/* Voice & Call Settings */}
        <BuilderSection
          icon={<Mic2 className="h-4 w-4" />}
          title="Voice recognition & call limits"
          description="Fine-tune how the agent listens and how long calls can last."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* STT mode dropdown */}
              <div className="space-y-1">
                <Label htmlFor="retell-stt-mode" className="text-[11px]">
                  Speech recognition
                </Label>
                <Select
                  value={agentForm.sttMode || ""}
                  onValueChange={(v) => onAgentFormChange("sttMode", v)}
                >
                  <SelectTrigger id="retell-stt-mode" className="h-8 text-xs">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {STT_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value || "default"}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Denoising dropdown */}
              <div className="space-y-1">
                <Label htmlFor="retell-denoising-mode" className="text-[11px]">
                  Background noise
                </Label>
                <Select
                  value={agentForm.denoisingMode || ""}
                  onValueChange={(v) => onAgentFormChange("denoisingMode", v)}
                >
                  <SelectTrigger
                    id="retell-denoising-mode"
                    className="h-8 text-xs"
                  >
                    <SelectValue placeholder="Automatic" />
                  </SelectTrigger>
                  <SelectContent>
                    {DENOISING_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value || "auto"}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ring duration in seconds */}
              <div className="space-y-1">
                <Label htmlFor="retell-ring-duration" className="text-[11px]">
                  Ring time (seconds)
                </Label>
                <Input
                  id="retell-ring-duration"
                  type="number"
                  min={5}
                  max={600}
                  step="5"
                  value={msToSeconds(agentForm.ringDurationMs)}
                  onChange={(event) =>
                    onAgentFormChange(
                      "ringDurationMs",
                      secondsToMs(event.target.value),
                    )
                  }
                  placeholder="15"
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  How long to ring before hanging up. 15 seconds is typical.
                </p>
              </div>

              {/* Max call duration in seconds */}
              <div className="space-y-1">
                <Label
                  htmlFor="retell-max-call-duration"
                  className="text-[11px]"
                >
                  Max call length (minutes)
                </Label>
                <Input
                  id="retell-max-call-duration"
                  type="number"
                  min={1}
                  max={480}
                  step="1"
                  value={
                    agentForm.maxCallDurationMs
                      ? String(
                          Math.round(
                            parseInt(String(agentForm.maxCallDurationMs), 10) /
                              60000,
                          ),
                        )
                      : ""
                  }
                  onChange={(event) => {
                    const mins = parseInt(event.target.value, 10);
                    if (!isNaN(mins)) {
                      onAgentFormChange(
                        "maxCallDurationMs",
                        String(mins * 60000),
                      );
                    }
                  }}
                  placeholder="30"
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  The longest a single call can last. 30 minutes is typical.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
              <div className="pr-4">
                <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Allow keypad input
                </p>
                <p className="text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
                  {AGENT_FIELD_HINTS.allowUserDtmf}
                </p>
              </div>
              <Switch
                checked={agentForm.allowUserDtmf}
                onCheckedChange={(checked) =>
                  onAgentFormChange("allowUserDtmf", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
              <div className="pr-4">
                <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Speak numbers naturally
                </p>
                <p className="text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
                  Converts "$150" to "one hundred fifty dollars" and similar.
                </p>
              </div>
              <Switch
                checked={agentForm.normalizeForSpeech}
                onCheckedChange={(checked) =>
                  onAgentFormChange("normalizeForSpeech", checked)
                }
              />
            </div>
          </div>
        </BuilderSection>
      </div>
    </div>
  );
}
