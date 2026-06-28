// src/services/social-studio/socialDeckService.ts
// CRUD for owner-saved Social Studio carousel decks (#8 Phase 3A). Plain object service,
// throw-on-error, RLS-enforced — mirrors socialTemplateService.
//
// A deck stores a VERSIONED ordered slide spec, not rendered numbers:
//   - data slides keep only { t:"data", view } and are re-derived from LIVE metrics on
//     load (the component rebuilds them with buildPreviewPages + current producers);
//   - marketing slides are static copy. Their user-supplied photo is NOT inlined as a
//     base64 data URL anymore (review #7): saveDeck uploads it to Storage and persists a
//     small `imageUrl`; loadDeck re-hydrates it back into a CORS-proof data URL for the
//     render/export. Decks saved the old way (with `imageDataUrl` inline) still load.
// The spec<->PreviewData conversion lives in CarouselBuilder (it needs config/producers).
// listDecks() deliberately omits `slides` so the list view never drags every deck's blob.

import { supabase } from "../base/supabase";
import { uploadDeckImage, removeDeckImages } from "./spotlightAssetService";
import type { Json } from "@/types/database.types";
import type { SocialView } from "@/features/social-studio/types";
import type {
  MarketingVariant,
  SlideListItem,
  SlideCompare,
} from "@/features/social-cards";

/** One serialized slide. Data slides re-derive on load; marketing slides snapshot copy. */
export type DeckSlideSpec =
  | { t: "data"; view: SocialView }
  | {
      t: "marketing";
      variant: MarketingVariant;
      // ── shared copy ──
      eyebrow?: string;
      text?: string;
      attribution?: string;
      headline?: string;
      subheadline?: string;
      body?: string;
      /** numbered-list rows */
      items?: SlideListItem[];
      /** checklist lines */
      bullets?: string[];
      /** big-stat hero value + caption */
      stat?: string;
      statLabel?: string;
      /** two-column compare */
      compare?: SlideCompare;
      /** closing-slide action chip label */
      ctaAction?: string;
      /** Persisted Storage URL for the slide photo (review #7). */
      imageUrl?: string;
      /** Legacy inline base64 (old decks) / the rehydrated render source on load. */
      imageDataUrl?: string;
    };

/** Every marketing variant the deck validator accepts (richer archetypes + legacy keys). */
const MARKETING_VARIANTS: readonly MarketingVariant[] = [
  "hook",
  "list",
  "checklist",
  "stat",
  "compare",
  "quote",
  "tip",
  "cta",
  "custom",
];

/** Versioned deck payload stored in `slides` jsonb (v marker → format can evolve). */
export interface DeckSpec {
  v: 1;
  slides: DeckSlideSpec[];
}

/** Lightweight row for the deck list (no `slides` blob). */
export interface DeckSummary {
  id: string;
  name: string;
  format: string;
  card_theme: string;
  created_at: string;
}

/** A loaded deck: the spec plus the deck-level theme/format to restore on load. */
export interface LoadedDeck {
  id: string;
  name: string;
  format: string;
  card_theme: string;
  spec: DeckSpec;
}

export interface SaveDeckInput {
  name: string;
  /** Tenant for the row — the studio's current IMO (useImo().imo.id). */
  imoId: string;
  spec: DeckSpec;
  format: string;
  cardTheme: string;
}

const TABLE = "social_carousel_decks";

/**
 * Structurally validate a persisted deck spec (review #3) — the raw jsonb was previously
 * cast straight to DeckSpec, so a corrupt or future-versioned blob caused silent undefined
 * access downstream (dropped slides, blank/crashing marketing cards). Throw a clear,
 * user-facing error instead of loading garbage.
 */
