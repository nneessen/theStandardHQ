import { useState } from "react";
import { Check } from "lucide-react";
import {
  PLATFORM_PILLARS,
  type PlatformPillar,
} from "../data/platform-pillars";
import { useReveal } from "../hooks/useReveal";

export function PlatformTourSection() {
  const [activeId, setActiveId] = useState(PLATFORM_PILLARS[0].id);
  const ref = useReveal<HTMLDivElement>();
  const active =
    PLATFORM_PILLARS.find((p) => p.id === activeId) ?? PLATFORM_PILLARS[0];

  return (
    <section id="platform" className="surface-base py-20 lg:py-28">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-14">
          <div className="section-eyebrow-row">
            <span className="section-eyebrow-num">02</span>
            <span className="section-eyebrow-line" />
            <span className="section-eyebrow-label">The Platform</span>
          </div>

          <h2
            className="text-display-2xl text-[var(--landing-deep-green)] mb-6"
            style={{ fontWeight: 300 }}
          >
            Eight pillars.
            <br />
            One operating system.
          </h2>
          <p className="text-fluid-lg text-muted max-w-2xl">
            Every part of your day as an agent — finding leads, qualifying them,
            training, writing apps, getting paid — lives inside one platform
            built specifically for what we do.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
          {/* Pillar list — vertical mono index */}
          <div
            className="grid grid-cols-1"
            style={{ gap: "1px", background: "var(--landing-border)" }}
          >
            {PLATFORM_PILLARS.map((pillar, idx) => (
              <PillarTab
                key={pillar.id}
                pillar={pillar}
                index={idx + 1}
                isActive={pillar.id === activeId}
                onActivate={() => setActiveId(pillar.id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PillarDetail pillar={active} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PillarTab({
  pillar,
  index,
  isActive,
  onActivate,
}: {
  pillar: PlatformPillar;
  index: number;
  isActive: boolean;
  onActivate: () => void;
}) {
  const Icon = pillar.icon;
  return (
    <button
      type="button"
      onClick={onActivate}
      onMouseEnter={onActivate}
      className={`group w-full text-left p-5 transition-colors flex items-center gap-4 ${
        isActive
          ? "bg-[var(--landing-white)]"
          : "bg-[var(--landing-icy-blue)] hover:bg-[var(--landing-white)]"
      }`}
    >
      <span className="section-eyebrow-num shrink-0">
        {String(index).padStart(2, "0")}
      </span>
      <div
        className={`icon-container ${isActive ? "icon-container-accent" : ""}`}
      >
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-eyebrow mb-0.5">{pillar.eyebrow}</p>
        <h3
          className="text-display-xl !text-base !font-bold !tracking-normal !normal-case text-[var(--landing-deep-green)]"
          style={{ fontFamily: "var(--landing-font-mono)", lineHeight: 1.3 }}
        >
          {pillar.title}
        </h3>
      </div>
    </button>
  );
}

function PillarDetail({ pillar }: { pillar: PlatformPillar }) {
  return (
    <div className="card p-8 lg:p-12">
      <p className="text-eyebrow mb-3">{pillar.eyebrow}</p>
      <h3
        className="text-display-2xl text-[var(--landing-deep-green)] mb-4"
        style={{ fontWeight: 700 }}
      >
        {pillar.title}
      </h3>
      <p
        className="text-fluid-lg text-[var(--landing-deep-green)] mb-5 mono"
        style={{ color: "var(--landing-forest-green)" }}
      >
        {pillar.tagline}
      </p>
      <p className="text-sm text-muted leading-relaxed mb-8">{pillar.body}</p>

      <div className="pt-6 border-t border-[var(--landing-border)]">
        <p className="text-eyebrow mb-4">What's inside</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {pillar.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <Check
                size={14}
                strokeWidth={2.5}
                className="text-[var(--landing-adventure-yellow)] mt-1 shrink-0"
                style={{
                  background: "var(--landing-deep-green)",
                  borderRadius: "1px",
                  padding: "1px",
                }}
              />
              <span className="text-sm text-[var(--landing-deep-green)] leading-snug">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
