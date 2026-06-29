// src/features/social-studio/components/CarouselBuilder.tsx
// The "Carousel builder" mode (#8): assemble an ORDERED deck mixing data cards (a chosen
// view's lead card, snapshotted) and marketing cards (quote / tip / recruiting CTA /
// custom), reorder/remove/edit them, then post the whole set as ONE Instagram carousel or
// download every slide. Posting reuses the exact path #7 shipped (CardExportHost.exportAll
// → uploadCarouselSlides → publishToInstagram as a FEED carousel). One brand theme +
// format applies to the whole deck so the carousel reads as a cohesive set.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Wand2,
  Save,
  FolderOpen,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PillNav } from "@/components/v2";
import { useAiAccess } from "@/hooks/subscription";
import {
  FORMAT_DIMS,
  CARD_THEMES,
  CARD_THEME_LABEL,
  cardThemeWrapperClass,
  normalizeCardTheme,
  toLastInitial,
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
  useComposeCarousel,
  type CarouselFramework,
} from "../hooks/useComposeCarousel";
import {
  useSocialDecks,
  useSaveDeck,
  useDeleteDeck,
  useLoadDeck,
  type DeckSpec,
  type DeckSlideSpec,
} from "../hooks/useSocialDecks";
import type { SocialStudioConfig, SocialView } from "../types";
import { MARKETING_COPY_CAPS, MARKETING_LIST_CAPS } from "../marketingCopyCaps";
import { aiErrorMessage } from "../aiErrorMessage";
import { toLocalInputValue } from "../datetimeLocal";
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
  /** Leaderboard still loading — gate the empty-deck sample seed so it doesn't fire
   *  during the data-load flash (review). */
  isLoading: boolean;
  /** True when there is NO live data, so sample is forced — the toggle is disabled. */
  sampleForced: boolean;
  /** Flip the "Preview with sample data" override (so carousel mode can toggle it too). */
  onSampleChange: (v: boolean) => void;
  labels: PeriodLabels;
  agencyName: string;
  network?: string;
  igConnected: boolean;
  /** All connected IG accounts — drives the account picker (which account to post from). */
  connectedIntegrations: { id: string; instagram_username?: string | null }[];
  selectedIntegration?: { id: string; instagram_username?: string | null };
  /** Pick which connected account to post/schedule from. */
  onSelectIntegration: (id: string) => void;
}

const DATA_VIEWS: { view: SocialView; label: string }[] = [
  { view: "daily", label: "Daily" },
  { view: "weekly", label: "Weekly" },
  { view: "monthly", label: "Monthly" },
  { view: "aotw", label: "Agent of Week" },
];

const MARKETING_TYPES: { variant: MarketingVariant; label: string }[] = [
  { variant: "hook", label: "Hook" },
  { variant: "list", label: "List" },
  { variant: "checklist", label: "Checklist" },
  { variant: "stat", label: "Stat" },
  { variant: "compare", label: "Compare" },
  { variant: "quote", label: "Quote" },
  { variant: "tip", label: "Tip" },
  { variant: "cta", label: "Recruiting" },
  { variant: "custom", label: "Custom" },
];

const FRAMEWORK_OPTIONS: { value: CarouselFramework; label: string }[] = [
  { value: "auto", label: "Auto — let AI choose" },
  { value: "list", label: "How-to / tips list" },
  { value: "problem-solution", label: "Problem → Solution" },
  { value: "story", label: "Story" },
  { value: "recruiting", label: "Recruiting pitch" },
];

/** The legacy variants the single-slide marketing-copy drafter supports. */
const LEGACY_COPY_VARIANTS = ["quote", "tip", "cta", "custom"] as const;
type LegacyCopyVariant = (typeof LEGACY_COPY_VARIANTS)[number];
function isLegacyCopyVariant(v: MarketingVariant): v is LegacyCopyVariant {
  return (LEGACY_COPY_VARIANTS as readonly string[]).includes(v);
}

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
        {
          hook: "Hook",
          list: "List",
          checklist: "Checklist",
          stat: "Stat",
          compare: "Compare",
          quote: "Quote",
          tip: "Tip",
          cta: "Recruiting CTA",
          custom: "Custom",
        }[data.variant] || "Marketing"
      );
    default:
      return "Slide";
  }
}

// Normalize the Build-with-AI slide-count input (which is "" while the user is mid-edit) to a
// valid count; "" / NaN / out-of-range fall back to a safe value (review #8).
function clampSlideCount(v: number | ""): number {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n)
    ? Math.max(2, Math.min(IG_CAROUSEL_MAX, Math.round(n)))
    : 5;
}

