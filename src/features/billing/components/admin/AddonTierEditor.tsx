// src/features/billing/components/admin/AddonTierEditor.tsx
// Compact table-based tier editor for add-on configuration

import { Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PREMIUM_VOICE_ADDON_NAME } from "@/lib/subscription/voice-addon";

export interface AddonTier {
  id: string;
  name: string;
  runs_per_month: number;
  included_minutes?: number;
  hard_limit_minutes?: number;
  plan_code?: string;
  allow_overage?: boolean;
  overage_rate_cents?: number | null;
  features?: {
    missedAppointment?: boolean;
    reschedule?: boolean;
    quotedFollowup?: boolean;
    afterHoursInbound?: boolean;
  };
  price_monthly: number;
  price_annual: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_annual?: string;
}

export interface TierConfig {
  tiers: AddonTier[];
}

interface AddonTierEditorProps {
  addonName?: string;
  tierConfig: TierConfig | null;
  onChange: (config: TierConfig) => void;
}

const DEFAULT_TIER: AddonTier = {
  id: "",
  name: "",
  runs_per_month: 100,
  price_monthly: 999,
  price_annual: 9590,
};

export function AddonTierEditor({
  addonName,
  tierConfig,
  onChange,
}: AddonTierEditorProps) {
  const tiers = tierConfig?.tiers || [];
  const usageLabel =
    addonName === PREMIUM_VOICE_ADDON_NAME ? "Minutes/mo" : "Runs/mo";

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const update = (
    index: number,
    field: keyof AddonTier,
    value: string | number,
  ) => {
    const next = [...tiers];
    next[index] = { ...next[index], [field]: value };
    onChange({ tiers: next });
  };

  const addTier = () => {
    const defaultTier =
      addonName === PREMIUM_VOICE_ADDON_NAME
        ? { ...DEFAULT_TIER, runs_per_month: 500 }
        : DEFAULT_TIER;

    onChange({
      tiers: [
        ...tiers,
        {
          ...defaultTier,
          id: `tier_${Date.now()}`,
          name: `Tier ${tiers.length + 1}`,
        },
      ],
    });
  };

  const removeTier = (index: number) => {
    onChange({ tiers: tiers.filter((_, i) => i !== index) });
  };

  if (tiers.length === 0) {
    return (
      <div className="text-center py-4 bg-muted/50 rounded border border-dashed">
        <p className="text-xs text-muted-foreground mb-2">
          No tiers configured.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={addTier}
          className="text-xs h-7"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add First Tier
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-medium">Usage Tiers</span>
        </div>
        <Badge variant="outline" className="text-[9px]">
          {tiers.length} tier{tiers.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Compact tier table */}
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/60 text-[10px] text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium w-[100px]">
                ID
              </th>
              <th className="px-2 py-1.5 text-left font-medium w-[100px]">
                Name
              </th>
              <th className="px-2 py-1.5 text-left font-medium w-[70px]">
                {usageLabel}
              </th>
              <th className="px-2 py-1.5 text-left font-medium w-[90px]">
                Monthly
              </th>
              <th className="px-2 py-1.5 text-left font-medium w-[90px]">
                Annual
              </th>
              <th className="px-2 py-1.5 text-left font-medium">
                Stripe Monthly ID
              </th>
              <th className="px-2 py-1.5 text-left font-medium">
                Stripe Annual ID
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => (
              <tr key={tier.id || i} className="border-t hover:bg-muted/20">
                <td className="px-1.5 py-1">
                  <Input
                    value={tier.id}
                    onChange={(e) =>
                      update(
                        i,
                        "id",
                        e.target.value.toLowerCase().replace(/\s+/g, "_"),
                      )
                    }
                    className="h-7 text-[11px] font-mono px-1.5"
                    placeholder="starter"
                  />
                </td>
                <td className="px-1.5 py-1">
                  <Input
                    value={tier.name}
                    onChange={(e) => update(i, "name", e.target.value)}
                    className="h-7 text-[11px] px-1.5"
                    placeholder="Starter"
                  />
                </td>
                <td className="px-1.5 py-1">
                  <Input
                    type="number"
                    value={tier.runs_per_month}
                    onChange={(e) =>
                      update(i, "runs_per_month", parseInt(e.target.value) || 0)
                    }
                    className="h-7 text-[11px] px-1.5"
                    min={0}
                  />
                </td>
                <td className="px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={tier.price_monthly}
                      onChange={(e) =>
                        update(
                          i,
                          "price_monthly",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="h-7 text-[11px] px-1.5 w-[60px]"
                      min={0}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {fmt(tier.price_monthly)}
                    </span>
                  </div>
                </td>
                <td className="px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={tier.price_annual}
                      onChange={(e) =>
                        update(i, "price_annual", parseInt(e.target.value) || 0)
                      }
                      className="h-7 text-[11px] px-1.5 w-[60px]"
                      min={0}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {fmt(tier.price_annual)}
                    </span>
                  </div>
                </td>
                <td className="px-1.5 py-1">
                  <Input
                    value={tier.stripe_price_id_monthly || ""}
                    onChange={(e) =>
                      update(i, "stripe_price_id_monthly", e.target.value)
                    }
                    className="h-7 text-[11px] font-mono px-1.5"
                    placeholder="price_..."
                  />
                </td>
                <td className="px-1.5 py-1">
                  <Input
                    value={tier.stripe_price_id_annual || ""}
                    onChange={(e) =>
                      update(i, "stripe_price_id_annual", e.target.value)
                    }
                    className="h-7 text-[11px] font-mono px-1.5"
                    placeholder="price_..."
                  />
                </td>
                <td className="px-1 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeTier(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addTier}
        className="w-full text-xs h-7 border-dashed"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Tier
      </Button>
    </div>
  );
}
