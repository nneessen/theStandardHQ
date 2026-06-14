// src/features/recruiting/templates/split-hero-stack.ts
//
// "Spotlight" — the split-hero-stack starter template. A versatile, confident
// page: a wide split hero (headline + your photo) over a clean, narrow
// single-column stack of supporting sections and the lead form.
//
// Placeholder copy is compliance-safe (training/mentorship/growth/support
// language only — NO income or earnings claims) and is meant to be edited by the
// recruiter. Block ids follow the validator's `${type}-${index}` convention so
// the spec round-trips through validateDesignSpec unchanged.

import type { RecruitingTemplate } from "./types";

export const splitHeroStackTemplate: RecruitingTemplate = {
  id: "split-hero-stack",
  name: "Spotlight",
  blurb:
    "A split hero (headline + your photo), then a clean single-column stack.",
  spec: {
    version: 1,
    layout: "split-hero-stack",
    theme: {
      palette: { primary: "#1F3A5F", accent: "#E4B95B" },
      mode: "light",
      font_pairing: "grotesk",
      radius: "soft",
      background_style: "topo-grid",
    },
    blocks: [
      {
        id: "hero-0",
        type: "hero",
        variant: "split",
        eyebrow: "Now Building Our Team",
        headline: "Build a Career You Can Be Proud Of",
        subhead:
          "Join a team that invests in your growth from day one — with hands-on training, real mentorship, and the flexibility to build your business your way.",
        primary_cta: "Start the Conversation",
        secondary_cta: "none",
      },
      {
        id: "value_grid-1",
        type: "value_grid",
        heading: "Why Agents Choose Us",
        items: [
          {
            title: "Structured Training",
            body: "A clear onboarding path that takes you from licensing to your first appointments with confidence.",
          },
          {
            title: "Real Mentorship",
            body: "Work alongside experienced agents who share what works and help you avoid the common pitfalls.",
          },
          {
            title: "Flexible Schedule",
            body: "Build your business around your life. Set your own hours and grow at a pace that fits your goals.",
          },
          {
            title: "Ongoing Support",
            body: "From lead resources to back-office help, you'll never feel like you're figuring it out alone.",
          },
        ],
      },
      {
        id: "about-2",
        type: "about",
        heading: "About the Opportunity",
        body: "We help people from all backgrounds — including career-changers and brand-new agents — build a meaningful career in insurance. Whether you're looking for a fresh start or a place to take your experience further, you'll find a team focused on doing right by clients and developing its people. We'll give you the training, tools, and support to grow; you bring the drive.",
      },
      {
        id: "stats-3",
        type: "stats",
        style: "lattice",
        items: [
          { icon: "graduation-cap", value: "Step 1", label: "Get Licensed" },
          { icon: "handshake", value: "Step 2", label: "Find a Mentor" },
          { icon: "trending-up", value: "Step 3", label: "Grow Your Book" },
        ],
      },
      {
        id: "form-4",
        type: "form",
        eyebrow: "Get Started",
        heading: "Tell Us About Yourself",
        subcopy:
          "Share a few details and we'll reach out within 24-48 hours to talk through the opportunity. No pressure — just a conversation.",
        cta_text: "Request Info",
      },
      {
        id: "contact-5",
        type: "contact",
        show_phone: true,
        show_socials: true,
      },
      {
        id: "footer-6",
        type: "footer",
        show_copyright: true,
      },
    ],
  },
};
