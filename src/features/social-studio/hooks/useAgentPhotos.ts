// src/features/social-studio/hooks/useAgentPhotos.ts
// One agent's photo set + the mutations to manage it (add / remove / reorder / mark
// primary), for the AgentPhotoManager in the New Agents section. Photo changes ripple to
// the avatar (profile_photo_url) + the rotation set + (a first upload) the welcome queue,
// so every mutation invalidates those queries too.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAgentPhotos,
  addAgentPhoto,
  removeAgentPhotoRow,
  setPrimaryAgentPhoto,
  reorderAgentPhotos,
  type AgentPhoto,
  type AddAgentPhotoInput,
} from "@/services/social-studio";
import { NEW_AGENT_KEYS } from "./useNewAgents";
import { WELCOME_POST_KEYS } from "./useAgentWelcomePosts";

export type { AgentPhoto };

export const AGENT_PHOTO_KEYS = {
  all: ["social-studio", "agent-photos"] as const,
  list: (agentId: string | null) => [...AGENT_PHOTO_KEYS.all, agentId] as const,
};

export function useAgentPhotos(agentId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: AGENT_PHOTO_KEYS.list(agentId) });
    // Photos drive the avatar + the rotation set, and a first upload queues a welcome.
    queryClient.invalidateQueries({ queryKey: NEW_AGENT_KEYS.all });
    queryClient.invalidateQueries({ queryKey: WELCOME_POST_KEYS.all });
  };

  const query = useQuery({
    queryKey: AGENT_PHOTO_KEYS.list(agentId),
    queryFn: () => listAgentPhotos(agentId as string),
    enabled: !!agentId,
  });

  const add = useMutation<AgentPhoto, Error, AddAgentPhotoInput>({
    mutationFn: addAgentPhoto,
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message || "Couldn't upload the photo."),
  });

  const remove = useMutation<void, Error, AgentPhoto>({
    mutationFn: removeAgentPhotoRow,
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message || "Couldn't remove the photo."),
  });

  const setPrimary = useMutation<void, Error, string>({
    mutationFn: (photoId) => setPrimaryAgentPhoto(agentId as string, photoId),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message || "Couldn't set the primary photo."),
  });

  const reorder = useMutation<void, Error, string[]>({
    mutationFn: reorderAgentPhotos,
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message || "Couldn't reorder the photos."),
  });

  return {
    photos: query.data ?? [],
    isLoading: query.isLoading,
    add,
    remove,
    setPrimary,
    reorder,
  };
}
