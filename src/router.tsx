// src/router.tsx
import { lazy } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  Navigate,
} from "@tanstack/react-router";
import { THE_STANDARD_AGENCY_ID } from "@/hooks/subscription";
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
import { CustomDomainSetupWizard } from "./features/settings/components/custom-domains";
import { MyRecruitingPipeline } from "./features/recruiting/pages/MyRecruitingPipeline";
import { RecruitingYourPage } from "./features/recruiting/pages/RecruitingYourPage";
import { ProspectsView } from "./features/recruiting/components/ProspectsView";
import { PublicJoinPage } from "./features/recruiting/pages/PublicJoinPage";
import { DesignPreviewPage } from "./features/recruiting/pages/DesignPreviewPage";
import { PublicJoinWrapper } from "./features/recruiting/pages/PublicJoinWrapper";
import { PublicRegistrationPage } from "./features/recruiting/pages/PublicRegistrationPage";
import { RecruitDetailPage } from "./features/recruiting/pages/RecruitDetailPage";
import { LeadDetailPage } from "./features/recruiting/pages/LeadDetailPage";
import { TrainingHubPage, TrainerDashboard } from "./features/training-hub";
import MyTrainingPage from "./features/training-modules/components/learner/MyTrainingPage";
import ModulePlayer from "./features/training-modules/components/learner/ModulePlayer";
import ModuleBuilderPage from "./features/training-modules/components/admin/ModuleBuilderPage";
import {
  RoadmapLandingOrAdmin,
  RoadmapListPage,
  RoadmapEditorPage,
  TeamProgressPanel,
  TeamOverviewPage,
  RoadmapRunnerPage,
} from "./features/agent-roadmap";
import PresentationRecordPage from "./features/training-modules/components/presentations/PresentationRecordPage";
import PresentationDetailPage from "./features/training-modules/components/presentations/PresentationDetailPage";
import { ContractingPage } from "./features/contracting/ContractingPage";
import { MessagesPage } from "./features/messages";
import { TermsPage, PrivacyPage, AccessibilityPage } from "./features/legal";
import { WorkflowAdminPage } from "./features/workflows";
import { LeaderboardPage } from "./features/leaderboard";
import {
  LicensingHubPage,
  type LicensingHubTab,
} from "./features/the-standard-team";
import { BillingPage } from "./features/billing/BillingPage";
import { LeadIntelligenceDashboard } from "./features/admin/components/lead-vendors";
import { ChatBotPage } from "./features/chat-bot";
import { AssistantPage } from "./features/assistant";
import { VoiceAgentPage } from "./features/voice-agent";
import { VoiceCloneWizardPage } from "./features/voice-agent/components/VoiceCloneWizardPage";
import { MarketingHubPage } from "./features/marketing";
import { TemplateEditorPage } from "./features/marketing/components/templates/TemplateEditorPage";
import { CampaignEditorPage } from "./features/marketing/components/campaigns/CampaignEditorPage";

// Close KPIs + AI Template Builder RETIRED — their routes now redirect to the
// dashboard, so the page components are no longer imported here.
const KpiPage = lazy(() =>
  import("./features/kpi").then((m) => ({
    default: m.KpiPage,
  })),
);
const CallReviewsPage = lazy(() =>
  import("./features/call-reviews").then((m) => ({
    default: m.CallReviewsPage,
  })),
);
const CallReviewDetailPage = lazy(() =>
  import("./features/call-reviews").then((m) => ({
    default: m.CallReviewDetailPage,
  })),
);
const ScriptsLibraryPage = lazy(() =>
  import("./features/call-reviews").then((m) => ({
    default: m.ScriptsLibraryPage,
  })),
);
const ScriptDetailPage = lazy(() =>
  import("./features/call-reviews").then((m) => ({
    default: m.ScriptDetailPage,
  })),
);
// Lazy-loaded underwriting pages
const UnderwritingWizardPage = lazy(
  () => import("./features/underwriting/components/Wizard"),
);
const UnderwritingGuidesPage = lazy(
  () => import("./features/underwriting/components/UnderwritingGuidesPage"),
);
const UnderwritingAdminPage = lazy(
  () => import("./features/underwriting/admin"),
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

// Leaderboard route - always-on for every approved agent (recruits excluded).
// Previously gated by the paid "leaderboard" subscription feature; made
// universal so all agents can reach it regardless of billing. Data is
// IMO-scoped via RLS.
const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "leaderboard",
  component: () => (
    <RouteGuard noRecruits>
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

// Bot Health monitoring route - admin-only live dashboard for
// standard-chat-bot queue depth, throughput, DB latency, and agent counts.
// Lazy-loaded so the monitoring page never bloats the main bundle.
const BotHealthPageLazy = lazy(() =>
  import("./features/admin/components/BotHealthPage").then((m) => ({
    default: m.BotHealthPage,
  })),
);
const botHealthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin/bot-health",
  component: () => (
    <RouteGuard permission="nav.user_management" noRecruits noStaffRoles>
      <BotHealthPageLazy />
    </RouteGuard>
  ),
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

// Recruit detail route - full-page detail view for a single recruit
const recruitDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/$recruitId",
  component: () => (
    <RouteGuard permission="nav.recruiting_pipeline" noRecruits>
      <RecruitDetailPage />
    </RouteGuard>
  ),
});