function validateDeckSpec(raw: unknown): DeckSpec {
  if (!raw || typeof raw !== "object") {
    throw new Error("This deck is empty or corrupted and can't be opened.");
  }
  const spec = raw as { v?: unknown; slides?: unknown };
  if (spec.v !== 1) {
    throw new Error(
      "This deck was saved in an unsupported format and can't be opened here.",
    );
  }
  if (!Array.isArray(spec.slides)) {
    throw new Error("This deck is corrupted (no slides) and can't be opened.");
  }
  for (const s of spec.slides) {
    const slide = s as { t?: unknown; view?: unknown; variant?: unknown };
    if (slide?.t === "data") {
      if (typeof slide.view !== "string") {
        throw new Error(
          "This deck has a corrupted data slide and can't be opened.",
        );
      }
    } else if (slide?.t === "marketing") {
      if (
        typeof slide.variant !== "string" ||
        !(MARKETING_VARIANTS as readonly string[]).includes(slide.variant)
      ) {
        throw new Error(
          "This deck has an unsupported marketing slide and can't be opened.",
        );
      }
    } else {
      throw new Error(
        "This deck has an unrecognized slide and can't be opened.",
      );
    }
  }
  return spec as unknown as DeckSpec;
}

/** Fetch a (public Storage) URL and return it as a CORS-proof data: URL for the render. */
async function urlToDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export const socialDeckService = {
  /** The current owner's saved decks, newest first — names/meta only (no slides blob). */
  async listDecks(): Promise<DeckSummary[]> {
    // RLS already scopes rows to the calling owner, so no auth round-trip / owner_id filter
    // is needed here (review #13).
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, name, format, card_theme, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DeckSummary[];
  },

  /** Load one deck's full spec (only fetched when the user opens it). */
  async loadDeck(id: string): Promise<LoadedDeck> {
    // RLS scopes to the owner (review #13: dropped the redundant getUser + owner_id filter).
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, name, format, card_theme, slides")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!data) throw new Error("Deck not found.");

    const spec = validateDeckSpec(data.slides);

    // Re-hydrate any Storage-backed marketing image into a CORS-proof data URL for the
    // render/export. Old decks already carry an inline imageDataUrl and are left as-is.
    const slides = await Promise.all(
      spec.slides.map(async (s) => {
        if (s.t === "marketing" && s.imageUrl && !s.imageDataUrl) {
          try {
            return { ...s, imageDataUrl: await urlToDataUrl(s.imageUrl) };
          } catch {
            return s; // image fetch failed — the slide still loads, just without the photo
          }
        }
        return s;
      }),
    );

    return {
      id: data.id,
      name: data.name,
      format: data.format,
      card_theme: data.card_theme,
      spec: { v: 1, slides },
    };
  },

  async saveDeck(input: SaveDeckInput): Promise<DeckSummary> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    // Pre-generate the row id so marketing images can be stored under {uid}/decks/{deckId}/
    // BEFORE the row exists, then persist a small URL instead of inline base64 (review #7).
    const deckId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;

    try {
      // Upload marketing photos to Storage INSIDE the try so a mid-batch upload failure is
      // swept by the catch's removeDeckImages rather than orphaning a world-readable PNG
      // (review #7 — mirrors scheduleCarousel's upload-inside-try hardening).
      const slides: DeckSlideSpec[] = await Promise.all(
        input.spec.slides.map(async (s, i) => {
          if (
            deckId &&
            s.t === "marketing" &&
            s.imageDataUrl?.startsWith("data:")
          ) {
            const imageUrl = await uploadDeckImage(deckId, i, s.imageDataUrl);
            // Persist only the URL; imageDataUrl:undefined is dropped by JSON serialization,
            // so the base64 never lands in the row's jsonb.
            return { ...s, imageUrl, imageDataUrl: undefined };
          }
          return s;
        }),
      );

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          ...(deckId ? { id: deckId } : {}),
          owner_id: user.id,
          imo_id: input.imoId,
          name: input.name,
          slides: { v: 1, slides } as unknown as Json,
          format: input.format,
          card_theme: input.cardTheme,
        })
        .select("id, name, format, card_theme, created_at")
        .single();
      if (error) throw error;
      return data as DeckSummary;
    } catch (e) {
      if (deckId) await removeDeckImages(deckId).catch(() => {});
      throw e;
    }
  },

  async deleteDeck(id: string): Promise<void> {
    // .select() the affected rows: PostgREST returns error:null for a 0-row delete
    // (RLS-blocked or stale id), which would surface as a false "Deck deleted."
    // RLS scopes the delete to the owner (review #13: dropped the redundant owner_id filter).
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Deck not found or already deleted.");
    }
    // GC the deck's stored slide images (review #7). Best-effort.
    await removeDeckImages(id).catch(() => {});
  },
};
