// src/features/landing/types/landing-page.types.ts
// TypeScript types for the public landing page

// ===== JSONB FIELD TYPES =====

export interface StatItem {
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
}

export interface GalleryImage {
  url: string;
  caption?: string;
  alt?: string;
}

export interface OpportunityStep {
  title: string;
  description: string;
  icon: string;
  detail?: string;
}

export interface RequirementItem {
  trait: string;
  description: string;
  icon: string;
}

export interface TechFeature {
  title: string;
  description: string;
  icon: string;
}

export interface Testimonial {
  name: string;
  role?: string;
  quote: string;
  image_url?: string;
  video_url?: string;
  earnings?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SocialLinks {
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  twitter?: string;
}

export type LoginAccessType =
  | "easter_egg"
  | "footer_link"
  | "both"
  | "nav_button";

export type SectionId =
  | "hero"
  | "stats"
  | "about"
  | "gallery"
  | "opportunity"
  | "requirements"
  | "tech"
  | "testimonials"
  | "faq"
  | "final_cta";

// ===== DATABASE ROW TYPE =====

export interface LandingPageSettingsRow {
  id: string;
  imo_id: string;

  // Hero Section
  hero_headline: string | null;
  hero_subheadline: string | null;
  hero_cta_text: string | null;
  hero_cta_link: string | null;
  hero_video_url: string | null;
  hero_image_url: string | null;

  // Stats Section
  stats_enabled: boolean;
  stats_data: StatItem[];

  // About Section
  about_enabled: boolean;
  about_headline: string | null;
  about_content: string | null;
  about_video_url: string | null;
  about_image_url: string | null;

  // Gallery Section
  gallery_enabled: boolean;
  gallery_headline: string | null;
  gallery_subheadline: string | null;
  gallery_featured_url: string | null;
  gallery_images: GalleryImage[];

  // Opportunity Section
  opportunity_enabled: boolean;
  opportunity_headline: string | null;
  opportunity_subheadline: string | null;
  opportunity_steps: OpportunityStep[];

  // Requirements Section
  requirements_enabled: boolean;
  requirements_headline: string | null;
  requirements_subheadline: string | null;
  requirements_items: RequirementItem[];

  // Tech Section
  tech_enabled: boolean;
  tech_headline: string | null;
  tech_subheadline: string | null;
  tech_features: TechFeature[];

  // Testimonials Section
  testimonials_enabled: boolean;
  testimonials_headline: string | null;
  testimonials_subheadline: string | null;
  testimonials: Testimonial[];

  // FAQ Section
  faq_enabled: boolean;
  faq_headline: string | null;
  faq_items: FaqItem[];

  // Final CTA Section
  final_cta_enabled: boolean;
  final_cta_headline: string | null;
  final_cta_subheadline: string | null;
  final_cta_text: string | null;
  final_cta_link: string | null;

  // Footer/Contact
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  social_links: SocialLinks;

  // Login Access Configuration
  login_access_type: LoginAccessType;

  // Global Theme
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;

  // Logo
  logo_light_url: string | null;
  logo_dark_url: string | null;

  // SEO
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;

  // Section Order
  section_order: SectionId[];

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ===== THEME TYPE (WITH DEFAULTS) =====

export interface LandingPageTheme {
  // Hero Section
  hero_headline: string;
  hero_subheadline: string;
  hero_cta_text: string;
  hero_cta_link: string;
  hero_video_url: string | null;
  hero_image_url: string | null;

  // Stats Section
  stats_enabled: boolean;
  stats_data: StatItem[];

  // About Section
  about_enabled: boolean;
  about_headline: string;
  about_content: string;
  about_video_url: string | null;
  about_image_url: string | null;

  // Gallery Section
  gallery_enabled: boolean;
  gallery_headline: string;
  gallery_subheadline: string;
  gallery_featured_url: string | null;
  gallery_images: GalleryImage[];

  // Opportunity Section
  opportunity_enabled: boolean;
  opportunity_headline: string;
  opportunity_subheadline: string;
  opportunity_steps: OpportunityStep[];

