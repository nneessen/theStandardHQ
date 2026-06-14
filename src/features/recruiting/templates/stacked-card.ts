// src/features/recruiting/templates/stacked-card.ts
//
// "Stacked" starter template — a friendly vertical stack of rounded cards on a
// tinted canvas (the stacked-card layout shell). Modern + approachable: indigo
// primary, warm coral accent, round corners, soft floating shapes. Placeholder
// copy aimed at career-changers / new agents; the recruiter edits it later.
//
// COMPLIANCE: neutral benefit language only — no guaranteed-income or specific
// earnings claims. Passes validateDesignSpec unchanged (exactly one form block).

import type { RecruitingTemplate } from "./types";

export const stackedCardTemplate: RecruitingTemplate = {
  id: "stacked-card",
  name: "Stacked",
  blurb:
    "A friendly stack of cards on a tinted canvas — modern and approachable.",
  spec: {
    version: 1,
    layout: "stacked-card",
    theme: {
      palette: { primary: "#4f46e5", accent: "#fb7185" },
      mode: "light",
      font_pairing: "modern",
      radius: "round",
      background_style: "floating-shapes",
    },
    blocks: [
      {
        id: "hero-1",
        type: "hero",
        variant: "stacked",
        eyebrow: "Now Building Our Team",
        headline: "Start a Career You Can Be Proud Of",
        subhead:
          "Join a team that invests in your growth from day one — with hands-on training, real mentorship, and the flexibility to build your work around your life.",
        primary_cta: "Start the Conversation",
        secondary_cta: "book_call",
      },
      {
        id: "value-1",
        type: "value_grid",
        heading: "Why People Join Us",
        items: [
          {
            icon: "graduation-cap",
            title: "Training From the Ground Up",
            body: "No prior experience required. We teach you the products, the process, and the people skills step by step.",
          },
          {
            icon: "handshake",
            title: "Mentorship That Sticks",
            body: "You're paired with experienced agents who answer your questions and help you grow at your own pace.",
          },
          {
            icon: "clock",
            title: "Flexibility That Fits",
            body: "Build a schedule around your family and your goals — many of our agents work remotely or part-time.",
          },
        ],
      },
      {
        id: "stats-1",
        type: "stats",
        style: "inline",
        items: [
          { icon: "users", value: "Team", label: "Supportive community" },
          { icon: "book-open", value: "Daily", label: "Coaching & training" },
          { icon: "trending-up", value: "Growth", label: "Clear path forward" },
        ],
      },
      {
        id: "testimonial-1",
        type: "testimonial",
        quote:
          "I came in with zero experience and a lot of questions. The training and mentorship gave me the confidence to actually help people — and to build something of my own.",
        attribution: "New Agent, First Year",
      },
      {
        id: "form-1",
        type: "form",
        eyebrow: "Let's Talk",
        heading: "Tell Us About Yourself",
        subcopy:
          "Share a few details and we'll reach out to see if this is the right fit. No pressure — just a real conversation.",
        cta_text: "Request Info",
      },
      {
        id: "footer-1",
        type: "footer",
        show_copyright: true,
      },
    ],
  },
};
