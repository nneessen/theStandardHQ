// src/services/social-studio/socialDeckService.ts
// CRUD for owner-saved Social Studio carousel decks (#8 Phase 3A). Plain object service,
// throw-on-error, RLS-enforced — mirrors socialTemplateService.
//
// A deck stores a VERSIONED ordered slide spec, not rendered numbers:
//   - data slides keep only { t:"data", view } and are re-derived from LIVE metrics on
//     load (the component rebuilds them with buildPreviewPages + current producers);
//   - marketing slides are static copy, so their content (incl. a user-supplied image
//     data URL) is snapshotted verbatim.
// The spec<->PreviewData conversion lives in CarouselBuilder (it needs config/producers).
// listDecks() deliberately omits `slides` so the list view never drags every deck's
// (potentially multi-MB, image-bearing) blob just to render names.

import { supabase } from "../base/supabase";
import type { Database, Json } from "@/types/database.types";
import type { SocialView } from "@/features/social-studio/types";
import type { MarketingVariant } from "@/features/social-cards";

type DeckRow = Database["public"]["Tables"]["social_carousel_decks"]["Row"];

/** One serialized slide. Data slides re-derive on load; marketing slides snapshot. */
export type DeckSlideSpec =
  | { t: "data"; view: SocialView }
  | {
      t: "marketing";
      variant: MarketingVariant;
      text?: string;
      attribution?: string;
      headline?: string;
      body?: string;
      imageDataUrl?: string;
    };

/** Versioned deck payload stored in `slides` jsonb (v marker → format can evolve). */
export interface DeckSpec {
  v: 1;
  slides: DeckSlideSpec[];
}

/** Lightweight row for the deck list (no `slides` blob). */
export type DeckSummary = Pick<
  DeckRow,
  "id" | "name" | "format" | "card_theme" | "created_at"
>;

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

export const socialDeckService = {
  /** The current owner's saved decks, newest first — names/meta only (no slides blob). */
  async listDecks(): Promise<DeckSummary[]> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from(TABLE)
      .select("id, name, format, card_theme, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DeckSummary[];
  },

  /** Load one deck's full spec (only fetched when the user opens it). */
  async loadDeck(id: string): Promise<LoadedDeck> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from(TABLE)
      .select("id, name, format, card_theme, slides")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (error) throw error;
    if (!data) throw new Error("Deck not found.");
    return {
      id: data.id,
      name: data.name,
      format: data.format,
      card_theme: data.card_theme,
      spec: data.slides as unknown as DeckSpec,
    };
  },

  async saveDeck(input: SaveDeckInput): Promise<DeckSummary> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        owner_id: user.id,
        imo_id: input.imoId,
        name: input.name,
        slides: input.spec as unknown as Json,
        format: input.format,
        card_theme: input.cardTheme,
      })
      .select("id, name, format, card_theme, created_at")
      .single();
    if (error) throw error;
    return data as DeckSummary;
  },

  async deleteDeck(id: string): Promise<void> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user?.id) throw new Error("Not authenticated");

    // .select() the affected rows: PostgREST returns error:null for a 0-row delete
    // (RLS-blocked or stale id), which would surface as a false "Deck deleted."
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Deck not found or already deleted.");
    }
  },
};
