// src/features/billing/components/admin/FeatureAssignmentMatrix.tsx
// Matrix for assigning features and analytics sections to subscription plans

import { useState, useMemo, useCallback } from "react";
import {
  Loader2,
  Save,
  RotateCcw,
  ChevronDown,
  LayoutDashboard,
  Target,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Palette,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useUpdatePlanFeatures,
  useUpdatePlanAnalytics,
  type SubscriptionPlan,
  type SubscriptionFeatures,
} from "@/hooks/admin";
import {
  ANALYTICS_SECTIONS_REGISTRY,
  FEATURE_CATEGORIES,
  CATEGORY_ACCENT_COLORS,
  CATEGORY_BORDER_COLORS,
  getFeaturesByCategory,
  type FeatureCategory,
  type FeatureDefinition,
} from "@/constants/features";

const CATEGORY_ICONS_RESOLVED: Record<FeatureCategory, LucideIcon> = {
  core: LayoutDashboard,
  tracking: Target,
  reports: FileText,
  team: Users,
  messaging: MessageSquare,
  analytics: BarChart3,
  branding: Palette,
  tools: Wrench,
};

interface FeatureAssignmentMatrixProps {
  plans: SubscriptionPlan[];
}

type ToggleState = "all" | "some" | "none";

export function FeatureAssignmentMatrix({
  plans,
}: FeatureAssignmentMatrixProps) {
  // Local state for pending changes
  const [pendingFeatureChanges, setPendingFeatureChanges] = useState<
    Record<string, SubscriptionFeatures>
  >({});
  const [pendingAnalyticsChanges, setPendingAnalyticsChanges] = useState<
    Record<string, string[]>
  >({});

  // Track which categories are expanded (all start expanded)
  const allCategoryKeys = useMemo(
    () => [...Object.keys(FEATURE_CATEGORIES), "__analytics__"] as string[],
    [],
  );
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(allCategoryKeys),
  );

  const updateFeatures = useUpdatePlanFeatures();
  const updateAnalytics = useUpdatePlanAnalytics();

  const featuresByCategory = useMemo(() => getFeaturesByCategory(), []);
  const analyticsSections = useMemo(
    () => Object.values(ANALYTICS_SECTIONS_REGISTRY),
    [],
  );

  // Get current feature state (pending or original)
  const getFeatureState = useCallback(
    (planId: string, featureKey: string): boolean => {
      if (pendingFeatureChanges[planId]) {
        return (
          pendingFeatureChanges[planId][
            featureKey as keyof SubscriptionFeatures
          ] ?? false
        );
      }
      const plan = plans.find((p) => p.id === planId);
      return plan?.features[featureKey as keyof SubscriptionFeatures] ?? false;
    },
    [plans, pendingFeatureChanges],
  );

  // Get current analytics state (pending or original)
  const getAnalyticsState = useCallback(
    (planId: string, sectionKey: string): boolean => {
      if (pendingAnalyticsChanges[planId]) {
        return pendingAnalyticsChanges[planId].includes(sectionKey);
      }
      const plan = plans.find((p) => p.id === planId);
      return plan?.analytics_sections?.includes(sectionKey) ?? false;
    },
    [plans, pendingAnalyticsChanges],
  );

  // Toggle feature
  const toggleFeature = (planId: string, featureKey: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const currentFeatures = pendingFeatureChanges[planId] || {
      ...plan.features,
    };
    const newFeatures = {
      ...currentFeatures,
      [featureKey]: !currentFeatures[featureKey as keyof SubscriptionFeatures],
    };

    setPendingFeatureChanges((prev) => ({
      ...prev,
      [planId]: newFeatures,
    }));
  };

  // Toggle analytics section
  const toggleAnalytics = (planId: string, sectionKey: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const currentSections = pendingAnalyticsChanges[planId] || [
      ...(plan.analytics_sections || []),
    ];
    const newSections = currentSections.includes(sectionKey)
      ? currentSections.filter((s) => s !== sectionKey)
      : [...currentSections, sectionKey];

    setPendingAnalyticsChanges((prev) => ({
      ...prev,
      [planId]: newSections,
    }));
  };

  // Get toggle state for a category + plan
  const getCategoryToggleState = useCallback(
    (
      _category: FeatureCategory,
      planId: string,
      features: FeatureDefinition[],
    ): ToggleState => {
      if (features.length === 0) return "none";
      const enabledCount = features.filter((f) =>
        getFeatureState(planId, f.key),
      ).length;
      if (enabledCount === 0) return "none";
      if (enabledCount === features.length) return "all";
      return "some";
    },
    [getFeatureState],
  );

  // Toggle all features in a category for a plan
  const toggleAllInCategory = (
    planId: string,
    cat: FeatureCategory,
    features: FeatureDefinition[],
  ) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const state = getCategoryToggleState(cat, planId, features);
    const setTo = state !== "all"; // if all enabled, disable all; otherwise enable all

    const currentFeatures = pendingFeatureChanges[planId] || {
      ...plan.features,
    };
    const newFeatures = { ...currentFeatures };
    for (const f of features) {
      (newFeatures as Record<string, boolean>)[f.key] = setTo;
    }

    setPendingFeatureChanges((prev) => ({
      ...prev,
      [planId]: newFeatures as SubscriptionFeatures,
    }));
  };

  // Get toggle state for analytics + plan
  const getAnalyticsToggleState = useCallback(
    (planId: string): ToggleState => {
      const enabledCount = analyticsSections.filter((s) =>
        getAnalyticsState(planId, s.key),
      ).length;
      if (enabledCount === 0) return "none";
      if (enabledCount === analyticsSections.length) return "all";
      return "some";
    },
    [getAnalyticsState, analyticsSections],
  );

  // Toggle all analytics sections for a plan
  const toggleAllAnalytics = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const state = getAnalyticsToggleState(planId);
    const setTo = state !== "all";

    const newSections = setTo ? analyticsSections.map((s) => s.key) : [];

    setPendingAnalyticsChanges((prev) => ({
      ...prev,
      [planId]: newSections,
    }));
  };

  // Check if there are pending changes for a plan
  const hasPendingChanges = (planId: string): boolean => {
    return !!(pendingFeatureChanges[planId] || pendingAnalyticsChanges[planId]);
  };

  // Save changes for a plan
  const saveChanges = async (planId: string) => {
    const featureChanges = pendingFeatureChanges[planId];
    const analyticsChanges = pendingAnalyticsChanges[planId];

    if (featureChanges) {
      await updateFeatures.mutateAsync({
        planId,
        features: featureChanges,
      });
      setPendingFeatureChanges((prev) => {
        const { [planId]: _, ...rest } = prev;
        return rest;
      });
    }

    if (analyticsChanges) {
      await updateAnalytics.mutateAsync({
        planId,
        analyticsSections: analyticsChanges,
      });
      setPendingAnalyticsChanges((prev) => {
        const { [planId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  // Reset changes for a plan
  const resetChanges = (planId: string) => {
    setPendingFeatureChanges((prev) => {
      const { [planId]: _, ...rest } = prev;
      return rest;
    });
    setPendingAnalyticsChanges((prev) => {
      const { [planId]: _, ...rest } = prev;
      return rest;
    });
  };

  // Save all changes
  const saveAllChanges = async () => {
    for (const planId of Object.keys(pendingFeatureChanges)) {
      await saveChanges(planId);
    }
    for (const planId of Object.keys(pendingAnalyticsChanges)) {
      if (!pendingFeatureChanges[planId]) {
        await saveChanges(planId);
      }
    }
  };

  const hasAnyPendingChanges =
    Object.keys(pendingFeatureChanges).length > 0 ||
    Object.keys(pendingAnalyticsChanges).length > 0;

  const isSaving = updateFeatures.isPending || updateAnalytics.isPending;

  // Expand/Collapse all
  const expandAll = () => setOpenCategories(new Set(allCategoryKeys));
  const collapseAll = () => setOpenCategories(new Set());

  const toggleCategory = (key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Grid template: feature name column + one column per plan
  const gridCols = `minmax(220px, 1fr) ${plans.map(() => "80px").join(" ")}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold">
              Feature & Analytics Configuration
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-zinc-500 px-2"
                onClick={expandAll}
              >
                Expand All
              </Button>
              <span className="text-zinc-300 dark:text-zinc-700 text-[10px]">
                /
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-zinc-500 px-2"
                onClick={collapseAll}
              >
                Collapse All
              </Button>
            </div>
          </div>
          {hasAnyPendingChanges && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] text-amber-600">
                Unsaved changes
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setPendingFeatureChanges({});
                  setPendingAnalyticsChanges({});
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset All
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={saveAllChanges}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          {/* Column Headers */}
          <div
            className="grid items-end border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-1"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="text-xs font-medium text-zinc-500 pr-4">
              Feature / Section
            </div>
            {plans.map((plan) => (
              <div key={plan.id} className="text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                    {plan.display_name}
                  </span>
                  {hasPendingChanges(plan.id) && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => resetChanges(plan.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-emerald-600"
                        onClick={() => saveChanges(plan.id)}
                        disabled={isSaving}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Feature Categories */}
          <div className="space-y-1">
            {(
              Object.entries(featuresByCategory) as [
                FeatureCategory,
                (typeof featuresByCategory)[FeatureCategory],
              ][]
            )
              .filter(([, features]) => features.length > 0)
              .map(([category, features]) => {
                const CategoryIcon = CATEGORY_ICONS_RESOLVED[category];
                const accentColor = CATEGORY_ACCENT_COLORS[category];
                const borderColor = CATEGORY_BORDER_COLORS[category];
                const isOpen = openCategories.has(category);

                return (
                  <Collapsible
                    key={category}
                    open={isOpen}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    {/* Category Header Row */}
                    <div
                      className="grid items-center rounded-md bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 py-2 px-2 text-left w-full group">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${accentColor}`}
                          />
                          <CategoryIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                              {FEATURE_CATEGORIES[category].label}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate">
                              {FEATURE_CATEGORIES[category].description}
                            </span>
                          </div>
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${
                              isOpen ? "" : "-rotate-90"
                            }`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      {/* Toggle-all checkboxes per plan */}
                      {plans.map((plan) => {
                        const state = getCategoryToggleState(
                          category,
                          plan.id,
                          features,
                        );
                        const enabledCount = features.filter((f) =>
                          getFeatureState(plan.id, f.key),
                        ).length;

                        return (
                          <div
                            key={plan.id}
                            className="flex flex-col items-center gap-0.5 py-2"
                          >
                            <Checkbox
                              checked={
                                state === "all"
                                  ? true
                                  : state === "some"
                                    ? "indeterminate"
                                    : false
                              }
                              onCheckedChange={() => {
                                toggleAllInCategory(
                                  plan.id,
                                  category,
                                  features,
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer"
                            />
                            <span className="text-[9px] text-zinc-400 tabular-nums">
                              {enabledCount}/{features.length}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Feature Rows */}
                    <CollapsibleContent>
                      {features.map((feature, idx) => (
                        <div
                          key={feature.key}
                          className={`grid items-center border-l-2 ${borderColor} ml-2 pl-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 ${
                            idx % 2 === 0
                              ? "bg-white dark:bg-transparent"
                              : "bg-zinc-50/50 dark:bg-zinc-900/20"
                          }`}
                          style={{ gridTemplateColumns: gridCols }}
                        >
                          <div className="py-1.5 pr-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                {feature.displayName}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {feature.description}
                              </span>
                            </div>
                          </div>
                          {plans.map((plan) => {
                            const isEnabled = getFeatureState(
                              plan.id,
                              feature.key,
                            );
                            const isPending = pendingFeatureChanges[plan.id];
                            return (
                              <div
                                key={plan.id}
                                className="flex justify-center py-1.5"
                              >
                                <Checkbox
                                  checked={isEnabled}
                                  onCheckedChange={() =>
                                    toggleFeature(plan.id, feature.key)
                                  }
                                  className={`${
                                    isPending
                                      ? "border-amber-500"
                                      : isEnabled
                                        ? "border-emerald-500 data-[state=checked]:bg-emerald-500"
                                        : ""
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

            {/* Analytics Section Separator */}
            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-zinc-950 px-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Analytics Dashboard Sections
                </span>
              </div>
            </div>

            {/* Analytics Collapsible Group */}
            <Collapsible
              open={openCategories.has("__analytics__")}
              onOpenChange={() => toggleCategory("__analytics__")}
            >
              {/* Analytics Header Row */}
              <div
                className="grid items-center rounded-md bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                style={{ gridTemplateColumns: gridCols }}
              >
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 py-2 px-2 text-left w-full group">
                    <span className="h-2 w-2 rounded-full shrink-0 bg-rose-500" />
                    <BarChart3 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        Analytics Sections
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate">
                        Individual dashboard sections to enable
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${
                        openCategories.has("__analytics__") ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                {plans.map((plan) => {
                  const state = getAnalyticsToggleState(plan.id);
                  const enabledCount = analyticsSections.filter((s) =>
                    getAnalyticsState(plan.id, s.key),
                  ).length;

                  return (
                    <div
                      key={plan.id}
                      className="flex flex-col items-center gap-0.5 py-2"
                    >
                      <Checkbox
                        checked={
                          state === "all"
                            ? true
                            : state === "some"
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={() => toggleAllAnalytics(plan.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer"
                      />
                      <span className="text-[9px] text-zinc-400 tabular-nums">
                        {enabledCount}/{analyticsSections.length}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Analytics Section Rows */}
              <CollapsibleContent>
                {analyticsSections.map((section, idx) => (
                  <div
                    key={section.key}
                    className={`grid items-center border-l-2 border-l-rose-500/40 ml-2 pl-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 ${
                      idx % 2 === 0
                        ? "bg-white dark:bg-transparent"
                        : "bg-zinc-50/50 dark:bg-zinc-900/20"
                    }`}
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    <div className="py-1.5 pr-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {section.displayName}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {section.description}
                        </span>
                      </div>
                    </div>
                    {plans.map((plan) => {
                      const isEnabled = getAnalyticsState(plan.id, section.key);
                      const isPending = pendingAnalyticsChanges[plan.id];
                      return (
                        <div
                          key={plan.id}
                          className="flex justify-center py-1.5"
                        >
                          <Checkbox
                            checked={isEnabled}
                            onCheckedChange={() =>
                              toggleAnalytics(plan.id, section.key)
                            }
                            className={`${
                              isPending
                                ? "border-amber-500"
                                : isEnabled
                                  ? "border-emerald-500 data-[state=checked]:bg-emerald-500"
                                  : ""
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
