import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  UserPlus,
  Mail,
  Download,
  Settings2,
  Inbox,
  Link2,
  Copy,
  Check,
  ArrowRight,
  ArrowUpRight,
  Users,
} from "lucide-react";
import {
  useRecruits,
  usePendingLeadsCount,
  usePendingInvitations,
} from "./hooks";
import { useActiveTemplate, usePhases } from "./hooks/usePipeline";
import { RecruitListTable } from "./components/RecruitListTable";
import { RecruitDetailPanel } from "./components/RecruitDetailPanel";
import { AddRecruitDialog } from "./components/AddRecruitDialog";
import { SendInviteDialog } from "./components/SendInviteDialog";
import { RecruitingErrorBoundary } from "./components/RecruitingErrorBoundary";
import {
  EditorialMasthead,
  EditorialStat,
  PipelineAttentionRow,
} from "./components/editorial";
import type { AttentionItem } from "./components/editorial";
import type { UserProfile } from "@/types/hierarchy.types";
import { useAuth } from "@/contexts/AuthContext";
import { STAFF_ONLY_ROLES } from "@/constants/roles";
import type { RecruitFilters } from "@/types/recruiting.types";
import { toast } from "sonner";
import { Link, useSearch } from "@tanstack/react-router";
import { downloadCSV } from "@/utils/exportHelpers";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports -- pre-existing: recruiter_slug query needs direct supabase access
import { supabase } from "@/services/base/supabase";
import { normalizePhaseNameToStatus } from "@/lib/pipeline";
import { useFeatureAccess } from "@/hooks/subscription";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { BasicRecruitingView } from "./components/BasicRecruitingView";
import { cn } from "@/lib/utils";

type RecruitWithRelations = UserProfile & {
  recruiter?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
  upline?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
};

const TOOLBAR_LINK_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg bg-warning hover:bg-warning/70 text-foreground px-3.5 py-2 text-[12px] font-semibold transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0";
const TOOLBAR_LINK_GHOST =
  "inline-flex items-center gap-1.5 rounded-lg ring-1 ring-border    hover:bg-background dark:hover:bg-muted px-3 py-2 text-[12px] font-semibold text-foreground dark:text-muted-foreground transition-colors";

