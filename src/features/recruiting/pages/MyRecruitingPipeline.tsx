import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useUplineProfile } from "@/hooks/hierarchy";
// eslint-disable-next-line no-restricted-imports -- direct supabase access for recruit pipeline page
import { supabase } from "@/services/base/supabase";
import {
  AlertCircle,
  Camera,
  Compass,
  ListChecks,
  Loader2,
  MessageSquare,
  User,
} from "lucide-react";
import {
  useRecruitPhaseProgress,
  useCurrentPhase,
  useChecklistProgress,
} from "../hooks/useRecruitProgress";
import { useTemplate } from "../hooks/usePipeline";
import { PhaseChecklist } from "../components/PhaseChecklist";
import { CommunicationPanel } from "../components/CommunicationPanel";
import { useRecruitDocuments } from "../hooks/useRecruitDocuments";
import { ContactsSection, DocumentsSection } from "../components/onboarding";
import {
  EditorialMasthead,
  EditorialSection,
  EditorialStat,
  EditorialStepper,
  CurrentPhaseSection,
  NextActionCard,
} from "../components/editorial";
import type { StepperItem, StepperStatus } from "../components/editorial";
import type { UserProfile } from "@/types/hierarchy.types";

interface KeyContact {
  id: string;
  role: string;
  label: string;
  profile: UserProfile | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- template phases come from raw service response
type TemplatePhase = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- checklist items come from raw service response
type TemplateItem = any;

export function MyRecruitingPipeline() {
  const { user, loading: authLoading } = useAuth();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<UserProfile | null>({
    queryKey: ["recruit-pipeline-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as UserProfile;
    },
    enabled: !authLoading && !!user?.id,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 30000,
    gcTime: 300000,
    refetchOnMount: true,
  });

  const isReady =
    !authLoading && !profileLoading && !!user?.id && !!profile?.id;

  const { data: recruitAgency } = useQuery({
    queryKey: ["recruit-agency", profile?.agency_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("id", profile!.agency_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isReady && !!profile?.agency_id,
  });

  const { data: upline } = useUplineProfile(profile?.upline_id ?? undefined, {
    enabled: isReady && !!profile?.upline_id,
  });

  const { data: keyContacts } = useQuery<KeyContact[]>({
    queryKey: ["key-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select(
          "id, first_name, last_name, email, phone, profile_photo_url, roles",
        )
        .or("roles.cs.{trainer},roles.cs.{contracting_manager}");

      if (error) throw error;
      const contacts: KeyContact[] = [];
      for (const u of data || []) {
        const roles = (u.roles as string[]) || [];
        const isTrainer = roles.includes("trainer");
        const isContracting = roles.includes("contracting_manager");
        if (!isTrainer && !isContracting) continue;
        const roleKey =
          isTrainer && isContracting
            ? "trainer_contracting"
            : isTrainer
              ? "trainer"
              : "contracting_manager";
        const label =
          isTrainer && isContracting
            ? "Trainer / Contracting"
            : isTrainer
              ? "Trainer"
              : "Contracting";
        contacts.push({
          id: `${u.id}-${roleKey}`,
          role: roleKey,
          label,
          profile: u as UserProfile,
        });
      }
      return contacts;
    },
    enabled: isReady,
  });

  const { data: phaseProgress } = useRecruitPhaseProgress(profile?.id);
  const { data: currentPhase } = useCurrentPhase(profile?.id);
  const { data: template } = useTemplate(
    profile?.pipeline_template_id ?? undefined,
  );
  const { data: documents } = useRecruitDocuments(profile?.id);

  const { data: allChecklistProgress } = useQuery({
    queryKey: ["all-checklist-progress", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("recruit_checklist_progress")
        .select("*")
        .eq("user_id", profile.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const { data: currentChecklistProgress } = useChecklistProgress(
    profile?.id,
    currentPhase?.phase_id,
  );

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const fileName = `${user.id}/avatar_${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("recruiting-assets")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("recruiting-assets")
        .getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ profile_photo_url: urlData.publicUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;
      window.location.reload();
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ---------- derived ----------

  const progressPercentage = useMemo(() => {
    if (!phaseProgress || phaseProgress.length === 0) return 0;
    const completed = phaseProgress.filter(
      (p) => p.status === "completed",
    ).length;
    return Math.round((completed / phaseProgress.length) * 100);
  }, [phaseProgress]);

  const totalPhases = phaseProgress?.length ?? 0;
  const completedPhases =
    phaseProgress?.filter((p) => p.status === "completed").length ?? 0;
  const remainingPhases = Math.max(totalPhases - completedPhases, 0);

  const currentPhaseIndex =
    phaseProgress?.findIndex((p) => p.phase_id === currentPhase?.phase_id) ?? 0;

  const currentPhaseData: TemplatePhase | undefined = template?.phases?.find(
    (p: TemplatePhase) => p.id === currentPhase?.phase_id,
  );

  const isCurrentPhaseHidden = currentPhaseData?.visible_to_recruit === false;

  const allChecklistItemsForPhase: TemplateItem[] =
    currentPhaseData?.checklist_items || [];

  const currentChecklistItems = allChecklistItemsForPhase.filter(
    (item: TemplateItem) => item.visible_to_recruit !== false,
  );

  const currentItemsCompleted =
    currentChecklistProgress?.filter((p) => p.status === "completed").length ||
    0;

  const recruitFirstName = profile?.first_name?.trim() || "";
  const recruitName =
    `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
  const agencyName = recruitAgency?.name || "your agency";

  const stepperItems: StepperItem[] = useMemo(() => {
    if (!phaseProgress) return [];
    return phaseProgress.map((p, idx) => {
      const tplPhase: TemplatePhase | undefined = template?.phases?.find(
        (tp: TemplatePhase) => tp.id === p.phase_id,
      );
      const hidden = tplPhase?.visible_to_recruit === false;
      let status: StepperStatus;
      if (hidden) status = "locked";
      else if (p.status === "completed") status = "completed";
      else if (p.status === "blocked") status = "blocked";
      else if (p.status === "in_progress") status = "in_progress";
      else status = "not_started";

      const items: TemplateItem[] = (
        (tplPhase?.checklist_items || []) as TemplateItem[]
      ).filter((it: TemplateItem) => it.visible_to_recruit !== false);
      const phaseItemProgress = (allChecklistProgress || []).filter((cp) =>
        items.some((it: TemplateItem) => it.id === cp.checklist_item_id),
      );
      const done = phaseItemProgress.filter(
        (cp) => cp.status === "completed" || cp.status === "approved",
      ).length;

      let caption: React.ReactNode = null;
      if (status === "completed") {
        caption = `All ${items.length} items complete`;
      } else if (status === "in_progress") {
        caption = `${done} of ${items.length} items complete`;
      } else if (status === "blocked") {
        caption = p.blocked_reason || "Paused by your recruiter";
      } else if (status === "locked") {
        caption = "Handled by your recruiter";
      } else if (tplPhase?.estimated_days) {
        caption = `Estimated ${tplPhase.estimated_days} day${tplPhase.estimated_days === 1 ? "" : "s"}`;
      }

      return {
        id: p.id,
        index: idx,
        name: tplPhase?.phase_name || `Phase ${idx + 1}`,
        status,
        caption,
      } satisfies StepperItem;
    });
  }, [phaseProgress, template, allChecklistProgress]);

  const nextAction = useMemo(() => {
    if (!profile) return null;
    if (!currentPhase || !template) {
      return {
        eyebrow: "Welcome",
        headline:
          "Your recruiter is setting up your pipeline. Check back here once it's ready.",
        caption:
          "If this takes more than a day, send your recruiter a quick text — they may need a nudge.",
        tone: "neutral" as const,
      };
    }
    if (isCurrentPhaseHidden) {
      return {
        eyebrow: "Waiting on admin",
        headline:
          "Your recruiter is reviewing this step. No action needed from you right now.",
        caption:
          "We'll surface the next step here as soon as it's ready. Feel free to message them below if you want a status update.",
        tone: "neutral" as const,
      };
    }
    if (currentPhase.status === "blocked") {
      return {
        eyebrow: "Phase blocked",
        headline:
          currentPhase.blocked_reason ||
          "Your recruiter blocked this phase and added a note.",
        caption:
          "Read the reason below, take any action you can, then text your recruiter to unblock.",
        tone: "warn" as const,
      };
    }
    const firstIncomplete = currentChecklistItems.find(
      (it: TemplateItem) =>
        !currentChecklistProgress?.some(
          (cp) =>
            cp.checklist_item_id === it.id &&
            (cp.status === "completed" || cp.status === "approved"),
        ),
    ) as TemplateItem | undefined;
    if (!firstIncomplete) {
      return {
        eyebrow: "Phase ready",
        headline:
          "Every required item is checked off — your recruiter will advance you to the next phase shortly.",
        caption:
          "If a few hours pass and nothing happens, drop them a message below.",
        tone: "primary" as const,
      };
    }
    return {
      eyebrow: "Do this next",
      headline: firstIncomplete.item_name as string,
      caption:
        firstIncomplete.item_description ||
        "Find this step in the checklist below to complete it.",
      tone: "primary" as const,
    };
  }, [
    profile,
    currentPhase,
    template,
    isCurrentPhaseHidden,
    currentChecklistItems,
    currentChecklistProgress,
  ]);

  // ---------- loading / error ----------

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-v2-canvas ">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-warning" />
          <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
            Loading your pipeline…
          </p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-v2-canvas ">
        <div className="bg-white dark:bg-v2-card rounded-2xl ring-1 ring-v2-ring  shadow-md dark:shadow-none p-6 max-w-sm text-center">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-3" />
          <h2 className="text-base font-bold text-v2-ink  mb-1">
            Couldn&apos;t load your profile
          </h2>
          <p className="text-[13px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Refresh the page to try again. If this keeps happening, message your
            recruiter.
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-v2-canvas ">
        <div className="bg-white dark:bg-v2-card rounded-2xl ring-1 ring-v2-ring  shadow-md dark:shadow-none p-6 max-w-sm text-center">
          <AlertCircle className="h-6 w-6 text-warning mx-auto mb-3" />
          <h2 className="text-base font-bold text-v2-ink  mb-1">
            Profile not found
          </h2>
          <p className="text-[13px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Please contact support.
          </p>
        </div>
      </div>
    );
  }

  // ---------- render ----------

  const subtitle = (
    <>
      You&apos;re{" "}
      <span className="font-mono tabular-nums font-bold text-v2-ink ">
        {progressPercentage}%
      </span>{" "}
      through your onboarding with {agencyName}.{" "}
      {currentPhase
        ? "Next up: complete the items in your current phase below."
        : "Your recruiter will activate your first phase soon."}
    </>
  );

  return (
    <div className="min-h-screen bg-v2-canvas ">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 flex flex-col gap-5 md:gap-6">
        <EditorialMasthead
          icon={Compass}
          eyebrow={`Onboarding · ${agencyName}`}
          title={
            <>
              Welcome,{" "}
              <span className="text-warning">
                {recruitFirstName || "recruit"}
              </span>
              .
            </>
          }
          subtitle={subtitle}
          rightSlot={
            <div className="flex items-end gap-6">
              <EditorialStat
                label="Complete"
                value={`${progressPercentage}%`}
                size="lg"
                tone={progressPercentage === 100 ? "success" : "brand"}
              />
              <EditorialStat
                label="Phases left"
                value={remainingPhases}
                size="md"
              />
            </div>
          }
        />

        {nextAction && (
          <NextActionCard
            eyebrow={nextAction.eyebrow}
            headline={nextAction.headline}
            caption={nextAction.caption}
            tone={nextAction.tone}
          />
        )}

        {currentPhase && template ? (
          <CurrentPhaseSection
            phaseIndex={currentPhaseIndex < 0 ? 0 : currentPhaseIndex}
            totalPhases={totalPhases}
            phaseName={
              isCurrentPhaseHidden
                ? "Waiting on your recruiter"
                : currentPhaseData?.phase_name || "Current Phase"
            }
            itemsCompleted={currentItemsCompleted}
            itemsTotal={currentChecklistItems.length}
            isHidden={isCurrentPhaseHidden}
            isBlocked={currentPhase.status === "blocked"}
            blockedReason={currentPhase.blocked_reason}
            notes={currentPhase.notes}
          >
            {!isCurrentPhaseHidden && (
              <PhaseChecklist
                userId={profile.id}
                checklistItems={currentChecklistItems}
                checklistProgress={currentChecklistProgress || []}
                isUpline={false}
                currentUserId={profile.id}
                currentPhaseId={currentPhase?.phase_id}
                viewedPhaseId={currentPhase?.phase_id}
                isAdmin={profile?.is_admin || false}
                onPhaseComplete={() => {
                  const el = document.getElementById("phase-progress-timeline");
                  if (el)
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                recruitEmail={profile.email}
                recruitName={recruitName}
                documents={documents || []}
              />
            )}
          </CurrentPhaseSection>
        ) : (
          <EditorialSection
            icon={Compass}
            iconTone="brand"
            eyebrow="No active phase"
            title="Your pipeline isn't set up yet"
            caption="Your recruiter will enroll you in a pipeline. The moment they do, your first phase appears here."
          >
            <div />
          </EditorialSection>
        )}

        <div id="phase-progress-timeline">
          <EditorialSection
            icon={ListChecks}
            iconTone="progress"
            eyebrow="Roadmap"
            title="Every step, in order"
            caption="Tap any phase to peek at what's inside. Locked phases are handled by your recruiter."
          >
            {stepperItems.length > 0 ? (
              <EditorialStepper
                items={stepperItems}
                expandedId={expandedPhase}
                onToggleExpanded={(id) =>
                  setExpandedPhase((cur) => (cur === id ? null : id))
                }
              />
            ) : (
              <p className="text-[13px] text-v2-ink-muted dark:text-v2-ink-subtle">
                No phases yet — they will appear here as soon as your recruiter
                sets up your pipeline.
              </p>
            )}
          </EditorialSection>
        </div>

        <ContactsSection
          upline={upline}
          keyContacts={keyContacts}
          recruitName={recruitName}
        />

        <DocumentsSection
          userId={profile.id}
          documents={documents}
          isUpline={false}
          currentUserId={profile.id}
        />

        <EditorialSection
          icon={MessageSquare}
          iconTone="brand"
          eyebrow="Messages"
          title="Talk to your recruiter"
          caption="Anything that doesn't fit a checklist box belongs here — questions, scheduling, voice memos."
        >
          <div className="rounded-xl ring-1 ring-v2-ring  overflow-hidden">
            <CommunicationPanel
              userId={profile.id}
              upline={upline}
              currentUserProfile={profile}
            />
          </div>
        </EditorialSection>

        <EditorialSection
          icon={User}
          iconTone="stone"
          eyebrow="Profile"
          title="Your photo"
          caption="A clear headshot helps your recruiter and trainers match a face to the name. Keep it under 5 MB."
          compact
        >
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-v2-card hover:bg-v2-ring dark:bg-v2-ring  text-white dark:text-v2-ink px-4 py-2.5 text-[13px] font-semibold transition-colors">
            {uploadingPhoto ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {uploadingPhoto ? "Uploading…" : "Upload a photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
            />
          </label>
        </EditorialSection>
      </div>
    </div>
  );
}
