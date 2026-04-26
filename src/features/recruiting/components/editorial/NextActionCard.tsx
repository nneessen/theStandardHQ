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

const TONE_SURFACE: Record<NextActionTone, string> = {
  primary:
    "bg-amber-50 dark:bg-amber-950/30 ring-amber-200/80 dark:ring-amber-900",
  warn: "bg-orange-50 dark:bg-orange-950/30 ring-orange-200/80 dark:ring-orange-900",
  neutral:
    "bg-stone-50 dark:bg-stone-900 ring-stone-200/80 dark:ring-stone-800",
  success:
    "bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-200/80 dark:ring-emerald-900",
};

const TONE_RULE: Record<NextActionTone, string> = {
  primary: "bg-amber-500",
  warn: "bg-orange-500",
  neutral: "bg-stone-500 dark:bg-stone-600",
  success: "bg-emerald-500",
};

const TONE_LABEL: Record<NextActionTone, string> = {
  primary: "text-amber-800 dark:text-amber-300",
  warn: "text-orange-800 dark:text-orange-300",
  neutral: "text-stone-700 dark:text-stone-300",
  success: "text-emerald-800 dark:text-emerald-300",
};

const TONE_CHIP: Record<NextActionTone, string> = {
  primary: "bg-amber-500 hover:bg-amber-400 text-stone-900",
  warn: "bg-orange-500 hover:bg-orange-400 text-white",
  neutral:
    "bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-white text-white dark:text-stone-900",
  success: "bg-emerald-600 hover:bg-emerald-500 text-white",
};

const TONE_HEADLINE: Record<NextActionTone, string> = {
  primary: "text-stone-900 dark:text-stone-100",
  warn: "text-stone-900 dark:text-stone-100",
  neutral: "text-stone-900 dark:text-stone-100",
  success: "text-stone-900 dark:text-stone-100",
};

const TONE_BODY: Record<NextActionTone, string> = {
  primary: "text-stone-700 dark:text-stone-300",
  warn: "text-stone-700 dark:text-stone-300",
  neutral: "text-stone-700 dark:text-stone-300",
  success: "text-stone-700 dark:text-stone-300",
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
  const ctaCls = cn(
    "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold tracking-tight transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0",
    TONE_CHIP[tone],
  );

  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-2xl ring-1 shadow-sm dark:shadow-none",
        TONE_SURFACE[tone],
        className,
      )}
    >
      <div
        aria-hidden
        className={cn("absolute left-0 top-0 bottom-0 w-1.5", TONE_RULE[tone])}
      />
      <div className="pl-7 pr-6 py-5 md:pl-8 md:pr-7 md:py-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={cn("h-3.5 w-3.5", TONE_LABEL[tone])} />
          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.2em] font-bold",
              TONE_LABEL[tone],
            )}
          >
            {eyebrow}
          </span>
        </div>
        <p
          className={cn(
            "text-lg sm:text-xl font-semibold leading-snug max-w-2xl",
            TONE_HEADLINE[tone],
          )}
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {headline}
        </p>
        {caption && (
          <p
            className={cn(
              "mt-2 text-[13px] max-w-2xl leading-relaxed",
              TONE_BODY[tone],
            )}
          >
            {caption}
          </p>
        )}
        {ctaLabel && (ctaHref || onCta) && (
          <div className="mt-4">
            {ctaHref ? (
              <a href={ctaHref} className={ctaCls}>
                {ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <button type="button" onClick={onCta} className={ctaCls}>
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
