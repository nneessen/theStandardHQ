// src/constants/features.ts
// Feature registry - single source of truth for all subscription features

export type FeatureCategory =
  | "core"
  | "tracking"
  | "reports"
  | "team"
  | "messaging"
  | "analytics"
  | "branding"
  | "tools";

export interface FeatureDefinition {
  key: string;
  displayName: string;
  description: string;
  category: FeatureCategory;
}

export interface AnalyticsSectionDefinition {
  key: string;
  displayName: string;
  description: string;
}

// ============================================
// Feature Registry
// ============================================

export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  // Core Features
  dashboard: {
    key: "dashboard",
    displayName: "Dashboard",
    description: "Main dashboard with KPIs and quick stats",
    category: "core",
  },
  policies: {
    key: "policies",
    displayName: "Policy Management",
    description: "Track and manage insurance policies",
    category: "core",
  },
  comp_guide: {
    key: "comp_guide",
    displayName: "Compensation Guide",
    description: "View carrier compensation rates",
    category: "core",
  },
  settings: {
    key: "settings",
    displayName: "Settings",
    description: "User profile and preferences",
    category: "core",
  },
  connect_upline: {
    key: "connect_upline",
    displayName: "Connect Upline",
    description: "Link to your upline agent",
    category: "core",
  },

  // Analytics Features
  analytics: {
    key: "analytics",
    displayName: "Analytics Dashboard",
    description: "Advanced analytics with charts and insights",
    category: "analytics",
  },

  // Tracking Features
  expenses: {
    key: "expenses",
    displayName: "Expense Tracking",
    description: "Track and categorize business expenses",
    category: "tracking",
  },
  targets_basic: {
    key: "targets_basic",
    displayName: "Basic Targets",
    description: "Set and track monthly income targets",
    category: "tracking",
  },
  targets_full: {
    key: "targets_full",
    displayName: "Full Targets & Goals",
    description: "Advanced target tracking with persistency",
    category: "tracking",
  },

  // Reports Features
  reports_view: {
    key: "reports_view",
    displayName: "View Reports",
    description: "Access to performance reports",
    category: "reports",
  },
  reports_export: {
    key: "reports_export",
    displayName: "Export Reports",
    description: "Download reports as CSV/PDF",
    category: "reports",
  },
  downline_reports: {
    key: "downline_reports",
    displayName: "Downline Reports",
    description: "View team performance reports",
    category: "reports",
  },

  // Team Features
  hierarchy: {
    key: "hierarchy",
    displayName: "Team Hierarchy",
    description: "View and manage team structure",
    category: "team",
  },
  team_analytics: {
    key: "team_analytics",
    displayName: "Team Analytics Dashboard",
    description: "Advanced analytics for your team's performance",
    category: "team",
  },
  recruiting: {
    key: "recruiting",
    displayName: "Recruiting Pipeline",
    description: "Manage recruitment pipeline and candidates",
    category: "team",
  },
  overrides: {
    key: "overrides",
    displayName: "Override Tracking",
    description: "Track override commissions from downline",
    category: "team",
  },
  leaderboard: {
    key: "leaderboard",
    displayName: "Leaderboard",
    description: "Agency and team performance leaderboard with rankings",
    category: "team",
  },

  // Messaging Features
  email: {
    key: "email",
    displayName: "Email Messaging",
    description: "Send emails from the platform",
    category: "messaging",
  },
  sms: {
    key: "sms",
    displayName: "SMS Messaging",
    description: "Send SMS messages from the platform",
    category: "messaging",
  },
  slack: {
    key: "slack",
    displayName: "Slack Integration",
    description: "Connect and message via Slack channels",
    category: "messaging",
  },
  instagram_messaging: {
    key: "instagram_messaging",
    displayName: "Instagram Messaging",
    description: "Manage Instagram DMs from the platform",
    category: "messaging",
  },
  instagram_scheduled_messages: {
    key: "instagram_scheduled_messages",
    displayName: "Scheduled Instagram Messages",
    description: "Schedule Instagram DMs to send later",
    category: "messaging",
  },
  instagram_templates: {
    key: "instagram_templates",
    displayName: "Instagram Templates",
    description: "Create and use message templates for Instagram",
    category: "messaging",
  },

  // Training Features
  training: {
    key: "training",
    displayName: "Training Modules",
    description: "Access training modules, quizzes, and gamification",
    category: "team",
  },

  // Premium Branding Features
  recruiting_basic: {
    key: "recruiting_basic",
    displayName: "Basic Recruiting",
    description: "Simple recruiting pipeline with lead tracking",
    category: "team",
  },
  recruiting_custom_pipeline: {
    key: "recruiting_custom_pipeline",
    displayName: "Custom Recruiting Pipeline",
    description: "Full recruiting pipeline with custom stages and automation",
    category: "team",
  },
  custom_branding: {
    key: "custom_branding",
    displayName: "Custom Branding",
    description:
      "Custom domain, personalized recruiting link, and landing page customization",
    category: "branding",
  },

  // Tools Features
  business_tools: {
    key: "business_tools",
    displayName: "Business Tools",
    description:
      "Financial statement processing, transaction categorization, and workbook export",
    category: "tools",
  },
} as const;

