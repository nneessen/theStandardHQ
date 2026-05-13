import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type NextActionTone = "primary" | "warn" | "neutral" | "success";

interface NextActionCardProps {
  eyebrow: string;
  headline: React.ReactNode;
  caption?: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  ctaHref?: string;
  tone?: NextActionTone;
  className?: string;
}

// Themed for `.theme-landing` — deep-green rule on the left, paper surface,
// adventure-yellow accents on the primary tone.
const TONE_STYLES: Record<
  NextActionTone,
  {
    surface: string;
    rule: string;
    label: string;
    chipBg: string;
    chipText: string;
  }
> = {
  primary: {
    surface: "var(--landing-adventure-yellow)",
    rule: "var(--landing-deep-green)",
    label: "var(--landing-deep-green)",
    chipBg: "var(--landing-deep-green)",
    chipText: "var(--landing-icy-blue)",
  },
  warn: {
    surface: "var(--landing-adventure-yellow-dim)",
    rule: "var(--landing-deep-green)",
    label: "var(--landing-deep-green)",
    chipBg: "var(--landing-deep-green)",
    chipText: "var(--landing-icy-blue)",
  },
  neutral: {
    surface: "var(--landing-icy-blue-light)",
    rule: "var(--landing-terrain-grey-dark)",
    label: "var(--landing-terrain-grey-dark)",
    chipBg: "var(--landing-terrain-grey-dark)",
    chipText: "var(--landing-icy-blue)",
  },
  success: {
    surface: "var(--landing-adventure-yellow)",
    rule: "var(--landing-deep-green)",
    label: "var(--landing-deep-green)",
    chipBg: "var(--landing-deep-green)",
    chipText: "var(--landing-icy-blue)",
  },
};

export const NextActionCard: React.FC<NextActionCardProps> = ({
  eyebrow,
  headline,
  caption,
  ctaLabel,
  onCta,
  ctaHref,
  tone = "primary",
  className,
}) => {
  const t = TONE_STYLES[tone];
  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-[2px] border border-[var(--landing-border)]",
        "shadow-[0_1px_0_rgba(22,27,19,0.04),0_4px_16px_-2px_rgba(22,27,19,0.06)]",
        className,
      )}
      style={{ background: t.surface }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ background: t.rule }}
      />
      <div className="pl-7 pr-6 py-5 md:pl-8 md:pr-7 md:py-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5" style={{ color: t.label }} />
          <span className="text-eyebrow-lg" style={{ color: t.label }}>
            {eyebrow}
          </span>
        </div>
        <p
          className="text-display-xl max-w-2xl"
          style={{
            color: "var(--landing-deep-green)",
            fontWeight: 800,
            fontFamily: "var(--landing-font-display)",
            textTransform: "none",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {headline}
        </p>
        {caption && (
          <p className="mt-2 text-fluid-base text-muted max-w-2xl">{caption}</p>
        )}
        {ctaLabel && (ctaHref || onCta) && (
          <div className="mt-4">
            {ctaHref ? (
              <a
                href={ctaHref}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[2px] text-[13px] font-bold uppercase tracking-[0.06em] transition-all hover:-translate-y-px font-mono"
                style={{ background: t.chipBg, color: t.chipText }}
              >
                {ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <button
                type="button"
                onClick={onCta}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[2px] text-[13px] font-bold uppercase tracking-[0.06em] transition-all hover:-translate-y-px font-mono"
                style={{ background: t.chipBg, color: t.chipText }}
              >
                {ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
