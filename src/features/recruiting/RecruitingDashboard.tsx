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
  const [statusFilter, setStatusFilter] = useState<string>("");

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
          {!isStaffRole && (
            <Link to="/recruiting/leads">
              <PillButton
                tone="ghost"
                size="sm"
                leadingIcon={<Inbox className="h-3.5 w-3.5" />}
              >
                Leads
                {pendingLeadsCount && pendingLeadsCount > 0 ? (
                  <span className="ml-1 font-mono tabular-nums text-warning">
                    {pendingLeadsCount}
                  </span>
                ) : null}
              </PillButton>
            </Link>
          )}
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
          Hide prospects
        </label>
      </div>

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
          recruits={filteredRecruits}
          isLoading={recruitsLoading}
          selectedRecruitId={selectedRecruit?.id}
          onSelectRecruit={handleSelectRecruit}
        />

        {filteredRecruits.length === 0 && !recruitsLoading && (
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
          recruits={recruits}
          isLoading={recruitsLoading}
          selectedRecruitId={selectedRecruit?.id}
          onSelectRecruit={handleSelectRecruit}
        />
      </SoftCard>

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
