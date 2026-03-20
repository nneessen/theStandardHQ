// src/contexts/CustomDomainContext.tsx
// Custom Domain Context
// Detects if app is loaded on a custom domain and resolves to recruiter_slug + theme

import React, {
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
import { supabaseFunctionsUrl } from "@/services/base";

// Primary domains (not custom domains)
const PRIMARY_DOMAINS = [
  "thestandardhq.com",
  "www.thestandardhq.com",
  "localhost",
  "127.0.0.1",
];

// Vercel preview deployments should be treated as primary
const isVercelPreview = (hostname: string) =>
  hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.sh");

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

    // Check if on primary domain or Vercel preview
    const isPrimary =
      PRIMARY_DOMAINS.includes(hostname) || isVercelPreview(hostname);

    if (isPrimary) {
      setState({
        customDomainSlug: null,
        isCustomDomain: false,
        isLoading: false,
        error: null,
        theme: null,
      });
      return;
    }

    // This is a custom domain - resolve via Edge Function
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
