import { useScrollAnimation, useCountUp } from "../hooks";
import type { LandingPageTheme, StatItem } from "../types";

interface Props {
  theme: LandingPageTheme;
}

function StatBlock({
  stat,
  index,
  isVisible,
}: {
  stat: StatItem;
  index: number;
  isVisible: boolean;
}) {
  const numericValue = parseFloat(stat.value.replace(/[^0-9.-]/g, "")) || 0;
  const { formattedValue } = useCountUp(numericValue, {
    enabled: isVisible,
    duration: 1500,
    delay: index * 100,
    decimals: 0,
  });

  return (
    <div
      className="text-center lg:text-left"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${index * 100}ms`,
      }}
    >
      <div className="font-display text-5xl lg:text-6xl text-[var(--landing-gold)] leading-none mb-3">
        {stat.prefix}
        {formattedValue}
        {stat.suffix}
      </div>
      <div className="text-sm uppercase tracking-[0.18em] text-[var(--landing-cream)]/60 font-medium">
        {stat.label}
      </div>
    </div>
  );
}

export function StatsBar({ theme }: Props) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({
    threshold: 0.2,
    triggerOnce: true,
  });

  if (!theme.stats_data || theme.stats_data.length === 0) return null;

  return (
    <section ref={ref} className="section-navy py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
          {theme.stats_data.map((stat, index) => (
            <StatBlock
              key={stat.label}
              stat={stat}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