export function CarouselBuilder({
  config,
  onConfigChange,
  imoId,
  postsImoId,
  producers,
  isSample,
  isLoading,
  sampleForced,
  onSampleChange,
  labels,
  agencyName,
  network,
  igConnected,
  connectedIntegrations,
  selectedIntegration,
  onSelectIntegration,
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

  // Build-with-AI (Phase 3C) — compose a whole deck from one idea + write a deck-aware caption.
  const {
    composeCarousel: runCompose,
    generateCaption: runCaption,
    enhanceIdea: runEnhance,
  } = useComposeCarousel();
  const [aiIdea, setAiIdea] = useState("");
  // Empty string while the user is mid-edit (cleared the field); normalized to a valid count
  // on blur / at use (review #8 — a plain number snapped back to 2 the moment it was cleared).
  const [aiCount, setAiCount] = useState<number | "">(7);
  const [aiRealQuotes, setAiRealQuotes] = useState(true);
  const [aiDataSlides, setAiDataSlides] = useState(true);
  const [aiFramework, setAiFramework] = useState<CarouselFramework>("auto");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const [enhancing, setEnhancing] = useState(false);
  const enhancingRef = useRef(false);
  const [captioning, setCaptioning] = useState(false);
  const captioningRef = useRef(false);

  // Real agency KPIs (assembled from already-loaded metrics) the AI may cite — and ONLY these.
  // Omitted when showing sample data so fabricated sample numbers are never presented as real.
  const factsAvailable = !isSample && producers.length > 0;
  const buildFacts = useCallback(() => {
    if (isSample || producers.length === 0) return undefined;
    const polFor = (p: ProducerRow) => p.submittedPolicies ?? p.policyCount;
    const ranked = [...producers].sort((a, b) => b.apTotal - a.apTotal);
    const totalAp = ranked.reduce((s, e) => s + e.apTotal, 0);
    const policyCount = ranked.reduce((s, e) => s + polFor(e), 0);
    const agentCount = ranked.length;
    const top = ranked[0];
    return {
      periodLabel: labels.monthLabel || labels.weekRange || labels.dateLabel,
      totalAp,
      policyCount,
      agentCount,
      avgApPerAgent: agentCount ? Math.round(totalAp / agentCount) : 0,
      topAgent: top
        ? {
            name: toLastInitial(top.agentName),
            ap: top.apTotal,
            policies: polFor(top),
          }
        : undefined,
      topFive: ranked.slice(0, 5).map((e, i) => ({
        rank: i + 1,
        name: toLastInitial(e.agentName),
        ap: e.apTotal,
        policies: polFor(e),
      })),
    };
  }, [isSample, producers, labels]);

  // Instagram carousels are FEED posts (portrait 4:5 or square 1:1) — never 9:16 Story. If the
  // shared config carries "story" (set in single-card mode), treat the carousel as portrait for
  // the preview, derivation, AND export, so a 9:16 deck can never be published as a feed carousel.
  const carouselFormat: SocialFormat =
    config.format === "story" ? "portrait" : config.format;

  // Build a data slide's lead card from CURRENT metrics for a given view/format/theme. Memoized
  // so deckPages can re-derive data slides whenever the inputs it snapshots change.
  const buildDataLead = useCallback(
    (
      view: SocialView,
      format: SocialFormat,
      cardTheme: CardTheme,
    ): PreviewData | undefined => {
      const pages = buildPreviewPages({
        config: { ...config, view, format, cardTheme },
        producers,
        isSample,
        labels,
      });
      return pages[0];
    },
    [config, producers, isSample, labels],
  );

  // One brand theme + page stamp applied to the WHOLE deck so the carousel is uniform.
  // Data slides are RE-DERIVED LIVE from their source view + the current sample/producers/shape
  // (never the stale add-time snapshot) — so a slide built in sample mode can't be exported/posted
  // with fabricated numbers after the toggle flips, and a shape change re-paginates its rows
  // instead of clipping. Marketing slides keep their edited copy. (AOTW carries no page field.)
  const deckPages = useMemo<PreviewData[]>(() => {
    const total = deck.length;
    return deck.map((s, i) => {
      const live =
        s.view && s.data.kind !== "marketing"
          ? buildDataLead(s.view, carouselFormat, config.cardTheme)
          : undefined;
      const themed = {
        ...(live ?? s.data),
        theme: config.cardTheme,
      } as PreviewData;
      if (themed.kind === "aotw") return themed;
      return {
        ...themed,
        page: total > 1 ? { index: i + 1, total } : undefined,
      };
    });
  }, [deck, config.cardTheme, carouselFormat, buildDataLead]);

  const selectedIndex = Math.max(
    0,
    deck.findIndex((s) => s.id === selectedId),
  );
  const selected = deck[selectedIndex];
  const selectedPage = deckPages[selectedIndex];
  const atCap = deck.length >= IG_CAROUSEL_MAX;
  // A data slide (leaderboard / AOTW / monthly recap) carries real-vs-sample numbers; a
  // marketing slide (quote/tip/cta/custom) does not. So sample mode only blocks posting when the
  // deck CONTAINS a data slide — an all-marketing carousel is always safe to post. This is sound
  // because deckPages re-derives data slides from the LIVE isSample, so when isSample is true the
  // rendered/exported data slides genuinely hold sample numbers (and real ones when it's false).
  const deckHasData = deck.some((s) => s.data.kind !== "marketing");
  const sampleBlocksPost = isSample && deckHasData;

  function addSlide(data: PreviewData, view?: SocialView) {
    if (atCap) {
      toast.message(`Carousels are capped at ${IG_CAROUSEL_MAX} slides.`);
      return;
    }
    const id = crypto.randomUUID();
    setDeck((d) => [...d, { id, data, view }]);
    setSelectedId(id);
  }

  function addData(view: SocialView) {
    const lead = buildDataLead(view, carouselFormat, config.cardTheme);
    if (lead) addSlide(lead, view);
  }

  // An empty deck + sample data used to show a blank preview — the "Preview with sample
  // data" toggle only re-derives EXISTING data slides, it never created one. Seed ONE
  // sample leaderboard slide the first time we're in sample mode with an empty deck so the
  // preview always shows something. Ref-guarded so deleting the seeded slide doesn't
  // re-add it (respects an intentional clear), gated on !isLoading so it never fires during
  // the data-load flash. Covers forced sample (0 producers), auto-sample (thin agency), and
  // toggling sample on after entering the builder.
  const autoSeededRef = useRef(false);
  useEffect(() => {
    if (autoSeededRef.current || isLoading || !isSample || deck.length > 0)
      return;
    const lead = buildDataLead("daily", carouselFormat, config.cardTheme);
    if (!lead) return;
    autoSeededRef.current = true;
    const id = crypto.randomUUID();
    setDeck([{ id, data: lead, view: "daily" }]);
    setSelectedId(id);
  }, [
    isSample,
    isLoading,
    deck.length,
    buildDataLead,
    carouselFormat,
    config.cardTheme,
  ]);

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
          eyebrow: d.eyebrow,
          text: d.text,
          attribution: d.attribution,
          headline: d.headline,
          subheadline: d.subheadline,
          body: d.body,
          items: d.items,
          bullets: d.bullets,
          stat: d.stat,
          statLabel: d.statLabel,
          compare: d.compare,
          ctaAction: d.ctaAction,
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
        format: carouselFormat,
        cardTheme: config.cardTheme,
      },
      { onSuccess: () => setDeckName("") },
    );
  }

  // Map one persisted/composed slide spec to a live DeckSlide: data slides re-derive from
  // current metrics (null when a metric is unavailable so the caller can report it); marketing
  // slides snapshot their copy. Shared by handleLoadDeck + buildWithAI (review #15).
  function specToDeckSlide(
    spec: DeckSlideSpec,
    fmt: SocialFormat,
    theme: CardTheme,
  ): DeckSlide | null {
    if (spec.t === "data") {
      const lead = buildDataLead(spec.view, fmt, theme);
      return lead
        ? { id: crypto.randomUUID(), data: lead, view: spec.view }
        : null;
    }
    return {
      id: crypto.randomUUID(),
      data: {
        kind: "marketing",
        variant: spec.variant,
        theme,
        eyebrow: spec.eyebrow,
        text: spec.text,
        attribution: spec.attribution,
        headline: spec.headline,
        subheadline: spec.subheadline,
        body: spec.body,
        items: spec.items,
        bullets: spec.bullets,
        stat: spec.stat,
        statLabel: spec.statLabel,
        compare: spec.compare,
        ctaAction: spec.ctaAction,
        imageDataUrl: spec.imageDataUrl,
      },
    };
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
        // A data slide whose live metric is unavailable can't be rebuilt; it's counted and
        // reported below, not silently dropped (review #3/#10).
        const slide = specToDeckSlide(spec, fmt, theme);
        if (slide) next.push(slide);
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
    const base = { kind: "marketing" as const, variant, theme };
    let data: PreviewData;
    switch (variant) {
      case "quote":
        data = { ...base, text: "", attribution: "" };
        break;
      case "hook":
        data = { ...base, eyebrow: "", headline: "", subheadline: "" };
        break;
      case "list":
        data = {
          ...base,
          headline: "",
          items: [{ label: "" }, { label: "" }, { label: "" }],
        };
        break;
      case "checklist":
        data = { ...base, headline: "", bullets: ["", "", ""] };
        break;
      case "stat":
        data = { ...base, stat: "", statLabel: "", body: "" };
        break;
      case "compare":
        data = {
          ...base,
          headline: "",
          compare: {
            left: { title: "Most agencies", items: ["", ""] },
            right: { title: "Us", items: ["", ""] },
          },
        };
        break;
      case "custom":
        data = { ...base, headline: "", body: "", imageDataUrl: undefined };
        break;
      case "cta":
        data = {
          ...base,
          headline: "Join our team",
          body: "We're growing — DM us to learn about a career here.",
          ctaAction: "DM us to apply",
        };
        break;
      default:
        data = { ...base, headline: "", body: "" };
    }
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
    patch: Partial<Omit<Extract<PreviewData, { kind: "marketing" }>, "kind">>,
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

  // ── Build the whole deck with AI (Phase 3C) ─────────────────────────────────
  // One idea → an ordered set of marketing slides (copy written by AI) + an optional
  // data slide or two (the AI picks the VIEW; we fill the real numbers via buildDataLead,
  // so no metric is ever fabricated) + the caption. Maps onto the SAME deck state the
  // builder + loadDeck already use.
  async function buildWithAI() {
    if (composingRef.current || captioningRef.current) return;
    const idea = aiIdea.trim();
    if (!idea) {
      toast.error("Tell the AI what the carousel is about.");
      return;
    }
    // A build replaces the whole post (slides AND caption), so say so before clobbering a
    // hand-written caption (review #6).
    if (
      deck.length > 0 &&
      !window.confirm(
        "Replace the current slides and caption with an AI-built carousel?",
      )
    ) {
      return;
    }
    const requested = clampSlideCount(aiCount); // review #8 — "" / out-of-range → safe count
    // Only offer the AI views that actually have live data right now, so it doesn't pick
    // an empty leaderboard/AOTW slide that we'd then have to drop.
    const availableViews = aiDataSlides
      ? DATA_VIEWS.map((d) => d.view).filter(
          (view) => !!buildDataLead(view, carouselFormat, config.cardTheme),
        )
      : [];
    composingRef.current = true;
    setComposing(true);
    try {
      const result = await runCompose({
        idea,
        slideCount: requested,
        agencyName,
        network,
        allowRealAttribution: aiRealQuotes,
        allowDataSlides: aiDataSlides,
        availableViews,
        framework: aiFramework,
        facts: buildFacts(),
      });
      const next: DeckSlide[] = [];
      for (const spec of result.slides) {
        const slide = specToDeckSlide(spec, carouselFormat, config.cardTheme);
        if (slide) next.push(slide);
      }
      const capped = next.slice(0, IG_CAROUSEL_MAX);
      if (capped.length < 2) {
        toast.error(
          "The AI couldn't build a full carousel. Try a clearer idea.",
        );
        return;
      }
      setDeck(capped);
      setSelectedId(capped[0]?.id ?? null);
      setAiDialogOpen(false);
      // The build owns the whole post: install its caption (or clear + warn if none came back,
      // rather than silently keeping the previous deck's caption — review #5).
      setCaption(result.caption);
      if (!result.caption.trim())
        toast.warning(
          "No caption came back — add one or hit Generate caption.",
        );

      // Surface a shortfall: fewer slides than requested, and why (review #9).
      const shortfall = requested - capped.length;
      const droppedData = result.slides.length - next.length;
      if (shortfall > 0) {
        toast.warning(
          `Built ${capped.length} of ${requested} slides` +
            (droppedData > 0
              ? ` (${droppedData} needed live metrics that aren't available yet)`
              : "") +
            ". Regenerate or add slides.",
        );
      } else {
        toast.success(`Built a ${capped.length}-slide carousel.`);
      }
      if (
        capped.some(
          (s) =>
            s.data.kind === "marketing" &&
            s.data.variant === "quote" &&
            s.data.attribution?.trim(),
        )
      ) {
        toast.warning("Double-check each quote's attribution before posting.");
      }
    } catch (e) {
      console.error("Carousel compose failed:", e);
      toast.error(aiErrorMessage(e, "carousel"));
    } finally {
      composingRef.current = false;
      setComposing(false);
    }
  }

  // Refine the rough idea into a sharper creative brief BEFORE building. Seeds the idea
  // field (still fully editable) so the user can review/tweak it, then Generate.
  async function handleEnhance() {
    if (enhancingRef.current || composingRef.current) return;
    const idea = aiIdea.trim();
    if (!idea) {
      toast.error("Type a rough idea first.");
      return;
    }
    enhancingRef.current = true;
    setEnhancing(true);
    try {
      const enhanced = await runEnhance({
        idea,
        agencyName,
        network,
        facts: buildFacts(),
      });
      setAiIdea(enhanced);
      toast.success("Sharpened your idea — tweak it or generate.");
    } catch (e) {
      console.error("Idea enhance failed:", e);
      toast.error(aiErrorMessage(e, "carousel"));
    } finally {
      enhancingRef.current = false;
      setEnhancing(false);
    }
  }

  // The per-slide caption payload for the CURRENT deck (pure — no state writes). Shared by
  // the manual "Generate caption" button and the auto-draft-on-publish path so both feed
  // the edge fn the same representative line per archetype.
  function buildCaptionSlides() {
    return deck.map((s) => {
      if (s.data.kind === "marketing") {
        const d = s.data;
        // Give the caption writer a representative line for EVERY archetype (a stat /
        // list / compare slide has no headline+body, so fall back to its own fields).
        return {
          variant: d.variant,
          headline: d.headline || d.stat || d.compare?.left.title || undefined,
          text: d.text,
          body:
            d.body ||
            d.subheadline ||
            d.items?.[0]?.label ||
            d.bullets?.[0] ||
            undefined,
        };
      }
      return { view: s.view ?? config.view };
    });
  }

  // Auto-draft belt (caption parity for Post Now + Schedule): never publish/schedule a
  // carousel with an empty caption box — draft one from the deck (when AI is enabled and
  // it isn't a sample) and reflect it in the editor. Generation must NEVER block the
  // post — on any failure we publish with whatever's there.
  async function resolveCaption(): Promise<string> {
    if (caption.trim()) return caption;
    if (!hasAiAccess || sampleBlocksPost) return caption;
    try {
      // Cap at Instagram's 2200-char limit — the publish edge fn and the carousel
      // schedule RPC both reject an overlong caption, so an unbounded AI draft would
      // fail the post. An empty AI result stays "no caption" (don't store "").
      const drafted = (
        await runCaption({
          agencyName,
          network,
          slides: buildCaptionSlides(),
        })
      ).slice(0, 2200);
      if (drafted) setCaption(drafted);
      return drafted;
    } catch (e) {
      console.error("Auto-caption on publish failed:", e);
      return caption;
    }
  }

  // Write a deck-aware caption from the CURRENT slides (works on any deck, AI-built or not).
  async function buildCaption() {
    // Ref guard (not state) so a fast double-click can't double-fire before the re-render —
    // matches buildWithAI / postAll / scheduleAll (review #7).
    if (captioningRef.current || composingRef.current) return;
    if (deck.length === 0) {
      toast.error("Add slides first.");
      return;
    }
    captioningRef.current = true;
    setCaptioning(true);
    try {
      const caption = await runCaption({
        agencyName,
        network,
        slides: buildCaptionSlides(),
      });
      setCaption(caption);
      toast.success("Caption written — edit it to taste.");
    } catch (e) {
      console.error("Caption generation failed:", e);
      toast.error(aiErrorMessage(e, "caption"));
    } finally {
      captioningRef.current = false;
      setCaptioning(false);
    }
  }

  async function postAll() {
    if (postingRef.current) return;
    if (sampleBlocksPost) {
      toast.error("Switch off sample data to post your real numbers.");
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
      // Never let a carousel post go out captionless — auto-draft if the box is empty.
      const cap = await resolveCaption();
      const { username } = await publishToInstagram(urls, cap, {
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
    if (sampleBlocksPost) {
      toast.error("Switch off sample data to schedule your real numbers.");
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
      // Never schedule a captionless carousel — auto-draft if the box is empty.
      const cap = await resolveCaption();
      await scheduleCarouselMut.mutateAsync({
        postId: crypto.randomUUID(),
        integrationId: selectedIntegration?.id ?? null,
        dataUrls: capped,
        caption: cap,
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
  const { w: natW, h: natH } = FORMAT_DIMS[carouselFormat];
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
                      format={carouselFormat}
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
            <div className="w-full space-y-1">
              {hasAiAccess && (
                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={buildCaption}
                    disabled={captioning || composing || deck.length === 0}
                    title="Write a caption from these slides with AI"
                  >
                    {captioning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {captioning ? "Writing…" : "Generate caption"}
                  </Button>
                </div>
              )}
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption for the carousel (optional)…"
                rows={2}
                className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </div>
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
                  sampleBlocksPost ||
                  posting ||
                  composing ||
                  captioning ||
                  !igConnected ||
                  deck.length < 2
                }
                title={
                  sampleBlocksPost
                    ? "This deck has live-metric slides — switch off sample data to post"
                    : composing || captioning
                      ? "Wait for the AI to finish before posting"
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
                min={toLocalInputValue(new Date())}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                title="Pick a future date and time to auto-post this carousel"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={scheduleAll}
                disabled={
                  sampleBlocksPost ||
                  scheduling ||
                  composing ||
                  captioning ||
                  !igConnected ||
                  deck.length < 2 ||
                  !scheduledFor
                }
                title={
                  sampleBlocksPost
                    ? "This deck has live-metric slides — switch off sample data to schedule"
                    : composing || captioning
                      ? "Wait for the AI to finish before scheduling"
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
        {/* Style & posting controls — carousel mode hides the single-card SocialCustomizer,
            so the brand theme, shape, account picker, and the sample-data toggle live here
            (otherwise they're unreachable while building a carousel). */}
        <div className="space-y-2.5 rounded-xl border border-border bg-card/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Style &amp; posting
          </p>
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Theme</span>
            <PillNav
              size="sm"
              activeValue={config.cardTheme}
              onChange={(v) =>
                onConfigChange({
                  cardTheme: v as SocialStudioConfig["cardTheme"],
                  aowBackground: null,
                  aowBgImageUrl: null,
                })
              }
              items={CARD_THEMES.map((th) => ({
                label: CARD_THEME_LABEL[th],
                value: th,
              }))}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Shape</span>
            <PillNav
              size="sm"
              activeValue={carouselFormat}
              onChange={(v) =>
                // Reset postType to "post" too — a carousel is a feed post, never a story, so
                // never leave the config in an inconsistent {postType:"story", format:"portrait"}.
                onConfigChange({
                  format: v as SocialStudioConfig["format"],
                  postType: "post",
                })
              }
              items={[
                { label: "Portrait 4:5", value: "portrait" },
                { label: "Square 1:1", value: "square" },
              ]}
            />
          </div>
          {connectedIntegrations.length > 1 && (
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">
                Post from
              </span>
              <select
                value={selectedIntegration?.id ?? ""}
                onChange={(e) => onSelectIntegration(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                title="Which Instagram account to post from"
                aria-label="Instagram account to post from"
              >
                {connectedIntegrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    @{i.instagram_username}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label
            className="flex items-center gap-2 text-xs text-muted-foreground"
            title={
              sampleForced
                ? "No live data yet — sample shows until your agency has producers"
                : "Fill the data slides with sample numbers while production is thin"
            }
          >
            <input
              type="checkbox"
              checked={isSample}
              disabled={sampleForced}
              onChange={(e) => onSampleChange(e.target.checked)}
            />
            Preview with sample data
            {sampleForced && (
              <span className="text-[10px]">(no live data yet)</span>
            )}
          </label>
        </div>
        {/* Build the whole carousel from one idea (Phase 3C) — opens a roomy composer dialog
            with an AI "enhance" pass; gated on the AI entitlement. */}
        {hasAiAccess && (
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Build with AI
            </p>
            <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
              Describe your idea and AI designs a full, varied carousel — a
              scroll-stopping hook, value slides, and a strong call to action.
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={() => setAiDialogOpen(true)}
              disabled={composing}
            >
              <Sparkles className="h-3.5 w-3.5" /> Build a carousel with AI
            </Button>
          </div>
        )}

        {/* AI composer dialog — roomy idea field + enhance pass + framework / options. */}
        <Dialog
          open={aiDialogOpen}
          onOpenChange={(o) => {
            if (composing || enhancing) return;
            setAiDialogOpen(o);
          }}
        >
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" /> Build a carousel
                with AI
              </DialogTitle>
              <DialogDescription>
                Describe what you want. AI plans the arc, varies the layouts,
                and writes the copy.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Your idea
                </label>
                <textarea
                  value={aiIdea}
                  onChange={(e) => setAiIdea(e.target.value)}
                  placeholder="e.g. Why experienced agents are switching to our agency — the lifestyle, the inbound leads, and the income upside."
                  rows={6}
                  disabled={composing || enhancing}
                  className="min-h-[150px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEnhance}
                    disabled={enhancing || composing || !aiIdea.trim()}
                    title="Let AI sharpen your idea into a stronger brief before building"
                  >
                    {enhancing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {enhancing ? "Enhancing…" : "Enhance with AI"}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Sharpens a rough idea before building.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-foreground">
                  Framework
                  <select
                    value={aiFramework}
                    onChange={(e) =>
                      setAiFramework(e.target.value as CarouselFramework)
                    }
                    disabled={composing || enhancing}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                  >
                    {FRAMEWORK_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  Slides
                  <input
                    type="number"
                    min={2}
                    max={IG_CAROUSEL_MAX}
                    value={aiCount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return setAiCount("");
                      const n = Number(v);
                      if (Number.isInteger(n))
                        setAiCount(Math.min(IG_CAROUSEL_MAX, Math.max(0, n)));
                    }}
                    onBlur={() => setAiCount(clampSlideCount(aiCount))}
                    disabled={composing || enhancing}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={aiRealQuotes}
                    onChange={(e) => setAiRealQuotes(e.target.checked)}
                    disabled={composing || enhancing}
                  />
                  Real attributed quotes (verify names before posting)
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={aiDataSlides}
                    onChange={(e) => setAiDataSlides(e.target.checked)}
                    disabled={composing || enhancing}
                  />
                  Let AI add leaderboard / Agent-of-Week slides
                </label>
                {factsAvailable ? (
                  <p className="flex items-start gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-500">
                    <span aria-hidden>✓</span>
                    AI will weave in your agency's real numbers for this period
                    (it never invents figures).
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    No live numbers yet — AI keeps the copy qualitative (no
                    invented figures).
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAiDialogOpen(false)}
                disabled={composing || enhancing}
              >
                Cancel
              </Button>
              <Button
                onClick={buildWithAI}
                disabled={composing || enhancing || !aiIdea.trim()}
                title="Let AI build the whole carousel from your idea"
              >
                {composing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {composing ? "Building…" : "Generate carousel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
        format={carouselFormat}
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
  onPatch: (
    p: Partial<Omit<Extract<PreviewData, { kind: "marketing" }>, "kind">>,
  ) => void;
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
  const caps = MARKETING_COPY_CAPS;
  const listCaps = MARKETING_LIST_CAPS;
  const [topic, setTopic] = useState("");
  const [drafting, setDrafting] = useState(false);
  // The single-slide AI drafter only supports the legacy copy variants.
  const canDraft = hasAiAccess && isLegacyCopyVariant(data.variant);

  // "Draft with AI" only SEEDS the copy fields — they stay fully editable after. For a quote
  // we ask for a real attributed line (allowRealAttribution) and seed the text; we only seed
  // the attribution when the AI actually returned one, so a re-draft never wipes a name the
  // user typed themselves (review #4). The inline note reminds them to verify it.
  async function draft() {
    if (drafting || !isLegacyCopyVariant(data.variant)) return;
    setDrafting(true);
    try {
      const result = await draftMarketingCopy({
        variant: data.variant,
        topic: topic.trim() || undefined,
        agencyName,
        network,
        allowRealAttribution: data.variant === "quote" ? true : undefined,
      });
      if (data.variant === "quote") {
        onPatch({
          text: result.text ?? "",
          ...(result.attribution?.trim()
            ? { attribution: result.attribution }
            : {}),
        });
      } else {
        onPatch({ headline: result.headline ?? "", body: result.body ?? "" });
      }
      toast.success("Drafted with AI — edit it to taste.");
    } catch (e) {
      console.error("Marketing copy draft failed:", e);
      toast.error(aiErrorMessage(e, "copy"));
    } finally {
      setDrafting(false);
    }
  }

  // ── Array-field helpers (immutable patches) ──
  const items = data.items ?? [];
  const bullets = data.bullets ?? [];
  const compare = data.compare ?? {
    left: { title: "", items: [] },
    right: { title: "", items: [] },
  };
  const patchCol = (
    side: "left" | "right",
    patch: Partial<{ title: string; items: string[] }>,
  ) =>
    onPatch({
      compare: { ...compare, [side]: { ...compare[side], ...patch } },
    });

  const imageUpload = (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
      <ImagePlus className="h-4 w-4" />
      {data.imageDataUrl ? "Change background photo" : "Add background photo"}
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
  );

  const headlineInput = (placeholder: string) => (
    <input
      className={input}
      maxLength={caps.headline}
      placeholder={placeholder}
      value={data.headline ?? ""}
      onChange={(e) => onPatch({ headline: e.target.value })}
    />
  );

  let fields: React.ReactNode = null;
  if (data.variant === "quote") {
    fields = (
      <>
        <textarea
          className={`${input} resize-none`}
          rows={3}
          maxLength={caps.text}
          placeholder="Quote text…"
          value={data.text ?? ""}
          onChange={(e) => onPatch({ text: e.target.value })}
        />
        <input
          className={input}
          maxLength={caps.attribution}
          placeholder="Attribution (optional)"
          value={data.attribution ?? ""}
          onChange={(e) => onPatch({ attribution: e.target.value })}
        />
        {data.attribution?.trim() && (
          <p className="text-[11px] text-amber-600 dark:text-amber-500">
            Verify this attribution before posting.
          </p>
        )}
      </>
    );
  } else if (data.variant === "hook") {
    fields = (
      <>
        <input
          className={input}
          maxLength={caps.eyebrow}
          placeholder="Eyebrow / kicker (optional)"
          value={data.eyebrow ?? ""}
          onChange={(e) => onPatch({ eyebrow: e.target.value })}
        />
        {headlineInput("Headline — the scroll-stopper")}
        <textarea
          className={`${input} resize-none`}
          rows={2}
          maxLength={caps.subheadline}
          placeholder="Subheadline (optional)"
          value={data.subheadline ?? ""}
          onChange={(e) => onPatch({ subheadline: e.target.value })}
        />
        {imageUpload}
      </>
    );
  } else if (data.variant === "list") {
    fields = (
      <>
        {headlineInput("Headline — the promise")}
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div
              key={i}
              className="rounded-md border border-border/60 bg-background/60 p-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-accent">
                  {i + 1}.
                </span>
                <input
                  className={`${input} flex-1`}
                  maxLength={caps.itemLabel}
                  placeholder="Step (verb-led, e.g. Audit your lead sources)"
                  value={it.label}
                  onChange={(e) =>
                    onPatch({
                      items: items.map((x, idx) =>
                        idx === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  className="text-destructive/80 hover:text-destructive disabled:opacity-30"
                  disabled={items.length <= 1}
                  onClick={() =>
                    onPatch({ items: items.filter((_, idx) => idx !== i) })
                  }
                  title="Remove step"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                className={`${input} mt-1`}
                maxLength={caps.itemDetail}
                placeholder="Detail (optional)"
                value={it.detail ?? ""}
                onChange={(e) =>
                  onPatch({
                    items: items.map((x, idx) =>
                      idx === i ? { ...x, detail: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={items.length >= listCaps.items}
          onClick={() => onPatch({ items: [...items, { label: "" }] })}
        >
          <Plus className="h-3 w-3" /> Add step
        </Button>
      </>
    );
  } else if (data.variant === "checklist") {
    fields = (
      <>
        {headlineInput("Headline — the promise")}
        <div className="space-y-1.5">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-accent">✓</span>
              <input
                className={`${input} flex-1`}
                maxLength={caps.bullet}
                placeholder="Benefit / point"
                value={b}
                onChange={(e) =>
                  onPatch({
                    bullets: bullets.map((x, idx) =>
                      idx === i ? e.target.value : x,
                    ),
                  })
                }
              />
              <button
                className="text-destructive/80 hover:text-destructive disabled:opacity-30"
                disabled={bullets.length <= 1}
                onClick={() =>
                  onPatch({ bullets: bullets.filter((_, idx) => idx !== i) })
                }
                title="Remove line"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={bullets.length >= listCaps.bullets}
          onClick={() => onPatch({ bullets: [...bullets, ""] })}
        >
          <Plus className="h-3 w-3" /> Add line
        </Button>
      </>
    );
  } else if (data.variant === "stat") {
    fields = (
      <>
        <input
          className={input}
          maxLength={caps.stat}
          placeholder="Big number (e.g. $1.2M, 65%, 340)"
          value={data.stat ?? ""}
          onChange={(e) => onPatch({ stat: e.target.value })}
        />
        <input
          className={input}
          maxLength={caps.statLabel}
          placeholder="What it measures (e.g. in new annual premium)"
          value={data.statLabel ?? ""}
          onChange={(e) => onPatch({ statLabel: e.target.value })}
        />
        <textarea
          className={`${input} resize-none`}
          rows={2}
          maxLength={caps.body}
          placeholder="Context (optional)"
          value={data.body ?? ""}
          onChange={(e) => onPatch({ body: e.target.value })}
        />
      </>
    );
  } else if (data.variant === "compare") {
    const colEditor = (side: "left" | "right", label: string) => {
      const col = compare[side];
      return (
        <div className="space-y-1.5 rounded-md border border-border/60 bg-background/60 p-1.5">
          <input
            className={input}
            maxLength={caps.compareTitle}
            placeholder={label}
            value={col.title}
            onChange={(e) => patchCol(side, { title: e.target.value })}
          />
          {col.items.map((it, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className={`${input} flex-1`}
                maxLength={caps.compareItem}
                placeholder="Line"
                value={it}
                onChange={(e) =>
                  patchCol(side, {
                    items: col.items.map((x, idx) =>
                      idx === i ? e.target.value : x,
                    ),
                  })
                }
              />
              <button
                className="text-destructive/80 hover:text-destructive disabled:opacity-30"
                disabled={col.items.length <= 1}
                onClick={() =>
                  patchCol(side, {
                    items: col.items.filter((_, idx) => idx !== i),
                  })
                }
                title="Remove line"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={col.items.length >= listCaps.compareItems}
            onClick={() => patchCol(side, { items: [...col.items, ""] })}
          >
            <Plus className="h-3 w-3" /> Add line
          </Button>
        </div>
      );
    };
    fields = (
      <>
        {headlineInput("Headline — the contrast")}
        <div className="grid grid-cols-2 gap-1.5">
          {colEditor("left", "Left title (e.g. Most agencies)")}
          {colEditor("right", "Right title (e.g. Us)")}
        </div>
      </>
    );
  } else {
    // tip | cta | custom
    fields = (
      <>
        {headlineInput("Headline")}
        <textarea
          className={`${input} resize-none`}
          rows={3}
          maxLength={caps.body}
          placeholder="Body text…"
          value={data.body ?? ""}
          onChange={(e) => onPatch({ body: e.target.value })}
        />
        {data.variant === "cta" && (
          <input
            className={input}
            maxLength={caps.ctaAction}
            placeholder="Action chip (e.g. Comment APPLY, DM us to apply)"
            value={data.ctaAction ?? ""}
            onChange={(e) => onPatch({ ctaAction: e.target.value })}
          />
        )}
        {data.variant === "custom" && imageUpload}
      </>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border border-border bg-secondary/30 p-2">
      {fields}

      {/* Draft with AI — seeds the copy fields for the simple quote/tip/cta/custom slides. */}
      {canDraft && (
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
