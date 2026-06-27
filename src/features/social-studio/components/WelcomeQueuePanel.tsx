// src/features/social-studio/components/WelcomeQueuePanel.tsx
// "Welcome posts to review" approval queue for the Social Studio owner page. Lists
// auto-generated welcome-post drafts (one per new agent who uploaded a photo) and lets
// the owner Deny, Post now, or Schedule each. Each row owns its own CardExportHost ref
// to avoid shared-export timing bugs across concurrent drafts.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FORMAT_DIMS,
  cardThemeWrapperClass,
  toLastInitial,
  type CardTheme,
  type WelcomeVariant,
} from "@/features/social-cards";
import { SocialCardSwitch, type PreviewData } from "./SocialPreview";
import { CardExportHost, type CardExportHandle } from "./CardExportHost";
import {
  useAgentWelcomePosts,
  useDenyWelcomePost,
  useMarkWelcomeApproved,
  type WelcomeDraft,
} from "../hooks/useAgentWelcomePosts";
import { useSpotlightActions } from "../hooks/useSpotlightActions";
import { useSchedulePost } from "@/hooks/instagram";
import { toLocalInputValue } from "../datetimeLocal";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface WelcomeQueuePanelProps {
  agencyName: string;
  network?: string;
  cardTheme: CardTheme;
  /** Which welcome design the drafts render with (the owner can switch it here). */
  welcomeVariant: WelcomeVariant;
  onWelcomeVariantChange: (v: WelcomeVariant) => void;
  igConnected: boolean;
  selectedIntegration?: { id: string; instagram_username?: string | null };
  postsImoId: string | null;
}

