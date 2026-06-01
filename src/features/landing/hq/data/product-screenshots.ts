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
 * The FIRST entry is the Jarvis Command Center frame — HqJarvis features it as
 * Jarvis's primary image, and it also flows through the gallery. Labels are
 * editable captions.
 *
 * DASHBOARD_SHOT (below) is separate: the single hero image for HqCommandCenter
 * ("Your day in one screen" = The Board). It is NOT part of the gallery array.
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

/*
 * The Board (main dashboard) hero for HqCommandCenter ("Your day in one screen").
 * NULL until a real, Slack/Discord-free Board capture is cropped to
 * `${BASE}/screen-dashboard.png`. The existing 5.43.06 / 5.43.12 source captures
 * are EXCLUDED by crop-landing-screenshots.py (they show Slack + Discord), so a
 * clean capture is required. While null, HqCommandCenter renders nothing — no
 * placeholder, no stand-in image.
 */
export const DASHBOARD_SHOT: ProductShot | null = null;
