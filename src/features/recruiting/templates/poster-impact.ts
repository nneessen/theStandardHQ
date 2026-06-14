// src/features/recruiting/templates/poster-impact.ts
//
// "Headliner" — a high-energy, poster-style recruiting page. An oversized display
// headline on a solid color block dominates the first screen (event-flyer energy),
// then a tight run of supporting blocks leads into the lead form. Renders through
// the "poster-impact" shell. Copy is neutral/compliance-safe placeholder the agent
// edits later (no income guarantees, no specific earnings claims).

import type { RecruitingTemplate } from "./types";

export const posterImpactTemplate: RecruitingTemplate = {
  id: "poster-impact",
  name: "Headliner",
  blurb: "An oversized poster hero with huge type — high energy.",
  spec: {
    version: 1,
    layout: "poster-impact",
    theme: {
      palette: {
        primary: "#FF4F1F", // vivid electric orange-red — the poster color block
        accent: "#F4FF52", // punchy lime-yellow — the CTA pop
      },
      mode: "dark",
      font_pairing: "impact",
      radius: "sharp",
      background_style: "flat",
    },
    blocks: [
      {
        id: "hero-0",
        type: "hero",
        variant: "stacked",
        eyebrow: "Now Recruiting",
        headline: "Build A Career Worth Showing Up For",
        subhead:
          "Launch a new career in insurance with real training, hands-on mentorship, and a team that has your back from day one.",
        primary_cta: "Start Your Application",
        secondary_cta: "book_call",
      },
      {
        id: "stats-1",
        type: "stats",
        style: "inline",
        items: [
          { icon: "graduation-cap", value: "Day 1", label: "Training begins" },
          { icon: "users", value: "1:1", label: "Mentorship" },
          { icon: "clock", value: "Flexible", label: "Your schedule" },
        ],
      },
      {
        id: "value_grid-2",
        type: "value_grid",
        heading: "Why agents join us",
        items: [
          {
            icon: "book-open",
            title: "Step-by-step training",
            body: "Learn the business from the ground up with a structured program — no prior experience required.",
          },
          {
            icon: "handshake",
            title: "Mentorship that sticks",
            body: "Work alongside experienced agents who coach you through real cases, not just theory.",
          },
          {
            icon: "trending-up",
            title: "Room to grow",
            body: "A clear path to build your book of business and take on leadership as you develop.",
          },
        ],
      },
      {
        id: "cta-3",
        type: "cta",
        headline: "Ready to make your move?",
        button_text: "Apply Now",
        action: "open_form",
      },
      {
        id: "form-4",
        type: "form",
        eyebrow: "Get Started",
        heading: "Tell Us About Yourself",
        subcopy:
          "Share a few details and we'll reach out within 24-48 hours to talk through next steps.",
        cta_text: "Submit Application",
      },
      {
        id: "footer-5",
        type: "footer",
        show_copyright: true,
      },
    ],
  },
};
