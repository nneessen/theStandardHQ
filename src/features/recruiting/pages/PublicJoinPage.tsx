// src/features/recruiting/pages/PublicJoinPage.tsx
// Public landing page for recruiting funnel - Theme-driven branding with layout variants

import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "@tanstack/react-router";
import { Loader2, AlertCircle } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import { leadsService } from "@/services/leads";
import type { PublicRecruiterInfo } from "@/types/leads.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";
import { DEFAULT_THEME } from "@/types/recruiting-theme.types";
import { LeadSubmissionConfirmation } from "../components/public/LeadSubmissionConfirmation";
import { useCustomDomain } from "@/contexts/CustomDomainContext";
import { CustomDomainError } from "../components/CustomDomainError";
import {
  applyRecruitingTheme,
  clearRecruitingTheme,
  mergeWithDefaults,
} from "@/lib/recruiting-theme";
import { AiComposedLayout } from "../layouts/AiComposedLayout";
import {
  validateDesignSpec,
  legacyThemeToSpec,
} from "@/lib/recruiting-design-spec";

/**
 * Extract recruiter slug from pathname or route params
 */
function extractSlug(
  pathname: string,
  params: { recruiterId?: string },
): string | null {
  if (params.recruiterId) {
    return params.recruiterId;
  }
  const hyphenMatch = pathname.match(/^\/join-([^/]+)$/);
  if (hyphenMatch) {
    return hyphenMatch[1];
  }
  return null;
}

export function PublicJoinPage() {
  const location = useLocation();
  const params = useParams({ strict: false }) as { recruiterId?: string };
  const {
    customDomainSlug,
    isCustomDomain,
    isLoading: isCustomDomainLoading,
    theme: customDomainTheme,
  } = useCustomDomain();

  // All hooks must be called before any conditional returns
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
  const [recruiterInfo, setRecruiterInfo] =
    useState<PublicRecruiterInfo | null>(null);
  const [theme, setTheme] = useState<RecruitingPageTheme | null>(null);
  const [isLoadingRecruiter, setIsLoadingRecruiter] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use custom domain slug if available, otherwise extract from URL
  const recruiterId = useMemo(() => {
    // If on custom domain with resolved slug, use it
    if (customDomainSlug) {
      return customDomainSlug;
    }
    // Otherwise extract from URL path/params
    return extractSlug(location.pathname, params);
  }, [customDomainSlug, location.pathname, params]);

  // Fetch recruiter info and theme
  useEffect(() => {
    if (!recruiterId || isCustomDomainLoading) {
      setIsLoadingRecruiter(false);
      return;
    }

    let cancelled = false;

    async function fetchRecruiterAndTheme() {
      setIsLoadingRecruiter(true);
      setError(null);

      try {
        // Fetch recruiter info
        const data = await leadsService.getPublicRecruiterInfo(recruiterId!);
        if (cancelled) return;

        setRecruiterInfo(data);

        // If we're on a custom domain and already have theme from context, use it
        if (isCustomDomain && customDomainTheme) {
          setTheme(customDomainTheme);
          setIsLoadingRecruiter(false);
          return;
        }

        // Otherwise fetch theme via RPC (for primary domain paths)
        const themeData = await leadsService.getPublicRecruitingTheme(
          recruiterId!,
        );
        if (cancelled) return;

        const finalTheme = mergeWithDefaults(themeData);
        setTheme(finalTheme);

        // Apply theme CSS variables
        applyRecruitingTheme(finalTheme);

        setIsLoadingRecruiter(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch"));
          setIsLoadingRecruiter(false);
        }
      }
    }

    fetchRecruiterAndTheme();
    return () => {
      cancelled = true;
    };
  }, [recruiterId, isCustomDomainLoading, isCustomDomain, customDomainTheme]);

  // Apply custom domain theme when available
  useEffect(() => {
    if (customDomainTheme && !theme) {
      setTheme(customDomainTheme);
    }
  }, [customDomainTheme, theme]);

  // Cleanup theme on unmount (only if not custom domain - context handles that)
  useEffect(() => {
    return () => {
      if (!isCustomDomain) {
        clearRecruitingTheme();
      }
    };
  }, [isCustomDomain]);

  // Use merged theme with defaults
  const displayTheme = useMemo(() => {
    return theme || DEFAULT_THEME;
  }, [theme]);

  // Resolve the design spec to render. This is the public re-validation point:
  // a stored design_spec is UNTRUSTED and re-validated on every load; recruiters
  // without a spec fall back to an on-brand spec derived from their theme.
  const resolvedSpec = useMemo(
    () =>
      displayTheme.design_spec
        ? validateDesignSpec(displayTheme.design_spec).spec
        : legacyThemeToSpec(displayTheme),
    [displayTheme],
  );

  // Show loading while custom domain is resolving
  if (isCustomDomainLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Show custom domain error page if resolution failed
  if (isCustomDomain && !customDomainSlug) {
    return <CustomDomainError hostname={window.location.hostname} />;
  }

  // Loading state
  if (isLoadingRecruiter) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !recruiterInfo || !recruiterInfo.is_active) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg border border-border p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-2">
            Link Not Found
          </h1>
          <p className="text-sm text-muted-foreground">
            This recruiting link is no longer active or doesn&apos;t exist.
            Please contact your recruiter for a valid link.
          </p>
        </div>
      </div>
    );
  }

  // Show confirmation after successful submission
  if (submittedLeadId) {
    return (
      <LeadSubmissionConfirmation
        leadId={submittedLeadId}
        recruiterInfo={recruiterInfo}
      />
    );
  }

  // Common props for all layouts
  const layoutProps = {
    theme: displayTheme,
    recruiterInfo,
    recruiterId: recruiterId || "",
    onFormSuccess: (leadId: string) => setSubmittedLeadId(leadId),
  };

  // All recruiting pages render through the AI block composer — a validated design
  // spec when the recruiter has built one, otherwise the legacy-theme fallback
  // computed above. The builder is the single source of truth for every page.
  return <AiComposedLayout spec={resolvedSpec} {...layoutProps} />;
}

export default PublicJoinPage;
