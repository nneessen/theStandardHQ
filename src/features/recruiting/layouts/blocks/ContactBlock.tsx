// src/features/recruiting/layouts/blocks/ContactBlock.tsx
import { Phone, Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import type { ContactBlock as ContactBlockData } from "@/types/recruiting-design-spec.types";
import type { BlockRenderContext } from "./types";
import { getActiveSocialLinks } from "../types";

const SOCIAL_ICONS: Record<string, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

export function ContactBlock({
  block,
  ctx,
}: {
  block: ContactBlockData;
  ctx: BlockRenderContext;
}) {
  const socials =
    block.show_socials !== false ? getActiveSocialLinks(ctx.socialLinks) : [];
  const showPhone = block.show_phone !== false && !!ctx.supportPhone;
  if (!showPhone && socials.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center gap-4 sm:gap-5">
      {showPhone && (
        <a
          href={`tel:${ctx.supportPhone}`}
          className="group inline-flex items-center gap-2 text-eyebrow hover:text-[var(--spec-primary)] transition-colors"
        >
          <span
            className="landing-icon-tile h-7 w-7"
            style={{ color: "var(--spec-primary)" }}
          >
            <Phone className="h-3 w-3" />
          </span>
          <span className="font-mono">{ctx.supportPhone}</span>
        </a>
      )}
      {socials.map(({ platform, url }) => {
        const Icon = SOCIAL_ICONS[platform];
        if (!Icon) return null;
        return (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 text-eyebrow hover:text-[var(--spec-primary)] transition-colors"
            aria-label={platform}
          >
            <span
              className="landing-icon-tile h-7 w-7"
              style={{ color: "var(--spec-primary)" }}
            >
              <Icon className="h-3 w-3" />
            </span>
          </a>
        );
      })}
    </section>
  );
}
