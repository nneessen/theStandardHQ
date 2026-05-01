import { ArrowRight, Sparkles, Cpu, Phone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { LandingPageTheme } from "../types";

interface Props {
  theme: LandingPageTheme;
}

const HEADLINE_FALLBACK_LINE_1 = "The Operating System";
const HEADLINE_FALLBACK_LINE_2 = "For Modern Insurance Agents";

const SUBHEAD_FALLBACK =
  "AI scores every lead in your pipeline. AI writes your Close emails, SMS, and full sequences. The underwriting wizard recommends the right carrier in three minutes. Commissions, advances, chargebacks, and downline overrides calculate themselves. Built in-house, not bought.";

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="floating-shape floating-shape-1"
        style={{ top: "8%", right: "5%" }}
      />
      <div
        className="floating-shape floating-shape-2"
        style={{ bottom: "18%", left: "8%" }}
      />
      <div
        className="floating-shape floating-shape-3"
        style={{ top: "22%", left: "14%" }}
      />
      <div
        className="floating-shape floating-shape-ring"
        style={{ bottom: "28%", right: "12%" }}
      />
    </div>
  );
}

export function HeroSection({ theme }: Props) {
  // Use theme overrides if non-default, otherwise fallback copy
  const headline =
    theme.hero_headline && theme.hero_headline !== "Build Your Future"
      ? theme.hero_headline
      : null;
  const subhead =
    theme.hero_subheadline &&
    theme.hero_subheadline !== "Remote sales careers for the ambitious"
      ? theme.hero_subheadline
      : SUBHEAD_FALLBACK;
  const ctaText = theme.hero_cta_text || "Apply to Join";
  const ctaLink = theme.hero_cta_link || "/join-the-standard";

  return (
    <section className="relative min-h-[90vh] flex items-center surface-base overflow-hidden">
      <FloatingShapes />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 w-full pt-24 lg:pt-32 pb-20">
        <div className="max-w-4xl">
          {/* Pulse-glow badge + eyebrow row */}
          <div className="inline-flex items-center gap-3 mb-12">
            <span className="relative inline-flex items-center px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-[var(--landing-icy-blue)] uppercase bg-[var(--landing-deep-green)] rounded-[2px] pulse-glow font-mono">
              Recruiting Now
            </span>
            <span className="w-12 h-px bg-[var(--landing-border)]" />
            <span className="text-eyebrow-lg">Exclusive Agent Opportunity</span>
          </div>

          {/* Stacked headlines — light weight Big Shoulders, two lines */}
          <div className="mb-8">
            {headline ? (
              <h1
                className="text-display-hero text-[var(--landing-deep-green)]"
                style={{ fontWeight: 300 }}
              >
                {headline}
              </h1>
            ) : (
              <>
                <h1
                  className="text-display-hero text-[var(--landing-deep-green)]"
                  style={{ fontWeight: 300 }}
                >
                  {HEADLINE_FALLBACK_LINE_1}
                </h1>
                <h1
                  className="text-display-hero text-[var(--landing-deep-green)]"
                  style={{ fontWeight: 300 }}
                >
                  {HEADLINE_FALLBACK_LINE_2}
                </h1>
              </>
            )}
          </div>

          {/* Long subhead in muted */}
          <p className="text-fluid-lg text-muted mb-12 max-w-2xl font-normal">
            {subhead}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-16">
            <Link to={ctaLink} className="btn btn-primary btn-lg">
              {ctaText}
              <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
            <a href="#platform" className="btn btn-secondary btn-lg">
              Tour the platform
            </a>
          </div>

          {/* Trust indicators with icon-container squares */}
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="icon-container">
                <Sparkles
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--landing-deep-green)]"
                />
              </div>
              <span className="text-eyebrow-lg !text-[var(--landing-deep-green)]">
                Production AI Toolkit
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="icon-container">
                <Cpu
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--landing-deep-green)]"
                />
              </div>
              <span className="text-eyebrow-lg !text-[var(--landing-deep-green)]">
                Built In-House
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="icon-container">
                <Phone
                  size={18}
                  strokeWidth={1.5}
                  className="text-[var(--landing-deep-green)]"
                />
              </div>
              <span className="text-eyebrow-lg !text-[var(--landing-deep-green)]">
                100% Remote
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
