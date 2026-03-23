// src/router.tsx
import { lazy } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import App from "./App";
import { ExpensesPage } from "./features/expenses";
import { PolicyDashboard } from "./features/policies";
import { AnalyticsDashboard } from "./features/analytics";
import { DashboardHome } from "./features/dashboard";
import { CompGuide } from "./features/comps";
import { SettingsDashboard } from "./features/settings";
import { TargetsPage } from "./features/targets";
import { TestCompGuide } from "./features/test/TestCompGuide";
import {
  Login,
  AuthCallback,
  ResetPassword,
  EmailVerificationPending,
  PendingApproval,
  DeniedAccess,
} from "./features/auth";
import { ReportsDashboard } from "./features/reports";
import AdminControlCenter from "./features/admin/components/AdminControlCenter";
// PermissionGuard reserved for future granular route permissions
// import { PermissionGuard } from "./components/auth/PermissionGuard";
import { RouteGuard } from "./components/auth/RouteGuard";
import {
  OverrideDashboard,
  DownlinePerformance,
  HierarchyManagement,
} from "./features/hierarchy";
import { HierarchyDashboardCompact } from "./features/hierarchy/HierarchyDashboardCompact";
import { AgentDetailPage } from "./features/hierarchy/AgentDetailPage";
import { OrgChartPage } from "./features/hierarchy/OrgChartPage";
import { RecruitingDashboard } from "./features/recruiting/RecruitingDashboard";
import { PipelineAdminPage } from "./features/recruiting/admin/PipelineAdminPage";
import { MyRecruitingPipeline } from "./features/recruiting/pages/MyRecruitingPipeline";
import { PublicJoinPage } from "./features/recruiting/pages/PublicJoinPage";
import { PublicJoinWrapper } from "./features/recruiting/pages/PublicJoinWrapper";
import { PublicRegistrationPage } from "./features/recruiting/pages/PublicRegistrationPage";
import { TestRegistration } from "./features/recruiting/pages/TestRegistration";
import { LeadsQueueDashboard } from "./features/recruiting/components/LeadsQueueDashboard";
import { TrainingHubPage, TrainerDashboard } from "./features/training-hub";
import MyTrainingPage from "./features/training-modules/components/learner/MyTrainingPage";
import ModulePlayer from "./features/training-modules/components/learner/ModulePlayer";
import ModuleBuilderPage from "./features/training-modules/components/admin/ModuleBuilderPage";
import PresentationRecordPage from "./features/training-modules/components/presentations/PresentationRecordPage";
import PresentationDetailPage from "./features/training-modules/components/presentations/PresentationDetailPage";
import { ContractingPage } from "./features/contracting/ContractingPage";
import { MessagesPage } from "./features/messages";
import { LeaderboardNamingPage } from "./features/messages/components/slack/LeaderboardNamingPage";
import { TermsPage, PrivacyPage } from "./features/legal";
import { WorkflowAdminPage } from "./features/workflows";
import { LeaderboardPage } from "./features/leaderboard";
import { TheStandardTeamRoutePage } from "./features/the-standard-team";
import { BillingPage } from "./features/billing/BillingPage";
import { LeadIntelligenceDashboard } from "./features/admin/components/lead-vendors";
import { ChatBotPage } from "./features/chat-bot";
import { VoiceAgentPage } from "./features/voice-agent";
import { VoiceCloneWizardPage } from "./features/voice-agent/components/VoiceCloneWizardPage";
import { ChannelOrchestrationPage } from "./features/channel-orchestration";
import { MarketingHubPage } from "./features/marketing";
import { TemplateEditorPage } from "./features/marketing/components/templates/TemplateEditorPage";
import { CampaignEditorPage } from "./features/marketing/components/campaigns/CampaignEditorPage";

// Lazy-loaded business tools page
const BusinessToolsPage = lazy(
  () => import("./features/business-tools/BusinessToolsPage"),
);

// Lazy-loaded underwriting pages
const UnderwritingWizardPage = lazy(
  () => import("./features/underwriting/components/Wizard"),
);
const QuickQuotePage = lazy(
  () =>
    import("./features/underwriting/components/QuickQuote/QuickQuoteDialog"),
);

