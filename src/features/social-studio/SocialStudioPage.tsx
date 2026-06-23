// src/features/social-studio/SocialStudioPage.tsx
// Social Studio — owner-only. Phase 1: live, agency-scoped preview of the
// leaderboard / report social cards (with a labeled sample fallback when the
// agency has no metrics yet), full customization, and client-side PNG download.
// Scheduling + auto-post to Instagram + AI one-off generation land in Phase 2/3.

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Sparkles, Lock } from "lucide-react";
import { SectionShell, PillNav } from "@/components/v2";
import { Board, Cap } from "@/components/board";
import { Button } from "@/components/ui/button";
import { useImo } from "@/contexts/ImoContext";
import { useAgencyAgentLeaderboard } from "@/hooks/leaderboard";
import { useAiAccess } from "@/hooks/subscription";
import type { LeaderboardFilters } from "@/types/leaderboard.types";
import { useSpotlightActions } from "./hooks/useSpotlightActions";
import { SocialPreview } from "./components/SocialPreview";
import { SocialCustomizer } from "./components/SocialCustomizer";
import { QuickPostsPanel } from "./components/QuickPostsPanel";
import { SocialLibrary } from "./components/SocialLibrary";
import { DEFAULT_CONFIG, VIEW_META, type SocialStudioConfig } from "./types";
import {
  resolveSampleState,
  buildPeriodLabels,
  buildPreviewData,
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { hasAiAccess } = useAiAccess();
  const {
    uploadAgentPhoto,
    removeAgentPhoto,
    readFileAsDataUrl,
    generateCaption,
  } = useSpotlightActions();
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

  const previewData = useMemo(
    () => buildPreviewData({ config, producers, isSample, labels }),
    [config, producers, isSample, labels],
  );

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
      patch({ aowPhotoUrl: dataUrl, aowPhotoStorageUrl: storageUrl });
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
      patch({ aowPhotoUrl: null, aowPhotoStorageUrl: null });
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

  async function handleDownload() {
    if (!cardRef.current) return;
    if (isSample) {
      toast.error(
        "This is a sample preview — switch off 'Preview with sample data' (once you have real production) to download a real post.",
      );
      return;
    }
    // Capture the filename BEFORE the awaits — the user could switch view/format during
    // font-load + rasterization, which would otherwise mis-name the file.
    const filename = `${agencyName.toLowerCase().replace(/\s+/g, "-")}-${config.view}-${config.format}.png`;
    try {
      // modern-screenshot is a more faithful html-to-image successor: it embeds
      // cross-origin webfonts and renders CSS gradients far more accurately, so the
      // downloaded PNG matches the on-screen preview (the old html-to-image path
      // flattened fonts/gradients on the real download). NOTE: foreignObject-based
      // rasterizers — including this one — still cannot capture `backdrop-filter`
      // (the aurora "glass" blur); that design renders faithfully only via a real
      // browser / the Creatomate pipeline.
      const { domToPng } = await import("modern-screenshot");
      // A runtime font change (the customizer dropdown) can race the download — wait
      // for the selected webfont to finish loading or the PNG bakes in a fallback.
      if (document.fonts?.ready) await document.fonts.ready;
      // scale:1 → exactly 1080px (matches the "1080px PNG" copy + Instagram's native
      // size); without it a retina screen exports at devicePixelRatio (e.g. 2160px).
      const dataUrl = await domToPng(cardRef.current, {
        scale: 1,
      });
      const a = document.createElement("a");
      a.download = filename;
      a.href = dataUrl;
      a.click();
      toast.success("Image downloaded");
    } catch (e) {
      console.error("Social card download failed:", e);
      toast.error("Couldn't generate the image. Please try again.");
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
              <Button
                size="sm"
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
            <SocialPreview
              data={previewData}
              format={config.format}
              agencyName={agencyName}
              network={network}
              isSample={isSample}
              isLoading={isLoading}
              showPolicies={config.showPolicies}
              cardRef={cardRef}
              repositionable={config.view === "aotw" && !!config.aowPhotoUrl}
              photoPosition={config.aowPhotoPosition}
              onPhotoPositionChange={(pos) => patch({ aowPhotoPosition: pos })}
            />
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
              <Cap style={{ marginBottom: 6 }}>Automation</Cap>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Scheduling and auto-posting to Instagram (daily / weekly /
                monthly, with on/off toggles) arrive next. Everything stays{" "}
                <span className="font-medium text-foreground">off</span> until
                you turn it on — your agency just started, so there's nothing to
                post yet.
              </p>
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
              patch({ aowBgImageUrl: null, title: undefined, ...c })
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
