/*
 * Real product screenshots for the "Inside the platform" gallery (3D flythrough)
 * and the "Command Center" feature frame.
 *
 * Source: the user's real app captures in docs/todo/landing/screenshots/, with
 * the left nav sidebar cropped out and downscaled by
 * `scripts/crop-landing-screenshots.py` → served from `public/landing/screens/`.
 *
 * TECH-STACK SAFE: 6 of the 15 source captures exposed vendor/IMO names or the
 * AI voice agent (Slack/Discord buttons, "Close KPI"/"Close CRM" titles, "AI
 * Voice Agent", Channel-Orchestration voice rows). Those are EXCLUDED at the
 * script level (never written to public/) — see EXCLUDE_TIME_TOKENS there. The 9
 * below are the clean survivors; re-audit any new captures the same way.
 *
 * The FIRST entry is the Command Center "Main Dashboard" frame; ALL flow through
 * the gallery. Labels are editable captions.
 */

export interface ProductShot {
  /** public-path image URL of a real app screenshot (sidebar cropped, no vendor names) */
  src: string;
  /** short caption shown in the gallery */
  label: string;
}

const BASE = "/landing/screens";

export const PRODUCT_SCREENSHOTS: ProductShot[] = [
  { src: `${BASE}/screen-01.png`, label: "Command Center" },
  { src: `${BASE}/screen-02.png`, label: "Targets" },
  { src: `${BASE}/screen-03.png`, label: "Policies" },
  { src: `${BASE}/screen-04.png`, label: "Expenses" },
  { src: `${BASE}/screen-05.png`, label: "Team" },
  { src: `${BASE}/screen-06.png`, label: "Recruiting" },
  { src: `${BASE}/screen-07.png`, label: "Messages" },
  { src: `${BASE}/screen-08.png`, label: "Underwriting" },
  { src: `${BASE}/screen-09.png`, label: "AI Assistant" },
];
