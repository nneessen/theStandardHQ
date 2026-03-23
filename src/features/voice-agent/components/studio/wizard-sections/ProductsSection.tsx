import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_PRESETS } from "../../../lib/prompt-wizard-presets";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface ProductsSectionProps {
  data: Pick<PromptWizardFormData, "products" | "productCustomKnowledge">;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

export function ProductsSection({ data, onChange }: ProductsSectionProps) {
  const toggleProduct = (key: string, checked: boolean) => {
    const next = checked
      ? [...data.products, key]
      : data.products.filter((k) => k !== key);
    onChange({ products: next });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
        Your agent will discuss these in general, educational terms — it won't
        quote prices or give specific advice.
      </p>

      <div className="space-y-2">
        {PRODUCT_PRESETS.map((preset) => (
          <label
            key={preset.key}
            className="flex items-start gap-2 cursor-pointer"
          >
            <Checkbox
              checked={data.products.includes(preset.key)}
              onCheckedChange={(checked) =>
                toggleProduct(preset.key, checked === true)
              }
              className="mt-0.5"
            />
            <div>
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                {preset.label}
              </span>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {preset.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="wiz-product-custom" className="text-[11px]">
          Any other products or custom knowledge? (optional)
        </Label>
        <Textarea
          id="wiz-product-custom"
          value={data.productCustomKnowledge}
          onChange={(e) => onChange({ productCustomKnowledge: e.target.value })}
          placeholder='e.g., "We also sell pet insurance and commercial liability coverage"'
          className="min-h-[60px] text-xs"
        />
      </div>
    </div>
  );
}
