import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  duplicateEmailTemplate,
  toggleTemplateActive,
  getUserTemplateStatus,
  getGroupedEmailTemplates,
  generateAiEmailTemplate,
  type EmailTemplateFilters,
} from "../services/emailTemplateService";
import type { CreateEmailTemplateRequest } from "@/types/email.types";

const QUERY_KEY = "email-templates";
const STATUS_QUERY_KEY = "email-template-status";

export function useEmailTemplates(filters?: EmailTemplateFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => getEmailTemplates(filters),
  });
}

export function useEmailTemplate(id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => (id ? getEmailTemplate(id) : null),
    enabled: !!id,
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (template: CreateEmailTemplateRequest) => {
      if (!user?.id) {
        throw new Error("You must be logged in to create templates");
      }
      return createEmailTemplate(template, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Template created successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to create template:", error);
      toast.error(error.message || "Failed to create template");
    },
  });
}

/**
 * Generate a ready-to-send email template with AI. Persists server-side (the edge
 * fn), then refreshes the list so the new template appears.
 */
export function useGenerateAiEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      prompt,
      options,
    }: {
      prompt: string;
      options?: { tone?: string; length?: string };
    }) => generateAiEmailTemplate(prompt, options),
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success(`AI created "${tpl.name}"`);
    },
    onError: (error: Error) => {
      console.error("AI template generation failed:", error);
      toast.error(error.message || "AI generation failed");
    },
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateEmailTemplateRequest>;
    }) => updateEmailTemplate(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] });
      toast.success("Template saved successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to update template:", error);
      toast.error(error.message || "Failed to save template");
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEmailTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Template deleted");
    },
    onError: (error: Error) => {
      console.error("Failed to delete template:", error);
      toast.error(error.message || "Failed to delete template");
    },
  });
}

export function useDuplicateEmailTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => {
      if (!user?.id) {
        throw new Error("You must be logged in to duplicate templates");
      }
      return duplicateEmailTemplate(id, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Template duplicated");
    },
    onError: (error: Error) => {
      console.error("Failed to duplicate template:", error);
      toast.error(error.message || "Failed to duplicate template");
    },
  });
}

export function useToggleTemplateActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleTemplateActive(id, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success(isActive ? "Template activated" : "Template deactivated");
    },
    onError: (error: Error) => {
      console.error("Failed to toggle template:", error);
      toast.error(error.message || "Failed to update template status");
    },
  });
}

/**
 * Get user's template status (count/limit)
 */
export function useUserTemplateStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [STATUS_QUERY_KEY, user?.id],
    queryFn: () => (user?.id ? getUserTemplateStatus(user.id) : null),
    enabled: !!user?.id,
  });
}

/**
 * Get templates grouped by global vs personal
 */
export function useGroupedEmailTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [QUERY_KEY, "grouped", user?.id],
    queryFn: () => (user?.id ? getGroupedEmailTemplates(user.id) : null),
    enabled: !!user?.id,
  });
}
