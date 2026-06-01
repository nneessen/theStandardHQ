/*
 * Culture photos for the HQ landing "Culture" sticky-scroll gallery.
 *
 * INTENTIONALLY EMPTY. The reference used drag-to-fill <image-slot> web
 * components backed by a build-time runtime that does not exist in the deployed
 * SPA. Per the no-mock-data rule, the Culture section renders ONLY when this
 * array is non-empty (see PublicLandingPage) — no empty photo boxes ship.
 *
 * To enable the section: add real entries below — e.g.
 *   { src: "https://…/founder.jpg", label: "Nick Neessen · Founder" }
 * The layout expects ~6–7 tiles (the middle column is the sticky one).
 */

export interface CulturePhoto {
  /** absolute or public-path image URL */
  src: string;
  /** caption shown over the photo */
  label: string;
}

export const CULTURE_PHOTOS: CulturePhoto[] = [];
