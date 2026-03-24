// src/features/chat-bot/hooks/useChatBotVoiceClone.ts
// React Query hooks for voice clone operations

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { toast } from "sonner";

import {
  chatBotApi,
  chatBotKeys,
  ChatBotApiError,
  invalidateVoiceAgentQueries,
} from "./useChatBot";

// ─── Types ──────────────────────────────────────────────────────

export interface VoiceCloneScript {
  segmentIndex: number;
  category: string;
  title: string;
  scriptText: string;
  minDurationSeconds: number;
  targetDurationSeconds: number;
  optional: boolean;
}

export interface VoiceCloneScriptsResponse {
  scripts: VoiceCloneScript[];
  totalSegments: number;
  minimumSegments: number;
  minimumAudioMinutes: number;
  isCustom: boolean;
}

export interface VoiceCloneScriptsUpdateResponse {
  saved: boolean;
  totalSegments: number;
}

export interface VoiceCloneStartResponse {
  id: string;
  status: string;
  remainingAttempts: number;
}

export interface VoiceCloneSegmentUploadResponse {
  segmentId: string;
  scriptId: number;
  durationSeconds: number;
  completedSegments: number;
  totalSegments: number;
  totalAudioMinutes: number;
}

export interface VoiceCloneSessionSegment {
  index: number;
  fileName: string;
  durationSeconds: number;
  uploadedAt: string;
}

export interface VoiceCloneSession {
  id: string;
  status:
    | "recording"
    | "processing"
    | "ready"
    | "failed"
    | "active"
    | "archived";
  voiceName: string;
  completedSegments: number;
  totalSegments: number;
  totalAudioMinutes: number;
  minimumAudioMinutes: number;
  minimumSegments: number;
  segments: VoiceCloneSessionSegment[];
  canSubmit: boolean;
  submitBlockReason: string | null;
}

// ─── Multipart Upload Helper ────────────────────────────────────

/**
 * Sends FormData (multipart) to the chat-bot-api edge function.
 * Used for audio segment uploads which can't go through the JSON chatBotApi().
 */
async function chatBotApiMultipart<T>(formData: FormData): Promise<T> {
  let accessToken: string | undefined = (await supabase.auth.getSession()).data
    .session?.access_token;

  if (!accessToken) {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    accessToken = session?.access_token;
  }

  const { data, error } = await supabase.functions.invoke("chat-bot-api", {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
    body: formData,
  });

  if (error) {
    let bodyError: string | undefined;
    const status =
      (error as { context?: Response }).context?.status ?? undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        bodyError =
          typeof body?.error === "string"
            ? body.error
            : (body?.error?.message ?? undefined);
      }
    } catch {
      // body already consumed or not JSON
    }

    if (!bodyError) {
      const de = data?.error;
      bodyError =
        typeof de === "string"
          ? de
          : typeof de === "object" && de?.message
            ? de.message
            : undefined;
    }

    const msg = bodyError || error.message || "Upload failed";
    const isTransport =
      msg.includes("Failed to send a request to the Edge Function") ||
      msg.includes("Failed to fetch") ||
      msg.includes("fetch failed") ||
      msg.includes("NetworkError");

    if (typeof status === "number" && !isTransport) {
      console.error(
        `[chatBotApiMultipart] upload failed (status=${status}):`,
        msg,
      );
    }
    throw new ChatBotApiError(msg, false, isTransport, isTransport);
  }

  if (!data || data.error) {
    const errVal = data?.error;
    const msg =
      typeof errVal === "string"
        ? errVal
        : typeof errVal === "object" && errVal?.message
          ? errVal.message
          : "Upload failed";
    throw new ChatBotApiError(msg);
  }

  return data as T;
}

// ─── Queries ────────────────────────────────────────────────────

/** Fetch recording scripts. Checks for per-agent custom scripts, falls back to defaults. */
export function useVoiceCloneScripts(enabled = true) {
  return useQuery<VoiceCloneScriptsResponse, ChatBotApiError>({
    queryKey: chatBotKeys.voiceCloneScripts(),
    queryFn: () =>
      chatBotApi<VoiceCloneScriptsResponse>("get_voice_clone_scripts"),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 1000 * 60 * 60,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 2;
    },
  });
}