// ============================================
// Analytics Sections Registry
// ============================================

export const ANALYTICS_SECTIONS_REGISTRY: Record<
  string,
  AnalyticsSectionDefinition
> = {
  pace_metrics: {
    key: "pace_metrics",
    displayName: "Pace Metrics",
    description: "Real-time performance pace and projections",
  },
  carriers_products: {
    key: "carriers_products",
    displayName: "Carriers & Products",
    description: "Breakdown by carrier and product type",
  },
  product_matrix: {
    key: "product_matrix",
    displayName: "Product Matrix",
    description: "Product distribution analysis",
  },
  policy_status_breakdown: {
    key: "policy_status_breakdown",
    displayName: "Policy Status",
    description: "Active, lapsed, and cancelled policy breakdown",
  },
  geographic: {
    key: "geographic",
    displayName: "Geographic Analysis",
    description: "Premium by state with US map",
  },
  client_segmentation: {
    key: "client_segmentation",
    displayName: "Client Segmentation",
    description: "Low, medium, high value client metrics",
  },
  game_plan: {
    key: "game_plan",
    displayName: "Game Plan",
    description: "Actionable recommendations to hit targets",
  },
  commission_pipeline: {
    key: "commission_pipeline",
    displayName: "Commission Pipeline",
    description: "Pipeline visualization and forecasting",
  },
  predictive_analytics: {
    key: "predictive_analytics",
    displayName: "Predictive Analytics",
    description: "AI-powered earnings forecasts",
  },
} as const;

// ============================================
// Helper Types
// ============================================

export type FeatureKey = keyof typeof FEATURE_REGISTRY;
export type AnalyticsSectionKey = keyof typeof ANALYTICS_SECTIONS_REGISTRY;

// Feature keys array for iteration
export const ALL_FEATURE_KEYS = Object.keys(FEATURE_REGISTRY) as FeatureKey[];
export const ALL_ANALYTICS_SECTION_KEYS = Object.keys(
  ANALYTICS_SECTIONS_REGISTRY,
) as AnalyticsSectionKey[];

// ============================================
// Category Helpers
// ============================================

export const FEATURE_CATEGORIES: Record<
  FeatureCategory,
  { label: string; description: string }
> = {
  core: {
    label: "Core Features",
    description: "Essential functionality for all users",
  },
  tracking: {
    label: "Tracking & Targets",
    description: "Financial tracking and goal setting",
  },
  reports: {
    label: "Reports",
    description: "Performance reporting and exports",
  },
  team: {
    label: "Team Management",
    description: "Hierarchy and team features",
  },
  messaging: {
    label: "Messaging",
    description: "Communication channels",
  },
  analytics: {
    label: "Analytics",
    description: "Advanced analytics sections",
  },
  branding: {
    label: "Branding & White Label",
    description: "Custom branding and white-label features",
  },
  tools: {
    label: "Tools",
    description: "Business productivity tools",
  },
};

/** Accent dot colors for category headers (Tailwind bg classes) */
export const CATEGORY_ACCENT_COLORS: Record<FeatureCategory, string> = {
  core: "bg-blue-500",
  tracking: "bg-amber-500",
  reports: "bg-emerald-500",
  team: "bg-violet-500",
  messaging: "bg-cyan-500",
  analytics: "bg-rose-500",
  branding: "bg-fuchsia-500",
  tools: "bg-teal-500",
};

/** Left border accent colors for feature rows within each category */
export const CATEGORY_BORDER_COLORS: Record<FeatureCategory, string> = {
  core: "border-l-blue-500/40",
  tracking: "border-l-amber-500/40",
  reports: "border-l-emerald-500/40",
  team: "border-l-violet-500/40",
  messaging: "border-l-cyan-500/40",
  analytics: "border-l-rose-500/40",
  branding: "border-l-fuchsia-500/40",
  tools: "border-l-teal-500/40",
};

/** Lucide icon name string per category (resolved in component) */
export const CATEGORY_ICONS: Record<FeatureCategory, string> = {
  core: "LayoutDashboard",
  tracking: "Target",
  reports: "FileText",
  team: "Users",
  messaging: "MessageSquare",
  analytics: "BarChart3",
  branding: "Palette",
  tools: "Wrench",
};

/**
 * Get features grouped by category
 */
export function getFeaturesByCategory(): Record<
  FeatureCategory,
  FeatureDefinition[]
> {
  const grouped: Record<FeatureCategory, FeatureDefinition[]> = {
    core: [],
    tracking: [],
    reports: [],
    team: [],
    messaging: [],
    analytics: [],
    branding: [],
    tools: [],
  };

  for (const feature of Object.values(FEATURE_REGISTRY)) {
    grouped[feature.category].push(feature);
  }

  return grouped;
}

/**
 * Get feature display name
 */
export function getFeatureDisplayName(featureKey: string): string {
  return FEATURE_REGISTRY[featureKey]?.displayName || featureKey;
}

/**
 * Get analytics section display name
 */
export function getAnalyticsSectionDisplayName(sectionKey: string): string {
  return ANALYTICS_SECTIONS_REGISTRY[sectionKey]?.displayName || sectionKey;
}