  // Requirements Section
  requirements_enabled: boolean;
  requirements_headline: string;
  requirements_subheadline: string;
  requirements_items: RequirementItem[];

  // Tech Section
  tech_enabled: boolean;
  tech_headline: string;
  tech_subheadline: string;
  tech_features: TechFeature[];

  // Testimonials Section
  testimonials_enabled: boolean;
  testimonials_headline: string;
  testimonials_subheadline: string;
  testimonials: Testimonial[];

  // FAQ Section
  faq_enabled: boolean;
  faq_headline: string;
  faq_items: FaqItem[];

  // Final CTA Section
  final_cta_enabled: boolean;
  final_cta_headline: string;
  final_cta_subheadline: string;
  final_cta_text: string;
  final_cta_link: string;

  // Footer/Contact
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  social_links: SocialLinks;

  // Login Access Configuration
  login_access_type: LoginAccessType;

  // Global Theme
  primary_color: string;
  secondary_color: string;
  accent_color: string;

  // Logo
  logo_light_url: string | null;
  logo_dark_url: string | null;

  // SEO
  meta_title: string;
  meta_description: string;
  og_image_url: string | null;

  // Section Order
  section_order: SectionId[];
}

// ===== INPUT TYPE FOR UPDATES =====

export interface LandingPageSettingsInput {
  // Hero Section
  hero_headline?: string;
  hero_subheadline?: string;
  hero_cta_text?: string;
  hero_cta_link?: string;
  hero_video_url?: string | null;
  hero_image_url?: string | null;

  // Stats Section
  stats_enabled?: boolean;
  stats_data?: StatItem[];

  // About Section
  about_enabled?: boolean;
  about_headline?: string;
  about_content?: string;
  about_video_url?: string | null;
  about_image_url?: string | null;

  // Gallery Section
  gallery_enabled?: boolean;
  gallery_headline?: string;
  gallery_subheadline?: string;
  gallery_featured_url?: string | null;
  gallery_images?: GalleryImage[];

  // Opportunity Section
  opportunity_enabled?: boolean;
  opportunity_headline?: string;
  opportunity_subheadline?: string;
  opportunity_steps?: OpportunityStep[];

  // Requirements Section
  requirements_enabled?: boolean;
  requirements_headline?: string;
  requirements_subheadline?: string;
  requirements_items?: RequirementItem[];

  // Tech Section
  tech_enabled?: boolean;
  tech_headline?: string;
  tech_subheadline?: string;
  tech_features?: TechFeature[];

  // Testimonials Section
  testimonials_enabled?: boolean;
  testimonials_headline?: string;
  testimonials_subheadline?: string;
  testimonials?: Testimonial[];

  // FAQ Section
  faq_enabled?: boolean;
  faq_headline?: string;
  faq_items?: FaqItem[];

  // Final CTA Section
  final_cta_enabled?: boolean;
  final_cta_headline?: string;
  final_cta_subheadline?: string;
  final_cta_text?: string;
  final_cta_link?: string;

  // Footer/Contact
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  social_links?: SocialLinks;

  // Login Access Configuration
  login_access_type?: LoginAccessType;

  // Global Theme
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;

  // Logo
  logo_light_url?: string | null;
  logo_dark_url?: string | null;

  // SEO
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string | null;

