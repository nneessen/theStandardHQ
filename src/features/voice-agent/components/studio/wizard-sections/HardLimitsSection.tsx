import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HARD_LIMIT_PRESETS } from "../../../lib/prompt-wizard-presets";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface HardLimitsSectionProps {
  data: Pick<PromptWizardFormData, "hardLimits" | "hardLimitsCustom">;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

export function HardLimitsSection({ data, onChange }: HardLimitsSectionProps) {
  const toggleLimit = (key: string, checked: boolean) => {
    const next = checked
      ? [...data.hardLimits, key]
      : data.hardLimits.filter((k) => k !== key);
    onChange({ hardLimits: next });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
        These are compliance guardrails. We strongly recommend keeping all
        defaults checked.
      </p>

      <div className="space-y-2">
        {HARD_LIMIT_PRESETS.map((preset) => (
          <label
            key={preset.key}
            className="flex items-start gap-2 cursor-pointer"
          >
            <Checkbox
              checked={data.hardLimits.includes(preset.key)}
              onCheckedChange={(checked) =>
                toggleLimit(preset.key, checked === true)
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
        <Label htmlFor="wiz-limits-custom" className="text-[11px]">
          Any other rules? (optional)
        </Label>
        <Textarea
          id="wiz-limits-custom"
          value={data.hardLimitsCustom}
          onChange={(e) => onChange({ hardLimitsCustom: e.target.value })}
          placeholder="e.g., Never discuss specific carrier names unless the caller mentions them first"
          className="min-h-[60px] text-xs"
        />
      </div>
    </div>
  );
}
