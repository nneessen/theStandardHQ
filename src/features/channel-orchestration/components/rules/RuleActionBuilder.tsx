// src/features/channel-orchestration/components/rules/RuleActionBuilder.tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  RuleAction,
  ChannelType,
  EscalationConfig,
} from "../../types/orchestration.types";

interface Props {
  action: RuleAction;
  onChange: (action: RuleAction) => void;
}

export function RuleActionBuilder({ action, onChange }: Props) {
  const update = (patch: Partial<RuleAction>) =>
    onChange({ ...action, ...patch });

  const toggleChannel = (channel: ChannelType) => {
    const current = action.allowedChannels;
    const next = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    // Must have at least one channel
    if (next.length === 0) return;
    const patch: Partial<RuleAction> = { allowedChannels: next };
    // Fix preferred if removed
    if (action.preferredChannel && !next.includes(action.preferredChannel)) {
      patch.preferredChannel = next[0];
    }
    // Clear escalation when only one channel (nothing to escalate to)
    if (next.length === 1) {
      patch.escalateAfter = undefined;
    }
    update(patch);
  };

  return (
    <div className="space-y-2">
      {/* Allowed Channels */}
      <div>
        <Label className="text-[10px] text-muted-foreground">
          Allowed Channels
        </Label>
        <p className="text-[9px] text-muted-foreground mb-0.5">
          Which channels can be used when this rule matches. At least one
          required.
        </p>
        <div className="flex gap-2 mt-0.5">
          {(["sms", "voice"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium rounded border transition-colors",
                action.allowedChannels.includes(ch)
                  ? "bg-info/10 dark:bg-info/30 border-info/40 text-info"
                  : "border-border dark:border-border text-muted-foreground",
              )}
            >
              {ch === "sms" ? "SMS" : "Voice"}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Channel */}
      {action.allowedChannels.length > 1 && (
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Preferred Channel
          </Label>
          <p className="text-[9px] text-muted-foreground mb-0.5">
            When both channels are allowed, which one should be tried first.
          </p>
          <div className="flex gap-2 mt-0.5">
            {action.allowedChannels.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => update({ preferredChannel: ch })}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded border transition-colors",
                  action.preferredChannel === ch
                    ? "bg-success/10 dark:bg-success/30 border-success/40 text-success"
                    : "border-border dark:border-border text-muted-foreground",
                )}
              >
                {ch === "sms" ? "SMS" : "Voice"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cooldown */}
      <div>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground w-24 shrink-0">
            Cooldown (min)
          </Label>
          <span className="text-[9px] text-muted-foreground">
            Minimum wait between outreach attempts. Leave empty for no cooldown.
          </span>
        </div>
        <Input
          type="number"
          min={0}
          max={10080}
          value={action.cooldownMinutes ?? ""}
          onChange={(e) =>
            update({
              cooldownMinutes: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="h-7 text-[10px] w-20"
          placeholder="None"
        />
        <span className="text-[9px] text-muted-foreground">
          0–10080 (7 days)
        </span>
      </div>

      {/* Escalation — only when both channels are allowed */}
      {action.allowedChannels.length > 1 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-[10px] text-muted-foreground">
              Escalation
            </Label>
            <Switch
              checked={!!action.escalateAfter}
              onCheckedChange={(checked) =>
                update({
                  escalateAfter: checked
                    ? {
                        channel: action.allowedChannels[0] ?? "sms",
                        attempts: 2,
                        escalateTo:
                          action.allowedChannels[0] === "sms" ? "voice" : "sms",
                      }
                    : undefined,
                })
              }
              className="h-4 w-7"
            />
          </div>
          <p className="text-[9px] text-muted-foreground mb-1">
            Automatically switch to another channel after repeated failures.
            E.g., after 2 failed SMS → try Voice.
          </p>
          {action.escalateAfter && (
            <EscalationEditor
              escalation={action.escalateAfter}
              onChange={(escalateAfter) => update({ escalateAfter })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function EscalationEditor({
  escalation,
  onChange,
}: {
  escalation: EscalationConfig;
  onChange: (e: EscalationConfig) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground dark:text-muted-foreground bg-background dark:bg-card-tinted/50 rounded p-1.5">
      <span>After</span>
      <Input
        type="number"
        min={1}
        max={20}
        value={escalation.attempts}
        onChange={(e) =>
          onChange({ ...escalation, attempts: Number(e.target.value) })
        }
        className="h-6 text-[10px] w-12"
      />
      <span>failed</span>
      <Select
        value={escalation.channel}
        onValueChange={(ch) =>
          onChange({ ...escalation, channel: ch as ChannelType })
        }
      >
        <SelectTrigger className="h-6 text-[10px] w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sms" className="text-[10px]">
            SMS
          </SelectItem>
          <SelectItem value="voice" className="text-[10px]">
            Voice
          </SelectItem>
        </SelectContent>
      </Select>
      <span>→ escalate to</span>
      <Select
        value={escalation.escalateTo}
        onValueChange={(ch) =>
          onChange({ ...escalation, escalateTo: ch as ChannelType })
        }
      >
        <SelectTrigger className="h-6 text-[10px] w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sms" className="text-[10px]">
            SMS
          </SelectItem>
          <SelectItem value="voice" className="text-[10px]">
            Voice
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
