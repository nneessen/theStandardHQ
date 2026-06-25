// src/features/social-studio/hooks/useSocialDecks.ts
// TanStack Query hooks for the carousel deck library (#8 Phase 3A) — mirrors
// useSocialTemplates (throw-on-error service, invalidate the root key on success).
// Wraps socialDeckService so the builder COMPONENT never imports the service layer
// directly (architecture: features → hooks → services); spec types are re-exported here
// for the component (which does the spec<->PreviewData conversion).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  socialDeckService,
  type DeckSummary,
  type LoadedDeck,
  type SaveDeckInput,
} from "@/services/social-studio";

export type {
  DeckSlideSpec,
  DeckSpec,
  DeckSummary,
  LoadedDeck,
  SaveDeckInput,
} from "@/services/social-studio";

export const SOCIAL_DECK_KEYS = {
  all: ["social-decks"] as const,
  lists: () => [...SOCIAL_DECK_KEYS.all, "list"] as const,
};

export function useSocialDecks() {
  return useQuery({
    queryKey: SOCIAL_DECK_KEYS.lists(),
    queryFn: () => socialDeckService.listDecks(),
  });
}

export function useSaveDeck() {
  const queryClient = useQueryClient();
  return useMutation<DeckSummary, Error, SaveDeckInput>({
    mutationFn: (input) => socialDeckService.saveDeck(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOCIAL_DECK_KEYS.all });
      toast.success("Deck saved.");
    },
    onError: (error) => {
      toast.error(error.message || "Couldn't save the deck.");
    },
  });
}

export function useDeleteDeck() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => socialDeckService.deleteDeck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOCIAL_DECK_KEYS.all });
      toast.success("Deck deleted.");
    },
    onError: (error) => {
      toast.error(error.message || "Couldn't delete the deck.");
    },
  });
}

/** Imperative loader — fetches one deck's full spec on demand (not a subscription). */
export function useLoadDeck() {
  return useMutation<LoadedDeck, Error, string>({
    mutationFn: (id) => socialDeckService.loadDeck(id),
    onError: (error) => {
      toast.error(error.message || "Couldn't load the deck.");
    },
  });
}