// Create root route with App layout
const rootRoute = createRootRoute({
  component: () => (
    <>
      <App />
      <TanStackRouterDevtools />
    </>
  ),
});

// Dashboard/Home route - requires approval, blocks recruits and staff roles, requires dashboard subscription
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <RouteGuard
      permission="nav.dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="dashboard"
    >
      <DashboardHome />
    </RouteGuard>
  ),
});

// Dashboard route (alias for home) - requires approval, blocks recruits and staff roles, requires dashboard subscription
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "dashboard",
  component: () => (
    <RouteGuard
      permission="nav.dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="dashboard"
    >
      <DashboardHome />
    </RouteGuard>
  ),
});

// Login route with success handler
// Default redirect is /policies since all tiers have access to it
// Dashboard and other premium routes will redirect unauthorized users
function LoginComponent() {
  const navigate = useNavigate();
  const handleLoginSuccess = () => {
    navigate({ to: "/policies" });
  };
  return <Login onSuccess={handleLoginSuccess} />;
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login",
  component: LoginComponent,
});

// Auth callback route (for email confirmation)
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "auth/callback",
  component: AuthCallback,
});

// Password reset route
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "auth/reset-password",
  component: ResetPassword,
});

// Email verification route
const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "auth/verify-email",
  component: EmailVerificationPending,
});

// Policies route - requires approval, blocks recruits and staff roles
const policiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "policies",
  component: () => (
    <RouteGuard permission="nav.policies" noRecruits noStaffRoles>
      <PolicyDashboard />
    </RouteGuard>
  ),
});

// Analytics route - requires approval, blocks recruits and staff roles, requires dashboard subscription
const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "analytics",
  component: () => (
    <RouteGuard
      permission="nav.dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="dashboard"
    >
      <AnalyticsDashboard />
    </RouteGuard>
  ),
});

// Leaderboard route - gated by leaderboard subscription feature
const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "leaderboard",
  component: () => (
    <RouteGuard noRecruits subscriptionFeature="leaderboard">
      <LeaderboardPage />
    </RouteGuard>
  ),
});

// Comp Guide route - Admin only (manages carriers, products, commission rates), requires comp_guide subscription
const compGuideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "comps",
  component: () => (
    <RouteGuard
      permission="carriers.manage"
      noRecruits
      noStaffRoles
      subscriptionFeature="comp_guide"
    >
      <CompGuide />
    </RouteGuard>
  ),
});

// Settings route - allow pending users, supports optional ?tab= search param
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: SettingsRouteComponent,
});

function SettingsRouteComponent() {
  const { tab } = settingsRoute.useSearch();
  return (
    <RouteGuard allowPending>
      <SettingsDashboard initialTab={tab} />
    </RouteGuard>
  );
}

// Targets route - requires approval, blocks recruits and staff roles, requires targets_basic subscription feature
const targetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "targets",
  component: () => (
    <RouteGuard
      permission="nav.dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="targets_basic"
    >
      <TargetsPage />
    </RouteGuard>
  ),
});

// Reports route - requires approval, blocks recruits and staff roles, requires reports_view subscription feature
const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "reports",
  component: () => (
    <RouteGuard
      permission="nav.downline_reports"
      noRecruits
      noStaffRoles
      subscriptionFeature="reports_view"
    >
      <ReportsDashboard />
    </RouteGuard>
  ),
});

// Expenses route - requires approval, blocks recruits and staff roles, requires expenses subscription feature
const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "expenses",
  component: () => (
    <RouteGuard
      permission="expenses.read.own"
      noRecruits
      noStaffRoles
      subscriptionFeature="expenses"
    >
      <ExpensesPage />
    </RouteGuard>
  ),
});

// Test route for debugging comp guide - Super-admin only
const testCompGuideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "test-comp",
  component: () => (
    <RouteGuard requireEmail="nickneessen@thestandardhq.com">
      <TestCompGuide />
    </RouteGuard>
  ),
});

// Pending approval route
const pendingApprovalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "auth/pending",
  component: PendingApproval,
});