function RecruitingDashboardContent() {
  const { user } = useAuth();
  const [hideProspects, setHideProspects] = useState(true);

  const isStaffRole =
    user?.roles?.some((role) =>
      STAFF_ONLY_ROLES.includes(role as (typeof STAFF_ONLY_ROLES)[number]),
    ) ?? false;

  const { hasAccess: hasCustomBranding } = useFeatureAccess("custom_branding");

  const recruitFilters: RecruitFilters | undefined = (() => {
    if (!user?.id) return undefined;
    if (isStaffRole && user.imo_id) {
      return { imo_id: user.imo_id, exclude_prospects: hideProspects };
    }
    return { my_recruits_user_id: user.id, exclude_prospects: hideProspects };
  })();

  const { data: recruitsData, isLoading: recruitsLoading } = useRecruits(
    recruitFilters,
    1,
    50,
    { enabled: !!user?.id },
  );

  const { data: pendingInvitations = [] } = usePendingInvitations();
  const { data: pendingLeadsCount } = usePendingLeadsCount();
  const { data: activeTemplate } = useActiveTemplate();
  const { data: pipelinePhases = [] } = usePhases(activeTemplate?.id);

  const [selectedRecruit, setSelectedRecruit] = useState<UserProfile | null>(
    null,
  );
  const [addRecruitDialogOpen, setAddRecruitDialogOpen] = useState(false);
  const [sendInviteDialogOpen, setSendInviteDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { recruitId } = useSearch({ from: "/recruiting" });

  const { data: recruiterSlug } = useQuery({
    queryKey: ["recruiter-slug", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("recruiter_slug")
        .eq("id", user.id)
        .single();
      return data?.recruiter_slug || null;
    },
    enabled: !!user?.id,
  });

  const handleCopyLink = async () => {
    if (!recruiterSlug) return;
    const url = `https://www.thestandardhq.com/join-${recruiterSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const registeredRecruits = (
    (recruitsData?.data || []) as RecruitWithRelations[]
  ).filter((recruit) => recruit.id !== user?.id);

  const invitedRecruits = pendingInvitations
    .filter((inv) => !inv.recruit_id)
    .map((inv) => ({
      id: `invitation-${inv.id}`,
      email: inv.email,
      first_name: inv.first_name || null,
      last_name: inv.last_name || null,
      phone: inv.phone || null,
      city: inv.city || null,
      state: inv.state || null,
      onboarding_status: "invited",
      created_at: inv.created_at,
      updated_at: inv.updated_at,
      is_invitation: true,
      invitation_id: inv.id,
      invitation_status: inv.status,
      invitation_sent_at: inv.sent_at,
      recruiter_id: inv.inviter_id,
      upline_id: inv.upline_id || inv.inviter_id,
      roles: ["recruit"],
      is_admin: false,
      imo_id: user?.imo_id || null,
      agency_id: user?.agency_id || null,
    })) as unknown as RecruitWithRelations[];

  const recruits = useMemo(
    () => [...invitedRecruits, ...registeredRecruits],
    [invitedRecruits, registeredRecruits],
  );

  useEffect(() => {
    if (recruitId && recruits.length > 0 && !selectedRecruit) {
      const recruit = recruits.find((r) => r.id === recruitId);
      if (recruit) {
        setSelectedRecruit(recruit);
        setDetailSheetOpen(true);
      }
    }
  }, [recruitId, recruits, selectedRecruit]);

  useEffect(() => {
    if (!selectedRecruit) return;
    const fresh = recruits.find((r) => r.id === selectedRecruit.id);
    if (fresh && fresh !== selectedRecruit) setSelectedRecruit(fresh);
  }, [recruits]);

  const activePhaseStatuses = pipelinePhases.map((phase) =>
    normalizePhaseNameToStatus(phase.phase_name),
  );

  const stats = useMemo(() => {
    return {
      total: recruits.length,
      active: recruits.filter((r) =>
        r.onboarding_status && activePhaseStatuses.length > 0
          ? activePhaseStatuses.includes(r.onboarding_status)
          : r.onboarding_status !== "completed" &&
            r.onboarding_status !== "dropped",
      ).length,
      completed: recruits.filter((r) => r.onboarding_status === "completed")
        .length,
      dropped: recruits.filter((r) => r.onboarding_status === "dropped").length,
      invited: recruits.filter((r) => r.onboarding_status === "invited").length,
      blocked: recruits.filter((r) => r.onboarding_status === "blocked").length,
    };
  }, [recruits, activePhaseStatuses]);

  const attentionItems: AttentionItem[] = [
    {
      id: "invited",
      count: stats.invited,
      label: "invited · awaiting signup",
      tone: "warn",
      onSelect: () =>
        setStatusFilter((f) => (f === "invited" ? null : "invited")),
      isActive: statusFilter === "invited",
    },
    {
      id: "blocked",
      count: stats.blocked,
      label: "blocked · need unblock",
      tone: "error",
      onSelect: () =>
        setStatusFilter((f) => (f === "blocked" ? null : "blocked")),
      isActive: statusFilter === "blocked",
    },
    {
      id: "leads",
      count: pendingLeadsCount || 0,
      label: "incoming leads to review",
      tone: "success",
    },
  ];

  const filteredRecruits = useMemo(() => {
    if (!statusFilter) return recruits;
    return recruits.filter((r) => r.onboarding_status === statusFilter);
  }, [recruits, statusFilter]);

  const handleSelectRecruit = (recruit: UserProfile) => {
    setSelectedRecruit(recruit);
    setDetailSheetOpen(true);
  };

  const handleExportCSV = () => {
    const exportData = recruits.map((r) => ({
      Name: r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : "",
      Email: r.email,
      Phone: r.phone || "",
      Status: r.onboarding_status || "",
      Recruiter:
        r.recruiter?.first_name && r.recruiter?.last_name
          ? `${r.recruiter.first_name} ${r.recruiter.last_name}`
          : r.recruiter?.email || "",
      Upline:
        r.upline?.first_name && r.upline?.last_name
          ? `${r.upline.first_name} ${r.upline.last_name}`
          : r.upline?.email || "",
      Created: r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
    }));
    downloadCSV(exportData, "recruits");
    toast.success(`Exported ${recruits.length} recruits to CSV`);
  };

  const handleRecruitDeleted = () => {
    setSelectedRecruit(null);
    setDetailSheetOpen(false);
  };

  const recruitingLinkUrl = recruiterSlug
    ? `www.thestandardhq.com/join-${recruiterSlug}`
    : null;

  return (
    <div className="min-h-screen bg-background ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12 flex flex-col gap-5 md:gap-6">
        <EditorialMasthead
          icon={Users}
          eyebrow="Recruiting · Pipeline"
          title="Your recruits, at a glance"
          subtitle={
            <>
              Click any name to open their pipeline. The card below highlights
              who needs you right now — start there before scrolling the full
              list.
            </>
          }
          rightSlot={
            <div className="flex items-end gap-6">
              <EditorialStat
                label="Active"
                value={stats.active}
                size="lg"
                tone="brand"
              />
              <EditorialStat
                label="Complete"
                value={stats.completed}
                size="md"
                tone="success"
              />
              <EditorialStat
                label="Dropped"
                value={stats.dropped}
                size="md"
                tone={stats.dropped > 0 ? "error" : "default"}
              />
            </div>
          }
        />

        <PipelineAttentionRow items={attentionItems} />

        {/* Recruit list — wrapped in a card */}
        <section className="rounded-2xl bg-white dark:bg-card ring-1 ring-border  shadow-sm dark:shadow-none overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 md:px-6 py-4 border-b border-border  bg-background/40 dark:bg-background/40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground dark:text-muted-foreground">
                {statusFilter
                  ? `Filtered · ${statusFilter}`
                  : `Showing all ${stats.total}`}
              </span>
              {statusFilter && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(null)}
                  className="text-[11px] text-muted-foreground dark:text-muted-foreground underline underline-offset-2 hover:text-foreground dark:hover:text-background"
                >
                  clear filter
                </button>
              )}
              <label className="ml-2 inline-flex items-center gap-1.5 text-[11px] text-foreground dark:text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideProspects}
                  onChange={(e) => setHideProspects(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border "
                />
                Hide prospects
              </label>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isStaffRole && (
                <Link to="/recruiting/leads" className={TOOLBAR_LINK_GHOST}>
                  <Inbox className="h-3.5 w-3.5" />
                  Leads
                  {pendingLeadsCount && pendingLeadsCount > 0 ? (
                    <span className="ml-1 font-mono tabular-nums text-warning">
                      {pendingLeadsCount}
                    </span>
                  ) : null}
                </Link>
              )}
              <button
                type="button"
                onClick={handleExportCSV}
                className={TOOLBAR_LINK_GHOST}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                type="button"
                onClick={() => setSendInviteDialogOpen(true)}
                className={TOOLBAR_LINK_GHOST}
              >
                <Mail className="h-3.5 w-3.5" />
                Send invite
              </button>
              <Link
                to="/recruiting/admin/pipelines"
                className={TOOLBAR_LINK_GHOST}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Pipelines
              </Link>
              <button
                type="button"
                onClick={() => setAddRecruitDialogOpen(true)}
                className={TOOLBAR_LINK_PRIMARY}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add recruit
              </button>
            </div>
          </div>

          {/* Recruiting link strip */}
          {!isStaffRole && hasCustomBranding && (
            <div
              className={cn(
                "px-5 md:px-6 py-3.5 border-b border-border  flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                recruitingLinkUrl
                  ? "bg-warning/10/60 dark:bg-warning/15"
                  : "bg-warning/10/30 dark:bg-warning/10",
              )}
            >
              {recruitingLinkUrl ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2 className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                    <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-warning">
                      Your link
                    </span>
                    <span className="text-[12px] font-mono text-foreground  truncate">
                      {recruitingLinkUrl}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={cn(
                      TOOLBAR_LINK_PRIMARY,
                      "self-start sm:self-auto",
                    )}
                  >
                    {linkCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy link
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2 className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                    <span className="text-[12px] text-foreground dark:text-muted-foreground">
                      Set up your personal recruiting link to share on social
                      media.
                    </span>
                  </div>
                  <Link to="/settings" className={TOOLBAR_LINK_PRIMARY}>
                    Set up link
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Table */}
          <div className="px-5 md:px-6">
            <RecruitListTable
              recruits={filteredRecruits}
              isLoading={recruitsLoading}
              selectedRecruitId={selectedRecruit?.id}
              onSelectRecruit={handleSelectRecruit}
            />
          </div>

          {filteredRecruits.length === 0 && !recruitsLoading && (
            <div className="px-5 md:px-6 pb-8 pt-2 text-center">
              <p className="text-[14px] text-foreground dark:text-muted-foreground mb-4">
                {statusFilter
                  ? `No recruits match the "${statusFilter}" filter.`
                  : "No recruits yet — send an invite or add one to start your pipeline."}
              </p>
              {!statusFilter && (
                <button
                  type="button"
                  onClick={() => setSendInviteDialogOpen(true)}
                  className={cn(TOOLBAR_LINK_PRIMARY, "inline-flex")}
                >
                  Send your first invite
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] md:max-w-[560px] lg:max-w-[640px] p-0 overflow-hidden"
        >
          <SheetTitle className="sr-only">Recruit Details</SheetTitle>
          <SheetDescription className="sr-only">
            View and manage recruit information, pipeline progress, and
            documents
          </SheetDescription>
          {selectedRecruit && (
            <RecruitDetailPanel
              key={selectedRecruit.id}
              recruit={selectedRecruit}
              currentUserId={user?.id}
              isUpline={true}
              onRecruitDeleted={handleRecruitDeleted}
            />
          )}
        </SheetContent>
      </Sheet>

      <AddRecruitDialog
        open={addRecruitDialogOpen}
        onOpenChange={setAddRecruitDialogOpen}
        onSuccess={(newRecruitId) => {
          const newRecruit = recruits.find((r) => r.id === newRecruitId);
          if (newRecruit) {
            setSelectedRecruit(newRecruit);
            setDetailSheetOpen(true);
          }
        }}
      />

      <SendInviteDialog
        open={sendInviteDialogOpen}
        onOpenChange={setSendInviteDialogOpen}
      />
    </div>
  );
}

function FreeUplineRecruitingView() {
  const { user } = useAuth();

  const recruitFilters: RecruitFilters | undefined = user?.id
    ? { my_recruits_user_id: user.id, exclude_prospects: false }
    : undefined;

  const { data: recruitsData, isLoading: recruitsLoading } = useRecruits(
    recruitFilters,
    1,
    50,
    { enabled: !!user?.id },
  );

  const { data: activeTemplate } = useActiveTemplate();
  const { data: pipelinePhases = [] } = usePhases(activeTemplate?.id);

  const [selectedRecruit, setSelectedRecruit] = useState<UserProfile | null>(
    null,
  );
  const [addRecruitDialogOpen, setAddRecruitDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const { recruitId } = useSearch({ from: "/recruiting" });

  const recruits = ((recruitsData?.data || []) as UserProfile[]).filter(
    (recruit) => recruit.id !== user?.id,
  );

  useEffect(() => {
    if (recruitId && recruits.length > 0 && !selectedRecruit) {
      const recruit = recruits.find((r) => r.id === recruitId);
      if (recruit) {
        setSelectedRecruit(recruit);
        setDetailSheetOpen(true);
      }
    }
  }, [recruitId, recruits, selectedRecruit]);

  useEffect(() => {
    if (!selectedRecruit) return;
    const fresh = recruits.find((r) => r.id === selectedRecruit.id);
    if (fresh && fresh !== selectedRecruit) setSelectedRecruit(fresh);
  }, [recruits]);

  const activePhaseStatuses = pipelinePhases.map((phase) =>
    normalizePhaseNameToStatus(phase.phase_name),
  );
  const stats = {
    total: recruits.length,
    active: recruits.filter((r) =>
      r.onboarding_status && activePhaseStatuses.length > 0
        ? activePhaseStatuses.includes(r.onboarding_status)
        : r.onboarding_status !== "completed" &&
          r.onboarding_status !== "dropped",
    ).length,
    completed: recruits.filter((r) => r.onboarding_status === "completed")
      .length,
    dropped: recruits.filter((r) => r.onboarding_status === "dropped").length,
  };

  const handleSelectRecruit = (recruit: UserProfile) => {
    setSelectedRecruit(recruit);
    setDetailSheetOpen(true);
  };

  const handleRecruitDeleted = () => {
    setSelectedRecruit(null);
    setDetailSheetOpen(false);
  };

  return (
    <div className="min-h-screen bg-background ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12 flex flex-col gap-5 md:gap-6">
        <EditorialMasthead
          icon={Users}
          eyebrow="Recruiting · Free tier"
          title="Your existing team"
          subtitle={
            <>
              You can keep managing your existing recruits on the free plan.{" "}
              <Link
                to="/billing"
                className="font-bold text-warning hover:text-warning dark:hover:text-warning underline underline-offset-2"
              >
                Upgrade
              </Link>{" "}
              to unlock the full pipeline configuration and add more.
            </>
          }
          rightSlot={
            <div className="flex items-end gap-6">
              <EditorialStat
                label="Active"
                value={stats.active}
                size="lg"
                tone="brand"
              />
              <EditorialStat
                label="Complete"
                value={stats.completed}
                size="md"
                tone="success"
              />
              <EditorialStat
                label="Dropped"
                value={stats.dropped}
                size="md"
                tone={stats.dropped > 0 ? "error" : "default"}
              />
            </div>
          }
        />

        <section className="rounded-2xl bg-white dark:bg-card ring-1 ring-border  shadow-sm dark:shadow-none overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-border  bg-background/40 dark:bg-background/40 flex items-center justify-end gap-2 flex-wrap">
            <Link to="/billing" className={TOOLBAR_LINK_GHOST}>
              Upgrade for full pipeline
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setAddRecruitDialogOpen(true)}
              className={TOOLBAR_LINK_PRIMARY}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add recruit
            </button>
          </div>

          <div className="px-5 md:px-6">
            <RecruitListTable
              recruits={recruits}
              isLoading={recruitsLoading}
              selectedRecruitId={selectedRecruit?.id}
              onSelectRecruit={handleSelectRecruit}
            />
          </div>
        </section>
      </div>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] md:max-w-[560px] lg:max-w-[640px] p-0 overflow-hidden"
        >
          <SheetTitle className="sr-only">Recruit Details</SheetTitle>
          <SheetDescription className="sr-only">
            View and manage recruit information, pipeline progress, and
            documents
          </SheetDescription>
          {selectedRecruit && (
            <RecruitDetailPanel
              key={selectedRecruit.id}
              recruit={selectedRecruit}
              currentUserId={user?.id}
              isUpline={true}
              onRecruitDeleted={handleRecruitDeleted}
            />
          )}
        </SheetContent>
      </Sheet>

      <AddRecruitDialog
        open={addRecruitDialogOpen}
        onOpenChange={setAddRecruitDialogOpen}
        onSuccess={(newRecruitId) => {
          const newRecruit = recruits.find((r) => r.id === newRecruitId);
          if (newRecruit) {
            setSelectedRecruit(newRecruit);
            setDetailSheetOpen(true);
          }
        }}
      />
    </div>
  );
}

export function RecruitingDashboard() {
  const { user } = useAuth();
  const isStaffRole =
    user?.roles?.some((role) =>
      STAFF_ONLY_ROLES.includes(role as (typeof STAFF_ONLY_ROLES)[number]),
    ) ?? false;

  const { hasAccess: hasCustomPipeline, isLoading: loadingCustomPipeline } =
    useFeatureAccess("recruiting_custom_pipeline");
  const { hasAccess: hasBasicRecruiting, isLoading: loadingBasicRecruiting } =
    useFeatureAccess("recruiting_basic");

  const { data: ownRecruitsData, isLoading: loadingOwnRecruits } = useRecruits(
    user?.id
      ? { my_recruits_user_id: user.id, exclude_prospects: false }
      : undefined,
    1,
    1,
    {
      enabled:
        !!user?.id &&
        !isStaffRole &&
        !loadingCustomPipeline &&
        !loadingBasicRecruiting &&
        !hasCustomPipeline &&
        !hasBasicRecruiting,
    },
  );

  if (isStaffRole) {
    return (
      <RecruitingErrorBoundary>
        <RecruitingDashboardContent />
      </RecruitingErrorBoundary>
    );
  }

  if (loadingCustomPipeline || loadingBasicRecruiting) {
    return (
      <div className="flex items-center justify-center h-64 text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground dark:text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (hasCustomPipeline) {
    return (
      <RecruitingErrorBoundary>
        <RecruitingDashboardContent />
      </RecruitingErrorBoundary>
    );
  }

  if (hasBasicRecruiting) {
    return (
      <RecruitingErrorBoundary>
        <BasicRecruitingView className="p-4" />
      </RecruitingErrorBoundary>
    );
  }

  if (loadingOwnRecruits) {
    return (
      <div className="flex items-center justify-center h-64 text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground dark:text-muted-foreground">
        Loading…
      </div>
    );
  }

  const ownRecruits = (ownRecruitsData?.data || []).filter(
    (r) => r.id !== user?.id,
  );
  if (ownRecruits.length > 0) {
    return (
      <RecruitingErrorBoundary>
        <FreeUplineRecruitingView />
      </RecruitingErrorBoundary>
    );
  }

  return (
    <FeatureGate feature="recruiting_basic" promptVariant="card">
      <div />
    </FeatureGate>
  );
}
