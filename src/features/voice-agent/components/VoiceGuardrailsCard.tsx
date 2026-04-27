import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useUpdateVoiceGuardrails,
  type ChatBotVoiceSetupState,
} from "@/features/chat-bot";

// ─── Types ─────────────────────────────────────────────────────

interface GuardrailsForm {
  silenceHangupSeconds: string;
  ringTimeoutSeconds: string;
  maxDailyOutboundCalls: string;
  maxAttemptsPerLead: string;
  outboundCooldownHours: string;
}

interface VoiceGuardrailsCardProps {
  voiceSetupState: ChatBotVoiceSetupState | null | undefined;
}

// ─── Constants ─────────────────────────────────────────────────

const FIELDS: {
  key: keyof GuardrailsForm;
  label: string;
  description: string;
  min: number;
  max: number;
  defaultVal: number;
}[] = [
  {
    key: "silenceHangupSeconds",
    label: "Silence hangup (sec)",
    description: "Hang up after this many seconds of silence.",
    min: 5,
    max: 300,
    defaultVal: 20,
  },
  {
    key: "ringTimeoutSeconds",
    label: "Ring timeout (sec)",
    description: "Stop ringing after this many seconds.",
    min: 5,
    max: 120,
    defaultVal: 30,
  },
  {
    key: "maxDailyOutboundCalls",
    label: "Max daily outbound calls",
    description: "Maximum outbound calls per day.",
    min: 1,
    max: 1000,
    defaultVal: 25,
  },
  {
    key: "maxAttemptsPerLead",
    label: "Max attempts per lead",
    description: "Maximum call attempts to a single lead.",
    min: 1,
    max: 20,
    defaultVal: 2,
  },
  {
    key: "outboundCooldownHours",
    label: "Cooldown between attempts (hrs)",
    description: "Minimum hours between call attempts to the same lead.",
    min: 1,
    max: 168,
    defaultVal: 24,
  },
];

// ─── Helpers ───────────────────────────────────────────────────

function buildForm(
  state: ChatBotVoiceSetupState | null | undefined,
): GuardrailsForm {
  const g = state?.guardrails;
  return {
    silenceHangupSeconds: String(g?.silenceHangupSeconds ?? 20),
    ringTimeoutSeconds: String(g?.ringTimeoutSeconds ?? 30),
    maxDailyOutboundCalls: String(g?.maxDailyOutboundCalls ?? 25),
    maxAttemptsPerLead: String(g?.maxAttemptsPerLead ?? 2),
    outboundCooldownHours: String(g?.outboundCooldownHours ?? 24),
  };
}

function validateField(value: string, min: number, max: number): string | null {
  const num = Number.parseInt(value, 10);
  if (!Number.isInteger(num) || num < min || num > max) {
    return `Must be between ${min} and ${max}.`;
  }
  return null;
}

// ─── Sub-components ────────────────────────────────────────────

function FieldRow({
  label,
  description,
  value,
  error,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <p className="text-[10px] leading-4 text-v2-ink-muted dark:text-v2-ink-subtle">
        {description}
      </p>
      <Input
        type="number"
        className="h-8 w-full text-[11px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {error && (
        <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────

export function VoiceGuardrailsCard({
  voiceSetupState,
}: VoiceGuardrailsCardProps) {
  const updateGuardrails = useUpdateVoiceGuardrails();

  const [form, setForm] = useState<GuardrailsForm>(() =>
    buildForm(voiceSetupState),
  );

  useEffect(() => {
    setForm(buildForm(voiceSetupState));
  }, [voiceSetupState]);

  const savedForm = useMemo(
    () => buildForm(voiceSetupState),
    [voiceSetupState],
  );
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string | null> = {};
    for (const f of FIELDS) {
      errors[f.key] = validateField(form[f.key], f.min, f.max);
    }
    return errors;
  }, [form]);

  const hasErrors = Object.values(fieldErrors).some(Boolean);

  const updateField = (key: keyof GuardrailsForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (hasErrors) return;
    updateGuardrails.mutate({
      silenceHangupSeconds: Number.parseInt(form.silenceHangupSeconds, 10),
      ringTimeoutSeconds: Number.parseInt(form.ringTimeoutSeconds, 10),
      maxDailyOutboundCalls: Number.parseInt(form.maxDailyOutboundCalls, 10),
      maxAttemptsPerLead: Number.parseInt(form.maxAttemptsPerLead, 10),
      outboundCooldownHours: Number.parseInt(form.outboundCooldownHours, 10),
    });
  };

  return (
    <div className="rounded-xl border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
            Outbound Guardrails
          </p>
          <p className="mt-1 text-[10px] leading-5 text-v2-ink-muted dark:text-v2-ink-subtle">
            Limits on outbound calling to protect lead relationships and manage
            costs.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FIELDS.map((f) => (
          <FieldRow
            key={f.key}
            label={f.label}
            description={f.description}
            value={form[f.key]}
            error={fieldErrors[f.key]}
            onChange={(v) => updateField(f.key, v)}
            disabled={updateGuardrails.isPending}
          />
        ))}
      </div>

      {isDirty && (
        <div className="mt-3 flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
          <Button
            size="sm"
            className="h-7 text-[10px]"
            disabled={updateGuardrails.isPending || hasErrors}
            onClick={handleSave}
          >
            {updateGuardrails.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Check className="mr-1 h-3 w-3" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
