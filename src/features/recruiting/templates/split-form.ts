// src/features/recruiting/templates/split-form.ts
//
// "Classic Split" — the balanced default for the split-form shell: content on the
// left, the lead form pinned in a right panel. A safe, professional starting point
// that suits almost any agency. All copy is COMPLIANCE-SAFE placeholder the agent
// edits later (no guaranteed-income / earnings claims). Round-trips through
// validateDesignSpec unchanged (ids are `<type>-<arrayIndex>`).

import type { RecruitingTemplate } from "./types";

export const splitFormTemplate: RecruitingTemplate = {
  id: "split-form",
  name: "Classic Split",
  blurb:
    "Content on the left, lead form pinned on the right — balanced and versatile.",
  spec: {
    version: 1,
    layout: "split-form",
    theme: {
      palette: { primary: "#1E3A8A", accent: "#0EA5E9" },
      mode: "light",
      font_pairing: "editorial",
      radius: "sharp",
      background_style: "topo-grid",
    },
    blocks: [
      {
        id: "hero-0",
        type: "hero",
        variant: "split",
        eyebrow: "Now Recruiting",
        headline: "Join a Team That Invests in You",
        subhead:
          "Build a meaningful career in insurance with the training, mentorship, and support to do it right — at a pace that works for your life.",
        primary_cta: "Apply Now",
        secondary_cta: "book_call",
      },
      {
        id: "value_grid-1",
        type: "value_grid",
        heading: "Why join us",
        items: [
          {
            icon: "graduation-cap",
            title: "Full Training",
            body: "Structured onboarding and licensing guidance so you start with confidence.",
          },
          {
            icon: "handshake",
            title: "Real Mentorship",
            body: "Learn directly from experienced agents who want to see you succeed.",
          },
          {
            icon: "clock",
            title: "Flexible Schedule",
            body: "Build your business around your life — not the other way around.",
          },
          {
            icon: "trending-up",
            title: "Room to Grow",
            body: "A clear path to advancement and leadership as your skills develop.",
          },
        ],
      },
      {
        id: "about-2",
        type: "about",
        heading: "About the opportunity",
        body: "We help people from all backgrounds build careers in insurance. Whether you're licensed or just exploring, we provide the tools, training, and team to help you grow — and we're genuinely invested in your success.",
      },
      {
        id: "form-3",
        type: "form",
        eyebrow: "Express Your Interest",
        heading: "Express Your Interest",
        subcopy: "Fill out the form and we'll be in touch within 24-48 hours.",
        cta_text: "Apply Now",
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
