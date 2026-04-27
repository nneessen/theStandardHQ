// src/features/recruiting/layouts/MultiSectionLayout.tsx
// Multi-section layout: scrolling landing page with hero, about, stats, form, footer

import {
  DollarSign,
  BookOpen,
  Clock,
  Rocket,
  Users,
  Zap,
  MapPin,
  ArrowDown,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const FEATURES = [
  {
    icon: DollarSign,
    title: "Uncapped Earnings",
    description: "No ceiling on your income potential. Earn what you deserve.",
  },
  {
    icon: Zap,
    title: "Latest Technology",
    description: "Modern tools to help you work smarter, not harder.",
  },
  {
    icon: BookOpen,
    title: "Full Training",
    description: "Comprehensive training programs to set you up for success.",
  },
  {
    icon: Clock,
    title: "Flexible Schedule",
    description: "Work-life balance that fits your lifestyle.",
  },
  {
    icon: Rocket,
    title: "Build a Business",
    description: "Create your own agency and grow your team.",
  },
  {
    icon: Users,
    title: "Mentorship",
    description: "Learn from experienced leaders in the industry.",
  },
];

export function MultiSectionLayout({
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps) {
  const activeSocialLinks = getActiveSocialLinks(theme.social_links);
  const recruiterFullName = getRecruiterFullName(theme);
  const logoSize = LOGO_SIZE_MAP[theme.logo_size || "medium"];
  const showDisplayName = theme.enabled_features?.show_display_name !== false;

  const scrollToForm = () => {
    const formSection = document.getElementById("apply-section");
    formSection?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col bg-foreground overflow-hidden">
        {/* Background */}
        {theme.hero_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${theme.hero_image_url})` }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${theme.primary_color}10 100%)`,
          }}
        />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between p-6 md:p-8">
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
              <div className="flex flex-col">
                <span
                  className="text-white text-lg font-bold tracking-wide"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {theme.display_name.toUpperCase()}
                </span>
                {theme.default_city && theme.default_state && (
                  <span
                    className="text-[9px] uppercase tracking-[0.2em]"
                    style={{ color: theme.primary_color }}
                  >
                    {theme.default_city}, {theme.default_state}
                  </span>
                )}
              </div>
            )}
          </div>
          <Button
            onClick={scrollToForm}
            size="sm"
            className="text-white"
            style={{ backgroundColor: theme.primary_color }}
          >
            {theme.cta_text}
          </Button>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 max-w-4xl"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {theme.headline}
          </h1>
          <p className="text-white/70 text-lg md:text-xl max-w-2xl mb-8">
            {theme.subheadline}
          </p>
          <Button
            onClick={scrollToForm}
            size="lg"
            className="text-white shadow-lg hover:scale-105 transition-transform"
            style={{
              backgroundColor: theme.primary_color,
              boxShadow: `0 8px 32px ${theme.primary_color}40`,
            }}
          >
            {theme.cta_text}
          </Button>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 flex justify-center pb-8">
          <button
            onClick={scrollToForm}
            className="flex flex-col items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
          >
            <span className="text-xs uppercase tracking-[0.18em]">
              Learn More
            </span>
            <ArrowDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </section>

      {/* About Section */}
      {theme.about_text && theme.enabled_features?.show_about !== false && (
        <section className="py-16 md:py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2
              className="text-2xl md:text-3xl font-bold text-foreground mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              About Us
            </h2>
            {theme.default_city && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <MapPin
                  className="h-4 w-4"
                  style={{ color: theme.primary_color }}
                />
                <span className="text-sm text-muted-foreground">
                  {theme.default_city}
                  {theme.default_state && `, ${theme.default_state}`}
                </span>
              </div>
            )}
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              {recruiterFullName && (
                <>
                  Founded by{" "}
                  <span className="text-foreground font-medium">
                    {recruiterFullName}
                  </span>
                  —
                </>
              )}
              {theme.about_text}
            </p>
          </div>
        </section>
      )}

      {/* Stats Section */}
      {theme.enabled_features?.show_stats !== false && (
        <section
          className="py-16 md:py-20 px-6"
          style={{ backgroundColor: `${theme.primary_color}08` }}
        >
          <div className="max-w-6xl mx-auto text-center">
            <div
              className="inline-block rounded-2xl px-8 py-6 mb-8"
              style={{
                backgroundColor: `${theme.primary_color}15`,
                border: `1px solid ${theme.primary_color}25`,
              }}
            >
              <p
                className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(to right, ${theme.primary_color}, ${theme.accent_color})`,
                }}
              >
                $20,000+
              </p>
              <p className="text-muted-foreground mt-2">
                Average monthly commissions for our agents
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Why Join Us?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="p-5 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${theme.primary_color}15` }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: theme.primary_color }}
                  />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section
        id="apply-section"
        className="py-16 md:py-24 px-6"
        style={{ backgroundColor: `${theme.primary_color}05` }}
      >
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="text-2xl md:text-3xl font-bold text-foreground mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground">
              Fill out the form below and we&apos;ll be in touch within 24-48
              hours.
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-lg p-6">
            <LeadInterestForm
              recruiterSlug={recruiterId}
              onSuccess={onFormSuccess}
              ctaText={theme.cta_text}
              primaryColor={theme.primary_color}
            />
          </div>
          <p className="mt-4 text-center text-[10px] text-muted-foreground">
            {theme.disclaimer_text ||
              "By submitting, you agree to be contacted about career opportunities."}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {theme.logo_light_url ? (
                <img
                  src={theme.logo_light_url}
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
                <span className="text-white/80 text-sm font-medium">
                  {theme.display_name}
                </span>
              )}
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

            <p className="text-white/40 text-xs">
              &copy; {new Date().getFullYear()} {theme.display_name}. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MultiSectionLayout;
