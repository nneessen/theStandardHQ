import { Check } from "lucide-react";
import type { PlatformPillar } from "../data/platform-pillars";

interface Props {
  pillar: PlatformPillar;
  isActive: boolean;
  onActivate: () => void;
}

export function PlatformPillarCard({ pillar, isActive, onActivate }: Props) {
  const Icon = pillar.icon;
  return (
    <button
      type="button"
      onClick={onActivate}
      onMouseEnter={onActivate}
      aria-pressed={isActive}
      className={`relative w-full text-left p-5 lg:p-6 border rounded-lg transition-all overflow-hidden group ${
        isActive
          ? "bg-[var(--landing-warm-white)] border-[var(--landing-gold)] shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
          : "bg-[var(--landing-warm-white)] border-[var(--landing-border)] hover:border-[var(--landing-gold)]/40 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      }`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-[var(--landing-gold)] transition-transform duration-300 ${
          isActive
            ? "translate-x-0"
            : "-translate-x-full group-hover:translate-x-0"
        }`}
      />

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-[var(--landing-navy)]/[0.04] flex items-center justify-center rounded shrink-0">
          <Icon
            size={22}
            strokeWidth={1.5}
            className="text-[var(--landing-navy)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider font-medium text-[var(--landing-gold-deep)] mb-1">
            {pillar.eyebrow}
          </p>
          <h3 className="font-display text-lg lg:text-xl text-[var(--landing-navy)] leading-tight">
            {pillar.title}
          </h3>
        </div>
      </div>
    </button>
  );
}

export function PlatformPillarDetail({ pillar }: { pillar: PlatformPillar }) {
  return (
    <div className="bg-[var(--landing-warm-white)] border border-[var(--landing-border)] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] p-8 lg:p-12">
      <p className="eyebrow mb-4">{pillar.eyebrow}</p>
      <h3 className="font-display text-3xl lg:text-4xl text-[var(--landing-navy)] mb-4 leading-[1.1]">
        {pillar.title}
      </h3>
      <p className="text-lg text-[var(--landing-gold-deep)] font-medium mb-5">
        {pillar.tagline}
      </p>
      <p className="text-base text-[var(--landing-slate)] mb-8 leading-relaxed">
        {pillar.body}
      </p>

      <div className="pt-6 border-t border-[var(--landing-border)]">
        <p className="text-sm text-[var(--landing-slate-soft)] mb-4">
          What's inside
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {pillar.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check
                size={18}
                strokeWidth={2.5}
                className="text-[var(--landing-gold-deep)] mt-0.5 shrink-0"
              />
              <span className="text-sm text-[var(--landing-navy)] leading-snug">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
