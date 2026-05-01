import { ArrowRight } from "lucide-react";
import type { LandingPageTheme } from "../types";
import { useReveal } from "../hooks/useReveal";
import { GoldCTAButton } from "./GoldCTAButton";

interface Props {
  theme: LandingPageTheme;
}

const PLATFORM_FEATURE_BY_TITLE: Record<
  string,
  { feature: string; detail: string }
> = {
  Apply: {
    feature: "Onboarding pipeline",
    detail:
      "Interactive checklists with videos, quizzes, signatures, and DocuSeal envelopes. Phase transitions trigger emails and Slack alerts automatically.",
  },
  Train: {
    feature: "Gamified training modules",
    detail:
      "XP for completing lessons, badges for streaks, daily challenges, team leaderboards. Quiz Builder for custom assessments. Trainer dashboard for content management.",
  },
  Earn: {
    feature: "AI Lead Heat + auto-commission engine",
    detail:
      "Every lead in your Close pipeline scored 0–100. Premiums in, commissions out. Advances tracked, chargebacks handled, persistency calculated, overrides distributed up your hierarchy.",
  },
  Lead: {
    feature: "Recruiting pipeline + downline reports",
    detail:
      "Build your team using the same kanban you came in through. Branded landing pages on your own domain. Real-time downline performance and override roll-ups.",
  },
};

export function OpportunityPath({ theme }: Props) {
  const ref = useReveal<HTMLDivElement>();
  if (!theme.opportunity_steps || theme.opportunity_steps.length === 0)
    return null;

  return (
    <section id="opportunity" className="section-cream py-24 lg:py-32">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <p className="eyebrow mb-4">The Opportunity</p>
          <h2 className="font-display text-3xl lg:text-5xl text-[var(--landing-navy)] mb-4 leading-[1.1]">
            {theme.opportunity_headline ||
              "From your first license to leading your own downline."}
          </h2>
          <p className="text-lg text-[var(--landing-slate)] leading-relaxed">
            {theme.opportunity_subheadline ||
              "Four phases. Every one of them backed by software that does the work other agencies expect you to do by hand."}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {theme.opportunity_steps.map((step, idx) => {
            const platformBlurb = PLATFORM_FEATURE_BY_TITLE[step.title];
            const isLast = idx === theme.opportunity_steps.length - 1;
            return (
              <div key={`${step.title}-${idx}`} className="relative">
                {!isLast && <div className="hidden lg:block step-connector" />}

                <div className="font-display text-6xl text-[var(--landing-gold)] leading-none mb-5 opacity-50">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <h3 className="font-display text-2xl text-[var(--landing-navy)] mb-3">
                  {step.title}
                </h3>
                <p className="text-base text-[var(--landing-slate)] leading-relaxed mb-5">
                  {step.description}
                </p>
                {platformBlurb && (
                  <div className="pt-5 border-t border-[var(--landing-border)]">
                    <p className="eyebrow text-xs mb-2">Platform support</p>
                    <p className="text-sm font-semibold text-[var(--landing-navy)] mb-1">
                      {platformBlurb.feature}
                    </p>
                    <p className="text-xs text-[var(--landing-slate)] leading-relaxed">
                      {platformBlurb.detail}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-16 pt-16 border-t border-[var(--landing-border)] text-center">
          <p className="text-lg text-[var(--landing-slate)] mb-6">
            Ready to take the first step?
          </p>
          <GoldCTAButton to="/join-the-standard" className="btn-lg">
            Apply to Join
            <ArrowRight size={20} className="hidden" />
          </GoldCTAButton>
        </div>
      </div>
    </section>
  );
}
