import { MessageCircle, Timer, Voicemail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AGENT_FIELD_HINTS,
  AMBIENT_SOUND_OPTIONS,
} from "../../lib/retell-field-hints";
import type { RetellStructuredAgentForm } from "../../lib/retell-studio";
import { FieldHint } from "./FieldHint";
import { BuilderSection as Section } from "./BuilderSection";

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm">
      <div className="pr-4">
        <p className="text-[11px] font-semibold text-foreground">{title}</p>
        <p className="text-[10px] leading-4 text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface CallBehaviorSectionProps {
  agentForm: RetellStructuredAgentForm;
  onAgentFormChange: <K extends keyof RetellStructuredAgentForm>(
    key: K,
    value: RetellStructuredAgentForm[K],
  ) => void;
}

export function CallBehaviorSection({
  agentForm,
  onAgentFormChange,
}: CallBehaviorSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Natural conversation feel */}
      <Section
        icon={<MessageCircle className="h-4 w-4" />}
        title="Natural conversation feel"
        description="Make the agent sound more human by adding filler words and background ambiance."
      >
        <div className="space-y-3">
          <ToggleRow
            title="Natural filler words"
            description={AGENT_FIELD_HINTS.enableBackchannel}
            checked={agentForm.enableBackchannel}
            onCheckedChange={(checked) =>
              onAgentFormChange("enableBackchannel", checked)
            }
          />

          {agentForm.enableBackchannel && (
            <div className="space-y-1.5">
              <Label htmlFor="retell-backchannel-frequency">
                Filler frequency
              </Label>
              <Input
                id="retell-backchannel-frequency"
                type="number"
                min={0}
                max={1}
                step="0.05"
                value={agentForm.backchannelFrequency}
                onChange={(event) =>
                  onAgentFormChange("backchannelFrequency", event.target.value)
                }
                placeholder="0.8"
              />
              <FieldHint>{AGENT_FIELD_HINTS.backchannelFrequency}</FieldHint>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="retell-ambient-sound">Background ambiance</Label>
            <select
              id="retell-ambient-sound"
              value={agentForm.ambientSound}
              onChange={(event) =>
                onAgentFormChange("ambientSound", event.target.value)
              }
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              {AMBIENT_SOUND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldHint>{AGENT_FIELD_HINTS.ambientSound}</FieldHint>
          </div>

          {agentForm.ambientSound && (
            <div className="space-y-1.5">
              <Label htmlFor="retell-ambient-volume">Ambiance volume</Label>
              <Input
                id="retell-ambient-volume"
                type="number"
                min={0}
                max={2}
                step="0.05"
                value={agentForm.ambientSoundVolume}
                onChange={(event) =>
                  onAgentFormChange("ambientSoundVolume", event.target.value)
                }
                placeholder="1.0"
              />
              <FieldHint>{AGENT_FIELD_HINTS.ambientSoundVolume}</FieldHint>
            </div>
          )}
        </div>
      </Section>

      <div className="space-y-4">
        {/* Silence and reminders */}
        <Section
          icon={<Timer className="h-4 w-4" />}
          title="Silence and reminders"
          description="Control what happens when nobody is speaking during the call."
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="retell-reminder-trigger">
                Re-prompt after silence (ms)
              </Label>
              <Input
                id="retell-reminder-trigger"
                type="number"
                min={1000}
                max={120000}
                step="1000"
                value={agentForm.reminderTriggerMs}
                onChange={(event) =>
                  onAgentFormChange("reminderTriggerMs", event.target.value)
                }
                placeholder="10000"
              />
              <FieldHint>{AGENT_FIELD_HINTS.reminderTriggerMs}</FieldHint>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retell-reminder-max">Max re-prompts</Label>
              <Input
                id="retell-reminder-max"
                type="number"
                min={0}
                max={10}
                value={agentForm.reminderMaxCount}
                onChange={(event) =>
                  onAgentFormChange("reminderMaxCount", event.target.value)
                }
                placeholder="1"
              />
              <FieldHint>{AGENT_FIELD_HINTS.reminderMaxCount}</FieldHint>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retell-end-call-silence">
                Hang up after silence (ms)
              </Label>
              <Input
                id="retell-end-call-silence"
                type="number"
                min={1000}
                max={600000}
                step="1000"
                value={agentForm.endCallAfterSilenceMs}
                onChange={(event) =>
                  onAgentFormChange("endCallAfterSilenceMs", event.target.value)
                }
                placeholder="600000"
              />
              <FieldHint>{AGENT_FIELD_HINTS.endCallAfterSilenceMs}</FieldHint>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retell-begin-message-delay">
                Delay before first message (ms)
              </Label>
              <Input
                id="retell-begin-message-delay"
                type="number"
                min={0}
                max={120000}
                step="100"
                value={agentForm.beginMessageDelayMs}
                onChange={(event) =>
                  onAgentFormChange("beginMessageDelayMs", event.target.value)
                }
                placeholder="0"
              />
              <FieldHint>{AGENT_FIELD_HINTS.beginMessageDelayMs}</FieldHint>
            </div>
          </div>
        </Section>

        {/* Voicemail behavior */}
        <Section
          icon={<Voicemail className="h-4 w-4" />}
          title="Voicemail behavior"
          description="Control what happens when the agent reaches voicemail."
        >
          <div className="space-y-3">
            <ToggleRow
              title="Detect voicemail"
              description={AGENT_FIELD_HINTS.enableVoicemailDetection}
              checked={agentForm.enableVoicemailDetection}
              onCheckedChange={(checked) =>
                onAgentFormChange("enableVoicemailDetection", checked)
              }
            />

            {agentForm.enableVoicemailDetection && (
              <div className="space-y-1.5">
                <Label htmlFor="retell-voicemail-timeout">
                  Voicemail detection timeout (ms)
                </Label>
                <Input
                  id="retell-voicemail-timeout"
                  type="number"
                  min={0}
                  max={120000}
                  step="1000"
                  value={agentForm.voicemailDetectionTimeoutMs}
                  onChange={(event) =>
                    onAgentFormChange(
                      "voicemailDetectionTimeoutMs",
                      event.target.value,
                    )
                  }
                  placeholder="30000"
                />
                <FieldHint>
                  {AGENT_FIELD_HINTS.voicemailDetectionTimeoutMs}
                </FieldHint>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