// Denied access route
const deniedAccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "auth/denied",
  component: DeniedAccess,
});

// Admin Control Center route - consolidated admin interface, blocks staff roles
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin",
  component: () => (
    <RouteGuard permission="nav.user_management" noRecruits noStaffRoles>
      <AdminControlCenter />
    </RouteGuard>
  ),
});

// Diagnostic route for troubleshooting auth issues - Super-admin only
const authDiagnosticRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin/auth-diagnostic",
  component: () => {
    const AuthDiagnostic = lazy(() =>
      import("./features/admin/components/AuthDiagnostic").then((m) => ({
        default: m.AuthDiagnostic,
      })),
    );
    return (
      <RouteGuard requireEmail="nickneessen@thestandardhq.com">
        <AuthDiagnostic />
      </RouteGuard>
    );
  },
});

// Hierarchy routes - Agency hierarchy and override commissions
// All hierarchy routes require approval, block recruits and staff roles, and require hierarchy subscription feature
const hierarchyIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "hierarchy",
  component: () => (
    <RouteGuard
      permission="nav.team_dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="hierarchy"
    >
      <HierarchyDashboardCompact />
    </RouteGuard>
  ),
});

const hierarchyTreeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "hierarchy/tree",
  component: () => (
    <RouteGuard
      permission="nav.team_dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="hierarchy"
    >
      <HierarchyDashboardCompact />
    </RouteGuard>
  ),
});

const hierarchyOverridesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "hierarchy/overrides",
  component: () => (
    <RouteGuard
      permission="nav.team_dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="overrides"
    >
      <OverrideDashboard />
    </RouteGuard>
  ),
});

const hierarchyDownlinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "hierarchy/downlines",
  component: () => (
    <RouteGuard
      permission="nav.team_dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="downline_reports"
    >
      <DownlinePerformance />
    </RouteGuard>
  ),
});

const hierarchyManageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "hierarchy/manage",
  component: () => (
    <RouteGuard
      permission="nav.team_dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="hierarchy"
    >
      <HierarchyManagement />
    </RouteGuard>
  ),
});

// Agent detail route - View individual agent information
const agentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "hierarchy/agent/$agentId",
  component: () => (
    <RouteGuard
      permission="nav.team_dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="hierarchy"
    >
      <AgentDetailPage />
    </RouteGuard>
  ),
});

// Phase 12A: Org Chart route - Interactive organization visualization
const orgChartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "hierarchy/org-chart",
  component: () => (
    <RouteGuard
      permission="nav.team_dashboard"
      noRecruits
      noStaffRoles
      subscriptionFeature="hierarchy"
    >
      <OrgChartPage />
    </RouteGuard>
  ),
});

// Recruiting route - requires approval, blocks recruits, requires recruiting subscription feature
// Note: Staff roles (trainers, contracting managers) CAN access - they see all IMO recruits via RLS
// Search params: recruitId - optional recruit ID to auto-select on load
const recruitingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting",
  validateSearch: (
    search: Record<string, unknown>,
  ): { recruitId?: string } => ({
    recruitId: search.recruitId ? String(search.recruitId) : undefined,
  }),
  component: () => (
    <RouteGuard permission="nav.recruiting_pipeline" noRecruits>
      <RecruitingDashboard />
    </RouteGuard>
  ),
});

// Recruiting admin route - pipeline management
// Accessible by: super admins (bypass), staff roles (trainers, contracting managers)
// RLS policies control which pipelines each user can actually view/edit
const recruitingAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/admin/pipelines",
  component: () => (
    <RouteGuard noRecruits subscriptionFeature="recruiting">
      <PipelineAdminPage />
    </RouteGuard>
  ),
});

// Workflow admin route - workflow/automation management - Super-admin only
const workflowAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "system/workflows",
  component: () => (
    <RouteGuard requireEmail="nickneessen@thestandardhq.com">
      <WorkflowAdminPage />
    </RouteGuard>
  ),
});

// My Pipeline route - Recruit-only dashboard (allows pending, recruit access only)
const myPipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/my-pipeline",
  component: () => (
    <RouteGuard recruitOnly allowPending>
      <MyRecruitingPipeline />
    </RouteGuard>
  ),
});

