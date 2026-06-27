// src/services/social-studio/agentPhotoService.ts
// Photo manager for the Social Studio "New Agents" section: an IMO admin uploads MULTIPLE
// photos on behalf of an agent, reorders them (rotation order), marks a primary (the
// avatar), and removes them. Files live in the public `recruiting-assets` bucket under the
// agent's folder ({agentId}/...); rows live in `agent_photos`. A DB trigger keeps
// user_profiles.profile_photo_url in sync with the primary photo.
//
// agent_photos isn't in the generated database.types (Phase C-B migration), so writes use a
// LOCALIZED TYPE BRIDGE ((supabase as any)), the same pattern as agentWelcomeService.
//
// Lives in the service layer so the feature/UI never touches the Supabase client directly.

import { supabase } from "../base/supabase";

const BUCKET = "recruiting-assets";

export interface AgentPhoto {
  id: string;
  agentId: string;
  photoUrl: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

interface AgentPhotoRow {
  id: string;
  agent_id: string;
  photo_url: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

function toPhoto(r: AgentPhotoRow): AgentPhoto {
  return {
    id: r.id,
    agentId: r.agent_id,
    photoUrl: r.photo_url,
    sortOrder: r.sort_order,
    isPrimary: r.is_primary,
    createdAt: r.created_at,
  };
}

/** Recover the storage object path ("{agentId}/photo_x.png") from a public URL so the
 *  object can be removed when its row is deleted. Returns null if the URL isn't a
 *  recruiting-assets public URL (then the object is left alone). */
function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  // Strip any cache-bust query.
  return url.slice(i + marker.length).split("?")[0] || null;
}

/** An agent's photos in rotation (sort) order. */
export async function listAgentPhotos(agentId: string): Promise<AgentPhoto[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agent_photos")
    .select("id, agent_id, photo_url, sort_order, is_primary, created_at")
    .eq("agent_id", agentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as AgentPhotoRow[]).map(toPhoto);
}

export interface AddAgentPhotoInput {
  agentId: string;
  imoId: string;
  file: File;
  /** Append after the current last photo (rotation order). */
  sortOrder: number;
  /** Make this the avatar (synced to profile_photo_url by the DB trigger). */
  isPrimary?: boolean;
}

/** Upload one photo for an agent and insert its row. Rolls back the orphaned object if the
 *  row insert fails (RLS / constraint), so a failed add never leaves a world-readable file. */
export async function addAgentPhoto(
  input: AddAgentPhotoInput,
): Promise<AgentPhoto> {
  const { agentId, imoId, file, sortOrder, isPrimary = false } = input;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${agentId}/photo_${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { data: u } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agent_photos")
    .insert({
      imo_id: imoId,
      agent_id: agentId,
      photo_url: pub.publicUrl,
      sort_order: sortOrder,
      is_primary: isPrimary,
      uploaded_by: u.user?.id ?? null,
    })
    .select("id, agent_id, photo_url, sort_order, is_primary, created_at")
    .single();

  if (error) {
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => {});
    throw error;
  }
  return toPhoto(data as AgentPhotoRow);
}

/** Delete a photo's row (the trigger re-syncs the avatar), then best-effort delete the
 *  object so a removed face isn't left world-readable. */
export async function removeAgentPhoto(photo: AgentPhoto): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("agent_photos")
    .delete()
    .eq("id", photo.id);
  if (error) throw error;
  const path = storagePathFromPublicUrl(photo.photoUrl);
  if (path)
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => {});
}

/** Mark one photo primary (the avatar). Clears the others FIRST so the
 *  one-primary-per-agent partial unique index never transiently sees two. */
export async function setPrimaryAgentPhoto(
  agentId: string,
  photoId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: e1 } = await (supabase as any)
    .from("agent_photos")
    .update({ is_primary: false })
    .eq("agent_id", agentId)
    .neq("id", photoId);
  if (e1) throw e1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: e2 } = await (supabase as any)
    .from("agent_photos")
    .update({ is_primary: true })
    .eq("id", photoId);
  if (e2) throw e2;
}

/** Persist a new rotation order: sort_order = position in `orderedIds`. */
export async function reorderAgentPhotos(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("agent_photos")
        .update({ sort_order: i })
        .eq("id", id)
        .then(({ error }: { error: unknown }) => {
          if (error) throw error;
        }),
    ),
  );
}

/** Advance an agent's rotation cursor (call AFTER a successful welcome post/schedule so the
 *  NEXT post uses the next photo). Scoped server-side to the caller's IMO. Best-effort. */
export async function bumpAgentPhotoRotation(agentId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("bump_agent_photo_rotation", {
    p_agent_id: agentId,
  });
  if (error) throw error;
}
