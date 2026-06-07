// src/features/recruiting/layouts/blocks/types.ts
// Shared render context handed to every block component. Carries the recruiter's
// real data (logo, contact, socials) + interaction callbacks. Blocks NEVER read
// from the network or storage — they render the context they're given.

import type { SpecPalette } from "@/types/recruiting-design-spec.types";
import type { SocialLinks } from "@/types/recruiting-theme.types";

export interface BlockRenderContext {
  recruiterId: string;
  palette: SpecPalette;
  displayName: string;
  recruiterFullName: string;
  logoUrl: string | null;
  calendlyUrl: string | null;
  supportPhone: string | null;
  socialLinks: SocialLinks;
  /** CTA label fallback when a block omits its own button text. */
  ctaText: string;
  /** Scroll the lead form into view (desktop) / into the column (mobile). */
  onOpenForm: () => void;
  /** Open the booking link in a new tab (no-op if no calendly_url). */
  onBookCall: () => void;
  /** Called by the form on a successful lead submission. */
  onFormSuccess: (leadId: string) => void;
}