// Public Join route - public recruiting funnel landing page (NO AUTH)
// Standard route with slash: /join/the-standard
const publicJoinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "join/$recruiterId",
  component: PublicJoinPage,
});

// Public Registration route - self-registration via invite token (NO AUTH)
const publicRegistrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "register/$token",
  component: PublicRegistrationPage,
});

// Debug route for testing registration
const testRegistrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "test-register/$token",
  component: TestRegistration,
});

// Underwriting Wizard route - full-page wizard, feature flag guarded internally
const underwritingWizardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "underwriting/wizard",
  component: () => (
    <RouteGuard noRecruits noStaffRoles>
      <UnderwritingWizardPage />
    </RouteGuard>
  ),
});

// Quick Quote route - free for all authenticated users
const quickQuoteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "underwriting/quick-quote",
  component: () => <QuickQuotePage />,
});

// Chat Bot route - AI Chat Bot management dashboard, accessible to all authenticated users
const chatBotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "chat-bot",
  component: () => (
    <RouteGuard noRecruits noStaffRoles>
      <ChatBotPage />
    </RouteGuard>
  ),
});

// Voice Clone Wizard route - must be before voice-agent so the more-specific path matches first
const voiceCloneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "voice-agent/clone",
  component: () => (
    <RouteGuard noRecruits noStaffRoles>
      <VoiceCloneWizardPage />
    </RouteGuard>
  ),
});

// Voice Agent route - dedicated Premium Voice product surface
const voiceAgentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "voice-agent",
  component: () => (
    <RouteGuard noRecruits noStaffRoles>
      <VoiceAgentPage />
    </RouteGuard>
  ),
});

// Channel Orchestration route - SMS + Voice routing rules, page handles access gating
const channelOrchestrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "channel-orchestration",
  component: () => (
    <RouteGuard noRecruits noStaffRoles>
      <ChannelOrchestrationPage />
    </RouteGuard>
  ),
});

// Business Tools route - Financial statement processing, page handles upsell internally
const businessToolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "business-tools",
  component: () => (
    <RouteGuard noRecruits noStaffRoles>
      <BusinessToolsPage />
    </RouteGuard>
  ),
});

// Alternative join route - catches /join-* pattern using catch-all
// This handles URLs like /join-the-standard without redirect
// Uses stable wrapper component (not inline function) so React Query works correctly
const publicJoinAltRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$slug",
  component: PublicJoinWrapper,
});

// Leads Queue route - manage incoming leads from public funnel
const leadsQueueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/leads",
  component: () => (
    <RouteGuard
      permission="nav.recruiting_pipeline"
      noRecruits
      subscriptionFeatures={[
        "recruiting",
        "recruiting_basic",
        "recruiting_custom_pipeline",
      ]}
    >
      <LeadsQueueDashboard />
    </RouteGuard>
  ),
});

// Training Hub route - for trainers and contracting managers
const trainingHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "training-hub",
  component: () => (
    <RouteGuard permission="nav.training_hub" noRecruits>
      <TrainingHubPage />
    </RouteGuard>
  ),
});

// My Training route - for agents and recruits to access training modules
const myTrainingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "my-training",
  component: () => (
    <RouteGuard noStaffRoles subscriptionFeature="training">
      <MyTrainingPage />
    </RouteGuard>
  ),
});

// Module Player route - for agents and recruits to play a specific training module
const myTrainingModuleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "my-training/$moduleId",
  component: () => {
    const { moduleId } = myTrainingModuleRoute.useParams();
    return (
      <RouteGuard noStaffRoles subscriptionFeature="training">
        <ModulePlayer moduleId={moduleId} />
      </RouteGuard>
    );
  },
});

// Module Builder route - for admins and staff to build/edit training modules
const myTrainingBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "my-training/builder/$moduleId",
  component: () => {
    const { moduleId } = myTrainingBuilderRoute.useParams();
    return (
      <RouteGuard subscriptionFeature="training">
        <ModuleBuilderPage moduleId={moduleId} />
      </RouteGuard>
    );
  },
});

