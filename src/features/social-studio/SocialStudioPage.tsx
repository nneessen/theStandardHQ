// src/features/social-studio/SocialStudioPage.tsx
// Social Studio — owner-only. Live, agency-scoped preview of the leaderboard /
// report / AOTW social cards (with a labeled sample fallback when the agency has no
// metrics yet), full customization, client-side PNG download, one-tap "Post to
// Instagram", and scheduled auto-posting to the connected account (cron worker).

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Send,
  Loader2,
  Sparkles,
  Lock,
  CalendarClock,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SectionShell, PillNav } from "@/components/v2";
import { Board, Cap } from "@/components/board";
import { Button } from "@/components/ui/button";
import { useImo } from "@/contexts/ImoContext";
import { useAgencyAgentLeaderboard } from "@/hooks/leaderboard";
import { useAiAccess } from "@/hooks/subscription";
import { useInstagramIntegrations, useSchedulePost } from "@/hooks/instagram";
import type { LeaderboardFilters } from "@/types/leaderboard.types";
import { useSpotlightActions } from "./hooks/useSpotlightActions";
import { SocialPreview } from "./components/SocialPreview";
import {
  CardExportHost,
  type CardExportHandle,
} from "./components/CardExportHost";
import { PostConfirmDialog } from "./components/PostConfirmDialog";
import { SocialCustomizer } from "./components/SocialCustomizer";
import { QuickPostsPanel } from "./components/QuickPostsPanel";
import { SocialLibrary } from "./components/SocialLibrary";
import { ScheduledPostsPanel } from "./components/ScheduledPostsPanel";
import {
  DEFAULT_CONFIG,
  VIEW_META,
  resolveTemplateTheme,
  type SocialStudioConfig,
} from "./types";
import {
  resolveSampleState,
  buildPeriodLabels,
  buildPreviewPages,
} from "./previewModel";