/** Save custom recording scripts for this agent. */
export function useUpdateVoiceCloneScripts() {
  const queryClient = useQueryClient();
  return useMutation<
    VoiceCloneScriptsUpdateResponse,
    ChatBotApiError,
    VoiceCloneScript[]
  >({
    mutationFn: (scripts) =>
      chatBotApi<VoiceCloneScriptsUpdateResponse>(
        "update_voice_clone_scripts",
        { scripts },
      ),
    onSuccess: () => {
      void queryClient.cancelQueries({
        queryKey: chatBotKeys.voiceCloneScripts(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneScripts(),
      });
      toast.success("Scripts saved");
    },
    onError: (err) => {
      if (
        err.message?.includes("recording") ||
        err.message?.includes("in progress")
      ) {
        toast.error(
          "Finish or reset your current recording before editing scripts",
        );
      } else {
        toast.error(err.message || "Failed to save scripts");
      }
    },
  });
}

/** Reset scripts to the platform defaults (deletes custom scripts). */
export function useResetVoiceCloneScripts() {
  const queryClient = useQueryClient();
  return useMutation<VoiceCloneScriptsResponse, ChatBotApiError>({
    mutationFn: () =>
      chatBotApi<VoiceCloneScriptsResponse>("reset_voice_clone_scripts"),
    onSuccess: () => {
      void queryClient.cancelQueries({
        queryKey: chatBotKeys.voiceCloneScripts(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneScripts(),
      });
      toast.success("Scripts reset to defaults");
    },
    onError: (err) => {
      if (
        err.message?.includes("recording") ||
        err.message?.includes("in progress")
      ) {
        toast.error(
          "Finish or reset your current recording before editing scripts",
        );
      } else {
        toast.error(err.message || "Failed to reset scripts");
      }
    },
  });
}

/** Fetch clone session detail. Polls every 3s when status is "processing". */
export function useVoiceCloneSession(cloneId: string | null, enabled = true) {
  return useQuery<VoiceCloneSession | null, ChatBotApiError>({
    queryKey: chatBotKeys.voiceCloneSession(cloneId ?? ""),
    queryFn: async () => {
      if (!cloneId) return null;
      try {
        return await chatBotApi<VoiceCloneSession>("get_voice_clone_session", {
          clone_id: cloneId,
        });
      } catch (err) {
        if (err instanceof ChatBotApiError && err.isNotProvisioned) return null;
        throw err;
      }
    },
    enabled: enabled && !!cloneId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      if (query.state.data?.status === "processing") return 3_000;
      return false;
    },
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────

/** Start a new voice clone recording session. */
export function useStartVoiceClone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { voiceName: string; consentAccepted: boolean }) =>
      chatBotApi<VoiceCloneStartResponse>("start_voice_clone", params),
    onSuccess: () => {
      toast.success("Voice clone session started.");
      void queryClient.cancelQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start voice clone session.");
    },
  });
}

/** Upload an audio segment via multipart FormData. */
export function useUploadVoiceCloneSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cloneId: string;
      segmentIndex: number;
      audioBlob: Blob;
      durationSeconds: number;
      fileName?: string;
    }) => {
      const formData = new FormData();
      formData.append("action", "upload_voice_clone_segment");
      formData.append("clone_id", params.cloneId);
      formData.append(
        "file",
        params.audioBlob,
        params.fileName || "recording.webm",
      );
      formData.append("segmentIndex", String(params.segmentIndex));
      formData.append("durationSeconds", String(params.durationSeconds));

      return chatBotApiMultipart<VoiceCloneSegmentUploadResponse>(formData);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneSession(variables.cloneId),
      });
      void queryClient.cancelQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload audio segment.");
    },
  });
}

/** Submit clone session for Retell voice generation. */
export function useSubmitVoiceClone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cloneId: string) =>
      chatBotApi<{ cloneId: string; status: string }>("submit_voice_clone", {
        clone_id: cloneId,
      }),
    onSuccess: (_data, cloneId) => {
      toast.success("Voice clone submitted for processing.");
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneSession(cloneId),
      });
      void queryClient.cancelQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit voice clone.");
    },
  });
}

/** Activate the cloned voice on all calls. */
export function useActivateVoiceClone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cloneId: string) =>
      chatBotApi<{ cloneId: string; status: string; isActive: boolean }>(
        "activate_voice_clone",
        { clone_id: cloneId },
      ),
    onSuccess: (_data, cloneId) => {
      toast.success("Cloned voice activated on all calls.");
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneSession(cloneId),
      });
      invalidateVoiceAgentQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to activate cloned voice.");
    },
  });
}

/** Deactivate cloned voice (revert to stock). */
export function useDeactivateVoiceClone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      chatBotApi<{ deactivated: boolean }>("deactivate_voice_clone"),
    onSuccess: () => {
      toast.success("Reverted to default voice.");
      invalidateVoiceAgentQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deactivate cloned voice.");
    },
  });
}

/** Delete a recorded audio segment. */
export function useDeleteVoiceCloneSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { cloneId: string; segmentIndex: number }) =>
      chatBotApi<{ completedSegments: number; totalAudioMinutes: number }>(
        "delete_voice_clone_segment",
        { clone_id: params.cloneId, segment_index: params.segmentIndex },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneSession(variables.cloneId),
      });
      void queryClient.cancelQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: chatBotKeys.voiceCloneStatus(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete audio segment.");
    },
  });
}

/** Cancel / abandon an in-progress voice clone session. */
export function useCancelVoiceClone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cloneId: string) =>
      chatBotApi<{ cancelled: boolean }>("cancel_voice_clone", {
        clone_id: cloneId,
      }),
    onSuccess: () => {
      toast.success("Voice clone session cancelled.");
      invalidateVoiceAgentQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel voice clone.");
    },
  });
}
