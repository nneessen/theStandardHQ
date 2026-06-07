// src/features/recruiting/layouts/blocks/HeroBlock.tsx
import { ArrowRight, Sparkles } from "lucide-react";
import type { HeroBlock as HeroBlockData } from "@/types/recruiting-design-spec.types";
import type { BlockRenderContext } from "./types";

/** Split a single-line headline into two display lines (matches the editorial hero). */
function splitHeadline(raw: string): [string, string] {
  const parts = raw.split(/\s*\|\s*/);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(" ")];
  const words = raw.split(/\s+/);
  if (words.length >= 4) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  return [raw, ""];
}

export function HeroBlock({
  block,
  ctx,
}: {
  block: HeroBlockData;
  ctx: BlockRenderContext;
}) {
  const [line1, line2] = splitHeadline(block.headline);
  const centered = block.variant === "stacked";
  const minimal = block.variant === "minimal";

  return (
    <section
      className={`flex flex-col ${centered ? "items-center text-center" : "items-start"}`}
    >
      {block.eyebrow && !minimal && (
        <div className="inline-flex items-center gap-3 mb-5">
          <span
            className="pulse-glow inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] rounded-[2px] font-mono"
            style={{
              background: "var(--spec-primary)",
              color: "var(--spec-primary-fg)",
            }}
          >
            {block.eyebrow}
          </span>
          {!centered && (
            <span className="hidden sm:block w-10 h-px bg-[var(--landing-border)]" />
          )}
        </div>
      )}

      <h1
        className={minimal ? "text-display-xl" : "text-display-2xl"}
        style={{ fontWeight: 300 }}
      >
        {line1}
        {line2 && (
          <>
            <br />
            <span style={{ fontWeight: 900 }}>{line2}</span>
          </>
        )}
      </h1>

      {block.subhead && (
        <p
          className={`text-fluid-base text-muted mt-4 lg:mt-5 max-w-[44ch] ${centered ? "mx-auto" : ""}`}
        >
          {block.subhead}
        </p>
      )}

      {(block.primary_cta || block.secondary_cta === "book_call") && (
        <div
          className={`mt-7 flex flex-wrap items-center gap-3 ${centered ? "justify-center" : ""}`}
        >
          {block.primary_cta && (
            <button
              type="button"
              onClick={ctx.onOpenForm}
              className="btn btn-lg"
              style={{
                background: "var(--spec-primary)",
                color: "var(--spec-primary-fg)",
                borderColor: "var(--spec-primary)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {block.primary_cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {block.secondary_cta === "book_call" && ctx.calendlyUrl && (
            <button
              type="button"
              onClick={ctx.onBookCall}
              className="btn btn-secondary btn-lg"
            >
              Schedule a Call
            </button>
          )}
        </div>
      )}
    </section>
  );
}