// Presentation Record route - agents submit weekly presentation recordings
const presentationRecordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "my-training/presentations/record",
  component: () => (
    <RouteGuard noStaffRoles subscriptionFeature="training">
      <PresentationRecordPage />
    </RouteGuard>
  ),
});

// Presentation Detail route - view a specific presentation submission
const presentationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "my-training/presentations/$submissionId",
  component: () => (
    <RouteGuard subscriptionFeature="training">
      <PresentationDetailPage />
    </RouteGuard>
  ),
});

// Trainer Dashboard route - Staff-only dashboard with KPIs and quick actions
const trainerDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "trainer-dashboard",
  component: () => (
    <RouteGuard staffOnly allowPending>
      <TrainerDashboard />
    </RouteGuard>
  ),
});

// Contracting route - for trainers, contracting managers, and admins
// Staff have IMO-wide contract management access
const contractingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "contracting",
  component: () => (
    <RouteGuard permission="nav.contracting_hub" noRecruits allowPending>
      <ContractingPage />
    </RouteGuard>
  ),
});

// Messages route - Communications Hub, requires email subscription feature
const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "messages",
  component: () => (
    <RouteGuard
      permission="nav.messages"
      noRecruits
      subscriptionFeature="email"
    >
      <MessagesPage />
    </RouteGuard>
  ),
});

// Slack leaderboard naming route - requires auth, blocks recruits
const slackNameLeaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "slack/name-leaderboard",
  component: () => (
    <RouteGuard noRecruits>
      <LeaderboardNamingPage />
    </RouteGuard>
  ),
});

// Legal routes - public, no auth required
const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "terms",
  component: TermsPage,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "privacy",
  component: PrivacyPage,
});

// Billing route - unified billing & subscription management, accessible to all authenticated users
const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "billing",
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    checkout?: string;
    addon_checkout?: string;
    pending_addon_id?: string;
    pending_tier_id?: string;
    plan_name?: string;
    billing_interval?: string;
  } => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
    addon_checkout:
      typeof search.addon_checkout === "string"
        ? search.addon_checkout
        : undefined,
    pending_addon_id:
      typeof search.pending_addon_id === "string"
        ? search.pending_addon_id
        : undefined,
    pending_tier_id:
      typeof search.pending_tier_id === "string"
        ? search.pending_tier_id
        : undefined,
    plan_name:
      typeof search.plan_name === "string" ? search.plan_name : undefined,
    billing_interval:
      typeof search.billing_interval === "string"
        ? search.billing_interval
        : undefined,
  }),
  component: () => (
    <RouteGuard allowPending>
      <BillingPage />
    </RouteGuard>
  ),
});

// Lead Vendors route - restricted to specific users in The Standard agency
const leadVendorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lead-vendors",
  component: () => (
    <RouteGuard
      noRecruits
      noStaffRoles
      allowedEmails={[
        "hunterthornhillsm@gmail.com",
        "andrewengel1999@gmail.com",
        "minyojames@gmail.com",
        "james.wadleigh.insurance@gmail.com",
      ]}
      allowedAgencyId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    >
      <LeadIntelligenceDashboard />
    </RouteGuard>
  ),
});

// Licensing/Writing route (legacy path kept for backwards compatibility)
// Supports tab search param: ?tab=writing-numbers or ?tab=state-licenses
const theStandardTeamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "the-standard-team",
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: TheStandardTeamRouteComponent,
});

function TheStandardTeamRouteComponent() {
  const { tab } = theStandardTeamRoute.useSearch();
  return (
    <RouteGuard noRecruits noStaffRoles>
      <TheStandardTeamRoutePage initialTab={tab} />
    </RouteGuard>
  );
}

// Marketing Hub - super admin only
const marketingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "marketing",
  component: () => (
    <RouteGuard noRecruits noStaffRoles superAdminOnly>
      <MarketingHubPage />
    </RouteGuard>
  ),
});

// Marketing Hub - templates tab deep-link
const marketingTemplatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "marketing/templates",
  component: () => (
    <RouteGuard noRecruits noStaffRoles superAdminOnly>
      <MarketingHubPage initialTab="templates" />
    </RouteGuard>
  ),
});

