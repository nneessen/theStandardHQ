// src/features/social-studio/hooks/useSocialTemplates.ts
// TanStack Query hooks for the Spotlight template library — mirrors the prospects
// query+mutation pattern (throw-on-error service, invalidate the root key on success).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  socialTemplateService,
  type CreateSocialTemplateInput,
} from "@/services/social-studio";

export const SOCIAL_TEMPLATE_KEYS = {
  all: ["social-templates"] as const,
  lists: () => [...SOCIAL_TEMPLATE_KEYS.all, "list"] as const,
};

export function useSocialTemplates() {
  return useQuery({
    queryKey: SOCIAL_TEMPLATE_KEYS.lists(),
    queryFn: () => socialTemplateService.getMyTemplates(),
  });
}

export function useCreateSocialTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSocialTemplateInput) =>
      socialTemplateService.createTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOCIAL_TEMPLATE_KEYS.all });
      toast.success("Template saved.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Couldn't save the template.");
    },
  });
}

export function useDeleteSocialTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => socialTemplateService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOCIAL_TEMPLATE_KEYS.all });
      toast.success("Template deleted.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Couldn't delete the template.");
    },
  });
}
