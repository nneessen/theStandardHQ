// src/features/recruiting/layouts/HeroSlideLayout.tsx
// Hero slide layout: full-width hero with form that slides in from the right

import { useState } from "react";
import {
  DollarSign,
  BookOpen,
  Clock,
  Rocket,
  Users,
  Zap,
  X,
  ArrowRight,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const FEATURES = [
  { icon: DollarSign, label: "Uncapped earnings" },
  { icon: Zap, label: "Latest tech" },
  { icon: BookOpen, label: "Full training" },
  { icon: Clock, label: "Flexible schedule" },
  { icon: Rocket, label: "Build a business" },
  { icon: Users, label: "Mentorship" },
];

export function HeroSlideLayout({
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const activeSocialLinks = getActiveSocialLinks(theme.social_links);
  const logoSize = LOGO_SIZE_MAP[theme.logo_size || "medium"];
  const showDisplayName = theme.enabled_features?.show_display_name !== false;

  return (
    <div className="min-h-screen bg-foreground relative overflow-hidden">
      {/* Hero background */}
      {theme.hero_image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${theme.hero_image_url})` }}
        />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${theme.primary_color}30 0%, transparent 60%, ${theme.accent_color}20 100%)`,
        }}
      />

      {/* Animated orbs */}
      <div
        className="absolute top-1/3 -left-32 w-96 h-96 rounded-full blur-3xl animate-pulse opacity-15"
        style={{ backgroundColor: theme.primary_color }}
      />
      <div
        className="absolute bottom-1/3 -right-32 w-80 h-80 rounded-full blur-3xl animate-pulse opacity-10"
        style={{ backgroundColor: theme.accent_color, animationDelay: "1.5s" }}
      />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="hero-grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
      </div>

      {/* Main hero content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-6 md:p-8">
          <div className="flex items-center gap-3">
            {theme.logo_light_url ? (
              <img
                src={theme.logo_light_url}
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
              <span
                className="text-white text-lg font-bold tracking-wide hidden sm:block"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {theme.display_name.toUpperCase()}
              </span>
            )}
          </div>

          {/* Desktop CTA in header */}
          <Button
            size="sm"
            onClick={() => setIsFormOpen(true)}
            className="hidden md:flex text-white border-white/30 hover:bg-white/10"
            style={{
              backgroundColor: theme.primary_color,
              borderColor: theme.primary_color,
            }}
          >
            {theme.cta_text}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </header>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <div className="text-center max-w-3xl">
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {theme.headline.split(" ").slice(0, 2).join(" ")}{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(to right, ${theme.primary_color}, ${theme.accent_color})`,
                }}
              >
                {theme.headline.split(" ").slice(2).join(" ")}
              </span>
            </h1>
            <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto mb-8">
              {theme.subheadline}
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Stats (if enabled) */}
            {theme.enabled_features?.show_stats !== false && (
              <div
                className="inline-block rounded-xl px-6 py-4 mb-8"
                style={{
                  backgroundColor: `${theme.primary_color}25`,
                  border: `1px solid ${theme.primary_color}40`,
                }}
              >
                <p
                  className="text-3xl font-bold bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${theme.primary_color}, ${theme.accent_color})`,
                  }}
                >
                  $20,000+
                </p>
                <p className="text-white/70 text-sm">
                  Average monthly commissions
                </p>
              </div>
            )}

            {/* Main CTA button */}
            <Button
              size="lg"
              onClick={() => setIsFormOpen(true)}
              className="text-white shadow-xl hover:scale-105 transition-transform"
              style={{
                backgroundColor: theme.primary_color,
                boxShadow: `0 8px 32px ${theme.primary_color}50`,
              }}
            >
              {theme.cta_text}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between p-6 md:p-8">
          <p className="text-white/40 text-xs">
            &copy; {new Date().getFullYear()} {theme.display_name}
          </p>
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
        </footer>
      </div>

      {/* Slide-in form panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-background shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isFormOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Panel header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              {theme.logo_dark_url ? (
                <img
                  src={theme.logo_dark_url}
                  alt={theme.display_name}
                  className="object-contain"
                  style={{ height: 32, width: 32 }}
                />
              ) : (
                <div
                  className="rounded flex items-center justify-center text-white text-sm font-bold"
                  style={{
                    backgroundColor: theme.primary_color,
                    height: 32,
                    width: 32,
                  }}
                >
                  {theme.display_name.charAt(0)}
                </div>
              )}
              {showDisplayName && (
                <span className="text-sm font-semibold text-foreground">
                  {theme.display_name}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFormOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Form content - scrollable */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4">
              <h2
                className="text-lg font-bold text-foreground mb-1"
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

          {/* Disclaimer */}
          <div className="p-4 border-t border-border shrink-0">
            <p className="text-[10px] text-muted-foreground text-center">
              {theme.disclaimer_text ||
                "By submitting, you agree to be contacted about career opportunities."}
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isFormOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsFormOpen(false)}
        />
      )}
    </div>
  );
}

export default HeroSlideLayout;