// Lead detail route - full-page detail view for a single lead from the public funnel
const leadDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/lead/$leadId",
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
      <LeadDetailPage />
    </RouteGuard>
  ),
});

// Recruiting admin route - pipeline management
// Super-admin only: per owner directive, only the super admin may create/manage
// recruiting pipelines. Backed by RLS (pipeline_templates writes are super-admin
// only) so this is defense-in-depth, not the sole gate.
const recruitingAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/admin/pipelines",
  component: () => (
    <RouteGuard noRecruits superAdminOnly>
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

// Design preview route — renders bare inside the wizard's live-preview iframe.
// Marked public in App.tsx so it loads without the app shell; it only renders a
// spec handed in via postMessage (no DB access).
const designPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "internal/design-preview",
  component: DesignPreviewPage,
});

// Public Registration route - self-registration via invite token (NO AUTH)
const publicRegistrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "register/$token",
  component: PublicRegistrationPage,
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

// Underwriting Admin route - single-page workflow for uploading guides,
// extracting rule candidates, and approving them. Page itself gates on
// useCanManageUnderwriting() so non-admin users see a friendly empty state.
const underwritingAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "underwriting/admin",
  component: () => (
    <RouteGuard noRecruits noStaffRoles>
      <UnderwritingAdminPage />
    </RouteGuard>
  ),
});

// Underwriting Guides route - Training-section carrier guide library backed by
// the `underwriting_guides` table. Open to every approved agent (IMO-scoped via
// RLS; admins upload, everyone views); recruits are excluded at the route.
const underwritingGuidesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "underwriting/guides",
  component: () => (
    <RouteGuard noRecruits>
      <UnderwritingGuidesPage />
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
    <RouteGuard
      noRecruits
      noStaffRoles
      allowedAgencyId={THE_STANDARD_AGENCY_ID}
    >
      <ChatBotPage />
    </RouteGuard>
  ),
});

// Command Center route - embedded Jarvis AI assistant, accessible to all authenticated users
const commandCenterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "command-center",
  component: () => (
    <RouteGuard noRecruits requiresAiAccess>
      <AssistantPage />
    </RouteGuard>
  ),
});

// Voice Clone Wizard route - must be before voice-agent so the more-specific path matches first
const voiceCloneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "voice-agent/clone",
  component: () => (
    <RouteGuard
      noRecruits
      noStaffRoles
      allowedAgencyId={THE_STANDARD_AGENCY_ID}
    >
      <VoiceCloneWizardPage />
    </RouteGuard>
  ),
});

// Voice Agent route - dedicated Premium Voice product surface
const voiceAgentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "voice-agent",
  component: () => (
    <RouteGuard
      noRecruits
      noStaffRoles
      allowedAgencyId={THE_STANDARD_AGENCY_ID}
    >
      <VoiceAgentPage />
    </RouteGuard>
  ),
});

// Close KPIs — RETIRED (Close CRM abandoned). Route kept registered so old links
// redirect to the dashboard instead of 404'ing.
const closeKpiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "close-kpi",
  component: () => <Navigate to="/dashboard" replace />,
});

// Call KPIs - inbound-call KPI workspace (Phase 1). Epic-Life-only during
// rollout (super-admins bypass), mirroring the Command Center email gate.
const kpiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "kpi",
  component: () => (
    <RouteGuard noRecruits requireEmailIncludes="epiclife">
      <KpiPage />
    </RouteGuard>
  ),
});

