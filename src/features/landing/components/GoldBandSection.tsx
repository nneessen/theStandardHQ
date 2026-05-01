import { TOTAL_FEATURE_COUNT } from "../data/feature-matrix";
import { PLATFORM_PILLARS } from "../data/platform-pillars";
import { INTEGRATIONS } from "../data/integrations";

const STATS = [
  { value: `${TOTAL_FEATURE_COUNT}+`, label: "Capabilities Shipped" },
  { value: `${PLATFORM_PILLARS.length}`, label: "Platform Pillars" },
  { value: "5", label: "AI Features" },
  { value: `${INTEGRATIONS.length}`, label: "Integrations" },
];

export function GoldBandSection() {
  return (
    <section
      className="py-14 lg:py-20 relative overflow-hidden"
      style={{ background: "var(--landing-deep-green)" }}
    >
      <div
        className="floating-shape"
        style={{
          width: 480,
          height: 480,
          top: "-200px",
          right: "-100px",
          background:
            "radial-gradient(circle, rgba(226,255,204,0.18), transparent 65%)",
          borderRadius: "50%",
        }}
      />
      <div
        className="floating-shape"
        style={{
          width: 320,
          height: 320,
          bottom: "-160px",
          left: "10%",
          background:
            "radial-gradient(circle, rgba(226,255,204,0.10), transparent 70%)",
          borderRadius: "50%",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
        <div
          className="grid grid-cols-2 lg:grid-cols-4"
          style={{ gap: "1px", background: "rgba(132, 144, 127, 0.18)" }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="px-6 py-10 lg:py-14 text-center"
              style={{ background: "var(--landing-deep-green)" }}
            >
              <div
                className="text-display-3xl mb-3"
                style={{
                  color: "var(--landing-adventure-yellow)",
                  fontWeight: 700,
                }}
              >
                {stat.value}
              </div>
              <div className="text-eyebrow !text-[var(--landing-icy-blue)]/60">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
