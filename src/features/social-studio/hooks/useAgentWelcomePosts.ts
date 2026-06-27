// src/features/social-studio/hooks/useAgentWelcomePosts.ts
// The "welcome new agent" approval queue, exposed to the Social Studio UI (architecture:
// features → hooks → services, so the panel never imports the service layer directly). Lists the
// owner's pending welcome drafts and exposes deny + mark-approved mutations. The actual posting
// (render → upload → schedule/publish) is orchestrated in the panel using the page's existing IG
// handlers; useMarkWelcomeApproved finalizes the draft afterward.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listPendingWelcomePosts,
  approveWelcomePost,
  denyWelcomePost,
} from "@/services/social-studio";

export type { WelcomeDraft } from "@/services/social-studio";

export const WELCOME_POST_KEYS = {
  all: ["agent-welcome-posts"] as const,
  pending: () => [...WELCOME_POST_KEYS.all, "pending"] as const,
};

export function useAgentWelcomePosts() {
  return useQuery({
    queryKey: WELCOME_POST_KEYS.pending(),
    queryFn: listPendingWelcomePosts,
  });
}

/** Mark a draft consumed AFTER the panel has rendered + scheduled/published it. */
export function useMarkWelcomeApproved() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => approveWelcomePost(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WELCOME_POST_KEYS.all }),
  });
}

export function useDenyWelcomePost() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => denyWelcomePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WELCOME_POST_KEYS.all });
      toast.success("Welcome post dismissed.");
    },
    onError: (error) =>
      toast.error(error.message || "Couldn't dismiss that welcome post."),
  });
}