  // Section Order
  section_order?: SectionId[];
}

// ===== DEFAULT VALUES =====

export const DEFAULT_LANDING_PAGE_THEME: LandingPageTheme = {
  // Hero
  hero_headline: "Build Your Future",
  hero_subheadline: "Remote sales careers for the ambitious",
  hero_cta_text: "Start Your Journey",
  hero_cta_link: "/join-the-standard",
  hero_video_url: null,
  hero_image_url: null,

  // Stats
  stats_enabled: true,
  stats_data: [
    { label: "Average First Year", value: "75000", prefix: "$", suffix: "+" },
    { label: "Team Members", value: "150", prefix: "", suffix: "+" },
    { label: "States Licensed", value: "48", prefix: "", suffix: "" },
    { label: "Remote Work", value: "100", prefix: "", suffix: "%" },
  ],

  // About
  about_enabled: true,
  about_headline: "Who We Are",
  about_content:
    "We are a team of driven professionals redefining what's possible in insurance sales. Our mission is to empower agents with world-class training, cutting-edge tools, and the support needed to build a thriving career from anywhere.",
  about_video_url: null,
  about_image_url: null,

  // Gallery
  gallery_enabled: true,
  gallery_headline: "Our People",
  gallery_subheadline: "The culture that drives our success",
  gallery_featured_url: null,
  gallery_images: [],

  // Opportunity
  opportunity_enabled: true,
  opportunity_headline: "Your Path",
  opportunity_subheadline: "From day one to agency ownership",
  opportunity_steps: [
    {
      title: "Join",
      description: "Apply and complete onboarding",
      icon: "rocket",
      detail: "Get licensed and certified",
    },
    {
      title: "Train",
      description: "Learn proven systems from top producers",
      icon: "book",
      detail: "Comprehensive training program",
    },
    {
      title: "Earn",
      description: "Start building real income immediately",
      icon: "dollar",
      detail: "Uncapped commission potential",
    },
    {
      title: "Lead",
      description: "Build and mentor your own team",
      icon: "users",
      detail: "Agency ownership track",
    },
  ],

  // Requirements
  requirements_enabled: true,
  requirements_headline: "What It Takes",
  requirements_subheadline: "No experience required. Just the right mindset.",
  requirements_items: [
    {
      trait: "Self-Motivated",
      description: "You don't wait to be told what to do",
      icon: "flame",
    },
    {
      trait: "Coachable",
      description: "You're hungry to learn and grow",
      icon: "lightbulb",
    },
    {
      trait: "Ambitious",
      description: "You want more than average results",
      icon: "target",
    },
    {
      trait: "People-Person",
      description: "You genuinely care about helping others",
      icon: "heart",
    },
  ],

  // Tech
  tech_enabled: true,
  tech_headline: "Your Tools",
  tech_subheadline: "Built for the digital generation",
  tech_features: [
    {
      title: "Smart Dashboard",
      description: "Real-time performance tracking and analytics",
      icon: "chart",
    },
    {
      title: "Lead Management",
      description: "Automated pipeline and follow-up systems",
      icon: "users",
    },
    {
      title: "Mobile First",
      description: "Work from anywhere with full mobile support",
      icon: "smartphone",
    },
    {
      title: "AI Assistant",
      description: "Intelligent tools to help you sell smarter",
      icon: "brain",
    },
  ],

  // Testimonials
  testimonials_enabled: true,
  testimonials_headline: "Real Stories",
  testimonials_subheadline: "From our agents",
  testimonials: [],

  // FAQ
  faq_enabled: true,
  faq_headline: "Quick Answers",
  faq_items: [
    {
      question: "Do I need prior insurance experience?",
      answer:
        "No! We provide comprehensive training for all new agents, regardless of background.",
    },
    {
      question: "Is this really 100% remote?",
      answer:
        "Yes. Our entire team works remotely. You can work from home, a coffee shop, or anywhere with internet.",
    },
    {
      question: "How does the compensation work?",
      answer:
        "You earn commission on every policy you sell. There's no cap on your earnings - the more you sell, the more you make.",
    },
    {
      question: "What kind of support will I receive?",
      answer:
        "You'll have access to mentorship, training resources, marketing materials, and a supportive team community.",
    },
    {
      question: "How quickly can I start earning?",
      answer:
        "Many agents write their first policy within their first week after completing licensing and training.",
    },
  ],

  // Final CTA
  final_cta_enabled: true,
  final_cta_headline: "Ready to Start?",
  final_cta_subheadline: "Your future is waiting",
  final_cta_text: "Apply Now",
  final_cta_link: "/join-the-standard",

  // Footer
  contact_email: null,
  contact_phone: null,
  contact_address: null,
  social_links: {},

  // Login
  login_access_type: "easter_egg",

  // Theme
  primary_color: "#f59e0b",
  secondary_color: "#18181b",
  accent_color: "#6366f1",

  // Logo
  logo_light_url: null,
  logo_dark_url: null,

  // SEO
  meta_title: "The Standard - Remote Insurance Sales Careers",
  meta_description:
    "Join The Standard and build a thriving career in insurance sales. 100% remote, unlimited earning potential, world-class training.",
  og_image_url: null,

  // Section Order — requirements and tech sections were retired in May 2026 in favor of the
  // hard-coded Platform Tour / AI Toolkit / Feature Matrix sections. DB columns retained.
  section_order: [
    "hero",
    "stats",
    "about",
    "gallery",
    "opportunity",
    "testimonials",
    "faq",
    "final_cta",
  ],
};

// ===== UTILITY FUNCTIONS =====

/**
 * Merge partial settings with defaults to get a complete theme
 */
export function mergeWithDefaults(
  settings: Partial<LandingPageSettingsRow> | null,
): LandingPageTheme {
  if (!settings) {
    return DEFAULT_LANDING_PAGE_THEME;
  }

  return {
    // Hero
    hero_headline:
      settings.hero_headline ?? DEFAULT_LANDING_PAGE_THEME.hero_headline,
    hero_subheadline:
      settings.hero_subheadline ?? DEFAULT_LANDING_PAGE_THEME.hero_subheadline,
    hero_cta_text:
      settings.hero_cta_text ?? DEFAULT_LANDING_PAGE_THEME.hero_cta_text,
    hero_cta_link:
      settings.hero_cta_link ?? DEFAULT_LANDING_PAGE_THEME.hero_cta_link,
    hero_video_url: settings.hero_video_url ?? null,
    hero_image_url: settings.hero_image_url ?? null,

    // Stats
    stats_enabled:
      settings.stats_enabled ?? DEFAULT_LANDING_PAGE_THEME.stats_enabled,
    stats_data:
      Array.isArray(settings.stats_data) && settings.stats_data.length > 0
        ? settings.stats_data
        : DEFAULT_LANDING_PAGE_THEME.stats_data,

    // About
    about_enabled:
      settings.about_enabled ?? DEFAULT_LANDING_PAGE_THEME.about_enabled,
    about_headline:
      settings.about_headline ?? DEFAULT_LANDING_PAGE_THEME.about_headline,
    about_content:
      settings.about_content ?? DEFAULT_LANDING_PAGE_THEME.about_content,
    about_video_url: settings.about_video_url ?? null,
    about_image_url: settings.about_image_url ?? null,

    // Gallery
    gallery_enabled:
      settings.gallery_enabled ?? DEFAULT_LANDING_PAGE_THEME.gallery_enabled,
    gallery_headline:
      settings.gallery_headline ?? DEFAULT_LANDING_PAGE_THEME.gallery_headline,
    gallery_subheadline:
      settings.gallery_subheadline ??
      DEFAULT_LANDING_PAGE_THEME.gallery_subheadline,
    gallery_featured_url: settings.gallery_featured_url ?? null,
    gallery_images: Array.isArray(settings.gallery_images)
      ? settings.gallery_images
      : [],

    // Opportunity
    opportunity_enabled:
      settings.opportunity_enabled ??
      DEFAULT_LANDING_PAGE_THEME.opportunity_enabled,
    opportunity_headline:
      settings.opportunity_headline ??
      DEFAULT_LANDING_PAGE_THEME.opportunity_headline,
    opportunity_subheadline:
      settings.opportunity_subheadline ??
      DEFAULT_LANDING_PAGE_THEME.opportunity_subheadline,
    opportunity_steps:
      Array.isArray(settings.opportunity_steps) &&
      settings.opportunity_steps.length > 0
        ? settings.opportunity_steps
        : DEFAULT_LANDING_PAGE_THEME.opportunity_steps,

    // Requirements
    requirements_enabled:
      settings.requirements_enabled ??
      DEFAULT_LANDING_PAGE_THEME.requirements_enabled,
    requirements_headline:
      settings.requirements_headline ??
      DEFAULT_LANDING_PAGE_THEME.requirements_headline,
    requirements_subheadline:
      settings.requirements_subheadline ??
      DEFAULT_LANDING_PAGE_THEME.requirements_subheadline,
    requirements_items:
      Array.isArray(settings.requirements_items) &&
      settings.requirements_items.length > 0
        ? settings.requirements_items
        : DEFAULT_LANDING_PAGE_THEME.requirements_items,

    // Tech
    tech_enabled:
      settings.tech_enabled ?? DEFAULT_LANDING_PAGE_THEME.tech_enabled,
    tech_headline:
      settings.tech_headline ?? DEFAULT_LANDING_PAGE_THEME.tech_headline,
    tech_subheadline:
      settings.tech_subheadline ?? DEFAULT_LANDING_PAGE_THEME.tech_subheadline,
    tech_features:
      Array.isArray(settings.tech_features) && settings.tech_features.length > 0
        ? settings.tech_features
        : DEFAULT_LANDING_PAGE_THEME.tech_features,

    // Testimonials
    testimonials_enabled:
      settings.testimonials_enabled ??
      DEFAULT_LANDING_PAGE_THEME.testimonials_enabled,
    testimonials_headline:
      settings.testimonials_headline ??
      DEFAULT_LANDING_PAGE_THEME.testimonials_headline,
    testimonials_subheadline:
      settings.testimonials_subheadline ??
      DEFAULT_LANDING_PAGE_THEME.testimonials_subheadline,
    testimonials: Array.isArray(settings.testimonials)
      ? settings.testimonials
      : [],

    // FAQ
    faq_enabled: settings.faq_enabled ?? DEFAULT_LANDING_PAGE_THEME.faq_enabled,
    faq_headline:
      settings.faq_headline ?? DEFAULT_LANDING_PAGE_THEME.faq_headline,
    faq_items:
      Array.isArray(settings.faq_items) && settings.faq_items.length > 0
        ? settings.faq_items
        : DEFAULT_LANDING_PAGE_THEME.faq_items,

    // Final CTA
    final_cta_enabled:
      settings.final_cta_enabled ??
      DEFAULT_LANDING_PAGE_THEME.final_cta_enabled,
    final_cta_headline:
      settings.final_cta_headline ??
      DEFAULT_LANDING_PAGE_THEME.final_cta_headline,
    final_cta_subheadline:
      settings.final_cta_subheadline ??
      DEFAULT_LANDING_PAGE_THEME.final_cta_subheadline,
    final_cta_text:
      settings.final_cta_text ?? DEFAULT_LANDING_PAGE_THEME.final_cta_text,
    final_cta_link:
      settings.final_cta_link ?? DEFAULT_LANDING_PAGE_THEME.final_cta_link,

    // Footer
    contact_email: settings.contact_email ?? null,
    contact_phone: settings.contact_phone ?? null,
    contact_address: settings.contact_address ?? null,
    social_links:
      settings.social_links && typeof settings.social_links === "object"
        ? settings.social_links
        : {},

    // Login
    login_access_type:
      settings.login_access_type ??
      DEFAULT_LANDING_PAGE_THEME.login_access_type,

    // Theme
    primary_color:
      settings.primary_color ?? DEFAULT_LANDING_PAGE_THEME.primary_color,
    secondary_color:
      settings.secondary_color ?? DEFAULT_LANDING_PAGE_THEME.secondary_color,
    accent_color:
      settings.accent_color ?? DEFAULT_LANDING_PAGE_THEME.accent_color,

    // Logo
    logo_light_url: settings.logo_light_url ?? null,
    logo_dark_url: settings.logo_dark_url ?? null,

    // SEO
    meta_title: settings.meta_title ?? DEFAULT_LANDING_PAGE_THEME.meta_title,
    meta_description:
      settings.meta_description ?? DEFAULT_LANDING_PAGE_THEME.meta_description,
    og_image_url: settings.og_image_url ?? null,

    // Section Order
    section_order:
      Array.isArray(settings.section_order) && settings.section_order.length > 0
        ? settings.section_order
        : DEFAULT_LANDING_PAGE_THEME.section_order,
  };
}
