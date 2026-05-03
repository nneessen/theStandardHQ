import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Clock3, Loader2, PhoneForwarded, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ChatBotAgent } from "@/features/chat-bot";
import { useUpdateBotConfig } from "@/features/chat-bot";
// eslint-disable-next-line no-restricted-imports
import { isValidPhoneNumber } from "@/services/sms";

interface VoiceAgentRuntimeCardProps {
  agent: ChatBotAgent | null | undefined;
}

type VoiceRuntimeForm = {
  voiceEnabled: boolean;
  voiceFollowUpEnabled: boolean;
  afterHoursInboundEnabled: boolean;
  afterHoursStartTime: string;
  afterHoursEndTime: string;
  afterHoursTimezone: string;
  voiceTransferNumber: string;
  primaryPhone: string;
  voiceMaxCallDurationSeconds: string;
  voiceVoicemailEnabled: boolean;
  voiceHumanHandoffEnabled: boolean;
  voiceQuotedFollowupEnabled: boolean;
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function buildFormState(
  agent: ChatBotAgent | null | undefined,
): VoiceRuntimeForm {
  return {
    voiceEnabled: agent?.voiceEnabled ?? false,
    voiceFollowUpEnabled: agent?.voiceFollowUpEnabled ?? false,
    afterHoursInboundEnabled: agent?.afterHoursInboundEnabled ?? false,
    afterHoursStartTime: agent?.afterHoursStartTime ?? "20:30",
    afterHoursEndTime: agent?.afterHoursEndTime ?? "08:00",
    afterHoursTimezone: agent?.afterHoursTimezone ?? "America/New_York",
    voiceTransferNumber: agent?.voiceTransferNumber ?? "",
    primaryPhone: agent?.primaryPhone ?? "",
    voiceMaxCallDurationSeconds: String(
      agent?.voiceMaxCallDurationSeconds ?? 300,
    ),
    voiceVoicemailEnabled: agent?.voiceVoicemailEnabled ?? true,
    voiceHumanHandoffEnabled: agent?.voiceHumanHandoffEnabled ?? true,
    voiceQuotedFollowupEnabled: agent?.voiceQuotedFollowupEnabled ?? false,
  };
}

function Section({
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
    <section className="rounded-lg border border-border p-4 dark:border-border">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card-tinted text-foreground dark:bg-card-tinted dark:text-foreground">
          {icon}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-foreground dark:text-foreground">
            {title}
          </p>
          <p className="mt-1 text-[10px] leading-5 text-muted-foreground dark:text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

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
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 dark:border-border">
      <div className="pr-4">
        <p className="text-[12px] font-semibold text-foreground dark:text-foreground">
          {title}
        </p>
        <p className="text-[10px] leading-5 text-muted-foreground dark:text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function VoiceAgentRuntimeCard({ agent }: VoiceAgentRuntimeCardProps) {
  const updateBotConfig = useUpdateBotConfig();
  const [form, setForm] = useState<VoiceRuntimeForm>(() =>
    buildFormState(agent),
  );

  useEffect(() => {
    setForm(buildFormState(agent));
  }, [agent]);

  const savedForm = useMemo(() => buildFormState(agent), [agent]);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    const timezone = form.afterHoursTimezone.trim();
    if (timezone && !isValidTimeZone(timezone)) {
      errors.push("Timezone must be a valid IANA timezone.");
    }

    const transferNumber = form.voiceTransferNumber.trim();
    if (transferNumber && !isValidPhoneNumber(transferNumber)) {
      errors.push("Transfer number must be a valid phone number.");
    }

    const callbackNumber = form.primaryPhone.trim();
    if (callbackNumber && !isValidPhoneNumber(callbackNumber)) {
      errors.push("Callback number must be a valid phone number.");
    }

    const maxDuration = Number.parseInt(form.voiceMaxCallDurationSeconds, 10);
    if (
      !Number.isInteger(maxDuration) ||
      maxDuration < 30 ||
      maxDuration > 3600
    ) {
      errors.push("Max call duration must be between 30 and 3600 seconds.");
    }

    return errors;
  }, [
    form.afterHoursTimezone,
    form.voiceMaxCallDurationSeconds,
    form.voiceTransferNumber,
    form.primaryPhone,
  ]);

  const updateField = <K extends keyof VoiceRuntimeForm>(
    key: K,
    value: VoiceRuntimeForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    if (validationErrors.length > 0) return;

    updateBotConfig.mutate({
      voiceEnabled: form.voiceEnabled,
      voiceFollowUpEnabled: form.voiceFollowUpEnabled,
      afterHoursInboundEnabled: form.afterHoursInboundEnabled,
      afterHoursStartTime: form.afterHoursStartTime || null,
      afterHoursEndTime: form.afterHoursEndTime || null,
      afterHoursTimezone: form.afterHoursTimezone || null,
      voiceTransferNumber: form.voiceTransferNumber || null,
      primaryPhone: form.primaryPhone || null,
      voiceMaxCallDurationSeconds:
        Number.parseInt(form.voiceMaxCallDurationSeconds, 10) || 300,
      voiceVoicemailEnabled: form.voiceVoicemailEnabled,
      voiceHumanHandoffEnabled: form.voiceHumanHandoffEnabled,
      voiceQuotedFollowupEnabled: form.voiceQuotedFollowupEnabled,
    });
  };

  const mutationError = updateBotConfig.error;

  return (
    <div className="rounded-lg border border-border bg-white p-4 dark:border-border dark:bg-card">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground dark:text-foreground">
            Call Flow & Availability
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground dark:text-muted-foreground">
            Choose when your AI Voice Agent should answer, how it should route
            calls, and what happens when a caller needs a human.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={
            updateBotConfig.isPending || !isDirty || validationErrors.length > 0
          }
        >
          {updateBotConfig.isPending ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Saving
            </>
          ) : (
            "Save Call Settings"
          )}
        </Button>
      </div>

      {mutationError && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 dark:border-destructive/60 dark:bg-destructive/10">
          <p className="text-[11px] font-semibold text-destructive">
            Failed to save call settings
          </p>
          <p className="mt-1 text-[11px] text-destructive">
            {mutationError.message || "An unexpected error occurred."}
          </p>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 dark:border-destructive/60 dark:bg-destructive/10">
          <p className="text-[11px] font-semibold text-destructive">
            Fix these fields before saving
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-destructive">
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Section
            icon={<Clock3 className="h-4 w-4" />}
            title="When should the agent answer?"
            description="Turn the voice agent on for this workspace and decide whether it should handle after-hours inbound calls."
          >
            <div className="space-y-3">
              <ToggleRow
                title="Voice agent is live"
                description="Allow voice workflows for this workspace."
                checked={form.voiceEnabled}
                onCheckedChange={(checked) =>
                  updateField("voiceEnabled", checked)
                }
              />

              <ToggleRow
                title="Answer after-hours inbound calls"
                description="Let the voice agent cover calls outside your normal business window."
                checked={form.afterHoursInboundEnabled}
                onCheckedChange={(checked) =>
                  updateField("afterHoursInboundEnabled", checked)
                }
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="voice-after-hours-start">
                    After-hours start
                  </Label>
                  <Input
                    id="voice-after-hours-start"
                    type="time"
                    value={form.afterHoursStartTime}
                    disabled={!form.afterHoursInboundEnabled}
                    onChange={(event) =>
                      updateField("afterHoursStartTime", event.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="voice-after-hours-end">After-hours end</Label>
                  <Input
                    id="voice-after-hours-end"
                    type="time"
                    value={form.afterHoursEndTime}
                    disabled={!form.afterHoursInboundEnabled}
                    onChange={(event) =>
                      updateField("afterHoursEndTime", event.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="voice-after-hours-timezone">Timezone</Label>
                  <Select
                    value={form.afterHoursTimezone}
                    onValueChange={(value) =>
                      updateField("afterHoursTimezone", value)
                    }
                  >
                    <SelectTrigger id="voice-after-hours-timezone">
                      <SelectValue placeholder="Select a timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((timezone) => (
                        <SelectItem key={timezone} value={timezone}>
                          {timezone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Section>

          <Section
            icon={<Sparkles className="h-4 w-4" />}
            title="Follow-up automation"
            description="Choose the outbound workflows this workspace should unlock after the voice add-on is active."
          >
            <div className="space-y-3">
              <ToggleRow
                title="Voice follow-up"
                description="Allow the agent to place outbound follow-up calls."
                checked={form.voiceFollowUpEnabled}
                onCheckedChange={(checked) =>
                  updateField("voiceFollowUpEnabled", checked)
                }
              />

              <ToggleRow
                title="Quoted follow-up"
                description="Use voice follow-up after a quote has already been sent."
                checked={form.voiceQuotedFollowupEnabled}
                onCheckedChange={(checked) =>
                  updateField("voiceQuotedFollowupEnabled", checked)
                }
              />
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section
            icon={<PhoneForwarded className="h-4 w-4" />}
            title="How should calls hand off?"
            description="Decide whether the agent should leave voicemails, transfer live calls, and how long it should stay on the line."
          >
            <div className="space-y-3">
              <ToggleRow
                title="Human handoff"
                description="Let the agent transfer a live caller to a real person."
                checked={form.voiceHumanHandoffEnabled}
                onCheckedChange={(checked) =>
                  updateField("voiceHumanHandoffEnabled", checked)
                }
              />

              <div className="space-y-1.5">
                <Label htmlFor="voice-transfer-number">Transfer number</Label>
                <Input
                  id="voice-transfer-number"
                  value={form.voiceTransferNumber}
                  onChange={(event) =>
                    updateField("voiceTransferNumber", event.target.value)
                  }
                  className="font-mono text-xs"
                  placeholder="+15551234567"
                />
                <p className="text-[10px] leading-5 text-muted-foreground dark:text-muted-foreground">
                  Use the direct number your team wants live callers sent to.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="voice-callback-number">Callback number</Label>
                <Input
                  id="voice-callback-number"
                  value={form.primaryPhone}
                  onChange={(event) =>
                    updateField("primaryPhone", event.target.value)
                  }
                  className="font-mono text-xs"
                  placeholder="+15551234567"
                />
                <p className="text-[10px] leading-5 text-muted-foreground dark:text-muted-foreground">
                  The number the AI tells leads to expect your call from.
                </p>
              </div>

              <ToggleRow
                title="Voicemail handling"
                description="Allow the agent to use voicemail logic when a live answer is not possible."
                checked={form.voiceVoicemailEnabled}
                onCheckedChange={(checked) =>
                  updateField("voiceVoicemailEnabled", checked)
                }
              />

              <div className="space-y-1.5">
                <Label htmlFor="voice-max-duration">
                  Max live call length (seconds)
                </Label>
                <Input
                  id="voice-max-duration"
                  type="number"
                  min={30}
                  max={3600}
                  value={form.voiceMaxCallDurationSeconds}
                  onChange={(event) =>
                    updateField(
                      "voiceMaxCallDurationSeconds",
                      event.target.value,
                    )
                  }
                />
                <p className="text-[10px] leading-5 text-muted-foreground dark:text-muted-foreground">
                  Keep this short for quick qualification calls, or raise it for
                  more involved conversations.
                </p>
              </div>
            </div>
          </Section>

          <div className="rounded-lg border border-border bg-background px-4 py-4 dark:border-border dark:bg-background/40">
            <p className="text-[12px] font-semibold text-foreground dark:text-foreground">
              Keep the experience simple
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground dark:text-muted-foreground">
              Voice selection, greeting, and prompt live in the build section
              above. This card is only for when the agent should answer and how
              it should route the call.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
