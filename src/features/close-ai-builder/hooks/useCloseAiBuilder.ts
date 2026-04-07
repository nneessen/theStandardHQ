// TanStack Query hooks for the Close AI Builder feature.
// Query key convention mirrors closeKpiKeys / businessToolsKeys.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { closeAiBuilderService } from "../services/closeAiBuilderService";
import type {
  EmailPromptOptions,
  GeneratedEmailTemplate,
  GeneratedSequence,
  GeneratedSmsTemplate,
  SequencePromptOptions,
  SmsPromptOptions,
} from "../types/close-ai-builder.types";

// ─── Query keys ────────────────────────────────────────────────────

export const closeAiBuilderKeys = {
  all: ["close-ai-builder"] as const,
  connection: () => [...closeAiBuilderKeys.all, "connection"] as const,
  emailTemplates: (params?: { limit?: number; skip?: number }) =>
    [...closeAiBuilderKeys.all, "email-templates", params ?? {}] as const,
  smsTemplates: (params?: { limit?: number; skip?: number }) =>
    [...closeAiBuilderKeys.all, "sms-templates", params ?? {}] as const,
  sequences: (params?: { limit?: number; skip?: number }) =>
    [...closeAiBuilderKeys.all, "sequences", params ?? {}] as const,
  generations: (type?: "email" | "sms" | "sequence") =>
    [...closeAiBuilderKeys.all, "generations", type ?? "all"] as const,
};

// ─── Connection ────────────────────────────────────────────────────

export function useCloseAiConnectionStatus() {
  return useQuery({
    queryKey: closeAiBuilderKeys.connection(),
    queryFn: () => closeAiBuilderService.connectionStatus(),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── List queries ──────────────────────────────────────────────────

export function useEmailTemplates(
  params: { limit?: number; skip?: number } = {},
) {
  return useQuery({
    queryKey: closeAiBuilderKeys.emailTemplates(params),
    queryFn: () => closeAiBuilderService.listEmailTemplates(params),
    placeholderData: keepPreviousData,
  });
}

export function useSmsTemplates(
  params: { limit?: number; skip?: number } = {},
) {
  return useQuery({
    queryKey: closeAiBuilderKeys.smsTemplates(params),
    queryFn: () => closeAiBuilderService.listSmsTemplates(params),
    placeholderData: keepPreviousData,
  });
}

export function useSequences(params: { limit?: number; skip?: number } = {}) {
  return useQuery({
    queryKey: closeAiBuilderKeys.sequences(params),
    queryFn: () => closeAiBuilderService.listSequences(params),
    placeholderData: keepPreviousData,
  });
}

export function useGenerationHistory(
  type?: "email" | "sms" | "sequence",
  limit = 50,
) {
  return useQuery({
    queryKey: closeAiBuilderKeys.generations(type),
    queryFn: () =>
      closeAiBuilderService.getGenerations({ limit, generationType: type }),
    staleTime: 30 * 1000,
  });
}

// ─── Generation mutations (AI call — no optimistic updates) ───────

export function useGenerateEmailTemplate() {
  return useMutation({
    mutationFn: (args: { prompt: string; options?: EmailPromptOptions }) =>
      closeAiBuilderService.generateEmail(args.prompt, args.options),
  });
}

export function useGenerateSmsTemplate() {
  return useMutation({
    mutationFn: (args: { prompt: string; options?: SmsPromptOptions }) =>
      closeAiBuilderService.generateSms(args.prompt, args.options),
  });
}

export function useGenerateSequence() {
  return useMutation({
    mutationFn: (args: { prompt: string; options?: SequencePromptOptions }) =>
      closeAiBuilderService.generateSequence(args.prompt, args.options),
  });
}

// ─── Save mutations (with list invalidation) ──────────────────────

export function useSaveEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      template: GeneratedEmailTemplate;
      generationId?: string;
    }) => closeAiBuilderService.saveEmail(args.template, args.generationId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "email-templates"],
      });
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "generations"],
      });
    },
  });
}

export function useSaveSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      template: GeneratedSmsTemplate;
      generationId?: string;
    }) => closeAiBuilderService.saveSms(args.template, args.generationId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "sms-templates"],
      });
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "generations"],
      });
    },
  });
}

export function useSaveSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      sequence: GeneratedSequence;
      generationId?: string;
    }) => closeAiBuilderService.saveSequence(args.sequence, args.generationId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "sequences"],
      });
      // Sequence save creates new templates as side effects — refetch those too.
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "email-templates"],
      });
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "sms-templates"],
      });
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "generations"],
      });
    },
  });
}

// ─── Delete mutations ─────────────────────────────────────────────

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeAiBuilderService.deleteEmailTemplate(id),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "email-templates"],
      }),
  });
}

export function useDeleteSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeAiBuilderService.deleteSmsTemplate(id),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "sms-templates"],
      }),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeAiBuilderService.deleteSequence(id),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: [...closeAiBuilderKeys.all, "sequences"],
      }),
  });
}
