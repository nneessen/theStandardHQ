// src/features/channel-orchestration/hooks/useOrchestration.ts
// TanStack Query hooks for channel orchestration API

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatBotApi, ChatBotApiError } from "@/features/chat-bot";
import { toast } from "sonner";
import {
  getStarterTemplates,
  getStarterTemplatePreview,
} from "../data/starter-templates";
import type {
  OrchestrationRuleset,
  OrchestrationTemplate,
  OrchestrationTemplatePreview,
  OrchestrationDecision,
  PostCallConfig,
  VoiceSession,
  VoiceSessionListResponse,
  CloseLeadSource,
  CloseCustomField,
  CloseSmartView,
  CreateRulePayload,
  UpdateRulePayload,
  CreateOrUpdateRulesetPayload,
  ApplyTemplatePayload,
  EvaluationContext,
  WritebackResult,
  TranscriptFormat,
  FallbackAction,
  CloseCustomFieldWriteResult,
  CloseSmartViewWriteResult,
  CloseMetadataRefreshResult,
} from "../types/orchestration.types";

/** Cast a typed payload to the Record<string, unknown> that chatBotApi expects. */
const p = <T>(v: T) => v as unknown as Record<string, unknown>;

// ─── Query Key Factory ──────────────────────────────────────────

export const orchestrationKeys = {
  all: ["channel-orchestration"] as const,
  ruleset: () => [...orchestrationKeys.all, "ruleset"] as const,
  templates: () => [...orchestrationKeys.all, "templates"] as const,
  templatePreview: (key: string) =>
    [...orchestrationKeys.all, "template-preview", key] as const,
  postCallConfig: () => [...orchestrationKeys.all, "post-call-config"] as const,
  voiceSessions: (params: { page: number; limit: number }) =>
    [...orchestrationKeys.all, "voice-sessions", params] as const,
  voiceSession: (sessionId: string) =>
    [...orchestrationKeys.all, "voice-session", sessionId] as const,
  closeLeadSources: () =>
    [...orchestrationKeys.all, "close-lead-sources"] as const,
  closeCustomFields: () =>
    [...orchestrationKeys.all, "close-custom-fields"] as const,
  closeSmartViews: () =>
    [...orchestrationKeys.all, "close-smart-views"] as const,
};

// ─── Queries ────────────────────────────────────────────────────

