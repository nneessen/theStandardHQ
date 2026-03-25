import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Check, Loader2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  LeadStatusSelector,
  LeadSourceSelector,
  useChatBotCloseLeadSources,
  useChatBotCloseCustomFields,
  useUpdateVoiceInboundRules,
  useUpdateVoiceOutboundRules,
  type ChatBotCloseLeadStatus,
  type ChatBotVoiceSetupState,
} from "@/features/chat-bot";

// ─── Types ─────────────────────────────────────────────────────

type OutboundMode = "disabled" | "status_based" | "custom_field_queue";

interface InboundForm {
  allowedLeadStatuses: string[];
}

interface OutboundForm {
  enabled: boolean;
  mode: OutboundMode;
  customFieldKey: string;
  allowedLeadStatuses: string[];
  allowedLeadSources: string[];
}

interface VoiceCallRulesCardProps {
  voiceSetupState: ChatBotVoiceSetupState | null | undefined;
  closeLeadStatuses: ChatBotCloseLeadStatus[] | null | undefined;
  closeConnected: boolean;
  closeLeadStatusesLoading: boolean;
}

// ─── Sub-components ────────────────────────────────────────────

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

function SaveButton({
  dirty,
  pending,
  disabled,
  onClick,
}: {
  dirty: boolean;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <Button
        size="sm"
        className="h-7 text-[10px]"
        disabled={pending || disabled}
        onClick={onClick}
      >
        {pending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Check className="mr-1 h-3 w-3" />
        )}
        Save Changes
      </Button>
    </div>
  );
}

// ─── Form builders ─────────────────────────────────────────────

function buildInboundForm(
  state: ChatBotVoiceSetupState | null | undefined,
): InboundForm {
  return {
    allowedLeadStatuses: state?.rules?.inbound?.allowedLeadStatuses ?? [],
  };
}

function buildOutboundForm(
  state: ChatBotVoiceSetupState | null | undefined,
): OutboundForm {
  const outbound = state?.rules?.outbound;
  return {
    enabled: outbound?.enabled ?? false,
    mode: outbound?.mode ?? "disabled",
    customFieldKey: outbound?.customFieldKey ?? "",
    allowedLeadStatuses: outbound?.allowedLeadStatuses ?? [],
    allowedLeadSources: outbound?.allowedLeadSources ?? [],
  };
}

// ─── Component ─────────────────────────────────────────────────

