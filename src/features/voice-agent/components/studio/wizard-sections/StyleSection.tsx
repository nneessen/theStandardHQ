import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STYLE_RULE_PRESETS } from "../../../lib/prompt-wizard-presets";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface StyleSectionProps {
  data: Pick<PromptWizardFormData, "styleRules" | "styleCustom">;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

export function StyleSection({ data, onChange }: StyleSectionProps) {
  const toggleRule = (key: string, checked: boolean) => {
    const next = checked
      ? [...data.styleRules, key]
      : data.styleRules.filter((k) => k !== key);
    onChange({ styleRules: next });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {STYLE_RULE_PRESETS.map((preset) => (
          <label
            key={preset.key}
            className="flex items-start gap-2 cursor-pointer"
          >
            <Checkbox
              checked={data.styleRules.includes(preset.key)}
              onCheckedChange={(checked) =>
                toggleRule(preset.key, checked === true)
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
        <Label htmlFor="wiz-style-custom" className="text-[11px]">
          Any other style notes? (optional)
        </Label>
        <Textarea
          id="wiz-style-custom"
          value={data.styleCustom}
          onChange={(e) => onChange({ styleCustom: e.target.value })}
          placeholder={
            'e.g., "Always end calls by asking if there\'s anything else you can help with"'
          }
          className="min-h-[60px] text-xs"
        />
      </div>
    </div>
  );
}
