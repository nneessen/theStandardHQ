import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONE_PRESETS } from "../../../lib/prompt-wizard-presets";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface IdentitySectionProps {
  data: Pick<
    PromptWizardFormData,
    "identityMode" | "agentName" | "agencyName" | "agentRole" | "timezone"
  >;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

export function IdentitySection({ data, onChange }: IdentitySectionProps) {
  const isCloned = data.identityMode === "cloned_voice";

  return (
    <div className="space-y-4">
      {/* Identity mode selection */}
      <div className="space-y-2">
        <Label className="text-[11px]">
          How should your voice agent identify itself on calls?
        </Label>
        <RadioGroup
          value={data.identityMode}
          onValueChange={(v) =>
            onChange({
              identityMode: v as PromptWizardFormData["identityMode"],
            })
          }
          className="space-y-2"
        >
          <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800 has-[:checked]:border-zinc-400 has-[:checked]:bg-zinc-50 dark:has-[:checked]:border-zinc-600 dark:has-[:checked]:bg-zinc-900/40">
            <RadioGroupItem
              value="cloned_voice"
              className="mt-0.5 flex-shrink-0"
            />
            <div>
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                It IS me — I cloned my voice
              </span>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                The AI speaks as you. Callers believe they are talking directly
                to you. It uses your name, says "I" and "my", and never reveals
                it's AI.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800 has-[:checked]:border-zinc-400 has-[:checked]:bg-zinc-50 dark:has-[:checked]:border-zinc-600 dark:has-[:checked]:bg-zinc-900/40">
            <RadioGroupItem
              value="assistant"
              className="mt-0.5 flex-shrink-0"
            />
            <div>
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                It's an assistant — using a stock voice
              </span>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                The AI acts as a named assistant at your agency. It can refer
                callers to you by name when they need to speak with a person.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="wiz-agent-name" className="text-[11px]">
            {isCloned ? "Your name" : "Agent name"}
          </Label>
          <Input
            id="wiz-agent-name"
            value={data.agentName}
            onChange={(e) => onChange({ agentName: e.target.value })}
            placeholder={isCloned ? "e.g., Nick" : "e.g., Sarah"}
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {isCloned
              ? "The name callers will hear. This should be your real name."
              : "The name your voice agent will use on calls."}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wiz-agency-name" className="text-[11px]">
            Agency / company name
          </Label>
          <Input
            id="wiz-agency-name"
            value={data.agencyName}
            onChange={(e) => onChange({ agencyName: e.target.value })}
            placeholder="e.g., ABC Insurance Group"
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Your company or agency name.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!isCloned && (
          <div className="space-y-1">
            <Label htmlFor="wiz-agent-role" className="text-[11px]">
              Assistant's role
            </Label>
            <Input
              id="wiz-agent-role"
              value={data.agentRole}
              onChange={(e) => onChange({ agentRole: e.target.value })}
              placeholder="e.g., friendly insurance office assistant"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              A short description of what this assistant does.
            </p>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="wiz-timezone" className="text-[11px]">
            Business timezone
          </Label>
          <Select
            value={data.timezone}
            onValueChange={(v) => onChange({ timezone: v })}
          >
            <SelectTrigger id="wiz-timezone" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_PRESETS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-xs">
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Used for scheduling context on calls.
          </p>
        </div>
      </div>
    </div>
  );
}