// Marketing Hub - campaigns tab deep-link
const marketingCampaignsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "marketing/campaigns",
  component: () => (
    <RouteGuard noRecruits noStaffRoles superAdminOnly>
      <MarketingHubPage initialTab="campaigns" />
    </RouteGuard>
  ),
});

// Marketing campaign editor - create
const marketingCampaignCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "marketing/campaigns/new",
  validateSearch: (search: Record<string, unknown>): { prefill?: string } => ({
    prefill:
      typeof search.prefill === "string" && search.prefill.length > 0
        ? search.prefill
        : undefined,
  }),
  component: MarketingCampaignCreateRouteComponent,
});

function MarketingCampaignCreateRouteComponent() {
  const { prefill } = marketingCampaignCreateRoute.useSearch();
  return (
    <RouteGuard noRecruits noStaffRoles superAdminOnly>
      <CampaignEditorPage prefillKey={prefill} />
    </RouteGuard>
  );
}

// Marketing campaign editor - edit draft
const marketingCampaignEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "marketing/campaigns/$campaignId/edit",
  component: () => {
    const { campaignId } = marketingCampaignEditRoute.useParams();
    return (
      <RouteGuard noRecruits noStaffRoles superAdminOnly>
        <CampaignEditorPage editCampaignId={campaignId} />
      </RouteGuard>
    );
  },
});

// Marketing template editor - create
const marketingTemplateCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "marketing/templates/new",
  component: () => (
    <RouteGuard noRecruits noStaffRoles superAdminOnly>
      <TemplateEditorPage />
    </RouteGuard>
  ),
});

// Marketing template editor - edit
const marketingTemplateEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "marketing/templates/$templateId/edit",
  component: () => {
    const { templateId } = marketingTemplateEditRoute.useParams();
    return (
      <RouteGuard noRecruits noStaffRoles superAdminOnly>
        <TemplateEditorPage templateId={templateId} />
      </RouteGuard>
    );
  },
});

// Create the route tree - all routes are already linked via getParentRoute
// Note: publicJoinAltRoute is at the end as a catch-all for /join-* URLs
const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  loginRoute,
  authCallbackRoute,
  resetPasswordRoute,
  verifyEmailRoute,
  pendingApprovalRoute,
  deniedAccessRoute,
  adminRoute,
  authDiagnosticRoute,
  policiesRoute,
  analyticsRoute,
  leaderboardRoute,
  compGuideRoute,
  settingsRoute,
  targetsRoute,
  reportsRoute,
  expensesRoute,
  testCompGuideRoute,
  hierarchyIndexRoute,
  hierarchyTreeRoute,
  hierarchyOverridesRoute,
  hierarchyDownlinesRoute,
  hierarchyManageRoute,
  agentDetailRoute,
  orgChartRoute,
  recruitingRoute,
  recruitingAdminRoute,
  workflowAdminRoute,
  myPipelineRoute,
  publicJoinRoute,
  publicRegistrationRoute,
  testRegistrationRoute,
  leadsQueueRoute,
  trainingHubRoute,
  myTrainingRoute,
  myTrainingBuilderRoute,
  presentationRecordRoute,
  presentationDetailRoute,
  myTrainingModuleRoute,
  trainerDashboardRoute,
  contractingRoute,
  messagesRoute,
  slackNameLeaderboardRoute,
  termsRoute,
  privacyRoute,
  billingRoute,
  theStandardTeamRoute,
  leadVendorsRoute,
  marketingRoute,
  marketingCampaignsRoute,
  marketingCampaignCreateRoute,
  marketingCampaignEditRoute,
  marketingTemplatesRoute,
  marketingTemplateCreateRoute,
  marketingTemplateEditRoute,
  underwritingWizardRoute,
  quickQuoteRoute,
  chatBotRoute,
  voiceCloneRoute,
  voiceAgentRoute,
  channelOrchestrationRoute,
  businessToolsRoute,
  publicJoinAltRoute, // Catch-all for /join-* pattern - must be last
]);

// Create and export the router
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

// Type declaration for TypeScript
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
