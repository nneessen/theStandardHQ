// src/features/recruiting/layouts/blocks/ValueGridBlock.tsx
import type { ValueGridBlock as ValueGridBlockData } from "@/types/recruiting-design-spec.types";
import { resolveIcon } from "./icons";

export function ValueGridBlock({ block }: { block: ValueGridBlockData }) {
  return (
    <section className="space-y-4">
      {block.heading && (
        <div className="section-eyebrow-row !mb-0">
          <span className="section-eyebrow-line" />
          <span className="section-eyebrow-label">{block.heading}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {block.items.map((item, i) => {
          const Icon = resolveIcon(item.icon);
          return (
            <div key={i} className="card card-hover p-4 flex gap-3">
              {Icon && (
                <span
                  className="landing-icon-tile h-9 w-9 shrink-0"
                  style={{
                    background: "var(--spec-primary)",
                    color: "var(--spec-primary-fg)",
                    borderColor: "var(--spec-primary)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0">
                <p className="font-display font-bold uppercase tracking-tight text-[0.95rem] leading-tight">
                  {item.title}
                </p>
                {item.body && (
                  <p className="text-eyebrow !normal-case !tracking-normal mt-1 leading-relaxed">
                    {item.body}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
