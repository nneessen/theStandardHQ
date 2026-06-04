// Frontend types for the Jarvis command center. Mirror the orchestrator response and
// the assistant_action_requests row shape (subset the UI needs).

export type AssistantRole = "user" | "assistant" | "tool" | "system";
export type ActionChannel = "email" | "sms" | "close_note" | "close_task";
export type ActionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executing"
  | "executed"
  | "failed"
  | "cancelled"
  | "expired";

export interface ToolActivityItem {
  name: string;
  status: string;
}

export interface CreatedAction {
  actionRequestId: string;
  channel: string;
}

/** Response shape from the assistant-orchestrator edge function. */
export interface OrchestratorResponse {
  conversationId: string;
  agentKey: string;
  message: string;
  toolActivity: ToolActivityItem[];
  actionRequests: CreatedAction[];
}

/** A rendered transcript turn (UI-local). */
export interface TranscriptMessage {
  id: string;
  role: AssistantRole;
  content: string;
  toolActivity?: ToolActivityItem[];
  agentKey?: string;
  /** Awaiting the first token (shows the scanning loader). */
  pending?: boolean;
  /** Tokens are actively streaming in (render live text + cursor, no Markdown). */
  streaming?: boolean;
}

export interface ActionDraftPayload {
  subject?: string;
  body?: string;
  /** Close write actions (close_note / close_task) only. */
  leadId?: string;
  leadName?: string;
  dueDate?: string;
}

/** Subset of an assistant_action_requests row used by the approval UI. */
export interface ActionRequest {
  id: string;
  channel: ActionChannel;
  tool_name: string;
  draft_payload: ActionDraftPayload | null;
  recipient: string | null;
  status: ActionStatus;
  created_at: string | null;
  error: string | null;
}

/**
 * Voice transport selection (gates which voice client renders):
 * - `legacy`   — browser MediaRecorder + Whisper STT + MediaSource MP3 playback (current).
 * - `realtime` — LiveKit Agents worker: Deepgram STT + ElevenLabs TTS + server VAD + barge-in.
 *
 * Stored as a free `text` column (no DB CHECK per project convention); this union is the
 * source of truth for valid values. Unknown/legacy DB values normalize to `legacy`.
 */
export type VoiceEngine = "legacy" | "realtime";

export interface AssistantPreferences {
  assistant_name: string;
  enabled_agents: string[];
  voice_enabled: boolean;
  voice_engine: VoiceEngine;
  sound_enabled: boolean;
  /** Opt-in gate for Jarvis durable memory (inject saved facts + allow saveMemory). */
  enabled_memory: boolean;
  tone: string;
  briefing_style: string;
}

export const DEFAULT_ASSISTANT_NAME = "Jarvis";
