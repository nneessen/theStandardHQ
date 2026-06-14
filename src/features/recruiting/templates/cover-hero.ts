// src/features/recruiting/templates/cover-hero.ts
//
// "Cover Story" — a bold, editorial cover-hero starting point for the cover-hero
// shell. Full-bleed cover image with the headline overlaid + a circular headshot,
// then supporting proof, then the lead form. All copy is professional placeholder
// the agent edits later; it is COMPLIANCE-SAFE (no guaranteed-income / earnings
// claims). The spec round-trips through validateDesignSpec unchanged: block ids
// are `<type>-<arrayIndex>` and every enum/bool field the validator emits is set.

import type { RecruitingTemplate } from "./types";

export const coverHeroTemplate: RecruitingTemplate = {
  id: "cover-hero",
  name: "Cover Story",
  blurb:
    "Full-bleed cover image with the headline overlaid and a circular headshot.",
  spec: {
    version: 1,
    layout: "cover-hero",
    theme: {
      palette: { primary: "#E8552A", accent: "#F2C94C" },
      mode: "dark",
      font_pairing: "impact",
      radius: "soft",
      background_style: "flat",
    },
    blocks: [
      {
        id: "hero-0",
        type: "hero",
        variant: "stacked",
        eyebrow: "Now Building Our Team",
        headline: "Build a Career That Moves With You",
        subhead:
          "Join a team that invests in your growth from day one — with hands-on training, real mentorship, and the flexibility to build on your own terms.",
        primary_cta: "Start the Conversation",
        secondary_cta: "book_call",
      },
      {
        id: "stats-1",
        type: "stats",
        style: "inline",
        items: [
          { icon: "graduation-cap", value: "Day 1", label: "Training begins" },
          { icon: "handshake", value: "1-on-1", label: "Mentorship" },
          { icon: "clock", value: "Flexible", label: "Your schedule" },
        ],
      },
      {
        id: "value_grid-2",
        type: "value_grid",
        heading: "Why people join us",
        items: [
          {
            icon: "graduation-cap",
            title: "Real Training",
            body: "Structured onboarding and licensing support so you ramp up with confidence — no guesswork.",
          },
          {
            icon: "handshake",
            title: "Mentorship That Sticks",
            body: "Work alongside experienced agents who share what works and help you avoid the common pitfalls.",
          },
          {
            icon: "users",
            title: "Warm Support",
            body: "Lead resources, proven systems, and a team that wants you to win — not figure it out alone.",
          },
          {
            icon: "trending-up",
            title: "Room to Grow",
            body: "A clear path to advance and take on leadership as you develop your skills and results.",
          },
        ],
      },
      {
        id: "form-3",
        type: "form",
        eyebrow: "Express Interest",
        heading: "Let's See If This Is a Fit",
        subcopy:
          "Tell us a little about yourself and we'll reach out within 24-48 hours. No pressure, just a conversation.",
        cta_text: "Submit Your Interest",
      },
      {
        id: "contact-4",
        type: "contact",
        show_phone: true,
        show_socials: true,
      },
      {
        id: "footer-5",
        type: "footer",
        show_copyright: true,
      },
    ],
  },
};
