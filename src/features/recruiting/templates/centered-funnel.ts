// src/features/recruiting/templates/centered-funnel.ts
//
// "Direct Line" — a focused, narrow single-column funnel: a minimal centered hero
// with the lead form right up top, then a short reassurance grid + one testimonial.
// Placeholder copy is intentionally neutral (training / mentorship / support /
// flexibility) — NO earnings or income claims. The recruiter edits this later.

import type { RecruitingTemplate } from "./types";

export const centeredFunnelTemplate: RecruitingTemplate = {
  id: "centered-funnel",
  name: "Direct Line",
  blurb: "A focused, narrow single column — minimal hero, form right up top.",
  spec: {
    version: 1,
    layout: "centered-funnel",
    theme: {
      palette: {
        primary: "#1f6f5c", // calm teal-green
        accent: "#f2b705", // warm gold
      },
      mode: "light",
      font_pairing: "grotesk",
      radius: "round",
      background_style: "flat",
    },
    blocks: [
      {
        id: "hero-0",
        type: "hero",
        variant: "stacked",
        eyebrow: "Now Building Our Team",
        headline: "Start a Career You Can Be Proud Of",
        subhead:
          "Join a team that invests in your growth — hands-on training, real mentorship, and the flexibility to build your business your way.",
        primary_cta: "Start the Conversation",
        secondary_cta: "none",
      },
      {
        id: "form-0",
        type: "form",
        eyebrow: "First Step",
        heading: "Tell Us About Yourself",
        subcopy:
          "Share a few details and we'll reach out within 24-48 hours to talk through next steps. No pressure, no obligation.",
        cta_text: "Request a Conversation",
      },
      {
        id: "value_grid-0",
        type: "value_grid",
        heading: "Why Agents Choose Us",
        items: [
          {
            icon: "graduation-cap",
            title: "Real Training",
            body: "Structured onboarding and ongoing coaching, whether you're brand new or making a career change.",
          },
          {
            icon: "handshake",
            title: "Dedicated Mentorship",
            body: "Work alongside experienced agents who are invested in helping you find your footing.",
          },
          {
            icon: "clock",
            title: "Flexibility & Support",
            body: "Build your schedule around your life, with a team that has your back every step of the way.",
          },
        ],
      },
      {
        id: "testimonial-0",
        type: "testimonial",
        quote:
          "I came in with no industry background. The training and the people made all the difference — I always knew where to turn for help.",
        attribution: "A team member",
      },
      {
        id: "footer-0",
        type: "footer",
        show_copyright: true,
      },
    ],
  },
};