export function useOrchestrationRuleset(enabled = true) {
  return useQuery<OrchestrationRuleset | null, ChatBotApiError>({
    queryKey: orchestrationKeys.ruleset(),
    queryFn: async () => {
      try {
        return await chatBotApi<OrchestrationRuleset>(
          "get_orchestration_ruleset",
        );
      } catch (err) {
        if (err instanceof ChatBotApiError && err.isNotProvisioned) {
          return null;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isNotProvisioned)
        return false;
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}

export function useOrchestrationTemplates(enabled = true) {
  return useQuery<OrchestrationTemplate[], ChatBotApiError>({
    queryKey: orchestrationKeys.templates(),
    queryFn: async () => {
      try {
        const result = await chatBotApi<{
          templates: OrchestrationTemplate[];
        }>("get_orchestration_templates");
        const remote = result.templates ?? [];
        // Merge: remote templates first, then local starters not already present
        const remoteIds = new Set(remote.map((t) => t.id));
        const localOnly = getStarterTemplates().filter(
          (t) => !remoteIds.has(t.id),
        );
        return [...remote, ...localOnly];
      } catch {
        // API unavailable — return local starter templates
        return getStarterTemplates();
      }
    },
    enabled,
    staleTime: 300_000, // templates rarely change
  });
}

export function useOrchestrationTemplatePreview(
  key: string | null,
  enabled = true,
) {
  return useQuery<OrchestrationTemplatePreview | null, ChatBotApiError>({
    queryKey: orchestrationKeys.templatePreview(key ?? ""),
    queryFn: async () => {
      // Check local templates first
      const local = getStarterTemplatePreview(key!);
      if (local) return local;
      // Fall back to remote API
      return chatBotApi<OrchestrationTemplatePreview>(
        "get_orchestration_template_preview",
        { templateKey: key },
      );
    },
    enabled: enabled && !!key,
    staleTime: 300_000,
  });
}

export function usePostCallConfig(enabled = true) {
  return useQuery<PostCallConfig | null, ChatBotApiError>({
    queryKey: orchestrationKeys.postCallConfig(),
    queryFn: async () => {
      try {
        return await chatBotApi<PostCallConfig>("get_post_call_config");
      } catch (err) {
        if (err instanceof ChatBotApiError && err.isNotProvisioned) {
          return null;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isNotProvisioned)
        return false;
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}

export function useVoiceSessions(page: number, limit: number, enabled = true) {
  return useQuery<VoiceSessionListResponse, ChatBotApiError>({
    queryKey: orchestrationKeys.voiceSessions({ page, limit }),
    queryFn: () =>
      chatBotApi<VoiceSessionListResponse>("get_voice_sessions", {
        page,
        limit,
      }),
    enabled,
    staleTime: 15_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}

export function useVoiceSession(sessionId: string | null, enabled = true) {
  return useQuery<VoiceSession | null, ChatBotApiError>({
    queryKey: orchestrationKeys.voiceSession(sessionId ?? ""),
    queryFn: () => chatBotApi<VoiceSession>("get_voice_session", { sessionId }),
    enabled: enabled && !!sessionId,
    staleTime: 60_000,
  });
}

export function useCloseLeadSources(enabled = true) {
  return useQuery<CloseLeadSource[], ChatBotApiError>({
    queryKey: orchestrationKeys.closeLeadSources(),
    queryFn: async () => {
      const result = await chatBotApi<{
        sources: CloseLeadSource[];
      }>("get_close_lead_sources");
      return result.sources ?? [];
    },
    enabled,
    staleTime: 300_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}

export function useCloseCustomFields(enabled = true) {
  return useQuery<CloseCustomField[], ChatBotApiError>({
    queryKey: orchestrationKeys.closeCustomFields(),
    queryFn: async () => {
      const result = await chatBotApi<{
        fields: CloseCustomField[];
      }>("get_close_custom_fields");
      return result.fields ?? [];
    },
    enabled,
    staleTime: 300_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}

export function useCloseSmartViews(enabled = true) {
  return useQuery<CloseSmartView[], ChatBotApiError>({
    queryKey: orchestrationKeys.closeSmartViews(),
    queryFn: async () => {
      const result = await chatBotApi<{
        smartViews: CloseSmartView[];
      }>("get_close_smart_views");
      return result.smartViews ?? [];
    },
    enabled,
    staleTime: 300_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatBotApiError && error.isTransportError)
        return false;
      return failureCount < 1;
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────

export function useCreateOrUpdateRuleset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrUpdateRulesetPayload) =>
      chatBotApi<OrchestrationRuleset>(
        "update_orchestration_ruleset",
        p(payload),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
      toast.success("Ruleset saved");
    },
    onError: () => toast.error("Failed to save ruleset"),
  });
}

export function usePatchRuleset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      isActive?: boolean;
      fallbackAction?: FallbackAction;
    }) =>
      chatBotApi<OrchestrationRuleset>("patch_orchestration_ruleset", patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({
        queryKey: orchestrationKeys.ruleset(),
      });
      const prev = queryClient.getQueryData<OrchestrationRuleset | null>(
        orchestrationKeys.ruleset(),
      );
      if (prev) {
        queryClient.setQueryData<OrchestrationRuleset>(
          orchestrationKeys.ruleset(),
          { ...prev, ...patch },
        );
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(orchestrationKeys.ruleset(), context.prev);
      }
      toast.error("Failed to update ruleset");
    },
  });
}

export function useDeleteRuleset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      chatBotApi<{ deleted: boolean }>("delete_orchestration_ruleset"),
    onSuccess: () => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), null);
      toast.success("Ruleset deleted");
    },
    onError: () => toast.error("Failed to delete ruleset"),
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRulePayload) =>
      chatBotApi<OrchestrationRuleset>("create_orchestration_rule", p(payload)),
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
      toast.success("Rule added");
    },
    onError: () => toast.error("Failed to add rule"),
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRulePayload) =>
      chatBotApi<OrchestrationRuleset>("update_orchestration_rule", p(payload)),
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
      toast.success("Rule updated");
    },
    onError: () => toast.error("Failed to update rule"),
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      chatBotApi<OrchestrationRuleset>("delete_orchestration_rule", {
        ruleId,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
      toast.success("Rule removed");
    },
    onError: () => toast.error("Failed to remove rule"),
  });
}

export function useToggleRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) =>
      chatBotApi<OrchestrationRuleset>("toggle_orchestration_rule", {
        ruleId,
        enabled,
      }),
    onMutate: async ({ ruleId, enabled }) => {
      await queryClient.cancelQueries({
        queryKey: orchestrationKeys.ruleset(),
      });
      const prev = queryClient.getQueryData<OrchestrationRuleset | null>(
        orchestrationKeys.ruleset(),
      );
      if (prev) {
        queryClient.setQueryData<OrchestrationRuleset>(
          orchestrationKeys.ruleset(),
          {
            ...prev,
            rules: prev.rules.map((r) =>
              r.id === ruleId ? { ...r, enabled } : r,
            ),
          },
        );
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(orchestrationKeys.ruleset(), context.prev);
      }
      toast.error("Failed to toggle rule");
    },
  });
}

