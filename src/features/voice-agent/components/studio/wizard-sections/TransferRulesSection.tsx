import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TRANSFER_TRIGGER_PRESETS } from "../../../lib/prompt-wizard-presets";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface TransferRulesSectionProps {
  data: Pick<PromptWizardFormData, "transferTriggers" | "transferCustom">;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

export function TransferRulesSection({
  data,
  onChange,
}: TransferRulesSectionProps) {
  const toggleTrigger = (key: string, checked: boolean) => {
    const next = checked
      ? [...data.transferTriggers, key]
      : data.transferTriggers.filter((k) => k !== key);
    onChange({ transferTriggers: next });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
        When any of these happen, the agent will attempt to transfer the call to
        your transfer number (configured in the Voice & Greeting tab).
      </p>

      <div className="space-y-2">
        {TRANSFER_TRIGGER_PRESETS.map((preset) => (
          <label
            key={preset.key}
            className="flex items-start gap-2 cursor-pointer"
          >
            <Checkbox
              checked={data.transferTriggers.includes(preset.key)}
              onCheckedChange={(checked) =>
                toggleTrigger(preset.key, checked === true)
              }
              className="mt-0.5"
            />
            <span className="text-[11px] leading-5 text-zinc-700 dark:text-zinc-300">
              {preset.label}
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="wiz-transfer-custom" className="text-[11px]">
          Any other transfer rules? (optional)
        </Label>
        <Textarea
          id="wiz-transfer-custom"
          value={data.transferCustom}
          onChange={(e) => onChange({ transferCustom: e.target.value })}
          placeholder="e.g., Transfer if the caller mentions they already have an appointment scheduled"
          className="min-h-[60px] text-xs"
        />
      </div>
    </div>
  );
}
