// src/features/recruiting/templates/identity-sidebar.ts
//
// "The Recruiter" — a personal, recruiter-forward starting point for the
// identity-sidebar layout. A sticky identity rail (headshot, name, socials,
// tagline) sits beside the supporting content and the pinned lead form. Copy is
// neutral, mentorship/training-focused placeholder text the agent edits later —
// NO income or guaranteed-earnings claims (compliance-safe).

import type { RecruitingTemplate } from "./types";

export const identitySidebarTemplate: RecruitingTemplate = {
  id: "identity-sidebar",
  name: "The Recruiter",
  blurb:
    "A sticky identity rail (your photo, name, socials) beside the content + form.",
  spec: {
    version: 1,
    layout: "identity-sidebar",
    theme: {
      palette: { primary: "#1f3d2b", accent: "#c8a04b" },
      mode: "light",
      font_pairing: "editorial",
      radius: "soft",
      background_style: "lattice",
    },
    blocks: [
      {
        id: "hero-0",
        type: "hero",
        variant: "split",
        eyebrow: "Helping new agents start strong.",
        headline: "Build a Career You're Proud Of",
        subhead:
          "Join a team that invests in your growth from day one — with hands-on training, real mentorship, and the tools to help you serve families well.",
        primary_cta: "Start the Conversation",
        secondary_cta: "none",
      },
      {
        id: "value_grid-1",
        type: "value_grid",
        heading: "What you can expect",
        items: [
          {
            icon: "graduation-cap",
            title: "Guided Training",
            body: "Step-by-step onboarding and ongoing coaching, whether you're licensed or just starting out.",
          },
          {
            icon: "handshake",
            title: "Real Mentorship",
            body: "Direct access to experienced agents who've built durable books of business.",
          },
          {
            icon: "clock",
            title: "Flexible Schedule",
            body: "Build your business around your life — full-time, part-time, or a focused transition.",
          },
          {
            icon: "trending-up",
            title: "Room to Grow",
            body: "A clear path to advance, lead, and build your own team as you develop.",
          },
        ],
      },
      {
        id: "about-2",
        type: "about",
        heading: "Why work with me",
        body: "I started where you are now, and I remember how much the right support mattered. My focus is simple: give you the training, structure, and honest guidance to do meaningful work and grow at your own pace. No pressure, no hype — just a real plan and a team that has your back.",
      },
      {
        id: "testimonial-3",
        type: "testimonial",
        quote:
          "The training and mentorship were the difference for me. I never felt like I was figuring it out alone — there was always someone ready to help.",
        attribution: "A team member, licensed agent",
      },
      {
        id: "form-4",
        type: "form",
        eyebrow: "Let's connect",
        heading: "Tell Me About Yourself",
        subcopy:
          "Share a few details and I'll personally reach out within 24-48 hours to answer your questions.",
        cta_text: "Send My Info",
      },
      {
        id: "contact-5",
        type: "contact",
        show_phone: true,
        // Socials already appear in the identity rail card — don't repeat them.
        show_socials: false,
      },
      {
        id: "footer-6",
        type: "footer",
        show_copyright: true,
      },
    ],
  },
};
