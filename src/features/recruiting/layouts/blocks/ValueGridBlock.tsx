// src/features/recruiting/layouts/blocks/ValueGridBlock.tsx
// Editorial numbered list (big index numerals + hairline rules) — intentionally
// NOT a grid of icon cards (that reads as generic SaaS/AI-built).
import type { ValueGridBlock as ValueGridBlockData } from "@/types/recruiting-design-spec.types";

export function ValueGridBlock({ block }: { block: ValueGridBlockData }) {
  return (
    <section>
      {block.heading && (
        <div className="section-eyebrow-row !mb-3">
          <span className="section-eyebrow-line" />
          <span className="section-eyebrow-label">{block.heading}</span>
        </div>
      )}
      <ul className="border-t border-[var(--landing-border)]">
        {block.items.map((item, i) => (
          <li
            key={i}
            className="flex items-baseline gap-4 border-b border-[var(--landing-border)] py-3"
          >
            <span
              className="font-display font-black tabular leading-none"
              style={{
                fontSize: "1.5rem",
                color: "var(--spec-primary)",
                letterSpacing: "-0.03em",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold uppercase leading-tight tracking-tight text-[1.05rem]">
                {item.title}
              </p>
              {item.body && (
                <p className="text-eyebrow mt-0.5 !normal-case !tracking-normal leading-relaxed">
                  {item.body}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
