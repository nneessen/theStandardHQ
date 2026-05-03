import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface PricingSectionProps {
  data: Pick<PromptWizardFormData, "pricingStrategy" | "pricingCustomScript">;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

const STRATEGY_OPTIONS: {
  value: PromptWizardFormData["pricingStrategy"];
  label: string;
  description: string;
}[] = [
  {
    value: "bridge_to_appointment",
    label: "Bridge to appointment",
    description:
      "Explain that rates are personalized and offer to schedule a call with you for exact numbers.",
  },
  {
    value: "provide_ranges",
    label: "Provide general ranges",
    description:
      "Give ballpark ranges but still recommend a personalized call.",
  },
  {
    value: "decline",
    label: "Decline to discuss",
    description: "Politely redirect all pricing questions.",
  },
];

export function PricingSection({ data, onChange }: PricingSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        When a caller asks about prices, how should the agent respond?
      </p>

      <RadioGroup
        value={data.pricingStrategy}
        onValueChange={(v) =>
          onChange({
            pricingStrategy: v as PromptWizardFormData["pricingStrategy"],
          })
        }
        className="space-y-2"
      >
        {STRATEGY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex items-start gap-2 cursor-pointer rounded-lg border border-v2-ring px-3 py-2.5 dark:border-v2-ring has-[:checked]:border-v2-ink has-[:checked]:bg-v2-canvas dark:has-[:checked]:border-v2-ring-strong dark:has-[:checked]:bg-v2-card-tinted"
          >
            <RadioGroupItem
              value={opt.value}
              className="mt-0.5 flex-shrink-0"
            />
            <div>
              <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted">
                {opt.label}
                {opt.value === "bridge_to_appointment" && (
                  <span className="ml-1.5 text-[10px] font-normal text-success">
                    recommended
                  </span>
                )}
              </span>
              <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                {opt.description}
              </p>
            </div>
          </label>
        ))}
      </RadioGroup>

      <div className="space-y-1">
        <Label htmlFor="wiz-pricing-custom" className="text-[11px]">
          Custom pricing language (optional)
        </Label>
        <Textarea
          id="wiz-pricing-custom"
          value={data.pricingCustomScript}
          onChange={(e) => onChange({ pricingCustomScript: e.target.value })}
          placeholder={
            'e.g., "The good news is it only takes a few minutes to get your exact numbers. What day works best?"'
          }
          className="min-h-[60px] text-xs"
        />
      </div>
    </div>
  );
}
