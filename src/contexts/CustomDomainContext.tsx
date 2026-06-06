// src/contexts/CustomDomainContext.tsx
// Custom Domain Context
// Detects if app is loaded on a custom domain and resolves to recruiter_slug + theme

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { CustomDomainContextValue } from "@/types/custom-domain.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";
import {
  applyRecruitingTheme,
  clearRecruitingTheme,
} from "@/lib/recruiting-theme";

import { leadsService } from "@/services/leads";
import { supabaseFunctionsUrl } from "@/services/base";
import { classifyHost } from "@/lib/hostname";

const CustomDomainContext = createContext<CustomDomainContextValue>({
  customDomainSlug: null,
  isCustomDomain: false,
  isLoading: true,
  error: null,
  theme: null,
});

export function useCustomDomain() {
  const context = useContext(CustomDomainContext);
  if (!context) {
    throw new Error("useCustomDomain must be used within CustomDomainProvider");
  }
  return context;
}

interface CustomDomainProviderProps {
  children: ReactNode;
}

export function CustomDomainProvider({ children }: CustomDomainProviderProps) {
  const [state, setState] = useState<CustomDomainContextValue>({
    customDomainSlug: null,
    isCustomDomain: false,
    isLoading: true,
    error: null,
    theme: null,
  });

  useEffect(() => {
    const hostname = window.location.hostname;
    const host = classifyHost(hostname);

    // Primary app/marketing site (or reserved platform subdomain) — not branded.
    if (host.kind === "primary") {
      setState({
        customDomainSlug: null,
        isCustomDomain: false,
        isLoading: false,
        error: null,
        theme: null,
      });
      return;
    }

    // Zero-config branded subdomain {slug}.thestandardhq.com.
    // The slug IS the subdomain label — resolve the theme directly via the
    // public RPC (no custom_domains row, no resolve-custom-domain round-trip).
    if (host.kind === "platform-subdomain") {
      const slug = host.slug;
      let cancelled = false;

      (async () => {
        try {
          const theme = await leadsService.getPublicRecruitingTheme(slug);
          if (cancelled) return;

          if (!theme) {
            // Slug not found / recruiter unapproved / IMO revoked or unlisted.
            setState({
              customDomainSlug: null,
              isCustomDomain: true,
              isLoading: false,
              error: "Domain not configured",
              theme: null,
            });
            return;
          }

          applyRecruitingTheme(theme);
          setState({
            customDomainSlug: slug,
            isCustomDomain: true,
            isLoading: false,
            error: null,
            theme,
          });
        } catch (err) {
          if (cancelled) return;
          console.error(
            "[CustomDomainProvider] Subdomain resolution failed:",
            err,
          );
          setState({
            customDomainSlug: null,
            isCustomDomain: true,
            isLoading: false,
            error: "Failed to resolve domain",
            theme: null,
          });
        }
      })();

      return () => {
        cancelled = true;
        clearRecruitingTheme();
      };
    }

    // External white-label custom domain — resolve via Edge Function.
    const resolveCustomDomain = async () => {
      try {
        const response = await fetch(
          `${supabaseFunctionsUrl}/resolve-custom-domain?hostname=${encodeURIComponent(hostname)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (response.status === 404) {
          // Domain not configured or inactive
          setState({
            customDomainSlug: null,
            isCustomDomain: true,
            isLoading: false,
            error: "Domain not configured",
            theme: null,
          });
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.recruiter_slug) {
          const theme: RecruitingPageTheme | null = data.theme || null;

          // Apply theme CSS variables if theme is present
          if (theme) {
            applyRecruitingTheme(theme);
          }

          setState({
            customDomainSlug: data.recruiter_slug,
            isCustomDomain: true,
            isLoading: false,
            error: null,
            theme,
          });
        } else {
          setState({
            customDomainSlug: null,
            isCustomDomain: true,
            isLoading: false,
            error: "Domain not configured",
            theme: null,
          });
        }
      } catch (err) {
        console.error("[CustomDomainProvider] Resolution failed:", err);
        setState({
          customDomainSlug: null,
          isCustomDomain: true,
          isLoading: false,
          error: "Failed to resolve domain",
          theme: null,
        });
      }
    };

    resolveCustomDomain();

    // Cleanup: clear theme CSS variables when component unmounts
    return () => {
      clearRecruitingTheme();
    };
  }, []);

  return (
    <CustomDomainContext.Provider value={state}>
      {children}
    </CustomDomainContext.Provider>
  );
}
