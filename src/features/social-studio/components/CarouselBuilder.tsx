// src/features/social-studio/components/CarouselBuilder.tsx
// The "Carousel builder" mode (#8): assemble an ORDERED deck mixing data cards (a chosen
// view's lead card, snapshotted) and marketing cards (quote / tip / recruiting CTA /
// custom), reorder/remove/edit them, then post the whole set as ONE Instagram carousel or
// download every slide. Posting reuses the exact path #7 shipped (CardExportHost.exportAll
// → uploadCarouselSlides → publishToInstagram as a FEED carousel). One brand theme +
// format applies to the whole deck so the carousel reads as a cohesive set.

import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Send,
  Download,
  Loader2,
  ImagePlus,
  Sparkles,
  Save,
  FolderOpen,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiAccess } from "@/hooks/subscription";
import {
  FORMAT_DIMS,
  cardThemeWrapperClass,
  normalizeCardTheme,
  type MarketingVariant,
  type SocialFormat,
  type CardTheme,
} from "@/features/social-cards";
import { SocialCardSwitch, type PreviewData } from "./SocialPreview";
import { CardExportHost, type CardExportHandle } from "./CardExportHost";
import {
  buildPreviewPages,
  type ProducerRow,
  type PeriodLabels,
} from "../previewModel";
import { useSpotlightActions } from "../hooks/useSpotlightActions";
import { useScheduleCarousel } from "@/hooks/instagram";
import {
  useMarketingCopyDraft,
  type MarketingCopyRequest,
  type MarketingCopyResult,
} from "../hooks/useMarketingCopyDraft";
import {
  useSocialDecks,
  useSaveDeck,
  useDeleteDeck,
  useLoadDeck,
  type DeckSpec,
  type DeckSlideSpec,
} from "../hooks/useSocialDecks";
import type { SocialStudioConfig, SocialView } from "../types";
import { MARKETING_COPY_CAPS } from "../marketingCopyCaps";
import { toast } from "sonner";

const IG_CAROUSEL_MAX = 10;
const MAX_W = 360;
const MAX_H = 460;

interface DeckSlide {
  id: string;
  data: PreviewData;
  /** Source view for a DATA slide — kept so a saved deck can re-derive it from live
   *  metrics on load (PreviewData.kind alone can't tell daily from weekly). */
  view?: SocialView;
}

interface CarouselBuilderProps {
  config: SocialStudioConfig;
  /** Patch the studio config (used to restore a saved deck's theme + format on load). */
  onConfigChange: (p: Partial<SocialStudioConfig>) => void;
  /** Current IMO — the tenant a saved deck is filed under. */
  imoId: string | null;
  /**
   * The IMO key the ScheduledPostsPanel subscribes to (selectedIntegration.imo_id ?? imoId).
   * The carousel-schedule mutation must invalidate THIS key, not imoId, or the panel goes
   * stale after scheduling in a multi-account (WI-6) setup (review #2).
   */
  postsImoId: string | null;
  producers: ProducerRow[];
  isSample: boolean;
  labels: PeriodLabels;
  agencyName: string;
  network?: string;
  igConnected: boolean;
  selectedIntegration?: { id: string; instagram_username?: string | null };
}

const DATA_VIEWS: { view: SocialView; label: string }[] = [
  { view: "daily", label: "Daily" },
  { view: "weekly", label: "Weekly" },
  { view: "monthly", label: "Monthly" },
  { view: "aotw", label: "Agent of Week" },
];

const MARKETING_TYPES: { variant: MarketingVariant; label: string }[] = [
  { variant: "quote", label: "Quote" },
  { variant: "tip", label: "Tip" },
  { variant: "cta", label: "Recruiting" },
  { variant: "custom", label: "Custom" },
];

// A short human label for a deck row.
function slideLabel(data: PreviewData): string {
  switch (data.kind) {
    case "leaderboard":
      return data.title || "Leaderboard";
    case "aotw":
      return "Agent of the Week";
    case "report":
      return "Monthly recap";
    case "marketing":
      return (
        { quote: "Quote", tip: "Tip", cta: "Recruiting CTA", custom: "Custom" }[
          data.variant
        ] || "Marketing"
      );
    default:
      return "Slide";
  }
}

