// src/features/recruiting/layouts/CenteredCardLayout.tsx
// Centered card layout: form card centered over hero background

import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { LeadInterestForm } from "../components/public/LeadInterestForm";
import { LOGO_SIZE_MAP } from "@/types/recruiting-theme.types";
import type { LayoutProps } from "./types";
import { getActiveSocialLinks } from "./types";

const SOCIAL_ICONS: Record<string, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

export function CenteredCardLayout({
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps) {
  const activeSocialLinks = getActiveSocialLinks(theme.social_links);
  const logoSize = LOGO_SIZE_MAP[theme.logo_size || "medium"];
  const showDisplayName = theme.enabled_features?.show_display_name !== false;

  return (
    <div className="min-h-screen bg-background relative overflow-auto">
      {/* Background with gradient and hero image */}
      <div className="fixed inset-0 -z-10">
        {theme.hero_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10"
            style={{ backgroundImage: `url(${theme.hero_image_url})` }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${theme.primary_color}15 0%, transparent 50%, ${theme.accent_color}10 100%)`,
          }}
        />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="centered-grid"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 60 0 L 0 0 0 60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#centered-grid)" />
          </svg>
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center min-h-screen py-8 px-4">
        {/* Header with logo */}
        <div className="flex items-center gap-3 mb-6">
          {theme.logo_dark_url ? (
            <img
              src={theme.logo_dark_url}
              alt={theme.display_name}
              className="object-contain"
              style={{ height: logoSize.mobile, width: logoSize.mobile }}
            />
          ) : (
            <div
              className="rounded-lg flex items-center justify-center text-white text-lg font-bold"
              style={{
                backgroundColor: theme.primary_color,
                height: logoSize.mobile,
                width: logoSize.mobile,
              }}
            >
              {theme.display_name.charAt(0)}
            </div>
          )}
          {showDisplayName && (
            <div className="flex flex-col">
              <span
                className="text-foreground text-lg font-bold tracking-wide"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {theme.display_name.toUpperCase()}
              </span>
              {theme.default_city && theme.default_state && (
                <span
                  className="text-[9px] uppercase tracking-[0.2em] font-medium"
                  style={{ color: theme.primary_color }}
                >
                  {theme.default_city}, {theme.default_state}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Headline */}
        <div className="text-center max-w-lg mb-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {theme.headline}
          </h1>
          <p className="text-sm text-muted-foreground">{theme.subheadline}</p>
        </div>

        {/* Form Card */}
        <div className="w-full max-w-[440px]">
          <div className="bg-card/95 backdrop-blur-md rounded-xl border border-border/50 shadow-2xl p-5">
            <div className="mb-4 text-center">
              <h2
                className="text-base font-semibold text-foreground mb-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Express Your Interest
              </h2>
              <p className="text-xs text-muted-foreground">
                Fill out the form and we&apos;ll be in touch within 24-48 hours.
              </p>
            </div>
            <LeadInterestForm
              recruiterSlug={recruiterId}
              onSuccess={onFormSuccess}
              ctaText={theme.cta_text}
              primaryColor={theme.primary_color}
            />
          </div>

          {/* Optional recruiter branding text. The legally-required consent/Terms
              language lives inside the form itself and cannot be overridden here. */}
          {theme.disclaimer_text && (
            <p className="mt-4 text-center text-[10px] text-muted-foreground">
              {theme.disclaimer_text}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {activeSocialLinks.length > 0 && (
            <div className="flex items-center gap-2">
              {activeSocialLinks.map(({ platform, url }) => {
                const Icon = SOCIAL_ICONS[platform];
                if (!Icon) return null;
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            &copy; {new Date().getFullYear()} {theme.display_name}
          </p>
        </div>
      </div>
    </div>
  );
}

export default CenteredCardLayout;
