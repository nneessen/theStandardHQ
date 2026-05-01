import type { LandingPageTheme } from "../types";
import { useReveal } from "../hooks/useReveal";

interface Props {
  theme: LandingPageTheme;
}

export function TestimonialsCarousel({ theme }: Props) {
  const ref = useReveal<HTMLDivElement>();
  if (!theme.testimonials || theme.testimonials.length === 0) return null;

  const display = theme.testimonials.slice(0, 3);

  return (
    <section id="stories" className="section-cream py-24 lg:py-32">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <p className="eyebrow mb-4">Agent Stories</p>
          <h2 className="font-display text-3xl lg:text-5xl text-[var(--landing-navy)] leading-[1.1]">
            {theme.testimonials_headline || "Real agents. Real numbers."}
          </h2>
          {theme.testimonials_subheadline && (
            <p className="text-lg text-[var(--landing-slate)] mt-4">
              {theme.testimonials_subheadline}
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {display.map((t, idx) => (
            <div
              key={`${t.name}-${idx}`}
              className="bg-[var(--landing-warm-white)] p-8 lg:p-10 border border-[var(--landing-border)] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)]"
            >
              <div className="quote-mark mb-4">"</div>

              <blockquote className="text-[var(--landing-slate)] text-lg leading-relaxed mb-8 min-h-[6rem]">
                {t.quote}
              </blockquote>

              <div className="pt-6 border-t border-[var(--landing-border)] flex items-center gap-4">
                {t.image_url && (
                  <img
                    src={t.image_url}
                    alt={t.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--landing-navy)] font-semibold">
                    {t.name}
                  </p>
                  {t.role && (
                    <p className="text-[var(--landing-slate-soft)] text-sm">
                      {t.role}
                    </p>
                  )}
                  {t.earnings && (
                    <p className="text-[var(--landing-gold-deep)] text-sm mt-1 font-medium">
                      {t.earnings}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