// Call Reviews — all-agents training library of live call recordings (open to
// every approved agent; recruits excluded; IMO-scoped by RLS, not by email).
const callReviewsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "call-reviews",
  component: () => (
    <RouteGuard noRecruits>
      <CallReviewsPage />
    </RouteGuard>
  ),
});
// Sales Scripts library — AI-generated master scripts per call type. Static path
// ("scripts") outranks the dynamic "$recordingId" sibling, so no route ambiguity.
const callReviewScriptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "call-reviews/scripts",
  component: () => (
    <RouteGuard noRecruits requiresAiAccess>
      <ScriptsLibraryPage />
    </RouteGuard>
  ),
});
const callReviewScriptDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "call-reviews/scripts/$callTypeId",
  component: function CallReviewScriptDetailRouteComponent() {
    const { callTypeId } = callReviewScriptDetailRoute.useParams();
    return (
      <RouteGuard noRecruits requiresAiAccess>
        <ScriptDetailPage callTypeId={callTypeId} />
      </RouteGuard>
    );
  },
});
const callReviewDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "call-reviews/$recordingId",
  component: function CallReviewDetailRouteComponent() {
    const { recordingId } = callReviewDetailRoute.useParams();
    return (
      <RouteGuard noRecruits>
        <CallReviewDetailPage recordingId={recordingId} />
      </RouteGuard>
    );
  },
});

// AI Template Builder (Close-AI-Builder) — RETIRED (Close CRM abandoned). Route
// kept registered so old links redirect to the dashboard instead of 404'ing.
const closeAiBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "close-ai-builder",
  component: () => <Navigate to="/dashboard" replace />,
});

// Alternative join route - catches /join-* pattern using catch-all
// This handles URLs like /join-the-standard without redirect
// Uses stable wrapper component (not inline function) so React Query works correctly
const publicJoinAltRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$slug",
  component: PublicJoinWrapper,
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

// Contracting Hub - open to all approved (non-recruit) agents. Agents track their own
// contracting + eligibility alerts and file different-upline requests; uplines manage
// their downline. Tabs: mine | downline. (Sponsorship approvals live in the always-on
// Action Center, shown on both tabs — legacy ?tab=approvals deep-links resolve to mine.)
const contractingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "contracting",
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    const tab = search.tab;
    return tab === "mine" || tab === "downline" ? { tab } : {};
  },
  component: ContractingRouteComponent,
});

function ContractingRouteComponent() {
  const { tab } = contractingRoute.useSearch();
  return (
    <RouteGuard noRecruits>
      <ContractingPage initialTab={tab} />
    </RouteGuard>
  );
}

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

const accessibilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "accessibility",
  component: AccessibilityPage,
});

// Billing route - subscription management. Hidden from all users for now;
// only super-admins may access it (e.g. to manage Stripe).
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
    // Hidden from all users for now — only super-admins may reach Billing.
    <RouteGuard superAdminOnly>
      <BillingPage />
    </RouteGuard>
  ),
});

// Lead Vendors route - restricted to the two IMO-owner accounts only.
// Kept in sync with the sidebar nav allowedEmails. allowedAgencyId removed so
// the agency-wide grant no longer applies.
const leadVendorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lead-vendors",
  component: () => (
    <RouteGuard
      noRecruits
      noStaffRoles
      allowedEmails={[
        "nickneessen@thestandardhq.com",
        "epiclife.neessen@gmail.com",
      ]}
    >
      <LeadIntelligenceDashboard />
    </RouteGuard>
  ),
});

// Licensing hub route (legacy path /the-standard-team kept for backwards
// compatibility). Free tabs: SureLC + My Documents. `?tab=` deep-links a tab.
// (Writing Numbers moved to the Contracting page.)
const theStandardTeamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "the-standard-team",
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: LicensingHubTab } => {
    const tab = search.tab;
    return tab === "surelc" || tab === "documents" ? { tab } : {};
  },
  component: TheStandardTeamRouteComponent,
});

function TheStandardTeamRouteComponent() {
  const { tab } = theStandardTeamRoute.useSearch();
  return (
    <RouteGuard noRecruits noStaffRoles>
      <LicensingHubPage initialTab={tab} />
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

// ============================================================================
// Agent Roadmap routes
// ============================================================================

// Admin: list of all roadmaps in the current agency
const roadmapListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin/agent-roadmap",
  component: () => (
    <RouteGuard superAdminOnly>
      <RoadmapListPage />
    </RouteGuard>
  ),
});

