import { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  Mail,
  Download,
  Settings2,
  Link2,
  Copy,
  Check,
  ArrowRight,
  Users,
} from "lucide-react";
import {
  useRecruits,
  usePendingInvitations,
  useLeads,
  useAcceptLead,
  useRejectLead,
} from "./hooks";
import { useActiveTemplate, usePhases } from "./hooks/usePipeline";
import {
  RecruitListTable,
  type RecruitingRow,
} from "./components/RecruitListTable";
import type { EnrichedLead } from "@/types/leads.types";
import { AddRecruitDialog } from "./components/AddRecruitDialog";
import { PostAddRecruitWizard } from "./components/PostAddRecruitWizard";
import { SendInviteDialog } from "./components/SendInviteDialog";
import { RecruitingErrorBoundary } from "./components/RecruitingErrorBoundary";
import type { UserProfile } from "@/types/hierarchy.types";
import { useAuth } from "@/contexts/AuthContext";
import { STAFF_ONLY_ROLES } from "@/constants/roles";
import type { RecruitFilters } from "@/types/recruiting.types";
import { toast } from "sonner";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { downloadCSV } from "@/utils/exportHelpers";
import { normalizePhaseNameToStatus } from "@/lib/pipeline";
import { useFeatureAccess } from "@/hooks/subscription";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { BasicRecruitingView } from "./components/BasicRecruitingView";
import { PillButton, PillNav, SoftCard } from "@/components/v2";
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
  const { data: pendingLeadsResponse } = useLeads(
    { status: ["pending"] },
    1,
    50,
  );
  const pendingLeads = useMemo(
    () => pendingLeadsResponse?.leads ?? [],
    [pendingLeadsResponse],
  );
  const acceptLeadMutation = useAcceptLead();
  const rejectLeadMutation = useRejectLead();
  const { data: activeTemplate } = useActiveTemplate();
  const { data: pipelinePhases = [] } = usePhases(activeTemplate?.id);

  const [addRecruitDialogOpen, setAddRecruitDialogOpen] = useState(false);
  const [sendInviteDialogOpen, setSendInviteDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [wizardState, setWizardState] = useState<{
    recruitId: string;
    recruitName: string;
    isLicensed: boolean;
    skippedPipeline: boolean;
  } | null>(null);

  const navigate = useNavigate();
  const { recruitId: deepLinkRecruitId } = useSearch({ from: "/recruiting" });

  // Legacy deep-link: `/recruiting?recruitId=...` now redirects to the
  // full-page detail at `/recruiting/$recruitId`.
  useEffect(() => {
    if (deepLinkRecruitId) {
      navigate({
        to: "/recruiting/$recruitId",
        params: { recruitId: deepLinkRecruitId },
      });
    }
  }, [deepLinkRecruitId, navigate]);

  const recruiterSlug = user?.recruiter_slug ?? null;

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

  const filteredRecruits = useMemo(() => {
    if (!statusFilter) return recruits;
    return recruits.filter((r) => r.onboarding_status === statusFilter);
  }, [recruits, statusFilter]);

  const filterItems = useMemo(
    () => [
      { label: `All ${stats.total}`, value: "" },
      { label: `Invited ${stats.invited}`, value: "invited" },
      { label: `Blocked ${stats.blocked}`, value: "blocked" },
    ],
    [stats.total, stats.invited, stats.blocked],
  );

  const handleSelectRecruit = (recruit: UserProfile) => {
    navigate({
      to: "/recruiting/$recruitId",
      params: { recruitId: recruit.id },
    });
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

  const handleSelectLead = (lead: EnrichedLead) => {
    navigate({
      to: "/recruiting/lead/$leadId",
      params: { leadId: lead.id },
    });
  };

  const handleAcceptLead = async (lead: EnrichedLead) => {
    await acceptLeadMutation.mutateAsync({ leadId: lead.id });
  };

  const handleRejectLead = async (lead: EnrichedLead, reason?: string) => {
    await rejectLeadMutation.mutateAsync({ leadId: lead.id, reason });
  };

  const rows = useMemo<RecruitingRow[]>(() => {
    const leadRows: RecruitingRow[] = pendingLeads.map((lead) => ({
      kind: "lead" as const,
      lead,
    }));
    const recruitRows: RecruitingRow[] = filteredRecruits.map((recruit) => ({
      kind: "recruit" as const,
      recruit,
    }));
    return [...leadRows, ...recruitRows];
  }, [pendingLeads, filteredRecruits]);

  const recruitingLinkUrl = recruiterSlug
    ? `www.thestandardhq.com/join-${recruiterSlug}`
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Compact header — title + inline summary + action buttons */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Users className="h-4 w-4 text-v2-ink" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              Recruiting
            </h1>
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
            <span>
              <span className="text-v2-ink font-semibold tabular-nums">
                {stats.active}
              </span>{" "}
              active
            </span>
            <span className="text-v2-ink-muted">·</span>
            <span>
              <span className="font-mono font-semibold text-warning tabular-nums">
                {stats.invited}
              </span>{" "}
              invited
            </span>
            {stats.blocked > 0 && (
              <>
                <span className="text-v2-ink-muted">·</span>
                <span>
                  <span className="font-mono font-semibold text-destructive tabular-nums">
                    {stats.blocked}
                  </span>{" "}
                  blocked
                </span>
              </>
            )}
            <span className="text-v2-ink-muted">·</span>
            <span>
              <span className="font-mono font-semibold text-emerald-600 tabular-nums">
                {stats.completed}
              </span>{" "}
              complete
            </span>
            {stats.dropped > 0 && (
              <>
                <span className="text-v2-ink-muted">·</span>
                <span>
                  <span className="font-mono font-semibold tabular-nums">
                    {stats.dropped}
                  </span>{" "}
                  dropped
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <PillButton
            tone="ghost"
            size="sm"
            onClick={handleExportCSV}
            leadingIcon={<Download className="h-3.5 w-3.5" />}
          >
            Export
          </PillButton>
          <PillButton
            tone="ghost"
            size="sm"
            onClick={() => setSendInviteDialogOpen(true)}
            leadingIcon={<Mail className="h-3.5 w-3.5" />}
          >
            Send invite
          </PillButton>
          <Link to="/recruiting/admin/pipelines">
            <PillButton
              tone="ghost"
              size="sm"
              leadingIcon={<Settings2 className="h-3.5 w-3.5" />}
            >
              Pipelines
            </PillButton>
          </Link>
          <PillButton
            tone="black"
            size="sm"
            onClick={() => setAddRecruitDialogOpen(true)}
            leadingIcon={<UserPlus className="h-3.5 w-3.5" />}
          >
            Add recruit
          </PillButton>
        </div>
      </header>

      {/* Filter row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PillNav
          size="sm"
          activeValue={statusFilter}
          onChange={setStatusFilter}
          items={filterItems}
        />
        <label className="inline-flex items-center gap-1.5 text-[11px] text-v2-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={hideProspects}
            onChange={(e) => setHideProspects(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-v2-ring"
          />
          Hide prospects (unenrolled recruits)
        </label>
      </div>

      {/* Heads-up banner when Hide Prospects is on — explains why a freshly
          added recruit might not appear in the list yet. */}
      {hideProspects && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-warning/30 bg-warning/5 text-[11px] text-v2-ink">
          <span>
            <strong>Hide prospects is on</strong> — recruits not yet enrolled in
            a pipeline are hidden. If a recruit you just added doesn&apos;t show
            up here, enroll them in a pipeline from their profile, or click to
            show all.
          </span>
          <button
            type="button"
            onClick={() => setHideProspects(false)}
            className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-warning/40 text-warning hover:bg-warning/10 text-[10px] uppercase tracking-[0.16em] font-semibold"
          >
            Show all
          </button>
        </div>
      )}

      {/* Recruiting link strip — only for non-staff with custom branding */}
      {!isStaffRole && hasCustomBranding && (
        <SoftCard
          variant="tinted"
          padding="sm"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          {recruitingLinkUrl ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-v2-ink-muted">
                  Your link
                </span>
                <span className="text-[12px] font-mono text-v2-ink truncate">
                  {recruitingLinkUrl}
                </span>
              </div>
              <PillButton
                tone="yellow"
                size="sm"
                onClick={handleCopyLink}
                leadingIcon={
                  linkCopied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {linkCopied ? "Copied" : "Copy link"}
              </PillButton>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                <span className="text-[12px] text-v2-ink-muted">
                  Set up your personal recruiting link to share on social media.
                </span>
              </div>
              <Link to="/settings">
                <PillButton
                  tone="yellow"
                  size="sm"
                  trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Set up link
                </PillButton>
              </Link>
            </>
          )}
        </SoftCard>
      )}

      {/* Table */}
      <SoftCard padding="none" className="overflow-hidden">
        <RecruitListTable
          rows={rows}
          isLoading={recruitsLoading}
          onSelectRecruit={handleSelectRecruit}
          onSelectLead={handleSelectLead}
          onAcceptLead={handleAcceptLead}
          onRejectLead={handleRejectLead}
          isAcceptingLead={acceptLeadMutation.isPending}
          isRejectingLead={rejectLeadMutation.isPending}
        />

        {rows.length === 0 && !recruitsLoading && (
          <div className="px-5 py-8 text-center">
            <p className="text-[12px] text-v2-ink-muted mb-3">
              {statusFilter
                ? `No recruits match the "${statusFilter}" filter.`
                : "No recruits yet — send an invite or add one to start your pipeline."}
            </p>
            {!statusFilter && (
              <PillButton
                tone="black"
                size="sm"
                onClick={() => setSendInviteDialogOpen(true)}
                leadingIcon={<Mail className="h-3.5 w-3.5" />}
              >
                Send your first invite
              </PillButton>
            )}
          </div>
        )}
      </SoftCard>

      <AddRecruitDialog
        open={addRecruitDialogOpen}
        onOpenChange={setAddRecruitDialogOpen}
        onSuccess={(newRecruitId, meta) => {
          setWizardState({
            recruitId: newRecruitId,
            recruitName: meta.fullName,
            isLicensed: meta.isLicensed,
            skippedPipeline: meta.skippedPipeline,
          });
        }}
      />

      <PostAddRecruitWizard
        open={!!wizardState}
        onOpenChange={(o) => {
          if (!o) setWizardState(null);
        }}
        recruitId={wizardState?.recruitId ?? null}
        recruitName={wizardState?.recruitName ?? ""}
        isLicensed={wizardState?.isLicensed ?? false}
        skippedPipeline={wizardState?.skippedPipeline ?? false}
        onComplete={() => {
          const id = wizardState?.recruitId;
          setWizardState(null);
          if (id) {
            navigate({
              to: "/recruiting/$recruitId",
              params: { recruitId: id },
            });
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

  const [addRecruitDialogOpen, setAddRecruitDialogOpen] = useState(false);

  const navigate = useNavigate();
  const { recruitId: deepLinkRecruitId } = useSearch({ from: "/recruiting" });

  const recruits = ((recruitsData?.data || []) as UserProfile[]).filter(
    (recruit) => recruit.id !== user?.id,
  );

  const recruitRows = useMemo<RecruitingRow[]>(
    () => recruits.map((recruit) => ({ kind: "recruit" as const, recruit })),
    [recruits],
  );

  // Legacy deep-link: `/recruiting?recruitId=...` now redirects to the
  // full-page detail at `/recruiting/$recruitId`.
  useEffect(() => {
    if (deepLinkRecruitId) {
      navigate({
        to: "/recruiting/$recruitId",
        params: { recruitId: deepLinkRecruitId },
      });
    }
  }, [deepLinkRecruitId, navigate]);

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
    navigate({
      to: "/recruiting/$recruitId",
      params: { recruitId: recruit.id },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Users className="h-4 w-4 text-v2-ink" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              Your team
            </h1>
            <span className="rounded-full bg-v2-card-tinted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-v2-ink-muted">
              Free
            </span>
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
            <span>
              <span className="text-v2-ink font-semibold tabular-nums">
                {stats.active}
              </span>{" "}
              active
            </span>
            <span className="text-v2-ink-muted">·</span>
            <span>
              <span className="font-mono font-semibold text-emerald-600 tabular-nums">
                {stats.completed}
              </span>{" "}
              complete
            </span>
            {stats.dropped > 0 && (
              <>
                <span className="text-v2-ink-muted">·</span>
                <span>
                  <span className="font-mono font-semibold tabular-nums">
                    {stats.dropped}
                  </span>{" "}
                  dropped
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link to="/billing">
            <PillButton
              tone="ghost"
              size="sm"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Upgrade for full pipeline
            </PillButton>
          </Link>
          <PillButton
            tone="black"
            size="sm"
            onClick={() => setAddRecruitDialogOpen(true)}
            leadingIcon={<UserPlus className="h-3.5 w-3.5" />}
          >
            Add recruit
          </PillButton>
        </div>
      </header>

      <p className={cn("text-[11px] text-v2-ink-muted")}>
        You can keep managing your existing recruits on the free plan.{" "}
        <Link
          to="/billing"
          className="font-semibold text-warning hover:underline underline-offset-2"
        >
          Upgrade
        </Link>{" "}
        to unlock the full pipeline configuration and add more.
      </p>

      <SoftCard padding="none" className="overflow-hidden">
        <RecruitListTable
          rows={recruitRows}
          isLoading={recruitsLoading}
          onSelectRecruit={handleSelectRecruit}
        />
      </SoftCard>

      <AddRecruitDialog
        open={addRecruitDialogOpen}
        onOpenChange={setAddRecruitDialogOpen}
        onSuccess={(newRecruitId) => {
          navigate({
            to: "/recruiting/$recruitId",
            params: { recruitId: newRecruitId },
          });
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
      <div className="flex items-center justify-center h-64 text-[11px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted">
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
        <BasicRecruitingView />
      </RecruitingErrorBoundary>
    );
  }

  if (loadingOwnRecruits) {
    return (
      <div className="flex items-center justify-center h-64 text-[11px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted">
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
