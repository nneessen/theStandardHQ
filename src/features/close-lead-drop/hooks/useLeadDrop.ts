// src/features/close-lead-drop/hooks/useLeadDrop.ts
// TanStack Query hooks for the Lead Drop feature.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadDropService } from "../services/leadDropService";
import type { DropJobStatus } from "../types/lead-drop.types";

export const leadDropKeys = {
  all: ["lead-drop"] as const,
  smartViews: () => [...leadDropKeys.all, "smart-views"] as const,
  preview: (svId: string, cursor: string | null) =>
    [...leadDropKeys.all, "preview", svId, cursor ?? "initial"] as const,
  recipients: () => [...leadDropKeys.all, "recipients"] as const,
  sequences: (recipientId: string) =>
    [...leadDropKeys.all, "sequences", recipientId] as const,
  jobStatus: (jobId: string) =>
    [...leadDropKeys.all, "job-status", jobId] as const,
  history: () => [...leadDropKeys.all, "history"] as const,
  jobResults: (jobId: string) =>
    [...leadDropKeys.all, "job-results", jobId] as const,
};

export function useLeadDropSmartViews() {
  return useQuery({
    queryKey: leadDropKeys.smartViews(),
    queryFn: () => leadDropService.getSmartViews(),
    staleTime: 30_000,
  });
}

export function useLeadDropPreview(
  smartViewId: string | null,
  cursor: string | null = null,
  enabled = false,
) {
  return useQuery({
    queryKey: leadDropKeys.preview(smartViewId ?? "", cursor),
    queryFn: () => leadDropService.previewLeads(smartViewId!, cursor),
    enabled: enabled && !!smartViewId,
    staleTime: 60_000,
  });
}

export function useLeadDropRecipients() {
  return useQuery({
    queryKey: leadDropKeys.recipients(),
    queryFn: () => leadDropService.getRecipients(),
    staleTime: 60_000,
  });
}

export function useLeadDropRecipientSequences(recipientId: string | null) {
  return useQuery({
    queryKey: leadDropKeys.sequences(recipientId ?? ""),
    queryFn: () => leadDropService.getRecipientSequences(recipientId!),
    enabled: !!recipientId,
    staleTime: 60_000,
  });
}

export function useCreateLeadDrop() {
  return useMutation({
    mutationFn: leadDropService.createDropJob,
  });
}

const TERMINAL_STATUSES: DropJobStatus[] = ["completed", "failed"];

export function useLeadDropJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: leadDropKeys.jobStatus(jobId ?? ""),
    queryFn: () => leadDropService.getJobStatus(jobId!),
    enabled: !!jobId,
    // Poll every 2s while job is running; stop when terminal
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status as DropJobStatus | undefined;
      if (!status || TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
    staleTime: 0,
  });
}

export function useLeadDropHistory() {
  return useQuery({
    queryKey: leadDropKeys.history(),
    queryFn: () => leadDropService.getHistory(),
    staleTime: 30_000,
  });
}

export function useLeadDropJobResults(jobId: string | null) {
  return useQuery({
    queryKey: leadDropKeys.jobResults(jobId ?? ""),
    queryFn: () => leadDropService.getJobResults(jobId!),
    enabled: !!jobId,
    staleTime: 60_000,
  });
}

export function useInvalidateLeadDropHistory() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: leadDropKeys.history() });
}