// Admin: edit a specific roadmap (sections + items + content blocks)
const roadmapEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin/agent-roadmap/$roadmapId",
  component: () => {
    const { roadmapId } = roadmapEditorRoute.useParams();
    return (
      <RouteGuard superAdminOnly>
        <RoadmapEditorPage roadmapId={roadmapId} />
      </RouteGuard>
    );
  },
});

// Admin: team progress monitoring view for a specific roadmap
const roadmapTeamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin/agent-roadmap/$roadmapId/team",
  component: () => {
    const { roadmapId } = roadmapTeamRoute.useParams();
    return (
      <RouteGuard superAdminOnly>
        <TeamProgressPanel roadmapId={roadmapId} />
      </RouteGuard>
    );
  },
});

// Admin: cross-roadmap team overview — "check on all my agents" dashboard
const roadmapTeamOverviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin/agent-roadmap/team",
  component: () => (
    <RouteGuard superAdminOnly>
      <TeamOverviewPage />
    </RouteGuard>
  ),
});

// Agent Roadmap: single entry point for both super-admin and agents.
// Super-admin sees the admin list (manage roadmaps) unless ?preview=true
// is in the URL, in which case they see the agent landing page so they
// can preview what their agents see.
// Regular agents always see the landing page.
const agentRoadmapLandingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "agent-roadmap",
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } => ({
    preview:
      search.preview === "true" || search.preview === true ? true : undefined,
  }),
  component: () => {
    const { preview } = agentRoadmapLandingRoute.useSearch();
    return <RoadmapLandingOrAdmin preview={!!preview} />;
  },
});

// Agent: runner page for a specific roadmap (the checklist they work through)
const agentRoadmapRunnerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "agent-roadmap/$roadmapId",
  component: () => {
    const { roadmapId } = agentRoadmapRunnerRoute.useParams();
    return <RoadmapRunnerPage roadmapId={roadmapId} />;
  },
});

// Recruiting → "Your Page" tab: branded link + custom domains in one place.
const recruitingYourPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/your-page",
  component: () => (
    <RouteGuard permission="nav.recruiting_pipeline" noRecruits>
      <RecruitingYourPage />
    </RouteGuard>
  ),
});

// Recruiting → "Prospects" tab: lightweight follow-up contacts (no account/email).
const recruitingProspectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/prospects",
  component: () => (
    <RouteGuard permission="nav.recruiting_pipeline" noRecruits>
      <ProspectsView />
    </RouteGuard>
  ),
});

// Full-page guided wizard for connecting a user-owned custom domain.
const customDomainSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "recruiting/custom-domains/setup",
  component: () => (
    <RouteGuard noRecruits noStaffRoles subscriptionFeature="custom_branding">
      <CustomDomainSetupWizard />
    </RouteGuard>
  ),
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
  botHealthRoute,
  policiesRoute,
  analyticsRoute,
  leaderboardRoute,
  compGuideRoute,
  settingsRoute,
  targetsRoute,
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
  recruitDetailRoute,
  leadDetailRoute,
  recruitingAdminRoute,
  workflowAdminRoute,
  myPipelineRoute,
  publicJoinRoute,
  designPreviewRoute,
  publicRegistrationRoute,
  trainingHubRoute,
  myTrainingRoute,
  myTrainingBuilderRoute,
  presentationRecordRoute,
  presentationDetailRoute,
  myTrainingModuleRoute,
  trainerDashboardRoute,
  contractingRoute,
  messagesRoute,
  termsRoute,
  privacyRoute,
  accessibilityRoute,
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
  underwritingAdminRoute,
  underwritingGuidesRoute,
  quickQuoteRoute,
  chatBotRoute,
  commandCenterRoute,
  voiceCloneRoute,
  voiceAgentRoute,
  closeKpiRoute,
  kpiRoute,
  callReviewsRoute,
  callReviewScriptsRoute,
  callReviewScriptDetailRoute,
  callReviewDetailRoute,
  closeAiBuilderRoute,
  roadmapListRoute,
  roadmapEditorRoute,
  roadmapTeamOverviewRoute,
  roadmapTeamRoute,
  agentRoadmapLandingRoute,
  agentRoadmapRunnerRoute,
  customDomainSetupRoute,
  recruitingYourPageRoute,
  recruitingProspectsRoute,
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
