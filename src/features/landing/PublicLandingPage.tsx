// src/features/landing/PublicLandingPage.tsx
// Main public landing page component

import { useEffect, useState } from "react";
import { HeroSection } from "./components/HeroSection";
import { StatsBar } from "./components/StatsBar";
import { AboutSection } from "./components/AboutSection";
import { CultureGallery } from "./components/CultureGallery";
import { OpportunityPath } from "./components/OpportunityPath";
import { RequirementsSection } from "./components/RequirementsSection";
import { TechShowcase } from "./components/TechShowcase";
import { TestimonialsCarousel } from "./components/TestimonialsCarousel";
import { FaqAccordion } from "./components/FaqAccordion";
import { FinalCta } from "./components/FinalCta";
import { LandingFooter } from "./components/LandingFooter";
import { ScrollProgress } from "./components/ScrollProgress";
import * as landingPageService from "./services/landingPageService";
import type { LandingPageTheme, SectionId } from "./types";
import { DEFAULT_LANDING_PAGE_THEME } from "./types";

// Section component map
const SECTION_COMPONENTS: Record<
  SectionId,
  React.ComponentType<{ theme: LandingPageTheme }>
> = {
  hero: HeroSection,
  stats: StatsBar,
  about: AboutSection,
  gallery: CultureGallery,
  opportunity: OpportunityPath,
  requirements: RequirementsSection,
  tech: TechShowcase,
  testimonials: TestimonialsCarousel,
  faq: FaqAccordion,
  final_cta: FinalCta,
};

// Section enabled check map
const SECTION_ENABLED_MAP: Record<SectionId, keyof LandingPageTheme> = {
  hero: "hero_headline", // Always show hero
  stats: "stats_enabled",
  about: "about_enabled",
  gallery: "gallery_enabled",
  opportunity: "opportunity_enabled",
  requirements: "requirements_enabled",
  tech: "tech_enabled",
  testimonials: "testimonials_enabled",
  faq: "faq_enabled",
  final_cta: "final_cta_enabled",
};

export function PublicLandingPage() {
  // Direct state management for landing page settings
  const [theme, setTheme] = useState<LandingPageTheme>(
    DEFAULT_LANDING_PAGE_THEME,
  );

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const result = await landingPageService.getPublicLandingPageSettings();
        if (mounted) {
          setTheme(result);
        }
      } catch {
        // On error, defaults are already set - no action needed
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  // Update document title and meta tags
  useEffect(() => {
    if (theme) {
      document.title = theme.meta_title;

      // Update meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute("content", theme.meta_description);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = theme.meta_description;
        document.head.appendChild(meta);
      }

      // Update OG tags
      if (theme.og_image_url) {
        let ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
          ogImage.setAttribute("content", theme.og_image_url);
        } else {
          ogImage = document.createElement("meta");
          ogImage.setAttribute("property", "og:image");
          ogImage.setAttribute("content", theme.og_image_url);
          document.head.appendChild(ogImage);
        }
      }
    }
  }, [theme]);

  // Only show error if we truly have no data (should never happen with placeholderData)
  if (!theme) {
    return (
      <div className="theme-v2 min-h-screen bg-v2-canvas flex items-center justify-center">
        <div className="text-v2-ink text-center font-display">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-v2-ink-muted">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  // Render sections in order
  const renderSections = () => {
    return theme.section_order.map((sectionId) => {
      const Component = SECTION_COMPONENTS[sectionId];
      const enabledKey = SECTION_ENABLED_MAP[sectionId];

      // Hero is always shown, others check their enabled flag
      if (sectionId !== "hero") {
        const isEnabled = theme[enabledKey];
        if (!isEnabled) return null;
      }

      return <Component key={sectionId} theme={theme} />;
    });
  };

  return (
    <div
      className="min-h-screen bg-[#030303] text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}
    >
      <ScrollProgress color={theme.primary_color} />

      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 100% 100% at 0% 0%, ${theme.primary_color}15 0%, transparent 50%),
              radial-gradient(ellipse 80% 80% at 100% 100%, ${theme.accent_color}15 0%, transparent 50%)
            `,
          }}
        />

        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Main content */}
      <main className="relative z-10">{renderSections()}</main>

      {/* Footer */}
      <LandingFooter theme={theme} />

      {/* CSS for custom animations */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          25% { transform: translate(10px, -20px) scale(1.2); opacity: 0.8; }
          50% { transform: translate(-5px, -40px) scale(0.8); opacity: 0.4; }
          75% { transform: translate(15px, -20px) scale(1.1); opacity: 0.7; }
        }

        @keyframes gridShift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px var(--glow-color, #f59e0b),
                        0 0 40px var(--glow-color, #f59e0b);
            opacity: 1;
          }
          50% {
            box-shadow: 0 0 40px var(--glow-color, #f59e0b),
                        0 0 80px var(--glow-color, #f59e0b);
            opacity: 0.8;
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-scale-in {
          animation: scaleIn 0.5s ease-out forwards;
        }

        .animate-slide-in-left {
          animation: slideInLeft 0.6s ease-out forwards;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
