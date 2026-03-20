// src/features/chat-bot/types/admin.types.ts
// Types for super-admin bot management panel

export interface AdminAgentListItem {
  id: string;
  user_id: string;
  external_agent_id: string;
  provisioning_status: string;
  billing_exempt: boolean;
  tier_id: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
  userName: string | null;
  userEmail: string | null;
}

export interface AdminTeamOverride {
  id: string;
  user_id: string;
  granted_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface AdminAgentListResponse {
  agents: AdminAgentListItem[];
  teamOverrides: AdminTeamOverride[];
}
