// src/features/recruiting/templates/editorial-bands.ts
//
// "Broadsheet" — a premium, magazine-style starting point: full-width bands that
// alternate surface tone for editorial rhythm. Placeholder copy is professional,
// confident, and compliance-safe (no guaranteed-income / specific-earnings
// claims). The agent edits this copy after picking the template; it is always
// re-validated through validateDesignSpec before render.

import type { RecruitingTemplate } from "./types";

export const editorialBandsTemplate: RecruitingTemplate = {
  id: "editorial-bands",
  name: "Broadsheet",
  blurb:
    "Full-width magazine bands that alternate surface — premium and editorial.",
  spec: {
    version: 1,
    layout: "editorial-bands",
    theme: {
      palette: { primary: "#1d2b24", accent: "#c9a35b" },
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
        eyebrow: "Now Building Our Team",
        headline: "Build a career you are proud of.",
        subhead:
          "Join a team that invests in your development from day one — with hands-on training, real mentorship, and the flexibility to grow at your own pace.",
        primary_cta: "Start the Conversation",
        secondary_cta: "book_call",
      },
      {
        id: "stats-1",
        type: "stats",
        style: "lattice",
        items: [
          { icon: "book-open", value: "1:1", label: "Mentorship from day one" },
          { icon: "clock", value: "Flexible", label: "Set your own schedule" },
          { icon: "users", value: "Team", label: "Collaborative culture" },
          { icon: "trending-up", value: "Growth", label: "Clear path forward" },
        ],
      },
      {
        id: "value_grid-2",
        type: "value_grid",
        heading: "Why agents choose us",
        items: [
          {
            icon: "graduation-cap",
            title: "Structured training",
            body: "A guided onboarding program that builds real skills, step by step — no being thrown in the deep end.",
          },
          {
            icon: "handshake",
            title: "Real mentorship",
            body: "Experienced producers who answer your calls, review your work, and help you improve every week.",
          },
          {
            icon: "target",
            title: "Warm support",
            body: "Marketing resources, lead support, and modern tools so you can focus on serving clients well.",
          },
          {
            icon: "line-chart",
            title: "Room to grow",
            body: "A defined path toward leadership and ownership for those who want to build something lasting.",
          },
        ],
      },
      {
        id: "about-3",
        type: "about",
        heading: "About the team",
        body: "We started this agency on a simple belief: when you develop people, results follow. We are a service-first team that treats clients with honesty and treats teammates like family.\n\nWhether you are changing careers or just getting started, we will meet you where you are and give you the training, mentorship, and support to do work that matters.",
      },
      {
        id: "testimonial-4",
        type: "testimonial",
        quote:
          "I came in with no experience and felt supported from the very first week. The training was real, the mentorship was real, and I finally feel like I am building something of my own.",
        attribution: "A team member, in their first year",
      },
      {
        id: "form-5",
        type: "form",
        eyebrow: "Get Started",
        heading: "Tell us about yourself",
        subcopy:
          "Share a few details and we will reach out within 24-48 hours to talk through whether this could be a fit.",
        cta_text: "Send My Interest",
      },
      {
        id: "footer-6",
        type: "footer",
        show_copyright: true,
      },
    ],
  },
};
