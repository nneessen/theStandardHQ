// src/features/recruiting/layouts/SplitPanelLayout.tsx
// Split panel layout: dark hero left, form right (original/default layout)

import {
  DollarSign,
  BookOpen,
  Clock,
  Rocket,
  Users,
  MapPin,
  Zap,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";
import { LeadInterestForm } from "../components/public/LeadInterestForm";
import { getRecruiterFullName } from "@/lib/recruiting-theme";
import { LOGO_SIZE_MAP } from "@/types/recruiting-theme.types";
import type { LayoutProps } from "./types";
import { getActiveSocialLinks } from "./types";

const SOCIAL_ICONS: Record<string, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

export function SplitPanelLayout({
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps) {
  const activeSocialLinks = getActiveSocialLinks(theme.social_links);
  const recruiterFullName = getRecruiterFullName(theme);
  const logoSize = LOGO_SIZE_MAP[theme.logo_size || "medium"];
  const showDisplayName = theme.enabled_features?.show_display_name !== false;

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* Left Panel - Dark Hero */}
      <div className="lg:w-1/2 xl:w-[50%] bg-foreground relative hidden lg:block overflow-hidden">
        {/* Hero background image (if set) */}
        {theme.hero_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${theme.hero_image_url})` }}
          />
        )}

        {/* Animated grid background */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Animated glow orbs - use theme colors */}
        <div
          className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl animate-pulse opacity-10"
          style={{ backgroundColor: theme.primary_color }}
        />
        <div
          className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl animate-pulse opacity-5"
          style={{ backgroundColor: theme.accent_color, animationDelay: "1s" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-10 h-full">
          {/* Logo and brand */}
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-xl blur-xl group-hover:opacity-30 transition-all duration-500 opacity-20"
                style={{ backgroundColor: theme.primary_color }}
              />
              {theme.logo_light_url ? (
                <img
                  src={theme.logo_light_url}
                  alt={theme.display_name}
                  className="relative object-contain drop-shadow-2xl"
                  style={{ height: logoSize.desktop, width: logoSize.desktop }}
                />
              ) : (
                <div
                  className="relative rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                  style={{
                    backgroundColor: theme.primary_color,
                    height: logoSize.desktop,
                    width: logoSize.desktop,
                  }}
                >
                  {theme.display_name.charAt(0)}
                </div>
              )}
            </div>
            {showDisplayName && (
              <div className="flex flex-col">
                <span
                  className="text-white text-2xl font-bold tracking-wide"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {theme.display_name.toUpperCase()}
                </span>
                {theme.default_city && theme.default_state && (
                  <span
                    className="text-[10px] uppercase tracking-[0.3em] font-medium"
                    style={{ color: theme.primary_color }}
                  >
                    {theme.default_city}, {theme.default_state}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Middle - Main messaging */}
          <div className="space-y-4">
            <div>
              <h1
                className="text-4xl xl:text-5xl font-bold leading-tight mb-3"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="text-white">
                  {theme.headline.split(" ").slice(0, 2).join(" ")}{" "}
                </span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${theme.primary_color}, ${theme.accent_color})`,
                  }}
                >
                  {theme.headline.split(" ").slice(2).join(" ")}
                </span>
              </h1>
              <p className="text-white/80 text-sm max-w-sm leading-relaxed">
                {theme.subheadline}
              </p>
            </div>

            {/* About section */}
            {theme.about_text &&
              theme.enabled_features?.show_about !== false && (
                <div className="bg-white/5 dark:bg-white/10 border border-white/10 dark:border-black/10 rounded-lg p-3 max-w-sm">
                  {theme.default_city && (
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin
                        className="h-3.5 w-3.5"
                        style={{ color: theme.primary_color }}
                      />
                      <span className="text-[10px] text-white/60 uppercase tracking-[0.18em]">
                        {theme.default_city}
                        {theme.default_state && `, ${theme.default_state}`}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-white/90 leading-relaxed">
                    {recruiterFullName && (
                      <>
                        Founded by{" "}
                        <span className="text-white font-medium">
                          {recruiterFullName}
                        </span>
                        —
                      </>
                    )}
                    {theme.about_text}
                  </p>
                </div>
              )}

            {/* Stats highlight */}
            {theme.enabled_features?.show_stats !== false && (
              <div
                className="relative border rounded-lg p-4 max-w-sm overflow-hidden"
                style={{
                  backgroundColor: `${theme.primary_color}20`,
                  borderColor: `${theme.primary_color}30`,
                }}
              >
                <div
                  className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10"
                  style={{ backgroundColor: theme.primary_color }}
                />
                <p
                  className="relative text-3xl font-bold bg-clip-text text-transparent"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    backgroundImage: `linear-gradient(to right, ${theme.primary_color}, ${theme.accent_color})`,
                  }}
                >
                  $20,000+
                </p>
                <p className="relative text-white/80 text-xs mt-1">
                  Average monthly commissions for our agents
                </p>
              </div>
            )}

            {/* Feature highlights */}
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              <div className="flex items-center gap-2 text-white/90">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">Uncapped earnings</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">Latest tech</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                  <BookOpen className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">Full training</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">Flexible schedule</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                  <Rocket className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">Build a business</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-white/10 dark:bg-white/10">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs">Mentorship</span>
              </div>
            </div>
          </div>

          {/* Bottom - Footer with social links */}
          <div className="flex items-center justify-between">
            <div className="text-white/50 text-xs">
              &copy; {new Date().getFullYear()} {theme.display_name}
            </div>

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
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-white/70" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-4 pt-8 lg:p-6 overflow-y-auto">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <div className="flex items-center gap-3">
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
                    className="text-foreground text-xl font-bold tracking-wide"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {theme.display_name.toUpperCase()}
                  </span>
                  {theme.default_city && theme.default_state && (
                    <span
                      className="text-[9px] uppercase tracking-[0.25em] font-medium"
                      style={{ color: theme.primary_color }}
                    >
                      {theme.default_city}, {theme.default_state}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="mb-3 text-center lg:text-left">
            <h2
              className="text-lg font-bold text-foreground mb-1"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Express Your Interest
            </h2>
            <p className="text-xs text-muted-foreground">
              Fill out the form below and we&apos;ll be in touch within 24-48
              hours.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-xl p-4">
            <LeadInterestForm
              recruiterSlug={recruiterId}
              onSuccess={onFormSuccess}
              ctaText={theme.cta_text}
              primaryColor={theme.primary_color}
            />
          </div>

          {/* Disclaimer text */}
          {theme.disclaimer_text ? (
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              {theme.disclaimer_text}
            </p>
          ) : (
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              By submitting, you agree to be contacted about career
              opportunities.
            </p>
          )}

          {/* Mobile footer */}
          <p className="lg:hidden mt-4 text-center text-[10px] text-muted-foreground">
            &copy; {new Date().getFullYear()} {theme.display_name}
          </p>

          {/* Mobile social links */}
          {activeSocialLinks.length > 0 && (
            <div className="lg:hidden flex items-center justify-center gap-3 mt-3">
              {activeSocialLinks.map(({ platform, url }) => {
                const Icon = SOCIAL_ICONS[platform];
                if (!Icon) return null;
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SplitPanelLayout;
