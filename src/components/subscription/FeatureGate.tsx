// src/components/subscription/FeatureGate.tsx
// Wrapper component that gates content based on subscription features

import type { ReactNode } from "react";
import { useFeatureAccess, type FeatureKey } from "@/hooks/subscription";
import { UpgradePrompt } from "./UpgradePrompt";
import { Loader2 } from "lucide-react";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";
import { cn } from "@/lib/utils";

interface FeatureGateProps {
  /** The feature required to view the content */
  feature: FeatureKey;
  /** Content to display when user has access */
  children: ReactNode;
  /** Content to display when user doesn't have access (defaults to UpgradePrompt) */
  fallback?: ReactNode;
  /** Whether to show loading state while checking access */
  showLoading?: boolean;
  /** Variant of the upgrade prompt to show */
  promptVariant?: "card" | "inline" | "banner" | "minimal";
  /** Additional classes for the wrapper */
  className?: string;
  /** If true, renders children but disabled/blurred instead of upgrade prompt */
  blurLocked?: boolean;
}

/**
 * Conditionally renders children based on subscription feature access.
 *
 * @example
 * // Basic usage - shows upgrade prompt if user doesn't have recruiting feature
 * <FeatureGate feature="recruiting">
 *   <RecruitingDashboard />
 * </FeatureGate>
 *
 * @example
 * // With custom fallback
 * <FeatureGate feature="email" fallback={<FreeTierEmailInfo />}>
 *   <EmailComposer />
 * </FeatureGate>
 *
 * @example
 * // Inline variant for smaller spaces
 * <FeatureGate feature="reports_export" promptVariant="inline">
 *   <ExportButton />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showLoading = true,
  promptVariant = "card",
  className,
  blurLocked = false,
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useFeatureAccess(feature);

  // Show loading state
  if (isLoading && showLoading) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  // User has access - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access - render locked state
  if (blurLocked) {
    return (
      <div className={cn("relative", className)}>
        <div className="blur-sm pointer-events-none select-none opacity-60">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-900/50">
          <UpgradePrompt feature={feature} variant={promptVariant} />
        </div>
      </div>
    );
  }

  // Show custom fallback or default upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className={className}>
      <UpgradePrompt feature={feature} variant={promptVariant} />
    </div>
  );
}

/**
 * HOC version of FeatureGate for wrapping entire components/pages
 */
// eslint-disable-next-line react-refresh/only-export-components -- HOC factory pattern requires non-component export
export function withFeatureGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: FeatureKey,
  options?: {
    promptVariant?: "card" | "inline" | "banner" | "minimal";
    fallback?: ReactNode;
  },
) {
  const FeatureGatedComponent = (props: P) => {
    return (
      <FeatureGate
        feature={feature}
        promptVariant={options?.promptVariant}
        fallback={options?.fallback}
      >
        <WrappedComponent {...props} />
      </FeatureGate>
    );
  };

  FeatureGatedComponent.displayName = `withFeatureGate(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return FeatureGatedComponent;
}

/**
 * Simple boolean check for conditional rendering
 * Use this when you need more control over the rendering logic
 *
 * @example
 * const { hasAccess } = useFeatureAccess("email");
 * return hasAccess ? <SendButton /> : null;
 */

/**
 * Gate for button-level features (e.g., export buttons, send buttons)
 * Shows a disabled button with tooltip when locked
 */
interface FeatureButtonGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /** Content to show when locked (defaults to same children but disabled) */
  lockedContent?: ReactNode;
}

export function FeatureButtonGate({
  feature,
  children,
  lockedContent,
}: FeatureButtonGateProps) {
  const { hasAccess, isLoading, requiredPlan } = useFeatureAccess(feature);

  if (isLoading) {
    return <div className="opacity-50 pointer-events-none">{children}</div>;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (lockedContent) {
    return <>{lockedContent}</>;
  }

  // Default: wrap children with locked styling and tooltip
  const lockedTitle = NEW_SUBSCRIPTIONS_ENABLED
    ? `Upgrade to ${requiredPlan} to unlock this feature`
    : `This feature isn't included in your current plan`;
  return (
    <div className="relative inline-block" title={lockedTitle}>
      <div className="opacity-50 pointer-events-none">{children}</div>
    </div>
  );
}
