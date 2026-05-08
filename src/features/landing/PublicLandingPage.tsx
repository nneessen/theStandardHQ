import { useEffect, useState } from "react";
import "./styles/landing-theme.css";

import { StickyNav } from "./components/StickyNav";
import { HeroSection } from "./components/HeroSection";
import { GoldBandSection } from "./components/GoldBandSection";
import { WhyLeaveYourIMOSection } from "./components/WhyLeaveYourIMOSection";
import { PlatformTourSection } from "./components/PlatformTourSection";
import { LiveProductSurfacesSection } from "./components/LiveProductSurfacesSection";
import { AIToolkitSection } from "./components/AIToolkitSection";
import { IntegrationsWallSection } from "./components/IntegrationsWallSection";
import { LifestyleBreakSection } from "./components/LifestyleBreakSection";
import { FullFeatureMatrixSection } from "./components/FullFeatureMatrixSection";
import { AboutSection } from "./components/AboutSection";
import { CultureGallery } from "./components/CultureGallery";
import { OpportunityPath } from "./components/OpportunityPath";
import { EarningsAndCompSection } from "./components/EarningsAndCompSection";
import { FounderQuoteSection } from "./components/FounderQuoteSection";
import { TestimonialsCarousel } from "./components/TestimonialsCarousel";
import { StatsBar } from "./components/StatsBar";
import { FaqAccordion } from "./components/FaqAccordion";
import { FinalCta } from "./components/FinalCta";
import { LandingFooter } from "./components/LandingFooter";

import * as landingPageService from "./services/landingPageService";
import type { LandingPageTheme } from "./types";
import { DEFAULT_LANDING_PAGE_THEME } from "./types";

export function PublicLandingPage() {
  const [theme, setTheme] = useState<LandingPageTheme>(
    DEFAULT_LANDING_PAGE_THEME,
  );

  useEffect(() => {
    let mounted = true;
    landingPageService
      .getPublicLandingPageSettings()
      .then((result) => {
        if (mounted) setTheme(result);
      })
      .catch(() => {
        // defaults already set
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Update meta tags
  useEffect(() => {
    if (!theme) return;
    document.title = theme.meta_title;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector);
      if (el) {
        el.setAttribute(attr, value);
      } else {
        el = document.createElement("meta");
        const [, key] = selector.match(/\[([^=]+)="([^"]+)"\]/) ?? [];
        if (key) el.setAttribute(key, selector.match(/="([^"]+)"/)?.[1] ?? "");
        el.setAttribute(attr, value);
        document.head.appendChild(el);
      }
    };

    if (theme.meta_description) {
      setMeta('meta[name="description"]', "content", theme.meta_description);
    }
    if (theme.og_image_url) {
      setMeta('meta[property="og:image"]', "content", theme.og_image_url);
    }
  }, [theme]);

  return (
    <div className="theme-landing min-h-screen">
      <StickyNav theme={theme} />

      <main>
        <HeroSection theme={theme} />

        <GoldBandSection />

        <WhyLeaveYourIMOSection />

        <PlatformTourSection />

        <LiveProductSurfacesSection />

        <AIToolkitSection />

        <IntegrationsWallSection />

        {/* Visual break — navy gradient with gold orbs/rings (no photo bg).
            Photos read poorly behind display copy and the agency is one
            person, so the design element does the heavy lifting here. */}
        <LifestyleBreakSection
          variant="navy-gradient"
          overlayText="Built by producers, for producers."
          overlaySubtext="Every feature on this page was designed by someone who writes business and got tired of doing it the slow way."
        />

        <FullFeatureMatrixSection />

        <AboutSection theme={theme} />

        {theme.gallery_enabled && theme.gallery_images.length > 0 && (
          <CultureGallery theme={theme} />
        )}

        <OpportunityPath theme={theme} />

        <EarningsAndCompSection />

        <FounderQuoteSection />

        {theme.stats_enabled && <StatsBar theme={theme} />}

        {theme.testimonials_enabled && theme.testimonials.length > 0 && (
          <TestimonialsCarousel theme={theme} />
        )}

        {theme.faq_enabled && <FaqAccordion theme={theme} />}

        <FinalCta theme={theme} />
      </main>

      <LandingFooter theme={theme} />
    </div>
  );
}
