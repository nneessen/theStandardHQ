/*
 * Testimonials for the HQ landing "Stories" marquee.
 *
 * INTENTIONALLY EMPTY. The reference design shipped placeholder quotes; the
 * project rule forbids fake/mock data in production. The Stories section is
 * rendered ONLY when this array is non-empty (see PublicLandingPage), so it
 * stays hidden until real, attributable quotes are added here.
 *
 * To enable the section: add real entries below — e.g.
 *   { quote: "…", name: "Marcus T.", role: "Agent · TX" }
 */

export interface Testimonial {
  quote: string;
  name: string;
  /** e.g. "Agent · TX" or "Agency Owner · FL" */
  role: string;
}

export const TESTIMONIALS: Testimonial[] = [];