// Formats the spotlight-assets bucket accepts AND a browser <img> can render. iPhone
// HEIC is excluded on both counts (the bucket rejects it; most browsers can't display it).
const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function SocialStudioPage() {
  const { agency, imo, loading: tenantLoading } = useImo();
  const agencyId = agency?.id ?? null;
  const imoId = imo?.id ?? null;
  const agencyName = (agency?.name ?? "Your Agency").toUpperCase();
  const network = imo?.name ? imo.name.toUpperCase() : undefined;
  // The page is super-admin-only; a super-admin whose profile resolves no agency /
  // network (or a transient ImoContext fetch failure) would otherwise silently get a
  // sample-only, save-disabled page. Surface it once the context has finished loading.
  const tenantMissing = !tenantLoading && (!agencyId || !imoId);

  const [config, setConfig] = useState<SocialStudioConfig>(DEFAULT_CONFIG);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [posting, setPosting] = useState(false);
  // "Confirm before you post" dialog (WI-5) — Post Now opens it; doPost runs on confirm.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Synchronous re-entrancy guard: a fast double-click can fire two handlers before
  // the `posting` state flushes to disable the button → two publishes / a racing
  // overwrite of the upload. The ref blocks the second call immediately.
  const postingRef = useRef(false);
  // Scheduling UI: the inline date/time picker + a matching re-entrancy guard.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const schedulingRef = useRef(false);
  const exportHostRef = useRef<CardExportHandle>(null);
  const { hasAiAccess } = useAiAccess();
  const {
    uploadAgentPhoto,
    removeAgentPhoto,
    readFileAsDataUrl,
    generateCaption,
    uploadGeneratedPost,
    publishToInstagram,
  } = useSpotlightActions();
  // The agency's connected Instagram account (Business/Creator) gates posting +
  // scheduling, and supplies the integration id we attach to a scheduled row.
  const { data: igIntegrations } = useInstagramIntegrations();
  const connectedIntegration = igIntegrations?.find(
    (i) => i.connection_status === "connected" && i.is_active,
  );
  const igConnected = !!connectedIntegration;
  // Scheduled posts belong to the agency that owns the connected account; the schedule
  // RPC derives imo_id from the caller's profile, which is the same imo the integration
  // is fetched under — so key the list + invalidation off it (not the acting imo).
  const postsImoId = connectedIntegration?.imo_id ?? imoId ?? null;
  const schedulePostMut = useSchedulePost(postsImoId ?? undefined);
  const patch = (p: Partial<SocialStudioConfig>) =>
    setConfig((c) => ({ ...c, ...p }));

  const period = VIEW_META[config.view].period;
  const filters: LeaderboardFilters = { timePeriod: period, scope: "all" };
  const { data, isLoading } = useAgencyAgentLeaderboard({ filters, agencyId });
  // The RPC returns EVERY approved agent (policies LEFT-JOINed, COALESCEd to $0),
  // so filter to actual producers before ranking, counting, or deciding whether
  // to show the sample fallback. Without this, a brand-new agency with agents but
  // no policies would render real $0 rows instead of the sample, and Top-N cards
  // would pad with $0 producers.
  const producers = useMemo(
    () => (data?.entries ?? []).filter((e) => e.apTotal > 0),
    [data?.entries],
  );
  const hasLive = producers.length > 0;

  // The "Preview with sample data" toggle: null = let the auto heuristic decide.
  const [sampleOverride, setSampleOverride] = useState<boolean | null>(null);
  // Sample vs. live is a pure decision (see resolveSampleState): when there are zero
  // real producers, sample is FORCED for EVERY view — so `!isSample` implies live
  // producers exist (no zero-producer crash) and the download/caption guards can
  // never let an empty real card through.
  const { isSample, sampleForced } = resolveSampleState({
    view: config.view,
    producersCount: producers.length,
    isLoading,
    sampleOverride,
  });

  // Period labels mirror the queried window's date math (timezone-consistent), so
  // the printed stamp can't disagree with the data. Computed once per mount.
  const labels = useMemo(() => buildPeriodLabels(), []);

  // The carousel of slides for the current config. One card always; more when the
  // selected roster (Top-N / "all") spills past a page at the current format.
  const previewPages = useMemo(
    () => buildPreviewPages({ config, producers, isSample, labels }),
    [config, producers, isSample, labels],
  );
  // Lead slide drives the caption context; the shown slide drives the on-screen preview.
  const previewData = previewPages[0];
  const pageCount = previewPages.length;
  const [pageIndex, setPageIndex] = useState(0);
  const shownIndex = Math.min(pageIndex, pageCount - 1);
  const shownPage = previewPages[shownIndex];

  async function handleUploadPhoto(file: File) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      toast.error(
        "Please use a JPEG, PNG, WEBP, or GIF (iPhone HEIC photos aren't supported — convert to JPG first).",
      );
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is over the 10MB limit — pick a smaller one.");
      return;
    }
    setUploadingPhoto(true);
    try {
      // Upload + data-URL read happen in the service (storage access stays out of
      // the UI); both land in config only on full success.
      const { dataUrl, storageUrl } = await uploadAgentPhoto(file);
      // A new face starts centered — don't inherit the prior photo's focal point.
      patch({
        aowPhotoUrl: dataUrl,
        aowPhotoStorageUrl: storageUrl,
        aowPhotoPosition: "50% 50%",
      });
      toast.success("Photo added");
    } catch (e) {
      console.error("Spotlight photo upload failed:", e);
      toast.error("Couldn't upload the photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    // Actually delete the object — "Remove" must not leave a face world-readable in
    // the public bucket. Best-effort: clear the UI even if the delete fails.
    try {
      await removeAgentPhoto();
    } catch (e) {
      console.error("Spotlight photo delete failed:", e);
    } finally {
      patch({
        aowPhotoUrl: null,
        aowPhotoStorageUrl: null,
        aowPhotoPosition: "50% 50%",
      });
    }
  }

  // Background image is BAKED into the exported PNG, so (unlike the agent photo,
  // which is also kept for later IG posting) it never needs a public Storage URL —
  // a client-side data URL is sufficient and avoids a second orphan-prone object.
  async function handleUploadBgImage(file: File) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      toast.error(
        "Please use a JPEG, PNG, WEBP, or GIF (iPhone HEIC photos aren't supported — convert to JPG first).",
      );
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is over the 10MB limit — pick a smaller one.");
      return;
    }
    setUploadingBg(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      // Image wins over a solid/gradient preset — clear the preset so they don't fight.
      patch({ aowBgImageUrl: dataUrl, aowBackground: null });
      toast.success("Background image added");
    } catch (e) {
      console.error("Spotlight background upload failed:", e);
      toast.error("Couldn't load that image. Please try again.");
    } finally {
      setUploadingBg(false);
    }
  }

  // Download every slide of the carousel (one PNG per page). A single-card post is
  // just one file.
  async function handleDownload() {
    if (isSample) {
      toast.error(
        "This is a sample preview — switch off 'Preview with sample data' (once you have real production) to download a real post.",
      );
      return;
    }
    // Capture the base name BEFORE the awaits — the user could switch view/format during
    // font-load + rasterization, which would otherwise mis-name the files.
    const base = `${agencyName.toLowerCase().replace(/\s+/g, "-")}-${config.view}-${config.format}`;
    try {
      const urls = await exportHostRef.current?.exportAll();
      if (!urls || urls.length === 0) return;
      const multi = urls.length > 1;
      for (let i = 0; i < urls.length; i++) {
        const a = document.createElement("a");
        a.download = multi ? `${base}-slide-${i + 1}.png` : `${base}.png`;
        a.href = urls[i];
        a.click();
        // Browsers throttle rapid programmatic downloads — a small gap so each lands.
        if (multi && i < urls.length - 1)
          await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(
        multi ? `Downloaded ${urls.length} slides` : "Image downloaded",
      );
    } catch (e) {
      console.error("Social card download failed:", e);
      toast.error("Couldn't generate the image. Please try again.");
    }
  }

  // Rasterize the CURRENTLY-PREVIEWED slide (Post Now / Schedule). The off-screen
  // CardExportHost mounts every slide at full 1080×H via the shared renderCardToPng
  // exporter (explicit FORMAT_DIMS pin + un-transformed node = no WI-1 crop);
  // exportOne captures the shown one. (Carousel multi-slide posting lands in Phase B.)
  async function renderCardPng(): Promise<string | null> {
    return (await exportHostRef.current?.exportOne(shownIndex)) ?? null;
  }

  // "Post to Instagram" now opens a confirm-before-post dialog (after the sample /
  // connection guards) so the user previews the graphic in Instagram chrome and
  // confirms. The actual publish runs in doPost() on confirm.
  function handlePostNow() {
    if (isSample) {
      toast.error(
        "Switch off 'Preview with sample data' to post your real numbers.",
      );
      return;
    }
    if (!igConnected) {
      toast.error(
        "Connect a Business Instagram account in Settings → Integrations first.",
      );
      return;
    }
    setConfirmOpen(true);
  }

  // Publish to the agency's connected Instagram account: render → upload to the public
  // bucket → instagram-publish-post edge fn. (Multi-slide carousel + Story-endpoint
  // routing land in Phase B; for now this posts the previewed slide.)
  async function doPost() {
    if (postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    try {
      const dataUrl = await renderCardPng();
      if (!dataUrl) throw new Error("The card isn't ready yet.");
      const imageUrl = await uploadGeneratedPost(dataUrl);
      const { username } = await publishToInstagram(imageUrl, config.caption);
      toast.success(
        username ? `Posted to @${username}` : "Posted to Instagram",
      );
      setConfirmOpen(false);
    } catch (e) {
      console.error("Instagram post failed:", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't post to Instagram.",
      );
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  // Format a Date as a datetime-local input value in LOCAL time (no tz suffix).
  function toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openSchedule() {
    // Default the picker to an hour out so the prefilled value is always future-valid.
    setScheduleAt(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    setScheduleOpen((o) => !o);
  }

  // Render the current card and queue it to publish at the chosen future time. The
  // image is uploaded under the post's own key (survives until the cron fires it),
  // then a queue row is created via the SECURITY DEFINER RPC (future-only enforced).
  async function handleSchedule() {
    if (isSample) {
      toast.error(
        "Switch off 'Preview with sample data' to schedule your real numbers.",
      );
      return;
    }
    if (!igConnected) {
      toast.error(
        "Connect a Business Instagram account in Settings → Integrations first.",
      );
      return;
    }
    const when = scheduleAt ? new Date(scheduleAt) : null;
    if (!when || isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error("Pick a future date and time.");
      return;
    }
    if (schedulingRef.current) return;
    schedulingRef.current = true;
    try {
      const dataUrl = await renderCardPng();
      if (!dataUrl) throw new Error("The card isn't ready yet.");
      await schedulePostMut.mutateAsync({
        postId: crypto.randomUUID(),
        integrationId: connectedIntegration?.id ?? null,
        dataUrl,
        caption: config.caption,
        view: config.view,
        cardTheme: config.cardTheme,
        scheduledFor: when,
      });
      toast.success(
        `Scheduled for ${when.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`,
      );
      setScheduleOpen(false);
      setScheduleAt("");
    } catch (e) {
      console.error("Schedule failed:", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't schedule the post.",
      );
    } finally {
      schedulingRef.current = false;
    }
  }

  async function handleCopyCaption() {
    try {
      await navigator.clipboard.writeText(config.caption);
      toast.success("Caption copied");
    } catch {
      toast.error("Couldn't copy caption");
    }
  }

  async function handleGenerateCaption() {
    if (!hasAiAccess) {
      toast.error("AI features aren't enabled for this account.");
      return;
    }
    // Never feed the AI the fabricated SAMPLE numbers — the download path blocks
    // sample posts, and the caption must honor the same guard so an invented agent
    // / premium can't reach a real Instagram post.
    if (isSample) {
      toast.error(
        "This is a sample preview — switch off 'Preview with sample data' to generate a caption from your real numbers.",
      );
      return;
    }
    setGeneratingCaption(true);
    try {
      const ctx =
        previewData.kind === "report"
          ? {
              view: config.view,
              agencyName,
              network,
              periodLabel: previewData.monthLabel,
              topAgent: previewData.topPerformer.name,
              totalAP: previewData.totalAp,
            }
          : previewData.kind === "aotw"
            ? {
                view: config.view,
                agencyName,
                network,
                periodLabel: previewData.periodLabel,
                topAgent: previewData.agent.name,
                // The spotlighted agent's OWN premium/policies (the edge fn labels
                // these as the agent's, not an agency total).
                totalAP: previewData.agent.ap,
                policies: previewData.agent.policies,
              }
            : {
                view: config.view,
                agencyName,
                network,
                periodLabel: previewData.periodLabel,
                topAgent: previewData.rows[0]?.name,
                totalAP: previewData.totalAp,
              };
      const caption = await generateCaption(ctx);
      patch({ caption });
      toast.success("Caption generated");
    } catch (e) {
      console.error("Caption generation failed:", e);
      toast.error("Couldn't generate a caption. Please try again.");
    } finally {
      setGeneratingCaption(false);
    }
  }

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 lg:py-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Spotlight
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Lock className="h-3 w-3" /> Owner only
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Branded Instagram graphics from your agency's live leaderboard —{" "}
              <span className="font-medium text-foreground">{agencyName}</span>
              {network ? ` · ${network}` : ""}.
            </p>
          </div>
          <PillNav
            activeValue={config.view}
            onChange={(v) => {
              // A per-view sample choice must not bleed across views — reset to the
              // auto heuristic so the newly selected view decides for itself.
              setSampleOverride(null);
              patch({ view: v as SocialStudioConfig["view"] });
            }}
            items={[
              { label: "Daily", value: "daily" },
              { label: "Weekly", value: "weekly" },
              { label: "Monthly", value: "monthly" },
              { label: "Agent of Week", value: "aotw" },
            ]}
          />
        </div>

        {tenantMissing && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            We couldn't load your agency or network, so live numbers and saving
            templates are unavailable right now. You can still explore the
            sample layouts — reload the page to try again.
          </div>
        )}

        {/* Body: preview + controls */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          {/* Preview column */}
          <Board pad={16} className="flex flex-col items-center gap-3">
            <div className="flex w-full items-center justify-between">
              <Cap>{VIEW_META[config.view].label}</Cap>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePostNow}
                  disabled={isSample || posting || !igConnected}
                  title={
                    isSample
                      ? "Switch to live data to post"
                      : !igConnected
                        ? "Connect Instagram in Settings → Integrations"
                        : "Publish this graphic to your Instagram feed"
                  }
                >
                  {posting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {posting ? "Posting…" : "Post to Instagram"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openSchedule}
                  disabled={isSample || !igConnected}
                  title={
                    isSample
                      ? "Switch to live data to schedule"
                      : !igConnected
                        ? "Connect Instagram in Settings → Integrations"
                        : "Schedule this graphic to auto-post later"
                  }
                >
                  <CalendarClock className="h-4 w-4" /> Schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isSample}
                  title={
                    isSample
                      ? "Sample preview can't be downloaded — switch to live data first"
                      : "Download a 1080px PNG"
                  }
                >
                  <Download className="h-4 w-4" /> Download PNG
                </Button>
              </div>
            </div>
            {scheduleOpen && (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border bg-secondary/40 p-2">
                <label
                  htmlFor="scheduleAt"
                  className="text-xs font-medium text-foreground"
                >
                  Publish at
                </label>
                <input
                  id="scheduleAt"
                  type="datetime-local"
                  value={scheduleAt}
                  min={toLocalInputValue(new Date())}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                />
                <Button
                  size="sm"
                  onClick={handleSchedule}
                  disabled={schedulePostMut.isPending}
                >
                  {schedulePostMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarClock className="h-4 w-4" />
                  )}
                  {schedulePostMut.isPending ? "Scheduling…" : "Schedule post"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2"
                  onClick={() => setScheduleOpen(false)}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Your local time — it auto-posts to your connected account.
                </span>
              </div>
            )}
            <SocialPreview
              data={shownPage}
              format={config.format}
              agencyName={agencyName}
              network={network}
              isSample={isSample}
              isLoading={isLoading}
              showPolicies={config.showPolicies}
              repositionable={config.view === "aotw" && !!config.aowPhotoUrl}
              photoPosition={config.aowPhotoPosition}
              onPhotoPositionChange={(pos) => patch({ aowPhotoPosition: pos })}
            />
            {/* Off-screen exporter — mounts EVERY slide at full 1080×H for Download/Post. */}
            <CardExportHost
              ref={exportHostRef}
              pages={previewPages}
              format={config.format}
              agencyName={agencyName}
              network={network}
              showPolicies={config.showPolicies}
            />
            <PostConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              postType={config.postType}
              format={config.format}
              data={shownPage}
              agencyName={agencyName}
              network={network}
              showPolicies={config.showPolicies}
              handle={connectedIntegration?.instagram_username ?? undefined}
              caption={config.caption}
              slideCount={pageCount}
              carouselReady={false}
              posting={posting}
              onConfirm={doPost}
            />
            {/* Carousel slide navigation — only when the roster spans multiple cards. */}
            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={shownIndex === 0}
                  onClick={() => setPageIndex(Math.max(0, shownIndex - 1))}
                  title="Previous slide"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-xs font-medium text-muted-foreground">
                  Slide {shownIndex + 1} of {pageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={shownIndex === pageCount - 1}
                  onClick={() =>
                    setPageIndex(Math.min(pageCount - 1, shownIndex + 1))
                  }
                  title="Next slide"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isSample && !isLoading && (
              <p className="text-center text-[11px] text-muted-foreground">
                {hasLive
                  ? `Showing a sample layout — your agency has ${producers.length} producer${producers.length === 1 ? "" : "s"} so far. Turn off "Preview with sample data" to see live numbers.`
                  : "No live metrics yet — showing a sample layout. Real numbers appear automatically once policies are logged."}
              </p>
            )}
          </Board>

          {/* Controls column */}
          <div className="space-y-4">
            <Board pad={16}>
              <Cap style={{ marginBottom: 12 }}>Customize</Cap>
              <SocialCustomizer
                config={config}
                onChange={patch}
                onCopyCaption={handleCopyCaption}
                onGenerateCaption={handleGenerateCaption}
                generatingCaption={generatingCaption}
                canUseAi={hasAiAccess}
                samplePreview={isSample}
                sampleForced={sampleForced}
                onSamplePreviewChange={setSampleOverride}
                onUploadPhoto={handleUploadPhoto}
                onRemovePhoto={handleRemovePhoto}
                uploadingPhoto={uploadingPhoto}
                onUploadBgImage={handleUploadBgImage}
                uploadingBg={uploadingBg}
              />
            </Board>

            <Board pad={16}>
              <Cap style={{ marginBottom: 10 }}>Quick posts</Cap>
              <QuickPostsPanel onApply={patch} />
            </Board>

            <Board pad={16}>
              <Cap style={{ marginBottom: 6 }}>Instagram</Cap>
              {igConnected ? (
                <>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Connected
                      {connectedIntegration?.instagram_username
                        ? ` · @${connectedIntegration.instagram_username}`
                        : "."}
                    </span>{" "}
                    <span className="font-medium text-foreground">Post</span>{" "}
                    publishes now;{" "}
                    <span className="font-medium text-foreground">
                      Schedule
                    </span>{" "}
                    queues this graphic to auto-post at a time you pick.
                  </p>
                  <div className="mt-3 border-t border-border pt-3">
                    <Cap style={{ marginBottom: 8 }}>Scheduled posts</Cap>
                    <ScheduledPostsPanel imoId={postsImoId} />
                  </div>
                </>
              ) : (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Connect a{" "}
                  <span className="font-medium text-foreground">
                    Business or Creator
                  </span>{" "}
                  Instagram account in{" "}
                  <a
                    href="/settings?tab=integrations"
                    className="font-medium text-accent underline"
                  >
                    Settings → Integrations
                  </a>{" "}
                  to publish or schedule straight from here — a personal account
                  can't post via the Instagram API.
                </p>
              )}
            </Board>
          </div>
        </div>

        {/* Template library — save the current style, pick a starter or saved one. */}
        <Board pad={16} className="mt-4">
          <Cap style={{ marginBottom: 12 }}>Template library</Cap>
          <SocialLibrary
            config={config}
            // Pre-clear per-post fields so applying a template that lacks them resets
            // a stale value (background image + leaderboard headline); the spread then
            // restores whatever the template DOES specify. Caption is left untouched
            // (it's stripped from templates entirely — never per-post-clobbered).
            onApply={(c) =>
              patch({
                aowBgImageUrl: null,
                title: undefined,
                ...c,
                // Migrate legacy templates (aowDesign/theme) → cardTheme on apply so an
                // old saved template restores its look instead of keeping the current one.
                cardTheme: resolveTemplateTheme(c),
              })
            }
            agencyName={agencyName}
            network={network}
            imoId={imoId}
            agencyId={agencyId}
          />
        </Board>
      </div>
    </SectionShell>
  );
}
