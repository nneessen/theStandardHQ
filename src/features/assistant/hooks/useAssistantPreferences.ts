import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { assistantKeys } from "./useAssistant";
import {
  DEFAULT_ASSISTANT_NAME,
  type AssistantPreferences,
} from "../types/assistant.types";

const DEFAULTS: AssistantPreferences = {
  assistant_name: DEFAULT_ASSISTANT_NAME,
  enabled_agents: [
    "executive-briefing",
    "production-analyst",
    "policy-risk",
    "lead-priority",
    "crm",
    "close",
    "sms-email-copy",
    "compliance",
    "recruiting",
    "coaching",
    "calendar",
    "slack",
    "workflow",
    "data-quality",
  ],
  voice_enabled: false,
  voice_engine: "legacy",
  sound_enabled: true,
  enabled_memory: true,
  tone: "professional",
  briefing_style: "concise",
};

export function useAssistantPreferences() {
  return useQuery({
    queryKey: assistantKeys.preferences,
    queryFn: async (): Promise<AssistantPreferences> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await supabase
        .from("assistant_preferences")
        .select(
          "assistant_name, enabled_agents, voice_enabled, voice_engine, sound_enabled, enabled_memory, tone, briefing_style",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return DEFAULTS;
      return {
        assistant_name: data.assistant_name ?? DEFAULTS.assistant_name,
        enabled_agents: data.enabled_agents ?? DEFAULTS.enabled_agents,
        voice_enabled: data.voice_enabled ?? DEFAULTS.voice_enabled,
        // The DB column is free `text`; normalize anything that isn't the realtime
        // opt-in back to the safe legacy transport.
        voice_engine: data.voice_engine === "realtime" ? "realtime" : "legacy",
        sound_enabled: data.sound_enabled ?? DEFAULTS.sound_enabled,
        // Default ON: a missing column/value means memory is enabled (the user's
        // own data); only an explicit false disables it.
        enabled_memory: data.enabled_memory ?? DEFAULTS.enabled_memory,
        tone: data.tone ?? DEFAULTS.tone,
        briefing_style: data.briefing_style ?? DEFAULTS.briefing_style,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateAssistantPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AssistantPreferences>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("assistant_preferences")
        .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: assistantKeys.preferences }),
  });
}
