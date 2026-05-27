// src/components/subscription/UpgradePrompt.tsx
// Component that displays when a user tries to access a locked feature

import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, ArrowRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type FeatureKey,
  FEATURE_DISPLAY_NAMES,
  useFeatureAccess,
} from "@/hooks/subscription";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";
import { cn } from "@/lib/utils";

interface UpgradePromptProps {
  /** The feature that requires upgrade */
  feature: FeatureKey;
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Render variant */
  variant?: "card" | "inline" | "banner" | "minimal";
  /** Additional CSS classes */
  className?: string;
  /** Whether to show CTA button */
  showCTA?: boolean;
}

/**
 * Displays an upgrade prompt for locked features.
 * Automatically shows the required plan based on the feature.
 */
export function UpgradePrompt({
  feature,
  title,
  description,
  variant = "card",
  className,
  showCTA = true,
}: UpgradePromptProps) {
  const featureName = FEATURE_DISPLAY_NAMES[feature];
  const { requiredPlan } = useFeatureAccess(feature);

  // When self-serve subscriptions are disabled, suppress every upgrade CTA and
  // drop the "upgrade to access" wording, while still showing the locked state.
  const ctaEnabled = showCTA && NEW_SUBSCRIPTIONS_ENABLED;

  const isFreeRequired = requiredPlan?.toLowerCase() === "free";
  const defaultTitle =
    title ??
    (isFreeRequired ? `Enable ${featureName}` : `Unlock ${featureName}`);
  const defaultDescription =
    description ??
    (isFreeRequired
      ? `${featureName} is available on all plans. Please contact support if you cannot access it.`
      : ctaEnabled
        ? `${featureName} is available on the ${requiredPlan} plan and above. Upgrade to access this feature.`
        : `${featureName} is available on the ${requiredPlan} plan and above.`);
  const buttonLabel = isFreeRequired
    ? "Get Started"
    : `Upgrade to ${requiredPlan}`;

  // Minimal variant - just an inline message
  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400",
          className,
        )}
      >
        <Lock className="h-3 w-3" />
        <span>
          Requires <span className="font-medium">{requiredPlan}</span> plan
        </span>
        {ctaEnabled && (
          <Link
            to="/billing"
            className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
          >
            Upgrade
          </Link>
        )}
      </div>
    );
  }

  // Banner variant - horizontal strip
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-3 py-2",
          "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
          "border border-amber-200 dark:border-amber-800 rounded-lg",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <div className="p-1 bg-amber-100 dark:bg-amber-900/50 rounded">
            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
              {defaultTitle}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-2">
              Available on {requiredPlan}+
            </span>
          </div>
        </div>
        {ctaEnabled && (
          <Link to="/billing">
            <Button
              size="sm"
              className="h-6 text-[10px] bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Upgrade
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // Inline variant - compact horizontal
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-2 py-1.5 rounded-md",
          "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
          className,
        )}
      >
        <Lock className="h-3 w-3 text-zinc-400" />
        <span className="text-[10px] text-zinc-600 dark:text-zinc-300">
          {requiredPlan} feature
        </span>
        {ctaEnabled && (
          <Link to="/billing">
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[9px] text-blue-600 dark:text-blue-400"
            >
              Upgrade
              <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // Card variant - full upgrade prompt card (default)
  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        "bg-gradient-to-br from-zinc-50 via-white to-zinc-50",
        "dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800",
        "border-zinc-200 dark:border-zinc-700",
        className,
      )}
    >
      <div className="flex flex-col items-center text-center max-w-sm mx-auto">
        {/* Icon */}
        <div className="relative mb-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
            <Crown className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          {defaultTitle}
        </h3>

        {/* Description */}
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
          {defaultDescription}
        </p>

        {/* Plan Badge */}
        <div className="inline-flex items-center gap-1.5 px-2 py-1 mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
          <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
            {requiredPlan} Plan Required
          </span>
        </div>

        {/* CTA */}
        {ctaEnabled && (
          <Link to="/billing" className="w-full">
            <Button className="w-full h-8 text-[11px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {buttonLabel}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Compact upgrade prompt for sidebars and constrained spaces
 */
export function UpgradePromptCompact({
  feature,
  className,
}: {
  feature: FeatureKey;
  className?: string;
}) {
  const { requiredPlan } = useFeatureAccess(feature);

  const badgeClasses = cn(
    "flex items-center gap-1.5 px-2 py-1 rounded text-[9px]",
    "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
    "border border-amber-200 dark:border-amber-800",
    className,
  );

  // Self-serve subscriptions disabled: show the locked badge without a link.
  if (!NEW_SUBSCRIPTIONS_ENABLED) {
    return (
      <span className={badgeClasses}>
        <Lock className="h-2.5 w-2.5" />
        <span>{requiredPlan}+</span>
      </span>
    );
  }

  return (
    <Link
      to="/billing"
      className={cn(
        badgeClasses,
        "hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors",
      )}
    >
      <Lock className="h-2.5 w-2.5" />
      <span>{requiredPlan}+</span>
    </Link>
  );
}
