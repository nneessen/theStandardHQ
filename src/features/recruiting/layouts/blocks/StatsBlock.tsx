// src/features/recruiting/layouts/blocks/StatsBlock.tsx
import type { StatsBlock as StatsBlockData } from "@/types/recruiting-design-spec.types";
import { resolveIcon } from "./icons";

export function StatsBlock({ block }: { block: StatsBlockData }) {
  const cols = Math.min(block.items.length, 4);
  if (block.style === "inline") {
    return (
      <section className="flex flex-wrap gap-x-8 gap-y-4">
        {block.items.map((item, i) => {
          const Icon = resolveIcon(item.icon);
          return (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-eyebrow inline-flex items-center gap-1.5">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {item.label}
              </span>
              <span
                className="font-display font-black tabular leading-none"
                style={{
                  fontSize: "1.6rem",
                  color: "var(--spec-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                {item.value}
              </span>
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <section
      className="lattice-grid max-w-md"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {block.items.map((item, i) => {
        const Icon = resolveIcon(item.icon);
        return (
          <div key={i} className="lattice-cell !p-3 flex flex-col gap-1">
            <span className="text-eyebrow inline-flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {item.label}
            </span>
            <span
              className="font-display font-black tabular leading-none"
              style={{
                fontSize: "1.5rem",
                color: "var(--spec-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              {item.value}
            </span>
          </div>
        );
      })}
    </section>
  );
}