// The welcome designs the owner can pick between (label = plain English).
const WELCOME_VARIANTS: { v: WelcomeVariant; label: string }[] = [
  { v: "celebration", label: "Celebration" },
  { v: "badge", label: "New-Agent Badge" },
  { v: "marquee", label: "Big Welcome" },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const FORMAT = "portrait" as const;
/** Target height of the in-row thumbnail (px). */
const THUMB_H = 180;
/** Minimum lead time before a scheduled post (ms). */
const MIN_LEAD_MS = 2 * 60 * 1000;
/** Default lead time pre-filled when the scheduler opens (ms). */
const DEFAULT_LEAD_MS = 10 * 60 * 1000;

// ── Sub-component: single draft row ───────────────────────────────────────────

interface WelcomeDraftRowProps {
  draft: WelcomeDraft;
  agencyName: string;
  network?: string;
  cardTheme: CardTheme;
  welcomeVariant: WelcomeVariant;
  igConnected: boolean;
  selectedIntegration?: { id: string; instagram_username?: string | null };
  postsImoId: string | null;
}

function WelcomeDraftRow({
  draft,
  agencyName,
  network,
  cardTheme,
  welcomeVariant,
  igConnected,
  selectedIntegration,
  postsImoId,
}: WelcomeDraftRowProps) {
  const { fetchImageAsDataUrl, uploadGeneratedPost, publishToInstagram } =
    useSpotlightActions();

  const exportRef = useRef<CardExportHandle>(null);
  // Re-entrancy guard: prevents concurrent post/schedule operations for the same row.
  const busyRef = useRef(false);

  const denyMut = useDenyWelcomePost();
  const markApprovedMut = useMarkWelcomeApproved();
  const schedulePost = useSchedulePost(postsImoId ?? undefined);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");

  // ── Fetch the agent photo as a data URL so the export embeds it ──────────────
  useEffect(() => {
    let cancelled = false;
    setPhotoLoading(true);
    fetchImageAsDataUrl(draft.photoUrl)
      .then((url) => {
        if (!cancelled) setPhotoDataUrl(url);
      })
      .catch((e) => {
        console.error("[WelcomeQueuePanel] fetchImageAsDataUrl failed:", e);
        // Still allow actions — the card will render without the photo.
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.photoUrl, fetchImageAsDataUrl]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const firstName = draft.agentName.split(/\s+/)[0] ?? draft.agentName;
  const caption = `Welcome to the team, ${firstName}! 🎉 We're excited to have you. #newagent #welcome`;

  const previewData: PreviewData = {
    kind: "newagent",
    agent: {
      name: toLastInitial(draft.agentName),
      photoUrl: photoDataUrl ?? null,
    },
    variant: welcomeVariant,
    theme: cardTheme,
  };

  const { w: naturalW, h: naturalH } = FORMAT_DIMS[FORMAT];
  const thumbScale = THUMB_H / naturalH;
  const thumbW = Math.round(naturalW * thumbScale);

  // ── Guards ────────────────────────────────────────────────────────────────────
  function guard(v: boolean) {
    busyRef.current = v;
    setBusy(v);
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleDeny = useCallback(() => {
    if (busyRef.current) return;
    denyMut.mutate(draft.id);
  }, [draft.id, denyMut]);

  const handlePostNow = useCallback(async () => {
    if (busyRef.current) return;
    guard(true);
    try {
      const png = await exportRef.current?.exportOne(0);
      if (!png) throw new Error("Card export produced no PNG.");
      const publicUrl = await uploadGeneratedPost(png);
      await publishToInstagram([publicUrl], caption, {
        mediaType: "FEED",
        integrationId: selectedIntegration?.id,
      });
      await markApprovedMut.mutateAsync(draft.id);
      toast.success(`Welcome post for ${firstName} published!`);
    } catch (e) {
      console.error("[WelcomeQueuePanel] Post now failed:", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't publish the post.",
      );
    } finally {
      guard(false);
    }
  }, [
    caption,
    draft.id,
    firstName,
    markApprovedMut,
    publishToInstagram,
    selectedIntegration?.id,
    uploadGeneratedPost,
  ]);

  const handleSchedule = useCallback(async () => {
    if (busyRef.current) return;
    if (!scheduleValue) {
      toast.error("Please pick a date and time.");
      return;
    }
    const scheduledFor = new Date(scheduleValue);
    if (scheduledFor.getTime() - Date.now() < MIN_LEAD_MS) {
      toast.error("Please pick a time at least 2 minutes in the future.");
      return;
    }
    guard(true);
    try {
      const png = await exportRef.current?.exportOne(0);
      if (!png) throw new Error("Card export produced no PNG.");
      await schedulePost.mutateAsync({
        postId: crypto.randomUUID(),
        integrationId: selectedIntegration?.id ?? null,
        dataUrl: png,
        caption,
        view: "newagent",
        cardTheme: cardTheme,
        scheduledFor,
      });
      await markApprovedMut.mutateAsync(draft.id);
      toast.success(`Welcome post for ${firstName} scheduled.`);
      setShowScheduler(false);
    } catch (e) {
      console.error("[WelcomeQueuePanel] Schedule failed:", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't schedule the post.",
      );
    } finally {
      guard(false);
    }
  }, [
    caption,
    cardTheme,
    draft.id,
    firstName,
    markApprovedMut,
    schedulePost,
    scheduleValue,
    selectedIntegration?.id,
  ]);

  const igDisabled = !igConnected;
  const igTitle = igDisabled ? "Connect Instagram to post" : undefined;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3">
      {/* Scaled thumbnail */}
      <div
        className={`relative flex-none overflow-hidden rounded-md ${cardThemeWrapperClass(cardTheme)}`}
        style={{ width: thumbW, height: THUMB_H }}
      >
        {photoLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="sr-only">Preparing…</span>
          </div>
        )}
        <div
          style={{
            transform: `scale(${thumbScale})`,
            transformOrigin: "top left",
            width: naturalW,
          }}
        >
          <SocialCardSwitch
            data={previewData}
            format={FORMAT}
            agencyName={agencyName}
            network={network}
            showPolicies={false}
          />
        </div>
      </div>

      {/* Agent info + action buttons */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="truncate text-xs font-semibold text-foreground">
          {draft.agentName}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {/* Deny */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            disabled={busy || denyMut.isPending}
            onClick={handleDeny}
            title="Dismiss — skip the welcome post for this agent"
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Deny
          </Button>

          {/* Post now */}
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs"
            disabled={busy || igDisabled}
            title={igTitle}
            onClick={() => void handlePostNow()}
          >
            {busy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            )}
            Post now
          </Button>

          {/* Schedule toggle */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={busy || igDisabled}
            title={igTitle}
            onClick={() => {
              setScheduleValue(
                toLocalInputValue(new Date(Date.now() + DEFAULT_LEAD_MS)),
              );
              setShowScheduler((v) => !v);
            }}
          >
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
            Schedule
          </Button>
        </div>

        {/* Inline scheduler */}
        {showScheduler && (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="datetime-local"
              value={scheduleValue}
              min={toLocalInputValue(new Date(Date.now() + MIN_LEAD_MS))}
              onChange={(e) => setScheduleValue(e.target.value)}
              className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2 text-xs"
              disabled={busy || !scheduleValue}
              onClick={() => void handleSchedule()}
            >
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
          </div>
        )}
      </div>

      {/* Off-screen full-size render host for PNG export */}
      <CardExportHost
        ref={exportRef}
        pages={[previewData]}
        format={FORMAT}
        agencyName={agencyName}
        network={network}
        showPolicies={false}
      />
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function WelcomeQueuePanel({
  agencyName,
  network,
  cardTheme,
  welcomeVariant,
  onWelcomeVariantChange,
  igConnected,
  selectedIntegration,
  postsImoId,
}: WelcomeQueuePanelProps) {
  const { data: drafts, isLoading } = useAgentWelcomePosts();

  // Render nothing while loading or when there's nothing to review.
  if (isLoading || !drafts || drafts.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Welcome posts to review ({drafts.length})
        </h3>
        {/* Design picker — change the welcome template for every draft below. */}
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-[11px]">
          {WELCOME_VARIANTS.map((w) => (
            <button
              key={w.v}
              type="button"
              onClick={() => onWelcomeVariantChange(w.v)}
              className={`rounded-md px-2 py-1 font-medium transition-colors ${
                welcomeVariant === w.v
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {drafts.map((draft) => (
          <WelcomeDraftRow
            key={draft.id}
            draft={draft}
            agencyName={agencyName}
            network={network}
            cardTheme={cardTheme}
            welcomeVariant={welcomeVariant}
            igConnected={igConnected}
            selectedIntegration={selectedIntegration}
            postsImoId={postsImoId}
          />
        ))}
      </div>
    </div>
  );
}