export function useReorderRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedRuleIds: string[]) =>
      chatBotApi<OrchestrationRuleset>("reorder_orchestration_rules", {
        orderedRuleIds,
      }),
    onMutate: async (orderedRuleIds) => {
      await queryClient.cancelQueries({
        queryKey: orchestrationKeys.ruleset(),
      });
      const prev = queryClient.getQueryData<OrchestrationRuleset | null>(
        orchestrationKeys.ruleset(),
      );
      if (prev) {
        const ruleMap = new Map(prev.rules.map((r) => [r.id, r]));
        const reordered = orderedRuleIds
          .map((id) => ruleMap.get(id))
          .filter(Boolean) as typeof prev.rules;
        queryClient.setQueryData<OrchestrationRuleset>(
          orchestrationKeys.ruleset(),
          { ...prev, rules: reordered },
        );
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(orchestrationKeys.ruleset(), context.prev);
      }
      toast.error("Failed to reorder rules");
    },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApplyTemplatePayload) => {
      // Check if this is a local starter template
      const local = getStarterTemplatePreview(payload.templateKey);
      if (local) {
        const existingRuleset =
          queryClient.getQueryData<OrchestrationRuleset | null>(
            orchestrationKeys.ruleset(),
          );
        const existingRules =
          payload.mode === "append" && existingRuleset
            ? existingRuleset.rules
            : [];
        const now = new Date().toISOString();
        // Build ruleset locally — no API call needed
        const ruleset: OrchestrationRuleset = {
          id: existingRuleset?.id ?? crypto.randomUUID(),
          agentId: existingRuleset?.agentId ?? "",
          name: existingRuleset?.name ?? local.name,
          isActive: existingRuleset?.isActive ?? true,
          rules: [...existingRules, ...local.rules],
          fallbackAction:
            payload.mode === "replace"
              ? local.fallbackAction
              : (existingRuleset?.fallbackAction ?? local.fallbackAction),
          templateKey: local.id,
          version: (existingRuleset?.version ?? 0) + 1,
          createdAt: existingRuleset?.createdAt ?? now,
          updatedAt: now,
        };
        // Try persisting to API; if unavailable, still return the local ruleset
        try {
          return await chatBotApi<OrchestrationRuleset>(
            "update_orchestration_ruleset",
            p({
              name: ruleset.name,
              isActive: ruleset.isActive,
              rules: ruleset.rules.map((r) => ({
                name: r.name,
                enabled: r.enabled,
                conditions: r.conditions,
                action: r.action,
              })),
              fallbackAction: ruleset.fallbackAction,
            } satisfies CreateOrUpdateRulesetPayload),
          );
        } catch {
          // API unavailable — return the locally-built ruleset
          return ruleset;
        }
      }
      // Remote template — use the API
      return chatBotApi<OrchestrationRuleset>(
        "apply_orchestration_template",
        p(payload),
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.ruleset(), data);
      toast.success("Template applied");
    },
    onError: () => toast.error("Failed to apply template"),
  });
}

export function useEvaluateOrchestration() {
  return useMutation({
    mutationFn: (context: EvaluationContext) =>
      chatBotApi<OrchestrationDecision>("evaluate_orchestration", p(context)),
  });
}

export function useUpdatePostCallConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<PostCallConfig>) =>
      chatBotApi<PostCallConfig>("update_post_call_config", config),
    onSuccess: (data) => {
      queryClient.setQueryData(orchestrationKeys.postCallConfig(), data);
      toast.success("Post-call config saved");
    },
    onError: () => toast.error("Failed to save post-call config"),
  });
}

export function useManualWriteback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      format,
      includeRecordingLink,
    }: {
      sessionId: string;
      format?: TranscriptFormat;
      includeRecordingLink?: boolean;
    }) =>
      chatBotApi<WritebackResult>("manual_voice_writeback", {
        sessionId,
        format,
        includeRecordingLink,
      }),
    onSuccess: (_data, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: orchestrationKeys.voiceSession(sessionId),
      });
      toast.success("Transcript written to Close");
    },
    onError: () => toast.error("Failed to write transcript to Close"),
  });
}

// ─── Close CRM Write Helpers ────────────────────────────────────

export function useCreateCloseCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { key: string; label?: string; type?: string }) =>
      chatBotApi<CloseCustomFieldWriteResult>(
        "create_close_custom_field",
        payload,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orchestrationKeys.closeCustomFields(),
      });
      toast.success("Custom field created in Close");
    },
    onError: () => toast.error("Failed to create custom field"),
  });
}

export function useCreateCloseSmartView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      customFieldKey: string;
      name?: string;
      customFieldValue?: string;
      shared?: boolean;
    }) =>
      chatBotApi<CloseSmartViewWriteResult>(
        "create_close_smart_view",
        p(payload),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orchestrationKeys.closeSmartViews(),
      });
      toast.success("Smart view created in Close");
    },
    onError: () => toast.error("Failed to create smart view"),
  });
}

export function useRefreshCloseMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      chatBotApi<CloseMetadataRefreshResult>("refresh_close_metadata"),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orchestrationKeys.closeLeadSources(),
      });
      void queryClient.invalidateQueries({
        queryKey: orchestrationKeys.closeCustomFields(),
      });
      void queryClient.invalidateQueries({
        queryKey: orchestrationKeys.closeSmartViews(),
      });
      toast.success("Close CRM metadata refreshed");
    },
    onError: () => toast.error("Failed to refresh Close metadata"),
  });
}
