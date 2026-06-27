// src/services/social-studio/agentWelcomeService.ts
// The "welcome new agent" approval queue (agent_welcome_posts): list the owner's pending drafts
// and approve / deny them. RLS scopes reads to the caller's agency + super-admin; the approve/deny
// RPCs are super-admin-gated server-side. The table + RPCs aren't in the generated database.types
// yet (the migration applies at go-live), so this uses a LOCALIZED TYPE BRIDGE — the same `(supabase
// as any)` cast pattern as accountSetupService — with hand-written row/result shapes.

import { supabase } from "../base/supabase";

export type WelcomePostStatus = "pending" | "approved" | "denied";

/** A queued welcome draft (data only — the PNG is rendered client-side at approval). */
export interface WelcomeDraft {
  id: string;
  imoId: string;
  agentId: string;
  /** Full name as captured at upload time (format to last-initial in the card layer). */
  agentName: string;
  /** Public profile-photo URL (recruiting-assets bucket). */
  photoUrl: string;
  status: WelcomePostStatus;
  createdAt: string;
}

interface WelcomeDraftRow {
  id: string;
  imo_id: string;
  agent_id: string;
  agent_name: string;
  photo_url: string;
  status: WelcomePostStatus;
  created_at: string;
}

function toDraft(r: WelcomeDraftRow): WelcomeDraft {
  return {
    id: r.id,
    imoId: r.imo_id,
    agentId: r.agent_id,
    agentName: r.agent_name,
    photoUrl: r.photo_url,
    status: r.status,
    createdAt: r.created_at,
  };
}

/** Pending welcome drafts for the owner's agency, oldest first (RLS enforces the scope). */
export async function listPendingWelcomePosts(): Promise<WelcomeDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agent_welcome_posts")
    .select("id,imo_id,agent_id,agent_name,photo_url,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as WelcomeDraftRow[]).map(toDraft);
}

/** Mark a draft approved (call AFTER the post has been scheduled/published from the browser). */
export async function approveWelcomePost(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("approve_agent_welcome_post", {
    p_id: id,
  });
  if (error) throw error;
}

/** Drop a draft (the agent won't get a welcome post). */
export async function denyWelcomePost(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("deny_agent_welcome_post", {
    p_id: id,
  });
  if (error) throw error;
}
