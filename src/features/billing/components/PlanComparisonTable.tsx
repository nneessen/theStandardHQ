// src/features/billing/components/PlanComparisonTable.tsx
// Displays a comparison table of all subscription plans

import React, { useMemo, useState } from "react";
import { Check, X, Layers, ChevronRight } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSubscriptionPlans, useSubscription } from "@/hooks/subscription";
import { cn } from "@/lib/utils";
import {
  FEATURE_CATEGORIES,
  getFeaturesByCategory,
  type FeatureCategory,
  type FeatureDefinition,
} from "@/constants/features";

// Utility function for formatting price
const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

// Features to exclude from display (universal to all plans)
const EXCLUDED_FEATURES = new Set(["settings"]);

// Features that show email limit
const EMAIL_LIMIT_FEATURES = new Set(["email"]);

// Category display order
const CATEGORY_ORDER: FeatureCategory[] = [
  "core",
  "tracking",
  "reports",
  "team",
  "messaging",
  "branding",
];

// Analytics sections available by tier (3-tier system)
const analyticsCountByTier: Record<string, number> = {
  free: 3,
  pro: 9,
  team: 9,
};

interface FeatureGroup {
  category: FeatureCategory;
  label: string;
  features: FeatureDefinition[];
}

export function PlanComparisonTable() {
  const { plans, isLoading } = useSubscriptionPlans();
  const { subscription } = useSubscription();

  const currentPlanName = subscription?.plan?.name || "free";
  const [isOpen, setIsOpen] = useState(false);

  // Build feature groups dynamically from registry
  const featureGroups = useMemo<FeatureGroup[]>(() => {
    const byCategory = getFeaturesByCategory();

    return CATEGORY_ORDER.map((category) => ({
      category,
      label: FEATURE_CATEGORIES[category].label,
      features: byCategory[category].filter(
        (f) => !EXCLUDED_FEATURES.has(f.key),
      ),
    })).filter((group) => group.features.length > 0);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-v2-ring rounded w-1/4" />
          <div className="h-40 bg-v2-ring rounded" />
        </div>
      </div>
    );
  }

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
        {/* Collapsible Trigger Header */}
        <Collapsible.Trigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2 hover:bg-v2-canvas transition-colors rounded-lg">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-v2-ink-subtle" />
              <span className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                Compare All Features
              </span>
            </div>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-v2-ink-subtle transition-transform duration-200",
                isOpen && "rotate-90",
              )}
            />
          </button>
        </Collapsible.Trigger>

        {/* Collapsible Content */}
        <Collapsible.Content>
          <div className="border-t border-v2-ring/60">
            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-v2-canvas hover:bg-v2-canvas">
                    <TableHead className="text-[11px] font-semibold w-40">
                      Feature
                    </TableHead>
                    {plans.map((plan) => (
                      <TableHead
                        key={plan.id}
                        className={cn(
                          "text-[11px] font-semibold text-center min-w-[80px]",
                          plan.name === currentPlanName && "bg-v2-ring",
                        )}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {plan.name === currentPlanName && (
                            <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                              CURRENT
                            </span>
                          )}
                          <span>{plan.display_name}</span>
                          <span className="text-[10px] font-normal text-v2-ink-muted">
                            {plan.price_monthly === 0
                              ? "Free"
                              : `${formatPrice(plan.price_monthly)}/mo`}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {/* Analytics Row */}
                  <TableRow className="bg-v2-canvas dark:bg-v2-ring/30">
                    <TableCell className="text-[11px] font-medium text-v2-ink-muted">
                      Analytics Sections
                    </TableCell>
                    {plans.map((plan) => (
                      <TableCell
                        key={`analytics-${plan.id}`}
                        className={cn(
                          "text-[11px] text-center font-medium",
                          plan.name === currentPlanName &&
                            "bg-v2-ring/50 dark:bg-v2-ring/50",
                        )}
                      >
                        {analyticsCountByTier[plan.name] || 0}/9
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* UW Wizard Row */}
                  <TableRow>
                    <TableCell className="text-[11px] font-medium text-v2-ink-muted">
                      UW Wizard (built-in)
                    </TableCell>
                    {plans.map((plan) => (
                      <TableCell
                        key={`uw-wizard-${plan.id}`}
                        className={cn(
                          "text-center",
                          plan.name === currentPlanName &&
                            "bg-v2-ring/50 dark:bg-v2-ring/50",
                        )}
                      >
                        {plan.name === "team" ? (
                          <div className="flex flex-col items-center">
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[9px] text-v2-ink-muted">
                              500 runs/mo
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <X className="h-3.5 w-3.5 text-v2-ink-subtle" />
                            <span className="text-[9px] text-v2-ink-subtle">
                              Add-on
                            </span>
                          </div>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Agent Seats Row */}
                  <TableRow>
                    <TableCell className="text-[11px] font-medium text-v2-ink-muted">
                      Agent Seats (UW Wizard)
                    </TableCell>
                    {plans.map((plan) => (
                      <TableCell
                        key={`agent-seats-${plan.id}`}
                        className={cn(
                          "text-center",
                          plan.name === currentPlanName &&
                            "bg-v2-ring/50 dark:bg-v2-ring/50",
                        )}
                      >
                        {plan.name === "team" ? (
                          <div className="flex flex-col items-center">
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[9px] text-v2-ink-muted">
                              5 included
                            </span>
                          </div>
                        ) : (
                          <X className="h-3.5 w-3.5 text-v2-ink-subtle mx-auto" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Feature Groups */}
                  {featureGroups.map((group) => (
                    <React.Fragment key={group.category}>
                      {/* Group Header */}
                      <TableRow className="bg-v2-ring/50 dark:bg-v2-ring/50 hover:bg-v2-ring/50 dark:hover:bg-v2-ring/50">
                        <TableCell
                          colSpan={plans.length + 1}
                          className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wide py-1"
                        >
                          {group.label}
                        </TableCell>
                      </TableRow>

                      {/* Features */}
                      {group.features.map((feature) => (
                        <TableRow key={feature.key}>
                          <TableCell className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                            {feature.displayName}
                          </TableCell>
                          {plans.map((plan) => {
                            const hasFeature =
                              plan.features[
                                feature.key as keyof typeof plan.features
                              ];
                            const emailLimit =
                              EMAIL_LIMIT_FEATURES.has(feature.key) &&
                              plan.email_limit > 0
                                ? plan.email_limit
                                : null;

                            return (
                              <TableCell
                                key={`${feature.key}-${plan.id}`}
                                className={cn(
                                  "text-center",
                                  plan.name === currentPlanName &&
                                    "bg-v2-ring/50 dark:bg-v2-ring/50",
                                )}
                              >
                                {hasFeature ? (
                                  <div className="flex flex-col items-center">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    {emailLimit && (
                                      <span className="text-[9px] text-v2-ink-muted">
                                        {emailLimit}/mo
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <X className="h-3.5 w-3.5 text-v2-ink-subtle mx-auto" />
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 bg-v2-canvas border-t border-v2-ring/60">
              <p className="text-[10px] text-v2-ink-muted">
                Training Hub and Admin access are role-based, not tier-based.
                Annual billing saves ~17%.
              </p>
            </div>
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}