export function VoiceCallRulesCard({
  voiceSetupState,
  closeLeadStatuses,
  closeConnected,
  closeLeadStatusesLoading,
}: VoiceCallRulesCardProps) {
  const updateInbound = useUpdateVoiceInboundRules();
  const updateOutbound = useUpdateVoiceOutboundRules();

  const { data: leadSources } = useChatBotCloseLeadSources(closeConnected);
  const { data: customFields } = useChatBotCloseCustomFields(closeConnected);

  // ── Inbound form state ──
  const [inbound, setInbound] = useState<InboundForm>(() =>
    buildInboundForm(voiceSetupState),
  );
  useEffect(() => {
    setInbound(buildInboundForm(voiceSetupState));
  }, [voiceSetupState]);

  const savedInbound = useMemo(
    () => buildInboundForm(voiceSetupState),
    [voiceSetupState],
  );
  const inboundDirty = JSON.stringify(inbound) !== JSON.stringify(savedInbound);

  const handleSaveInbound = () => {
    updateInbound.mutate({
      allowedLeadStatuses: inbound.allowedLeadStatuses,
    });
  };

  // ── Outbound form state ──
  const [outbound, setOutbound] = useState<OutboundForm>(() =>
    buildOutboundForm(voiceSetupState),
  );
  useEffect(() => {
    setOutbound(buildOutboundForm(voiceSetupState));
  }, [voiceSetupState]);

  const savedOutbound = useMemo(
    () => buildOutboundForm(voiceSetupState),
    [voiceSetupState],
  );
  const outboundDirty =
    JSON.stringify(outbound) !== JSON.stringify(savedOutbound);

  const outboundErrors = useMemo(() => {
    const errors: string[] = [];
    if (
      outbound.mode === "custom_field_queue" &&
      !outbound.customFieldKey.trim()
    ) {
      errors.push("Custom field key is required for queue mode.");
    }
    return errors;
  }, [outbound.mode, outbound.customFieldKey]);

  const handleSaveOutbound = () => {
    if (outboundErrors.length > 0) return;
    updateOutbound.mutate({
      enabled: outbound.enabled,
      mode: outbound.mode,
      customFieldKey: outbound.customFieldKey.trim() || null,
      allowedLeadStatuses: outbound.allowedLeadStatuses,
      allowedLeadSources: outbound.allowedLeadSources,
    });
  };

  const updateOutboundField = <K extends keyof OutboundForm>(
    key: K,
    value: OutboundForm[K],
  ) => {
    setOutbound((prev) => ({ ...prev, [key]: value }));
  };

  // Derive lead source option strings for the selector
  const leadSourceOptions = useMemo(
    () => leadSources?.map((s) => s.label) ?? null,
    [leadSources],
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
        Call Rules
      </p>
      <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
        Control which leads the voice agent can call and receive calls from.
        Empty status lists mean all leads are allowed.
      </p>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {/* ── Inbound Rules ── */}
        <Section
          icon={<PhoneIncoming className="h-4 w-4" />}
          title="Inbound Call Filtering"
          description="Which lead statuses should the agent answer calls for? Leave empty to accept all."
        >
          <LeadStatusSelector
            options={closeLeadStatuses}
            selected={inbound.allowedLeadStatuses}
            onChange={(statuses) =>
              setInbound((prev) => ({
                ...prev,
                allowedLeadStatuses: statuses,
              }))
            }
            disabled={updateInbound.isPending || closeLeadStatusesLoading}
          />
          <SaveButton
            dirty={inboundDirty}
            pending={updateInbound.isPending}
            onClick={handleSaveInbound}
          />
        </Section>

        {/* ── Outbound Rules ── */}
        <Section
          icon={<PhoneOutgoing className="h-4 w-4" />}
          title="Outbound Call Filtering"
          description="Which leads should receive outbound calls from the agent?"
        >
          <div className="space-y-3">
            {/* Outbound enabled toggle */}
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
              <div className="pr-4">
                <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Outbound calling
                </p>
                <p className="text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                  Allow the agent to place outbound calls.
                </p>
              </div>
              <Switch
                checked={outbound.enabled}
                onCheckedChange={(checked) => {
                  updateOutboundField("enabled", checked);
                  if (!checked) updateOutboundField("mode", "disabled");
                }}
              />
            </div>

            {/* Outbound mode */}
            {outbound.enabled && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Outbound Mode</Label>
                  <Select
                    value={outbound.mode}
                    onValueChange={(v) =>
                      updateOutboundField("mode", v as OutboundMode)
                    }
                  >
                    <SelectTrigger className="h-8 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status_based">Status Based</SelectItem>
                      <SelectItem value="custom_field_queue">
                        Custom Field Queue
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom field key selector */}
                {outbound.mode === "custom_field_queue" && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Custom Field</Label>
                    <Select
                      value={outbound.customFieldKey}
                      onValueChange={(v) =>
                        updateOutboundField("customFieldKey", v)
                      }
                    >
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue placeholder="Select a custom field" />
                      </SelectTrigger>
                      <SelectContent>
                        {customFields?.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.name}
                          </SelectItem>
                        ))}
                        {(!customFields || customFields.length === 0) && (
                          <SelectItem value="" disabled>
                            No custom fields found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Outbound lead statuses */}
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Allowed Lead Statuses</Label>
                  <LeadStatusSelector
                    options={closeLeadStatuses}
                    selected={outbound.allowedLeadStatuses}
                    onChange={(statuses) =>
                      updateOutboundField("allowedLeadStatuses", statuses)
                    }
                    disabled={
                      updateOutbound.isPending || closeLeadStatusesLoading
                    }
                  />
                </div>

                {/* Outbound lead sources */}
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Allowed Lead Sources</Label>
                  <LeadSourceSelector
                    selected={outbound.allowedLeadSources}
                    onChange={(sources) =>
                      updateOutboundField("allowedLeadSources", sources)
                    }
                    disabled={updateOutbound.isPending}
                    options={leadSourceOptions}
                  />
                </div>
              </>
            )}

            {/* Outbound validation errors */}
            {outboundErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                {outboundErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}

            <SaveButton
              dirty={outboundDirty}
              pending={updateOutbound.isPending}
              disabled={outboundErrors.length > 0}
              onClick={handleSaveOutbound}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
