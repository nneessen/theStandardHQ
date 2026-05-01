import { FEATURE_MATRIX, TOTAL_FEATURE_COUNT } from "../data/feature-matrix";
import { useReveal } from "../hooks/useReveal";

export function FullFeatureMatrixSection() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="section-warm-white py-24 lg:py-32">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Every feature, no exceptions</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-4">
            {TOTAL_FEATURE_COUNT}+ capabilities. All shipped. All in production.
          </h2>
          <p className="text-lg text-[var(--landing-slate)]">
            We don't have a "coming soon" page. Below is the complete inventory
            of what your day-one toolkit looks like.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
          {FEATURE_MATRIX.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.id}>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--landing-border)]">
                  <span className="landing-icon-tile">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <h3 className="font-display text-2xl">{category.title}</h3>
                  <span className="ml-auto text-xs text-[var(--landing-slate-soft)] font-medium">
                    {category.features.length}
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {category.features.map((feature) => (
                    <li
                      key={feature.name}
                      className="grid grid-cols-[auto_1fr] gap-x-3 text-sm leading-snug"
                    >
                      <span className="font-semibold text-[var(--landing-navy)] whitespace-nowrap">
                        {feature.name}
                      </span>
                      <span className="text-[var(--landing-slate)]">
                        — {feature.benefit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
