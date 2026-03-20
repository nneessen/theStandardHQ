// src/features/chat-bot/hooks/useChatBotAdmin.ts
// Admin-scoped hooks for super-admin bot management panel.
// Every query/mutation passes targetUserId to act on behalf of another user.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  chatBotApi,
  ChatBotApiError,
  type ChatBotAgent,
  type ChatBotUsage,
} from "./useChatBot";
import type {
  AdminAgentListResponse,
  AdminAgentListItem,
  AdminTeamOverride,
} from "../types/admin.types";

// ─── Query Key Factory ──────────────────────────────────────────

export const adminKeys = {
  all: ["chat-bot", "admin"] as const,
  agents: () => [...adminKeys.all, "agents"] as const,
  agentDetail: (userId: string) => [...adminKeys.all, "agent", userId] as const,
  connections: (userId: string) =>
    [...adminKeys.all, "connections", userId] as const,
  closeStatus: (userId: string) =>
    [...adminKeys.all, "close-status", userId] as const,
  calendlyStatus: (userId: string) =>
    [...adminKeys.all, "calendly-status", userId] as const,
  googleStatus: (userId: string) =>
    [...adminKeys.all, "google-status", userId] as const,
  usage: (userId: string) => [...adminKeys.all, "usage", userId] as const,
  monitoring: (userId: string) =>
    [...adminKeys.all, "monitoring", userId] as const,
  voiceSetupState: (userId: string) =>
    [...adminKeys.all, "voice-setup-state", userId] as const,
  voiceEntitlement: (userId: string) =>
    [...adminKeys.all, "voice-entitlement", userId] as const,
  voiceUsage: (userId: string) =>
    [...adminKeys.all, "voice-usage", userId] as const,
};

// ─── Helper ─────────────────────────────────────────────────────

function adminApi<T>(
  action: string,
  targetUserId: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return chatBotApi<T>(action, { ...params, targetUserId });
}

// ─── Queries ────────────────────────────────────────────────────

export function useAdminListAgents() {
  return useQuery<AdminAgentListResponse, ChatBotApiError>({
    queryKey: adminKeys.agents(),
    queryFn: () => chatBotApi<AdminAgentListResponse>("admin_list_agents"),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminGetAgent(userId: string | null) {
  return useQuery<ChatBotAgent | null, ChatBotApiError>({
    queryKey: adminKeys.agentDetail(userId ?? ""),
    queryFn: async () => {
      if (!userId) return null;
      try {
        return await adminApi<ChatBotAgent>("get_agent", userId);
      } catch (err) {
        if (
          err instanceof ChatBotApiError &&
          err.message.includes("No active chat bot")
        ) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminGetCloseStatus(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.closeStatus(userId ?? ""),
    queryFn: () =>
      adminApi<{ connected: boolean; orgName?: string }>(
        "get_close_status",
        userId!,
      ),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminGetCalendlyStatus(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.calendlyStatus(userId ?? ""),
    queryFn: () =>
      adminApi<{
        connected: boolean;
        eventType?: string;
        userName?: string;
        userEmail?: string;
      }>("get_calendly_status", userId!),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminGetGoogleStatus(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.googleStatus(userId ?? ""),
    queryFn: () =>
      adminApi<{ connected: boolean; calendarId?: string; userEmail?: string }>(
        "get_google_status",
        userId!,
      ),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminGetUsage(userId: string | null) {
  return useQuery<ChatBotUsage, ChatBotApiError>({
    queryKey: adminKeys.usage(userId ?? ""),
    queryFn: () => adminApi<ChatBotUsage>("get_usage", userId!),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminGetMonitoring(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.monitoring(userId ?? ""),
    queryFn: () => adminApi("get_monitoring", userId!),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminGetVoiceSetupState(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.voiceSetupState(userId ?? ""),
    queryFn: () => adminApi("get_voice_setup_state", userId!),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminGetVoiceEntitlement(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.voiceEntitlement(userId ?? ""),
    queryFn: () =>
      adminApi<{ entitlement: Record<string, unknown> | null }>(
        "get_voice_entitlement",
        userId!,
      ),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminGetVoiceUsage(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.voiceUsage(userId ?? ""),
    queryFn: () => adminApi("get_voice_usage", userId!),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}

// ─── Mutations ──────────────────────────────────────────────────

export function useAdminUpdateConfig(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, unknown>) => {
      if (!userId) throw new Error("No userId");
      return adminApi("update_config", userId, config);
    },
    onSuccess: () => {
      toast.success("Config updated");
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: adminKeys.agentDetail(userId),
        });
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to update config: ${err.message}`);
    },
  });
}

export function useAdminUpdateBusinessHours(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (businessHours: unknown) => {
      if (!userId) throw new Error("No userId");
      return adminApi("update_business_hours", userId, { businessHours });
    },
    onSuccess: () => {
      toast.success("Business hours updated");
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: adminKeys.agentDetail(userId),
        });
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to update business hours: ${err.message}`);
    },
  });
}

export function useAdminGrantTeamAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      chatBotApi("admin_grant_team_access", { userId, reason }),
    onSuccess: () => {
      toast.success("Team access granted");
      void queryClient.invalidateQueries({ queryKey: adminKeys.agents() });
    },
    onError: (err: Error) => {
      toast.error(`Failed to grant access: ${err.message}`);
    },
  });
}

export function useAdminRevokeTeamAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      chatBotApi("admin_revoke_team_access", { userId }),
    onSuccess: () => {
      toast.success("Team access revoked");
      void queryClient.invalidateQueries({ queryKey: adminKeys.agents() });
    },
    onError: (err: Error) => {
      toast.error(`Failed to revoke access: ${err.message}`);
    },
  });
}

// ─── Re-exports for convenience ─────────────────────────────────

export type { AdminAgentListItem, AdminTeamOverride, AdminAgentListResponse };
