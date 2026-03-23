import { type ReactNode } from "react";
import { Bot, Mic2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AGENT_FIELD_HINTS,
  LLM_FIELD_HINTS,
} from "../../lib/retell-field-hints";
import type {
  RetellStructuredAgentForm,
  RetellStructuredLlmForm,
} from "../../lib/retell-studio";
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

export function AdvancedView({
  agentForm,
  onAgentFormChange,
  llmForm,
  onLlmFormChange,
  llmAvailable,
  llmLoading,
}: AdvancedViewProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
          Advanced options are optional
        </p>
        <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
          Use these settings when you need deeper control over model behavior,
          knowledge, connected actions, or extra call safeguards. Basic setup
          can still be completed without changing anything here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BuilderSection
          icon={<Bot className="h-4 w-4" />}
          title="Knowledge, connected actions, and model"
          description="Optional controls for knowledge sources, connected actions, and the underlying model."
        >
          {!llmAvailable && !llmLoading ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              Advanced prompt controls are unavailable until this workspace is
              using the managed voice model setup.
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
                      onLlmFormChange("model", event.target.value)
                    }
                    placeholder="gpt-4o-mini"
                  />
                  <FieldHint>{LLM_FIELD_HINTS.model}</FieldHint>
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
                      onLlmFormChange("modelTemperature", event.target.value)
                    }
                  />
                  <FieldHint>{LLM_FIELD_HINTS.modelTemperature}</FieldHint>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retell-kb-ids">Knowledge sources</Label>
                <Textarea
                  id="retell-kb-ids"
                  value={llmForm.knowledgeBaseIds}
                  onChange={(event) =>
                    onLlmFormChange("knowledgeBaseIds", event.target.value)
                  }
                  className="min-h-[110px] font-mono text-xs"
                  placeholder={"kb_123\nkb_456"}
                />
                <FieldHint>{LLM_FIELD_HINTS.knowledgeBaseIds}</FieldHint>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <div className="pr-4">
                  <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Strict connected actions
                  </p>
                  <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
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

              <div className="space-y-1.5">
                <Label htmlFor="retell-general-tools">Connected actions</Label>
                <Textarea
                  id="retell-general-tools"
                  value={llmForm.generalTools}
                  onChange={(event) =>
                    onLlmFormChange("generalTools", event.target.value)
                  }
                  className="min-h-[180px] font-mono text-xs"
                  spellCheck={false}
                  placeholder={'[\n  {\n    "name": "lookup_policy"\n  }\n]'}
                />
                <FieldHint>{LLM_FIELD_HINTS.generalTools}</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retell-mcps">Advanced connections</Label>
                <Textarea
                  id="retell-mcps"
                  value={llmForm.mcps}
                  onChange={(event) =>
                    onLlmFormChange("mcps", event.target.value)
                  }
                  className="min-h-[180px] font-mono text-xs"
                  spellCheck={false}
                  placeholder={'[\n  {\n    "name": "crm"\n  }\n]'}
                />
                <FieldHint>{LLM_FIELD_HINTS.mcps}</FieldHint>
              </div>
            </div>
          )}
        </BuilderSection>

        <BuilderSection
          icon={<Mic2 className="h-4 w-4" />}
          title="Advanced voice and call behavior"
          description="Optional tuning for speech recognition, noise handling, and call limits."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="retell-stt-mode">STT mode</Label>
                <Input
                  id="retell-stt-mode"
                  value={agentForm.sttMode}
                  onChange={(event) =>
                    onAgentFormChange("sttMode", event.target.value)
                  }
                  placeholder="fast"
                />
                <FieldHint>{AGENT_FIELD_HINTS.sttMode}</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retell-denoising-mode">Denoising mode</Label>
                <Input
                  id="retell-denoising-mode"
                  value={agentForm.denoisingMode}
                  onChange={(event) =>
                    onAgentFormChange("denoisingMode", event.target.value)
                  }
                  placeholder="auto"
                />
                <FieldHint>{AGENT_FIELD_HINTS.denoisingMode}</FieldHint>
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
                    onAgentFormChange("ringDurationMs", event.target.value)
                  }
                />
                <FieldHint>{AGENT_FIELD_HINTS.ringDurationMs}</FieldHint>
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
                    onAgentFormChange("maxCallDurationMs", event.target.value)
                  }
                />
                <FieldHint>{AGENT_FIELD_HINTS.maxCallDurationMs}</FieldHint>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
              <div className="pr-4">
                <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Allow keypad input
                </p>
                <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
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

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
              <div className="pr-4">
                <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Normalize speech
                </p>
                <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                  {AGENT_FIELD_HINTS.normalizeForSpeech}
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