export function CarouselBuilder({
  config,
  onConfigChange,
  imoId,
  postsImoId,
  producers,
  isSample,
  labels,
  agencyName,
  network,
  igConnected,
  selectedIntegration,
}: CarouselBuilderProps) {
  const { uploadCarouselSlides, publishToInstagram, readFileAsDataUrl } =
    useSpotlightActions();
  const [deck, setDeck] = useState<DeckSlide[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const postingRef = useRef(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const schedulingRef = useRef(false);
  // Invalidate the SAME key the panel reads (postsImoId), not imoId (review #2).
  const scheduleCarouselMut = useScheduleCarousel(postsImoId ?? undefined);
  const exportRef = useRef<CardExportHandle>(null);
  const { hasAiAccess } = useAiAccess();
  const draftMarketingCopy = useMarketingCopyDraft();

  // Deck library (Phase 3A) — save / load / delete the ordered deck.
  const decksQuery = useSocialDecks();
  const saveDeckMut = useSaveDeck();
  const deleteDeckMut = useDeleteDeck();
  const loadDeckMut = useLoadDeck();
  const [deckName, setDeckName] = useState("");

  // One brand theme + page stamp applied to the WHOLE deck so the carousel is uniform,
  // regardless of the theme a slide was added under. (AOTW carries no page field.)
  const deckPages = useMemo<PreviewData[]>(() => {
    const total = deck.length;
    return deck.map((s, i) => {
      const themed = { ...s.data, theme: config.cardTheme } as PreviewData;
      if (themed.kind === "aotw") return themed;
      return {
        ...themed,
        page: total > 1 ? { index: i + 1, total } : undefined,
      };
    });
  }, [deck, config.cardTheme]);

  const selectedIndex = Math.max(
    0,
    deck.findIndex((s) => s.id === selectedId),
  );
  const selected = deck[selectedIndex];
  const selectedPage = deckPages[selectedIndex];
  const atCap = deck.length >= IG_CAROUSEL_MAX;

  function addSlide(data: PreviewData, view?: SocialView) {
    if (atCap) {
      toast.message(`Carousels are capped at ${IG_CAROUSEL_MAX} slides.`);
      return;
    }
    const id = crypto.randomUUID();
    setDeck((d) => [...d, { id, data, view }]);
    setSelectedId(id);
  }

  // Build a data slide's lead card from CURRENT metrics for a given view/format/theme.
  function buildDataLead(
    view: SocialView,
    format: SocialFormat,
    cardTheme: CardTheme,
  ): PreviewData | undefined {
    const pages = buildPreviewPages({
      config: { ...config, view, format, cardTheme },
      producers,
      isSample,
      labels,
    });
    return pages[0];
  }

  function addData(view: SocialView) {
    const lead = buildDataLead(view, config.format, config.cardTheme);
    if (lead) addSlide(lead, view);
  }

  // ── Deck save / load (Phase 3A) ─────────────────────────────────────────────
  // Serialize the deck to a versioned spec: data slides keep only their view (re-derived
  // from live metrics on load); marketing slides snapshot their static copy + image.
  function deckToSpec(): DeckSpec {
    const slides: DeckSlideSpec[] = deck.map((s) => {
      if (s.data.kind === "marketing") {
        const d = s.data;
        return {
          t: "marketing",
          variant: d.variant,
          text: d.text,
          attribution: d.attribution,
          headline: d.headline,
          body: d.body,
          imageDataUrl: d.imageDataUrl,
        };
      }
      return { t: "data", view: s.view ?? config.view };
    });
    return { v: 1, slides };
  }

  function handleSaveDeck() {
    const name = deckName.trim();
    if (!name) {
      toast.error("Name your deck first.");
      return;
    }
    if (deck.length === 0) {
      toast.error("Add at least one slide before saving.");
      return;
    }
    if (!imoId) {
      toast.error("No agency context — reload and try again.");
      return;
    }
    saveDeckMut.mutate(
      {
        name,
        imoId,
        spec: deckToSpec(),
        format: config.format,
        cardTheme: config.cardTheme,
      },
      { onSuccess: () => setDeckName("") },
    );
  }

  async function handleLoadDeck(id: string) {
    try {
      const loaded = await loadDeckMut.mutateAsync(id);
      const theme = normalizeCardTheme(loaded.card_theme);
      const fmt: SocialFormat = (
        ["portrait", "square", "story"].includes(loaded.format)
          ? loaded.format
          : "portrait"
      ) as SocialFormat;
      const expected = loaded.spec.slides.length;
      const next: DeckSlide[] = [];
      for (const spec of loaded.spec.slides) {
        if (spec.t === "data") {
          const lead = buildDataLead(spec.view, fmt, theme);
          // A data slide whose live metric is unavailable (e.g. sample mode off) can't be
          // rebuilt; it's counted and reported below, not silently dropped (review #3/#10).
          if (lead)
            next.push({ id: crypto.randomUUID(), data: lead, view: spec.view });
        } else {
          next.push({
            id: crypto.randomUUID(),
            data: {
              kind: "marketing",
              variant: spec.variant,
              theme,
              text: spec.text,
              attribution: spec.attribution,
              headline: spec.headline,
              body: spec.body,
              imageDataUrl: spec.imageDataUrl,
            },
          });
        }
      }
      // Restore the saved deck's theme + format so the re-derived deck renders as saved.
      onConfigChange({ cardTheme: theme, format: fmt });
      const capped = next.slice(0, IG_CAROUSEL_MAX);
      setDeck(capped);
      setSelectedId(capped[0]?.id ?? null);
      const dropped = expected - next.length;
      if (dropped > 0) {
        toast.warning(
          `Loaded "${loaded.name}" — ${next.length} of ${expected} slides. ` +
            `${dropped} data slide${dropped > 1 ? "s" : ""} couldn't be rebuilt (live metrics unavailable).`,
        );
      } else {
        toast.success(`Loaded "${loaded.name}".`);
      }
    } catch {
      /* error toast handled by the mutation's onError */
    }
  }

  function addMarketing(variant: MarketingVariant) {
    const theme = config.cardTheme;
    const data: PreviewData =
      variant === "quote"
        ? { kind: "marketing", variant, theme, text: "", attribution: "" }
        : variant === "custom"
          ? {
              kind: "marketing",
              variant,
              theme,
              headline: "",
              body: "",
              imageDataUrl: undefined,
            }
          : variant === "cta"
            ? {
                kind: "marketing",
                variant,
                theme,
                headline: "Join our team",
                body: "We're growing — DM us to learn about a career here.",
              }
            : { kind: "marketing", variant, theme, headline: "", body: "" };
    addSlide(data);
  }

  function move(i: number, dir: -1 | 1) {
    setDeck((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const copy = d.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function remove(id: string) {
    setDeck((d) => d.filter((s) => s.id !== id));
  }

  // Patch the SELECTED marketing slide's editable copy.
  function patchMarketing(
    patch: Partial<{
      text: string;
      attribution: string;
      headline: string;
      body: string;
      imageDataUrl?: string;
    }>,
  ) {
    if (!selected) return;
    setDeck((d) =>
      d.map((s) =>
        s.id === selected.id && s.data.kind === "marketing"
          ? { ...s, data: { ...s.data, ...patch } }
          : s,
      ),
    );
  }

  async function handleImage(file: File) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      patchMarketing({ imageDataUrl: dataUrl });
    } catch {
      toast.error("Couldn't read that image.");
    }
  }

  async function postAll() {
    if (postingRef.current) return;
    if (isSample) {
      toast.error("Switch off sample data to post your real deck.");
      return;
    }
    if (!igConnected) {
      toast.error("Connect a Business Instagram account first.");
      return;
    }
    if (deck.length < 2) {
      toast.error("A carousel needs at least 2 slides.");
      return;
    }
    postingRef.current = true;
    setPosting(true);
    try {
      const slides = await exportRef.current?.exportAll();
      if (!slides || slides.length === 0)
        throw new Error("The slides aren't ready yet.");
      const capped = slides.slice(0, IG_CAROUSEL_MAX);
      const urls = await uploadCarouselSlides(capped);
      const { username } = await publishToInstagram(urls, caption, {
        mediaType: "FEED",
        integrationId: selectedIntegration?.id,
      });
      toast.success(
        username
          ? `Posted carousel (${urls.length}) to @${username}`
          : `Posted carousel (${urls.length})`,
      );
    } catch (e) {
      console.error("Carousel post failed:", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't post the carousel.",
      );
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  // Schedule the whole deck as a carousel for a future time. Uploads every slide under the
  // row's folder, then inserts the queue row via the carousel RPC; the cron worker fires it.
  async function scheduleAll() {
    if (schedulingRef.current) return;
    if (isSample) {
      toast.error("Switch off sample data to schedule your deck.");
      return;
    }
    if (!igConnected) {
      toast.error("Connect a Business Instagram account first.");
      return;
    }
    if (!postsImoId) {
      toast.error("No agency context — reload and try again.");
      return;
    }
    if (deck.length < 2) {
      toast.error("A carousel needs at least 2 slides.");
      return;
    }
    const when = new Date(scheduledFor);
    // Require a small lead so the slide export + upload (which run before the RPC) can't push
    // `now()` past the chosen time and trip the server's future-only guard (review #11).
    const MIN_LEAD_MS = 2 * 60 * 1000;
    if (
      !scheduledFor ||
      isNaN(when.getTime()) ||
      when.getTime() <= Date.now() + MIN_LEAD_MS
    ) {
      toast.error("Pick a time at least a couple of minutes from now.");
      return;
    }
    schedulingRef.current = true;
    setScheduling(true);
    try {
      const slides = await exportRef.current?.exportAll();
      if (!slides || slides.length === 0)
        throw new Error("The slides aren't ready yet.");
      const capped = slides.slice(0, IG_CAROUSEL_MAX);
      await scheduleCarouselMut.mutateAsync({
        postId: crypto.randomUUID(),
        integrationId: selectedIntegration?.id ?? null,
        dataUrls: capped,
        caption,
        view: config.view,
        cardTheme: config.cardTheme,
        scheduledFor: when,
      });
      toast.success(
        `Scheduled a ${capped.length}-slide carousel for ${when.toLocaleString()}`,
      );
      setScheduledFor("");
    } catch (e) {
      console.error("Carousel schedule failed:", e);
      toast.error(
        e instanceof Error ? e.message : "Couldn't schedule the carousel.",
      );
    } finally {
      schedulingRef.current = false;
      setScheduling(false);
    }
  }

  async function downloadAll() {
    try {
      const slides = await exportRef.current?.exportAll();
      if (!slides || slides.length === 0) return;
      const base = `${agencyName.toLowerCase().replace(/\s+/g, "-")}-carousel`;
      for (let i = 0; i < slides.length; i++) {
        const a = document.createElement("a");
        a.download = `${base}-slide-${i + 1}.png`;
        a.href = slides[i];
        a.click();
        if (i < slides.length - 1) await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(`Downloaded ${slides.length} slides`);
    } catch (e) {
      console.error("Carousel download failed:", e);
      toast.error("Couldn't generate the images.");
    }
  }

  // Scaled on-screen preview of the selected slide (display only — never the export src).
  const { w: natW, h: natH } = FORMAT_DIMS[config.format];
  const scale = Math.min(MAX_W / natW, MAX_H / natH);

  const handleLabel = selectedIntegration?.instagram_username
    ? `@${selectedIntegration.instagram_username}`
    : "your account";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Preview + actions */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
        {deck.length === 0 ? (
          <div className="flex h-[360px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Build a carousel</p>
            <p className="mt-1 max-w-xs text-xs">
              Add data cards and marketing slides from the right, reorder them,
              then post the set as one Instagram carousel.
            </p>
          </div>
        ) : (
          <>
            <div
              className="overflow-hidden rounded-lg"
              style={{
                width: Math.round(natW * scale),
                height: Math.round(natH * scale),
              }}
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  className={cardThemeWrapperClass(config.cardTheme)}
                  style={{ width: natW }}
                >
                  {selectedPage && (
                    <SocialCardSwitch
                      data={selectedPage}
                      format={config.format}
                      agencyName={agencyName}
                      network={network}
                      showPolicies={config.showPolicies}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Slide nav */}
            {deck.length > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedIndex === 0}
                  onClick={() => setSelectedId(deck[selectedIndex - 1].id)}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Slide {selectedIndex + 1} / {deck.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedIndex === deck.length - 1}
                  onClick={() => setSelectedId(deck[selectedIndex + 1].id)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Inline editor for the selected marketing slide */}
            {selected?.data.kind === "marketing" && (
              <MarketingEditor
                key={selected.id}
                data={selected.data}
                onPatch={patchMarketing}
                onImage={handleImage}
                hasAiAccess={hasAiAccess}
                draftMarketingCopy={draftMarketingCopy}
                agencyName={agencyName}
                network={network}
              />
            )}

            {/* Caption + actions */}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption for the carousel (optional)…"
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
            />
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={downloadAll}
                disabled={deck.length === 0}
                title="Download every slide as a PNG"
              >
                <Download className="h-4 w-4" /> Download
              </Button>
              <Button
                size="sm"
                onClick={postAll}
                disabled={
                  isSample || posting || !igConnected || deck.length < 2
                }
                title={
                  isSample
                    ? "Switch to live data to post"
                    : !igConnected
                      ? "Connect Instagram in Settings → Integrations"
                      : deck.length < 2
                        ? "Add at least 2 slides for a carousel"
                        : `Post the ${deck.length}-slide carousel to ${handleLabel}`
                }
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {posting ? "Posting…" : "Post carousel"}
              </Button>
            </div>

            {/* Schedule the deck as a carousel for a future time (Phase 3B). */}
            <div className="flex w-full items-center justify-end gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                title="Pick a future date and time to auto-post this carousel"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={scheduleAll}
                disabled={
                  isSample ||
                  scheduling ||
                  !igConnected ||
                  deck.length < 2 ||
                  !scheduledFor
                }
                title={
                  isSample
                    ? "Switch to live data to schedule"
                    : !igConnected
                      ? "Connect Instagram in Settings → Integrations"
                      : deck.length < 2
                        ? "Add at least 2 slides for a carousel"
                        : !scheduledFor
                          ? "Pick a future date and time"
                          : `Schedule the ${deck.length}-slide carousel to ${handleLabel}`
                }
              >
                {scheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                {scheduling ? "Scheduling…" : "Schedule"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Palette + deck */}
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-card/40 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Add a slide {atCap ? "(max 10 reached)" : ""}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DATA_VIEWS.map((d) => (
              <Button
                key={d.view}
                size="sm"
                variant="outline"
                className="justify-start text-xs"
                disabled={atCap}
                onClick={() => addData(d.view)}
              >
                <Plus className="h-3 w-3" /> {d.label}
              </Button>
            ))}
            {MARKETING_TYPES.map((m) => (
              <Button
                key={m.variant}
                size="sm"
                variant="outline"
                className="justify-start text-xs"
                disabled={atCap}
                onClick={() => addMarketing(m.variant)}
              >
                <Plus className="h-3 w-3" /> {m.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your carousel ({deck.length})
          </p>
          {deck.length === 0 ? (
            <p className="text-xs text-muted-foreground">No slides yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {deck.map((s, i) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                    s.id === selectedId
                      ? "border-accent bg-accent/10"
                      : "border-border bg-background"
                  }`}
                >
                  <button
                    className="flex-1 truncate text-left text-foreground"
                    onClick={() => setSelectedId(s.id)}
                    title="Edit / preview this slide"
                  >
                    <span className="text-muted-foreground">{i + 1}.</span>{" "}
                    {slideLabel(s.data)}
                  </button>
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={i === deck.length - 1}
                    onClick={() => move(i, 1)}
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="text-destructive/80 hover:text-destructive"
                    onClick={() => remove(s.id)}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Saved decks (Phase 3A) — name + save the current deck; reload/delete saved ones.
            Data slides re-derive from live metrics on load; marketing copy is snapshotted. */}
        <div className="rounded-xl border border-border bg-card/40 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Saved decks
          </p>
          <div className="flex items-center gap-1.5">
            <input
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Name this deck…"
              maxLength={80}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveDeck();
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveDeck}
              disabled={
                deck.length === 0 || saveDeckMut.isPending || !deckName.trim()
              }
              title="Save the current deck"
            >
              {saveDeckMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>

          <div className="mt-2">
            {decksQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (decksQuery.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved decks yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {decksQuery.data?.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    <button
                      className="flex flex-1 items-center gap-1.5 truncate text-left text-foreground disabled:opacity-50"
                      onClick={() => handleLoadDeck(d.id)}
                      disabled={loadDeckMut.isPending}
                      title="Load this deck"
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{d.name}</span>
                    </button>
                    <button
                      className="text-destructive/80 hover:text-destructive disabled:opacity-30"
                      onClick={() => deleteDeckMut.mutate(d.id)}
                      disabled={deleteDeckMut.isPending}
                      title="Delete this deck"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Off-screen full-size export host over the whole deck (Download / Post). */}
      <CardExportHost
        ref={exportRef}
        pages={deckPages}
        format={config.format}
        agencyName={agencyName}
        network={network}
        showPolicies={config.showPolicies}
      />
    </div>
  );
}

// ── Inline editor for a marketing slide ──────────────────────────────────────
function MarketingEditor({
  data,
  onPatch,
  onImage,
  hasAiAccess,
  draftMarketingCopy,
  agencyName,
  network,
}: {
  data: Extract<PreviewData, { kind: "marketing" }>;
  onPatch: (p: {
    text?: string;
    attribution?: string;
    headline?: string;
    body?: string;
    imageDataUrl?: string;
  }) => void;
  onImage: (f: File) => void;
  hasAiAccess: boolean;
  draftMarketingCopy: (
    req: MarketingCopyRequest,
  ) => Promise<MarketingCopyResult>;
  agencyName: string;
  network?: string;
}) {
  const input =
    "w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground";
  const [topic, setTopic] = useState("");
  const [drafting, setDrafting] = useState(false);

  // "Draft with AI" only SEEDS the copy fields — they stay fully editable after. The
  // server forces a quote's attribution empty (never fabricates a source), so we leave
  // any user-typed attribution untouched here.
  async function draft() {
    if (drafting) return;
    setDrafting(true);
    try {
      const result = await draftMarketingCopy({
        variant: data.variant,
        topic: topic.trim() || undefined,
        agencyName,
        network,
      });
      if (data.variant === "quote") {
        onPatch({ text: result.text ?? "" });
      } else {
        onPatch({ headline: result.headline ?? "", body: result.body ?? "" });
      }
      toast.success("Drafted with AI — edit it to taste.");
    } catch (e) {
      console.error("Marketing copy draft failed:", e);
      toast.error("Couldn't draft copy. Try again.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="w-full space-y-2 rounded-md border border-border bg-secondary/30 p-2">
      {data.variant === "quote" ? (
        <>
          <textarea
            className={`${input} resize-none`}
            rows={3}
            maxLength={MARKETING_COPY_CAPS.text}
            placeholder="Quote text…"
            value={data.text ?? ""}
            onChange={(e) => onPatch({ text: e.target.value })}
          />
          <input
            className={input}
            maxLength={MARKETING_COPY_CAPS.attribution}
            placeholder="Attribution (optional)"
            value={data.attribution ?? ""}
            onChange={(e) => onPatch({ attribution: e.target.value })}
          />
        </>
      ) : (
        <>
          <input
            className={input}
            maxLength={MARKETING_COPY_CAPS.headline}
            placeholder="Headline"
            value={data.headline ?? ""}
            onChange={(e) => onPatch({ headline: e.target.value })}
          />
          <textarea
            className={`${input} resize-none`}
            rows={3}
            maxLength={MARKETING_COPY_CAPS.body}
            placeholder="Body text…"
            value={data.body ?? ""}
            onChange={(e) => onPatch({ body: e.target.value })}
          />
          {data.variant === "custom" && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ImagePlus className="h-4 w-4" />
              {data.imageDataUrl
                ? "Change background image"
                : "Add background image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImage(f);
                }}
              />
            </label>
          )}
        </>
      )}

      {/* Draft with AI — seeds the copy fields; gated on the AI entitlement. */}
      {hasAiAccess && (
        <div className="flex items-center gap-1.5 border-t border-border/60 pt-2">
          <input
            className={`${input} flex-1`}
            placeholder="Optional: steer the draft (e.g. team growth)…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={drafting}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={draft}
            disabled={drafting}
            title="Draft this slide's copy with AI"
          >
            {drafting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {drafting ? "Drafting…" : "Draft with AI"}
          </Button>
        </div>
      )}
    </div>
  );
}
