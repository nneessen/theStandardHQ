// src/features/recruiting/layouts/shells/IdentitySidebarShell.tsx
//
// The "identity-sidebar" layout — a PERSONAL, recruiter-forward page. The LEFT
// pane is a personal-brand identity rail: a large rounded headshot (or elegant
// initials), the recruiter's name + agency, a short tagline, social icons, then
// the custom hero (headline + subhead) and the supporting content stream, capped
// by a primary CTA. The RIGHT pane is the pinned lead form (rendered by
// PinnedFormShell — never hand-mount the form here). On mobile PinnedFormShell
// collapses to natural flow: identity + content above, form below.

import {
  ArrowRight,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Headshot,
  ShellHeader,
  ContentStream,
  splitFormAndContent,
} from "./shellKit";
import { PinnedFormShell } from "./scaffolds";
import type { ShellProps } from "./types";
import { getActiveSocialLinks } from "../types";

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

/** Up to two initials from the recruiter's name (graceful headshot fallback). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function IdentitySidebarShell(props: ShellProps) {
  const { spec, ctx } = props;
  const { contentBlocks } = splitFormAndContent(spec);

  // CUSTOM HERO — read the hero block directly (tolerate its absence).
  const heroBlock = spec.blocks.find((b) => b.type === "hero");
  const hero = heroBlock && heroBlock.type === "hero" ? heroBlock : null;

  // Everything except the hero + form flows through the content stream. The
  // supporting blocks lead UP to the CTA; contact/footer trail AFTER it so the
  // CTA is the climax of the rail (never buried beneath the copyright line).
  const rest = contentBlocks.filter((b) => b.type !== "hero");
  const railBlocks = rest.filter(
    (b) => b.type !== "contact" && b.type !== "footer",
  );
  const tailBlocks = rest.filter(
    (b) => b.type === "contact" || b.type === "footer",
  );

  const socials = getActiveSocialLinks(ctx.socialLinks);
  const fullName = ctx.recruiterFullName || ctx.displayName;
  const initials = initialsOf(fullName);
  const tagline = hero?.eyebrow;
  const primaryLabel = hero?.primary_cta || ctx.ctaText;

  return (
    <PinnedFormShell
      shell={props}
      gridCols="0.95fr 1.05fr"
      left={
        <div className="flex min-h-full flex-col gap-9 px-5 pt-5 pb-10 sm:px-8 lg:gap-11 lg:px-12 lg:py-10 xl:px-14">
          <ShellHeader ctx={props.ctx} theme={props.theme} />

          {/* IDENTITY CARD — the personal-brand panel anchored at the top. */}
          <section className="flex flex-col items-start gap-5">
            <div className="flex items-center gap-5">
              {ctx.headshotUrl ? (
                <Headshot
                  ctx={ctx}
                  shape="rounded"
                  className="h-24 w-24 shrink-0 border border-[var(--landing-border-strong)] sm:h-28 sm:w-28"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="font-display flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border text-3xl font-black leading-none sm:h-28 sm:w-28"
                  style={{
                    background: "var(--spec-primary)",
                    color: "var(--spec-primary-fg)",
                    borderColor: "var(--spec-primary)",
                  }}
                >
                  {initials}
                </span>
              )}

              <div className="min-w-0">
                <p className="text-eyebrow mb-1">Your Recruiter</p>
                <p className="text-display-xl leading-none">{fullName}</p>
                {ctx.displayName && ctx.displayName !== fullName && (
                  <p
                    className="font-mono mt-1.5 text-[0.8125rem] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--spec-primary)" }}
                  >
                    {ctx.displayName}
                  </p>
                )}
              </div>
            </div>

            {tagline && (
              <p className="text-fluid-base text-muted max-w-[42ch] leading-relaxed">
                {tagline}
              </p>
            )}

            {socials.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5">
                {socials.map(({ platform, url }) => {
                  const Icon = SOCIAL_ICONS[platform];
                  if (!Icon) return null;
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={platform}
                      className="landing-icon-tile h-9 w-9 transition-colors hover:border-[var(--spec-primary)]"
                      style={{ color: "var(--spec-primary)" }}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <div className="hairline" />

          {/* CUSTOM HERO — headline + subhead, drawn from the hero block. */}
          {hero && (
            <section className="flex flex-col items-start">
              <h1 className="text-display-2xl" style={{ fontWeight: 900 }}>
                {hero.headline}
              </h1>
              {hero.subhead && (
                <p className="text-fluid-lg text-muted mt-4 max-w-[46ch] leading-relaxed">
                  {hero.subhead}
                </p>
              )}
            </section>
          )}

          {/* SUPPORTING CONTENT — value_grid / about / testimonial / etc. */}
          {railBlocks.length > 0 && (
            <ContentStream
              blocks={railBlocks}
              ctx={ctx}
              className="flex flex-col gap-9 lg:gap-11"
            />
          )}

          {/* CTA — scrolls the prospect to the pinned form (+ optional book-call). */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={ctx.onOpenForm}
              className="btn btn-lg w-full sm:w-auto"
              style={{
                background: "var(--spec-primary)",
                color: "var(--spec-primary-fg)",
                borderColor: "var(--spec-primary)",
              }}
            >
              {primaryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            {hero?.secondary_cta === "book_call" && ctx.calendlyUrl && (
              <button
                type="button"
                onClick={ctx.onBookCall}
                className="btn btn-secondary btn-lg w-full sm:w-auto"
              >
                Schedule a Call
              </button>
            )}
          </div>

          {/* CONTACT / FOOTER — trail after the CTA. */}
          {tailBlocks.length > 0 && (
            <ContentStream
              blocks={tailBlocks}
              ctx={ctx}
              className="mt-auto flex flex-col gap-6 pt-2"
            />
          )}
        </div>
      }
    />
  );
}

export default IdentitySidebarShell;
