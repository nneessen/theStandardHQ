// Frontend types for the Jarvis command center. Mirror the orchestrator response and
// the assistant_action_requests row shape (subset the UI needs).

export type AssistantRole = "user" | "assistant" | "tool" | "system";
export type ActionChannel = "email" | "sms";
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
  pending?: boolean;
}

export interface ActionDraftPayload {
  subject?: string;
  body?: string;
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

export interface AssistantPreferences {
  assistant_name: string;
  enabled_agents: string[];
  voice_enabled: boolean;
  sound_enabled: boolean;
  tone: string;
  briefing_style: string;
}

export const DEFAULT_ASSISTANT_NAME = "Jarvis";
