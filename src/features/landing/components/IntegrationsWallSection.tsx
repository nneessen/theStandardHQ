import { INTEGRATIONS } from "../data/integrations";
import { useReveal } from "../hooks/useReveal";

export function IntegrationsWallSection() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="section-cream py-24 lg:py-32">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <p className="eyebrow mb-3">The stack</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-4">
            Built on tools that actually work.
          </h2>
          <p className="text-lg text-[var(--landing-slate)]">
            We didn't reinvent the wheel — we composed the best of every
            category. Your work flows through these systems automatically.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.id}
              className="landing-card p-5 flex flex-col gap-2"
            >
              <div className="font-display text-lg text-[var(--landing-navy)]">
                {integration.name}
              </div>
              <p className="text-xs text-[var(--landing-slate)] leading-relaxed">
                {integration.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
