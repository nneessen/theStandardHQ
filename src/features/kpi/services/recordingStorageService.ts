// src/features/kpi/services/recordingStorageService.ts
// Storage operations for call recordings in the private `call-recordings`
// bucket. Path convention: {agent_id}/{yyyy}/{mm}/{timestamp}_{sanitized}
// — storage RLS keys on foldername[1] = agent_id, so the first segment MUST be
// the agent's user id.

import { supabase } from "@/services/base/supabase";

export const CALL_RECORDINGS_BUCKET = "call-recordings";
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/** Sanitize a filename for safe storage, preserving the extension. */
function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const extension = lastDot > 0 ? name.slice(lastDot) : "";
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;

  const sanitizedBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return `${sanitizedBase || "recording"}${extension.toLowerCase()}`;
}

/** Build the storage path: {agentId}/{yyyy}/{mm}/{timestamp}_{sanitized}. */
function buildStoragePath(agentId: string, fileName: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = now.getTime();
  return `${agentId}/${yyyy}/${mm}/${timestamp}_${sanitizeFileName(fileName)}`;
}

export const recordingStorageService = {
  /** Upload a recording file into the agent's folder. Returns its storage path. */
  async upload(file: File, agentId: string): Promise<{ storagePath: string }> {
    const storagePath = buildStoragePath(agentId, file.name);

    const { error } = await supabase.storage
      .from(CALL_RECORDINGS_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload recording: ${error.message}`);
    }

    return { storagePath };
  },

  /**
   * Remove a previously-uploaded object. Used to roll back a successful upload
   * when the subsequent DB insert fails, so storage never orphans a file.
   */
  async remove(storagePath: string): Promise<void> {
    await supabase.storage.from(CALL_RECORDINGS_BUCKET).remove([storagePath]);
  },

  /** Create a short-lived signed URL for playback. Null on failure. */
  async getSignedUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(CALL_RECORDINGS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (error) {
      return null;
    }
    return data?.signedUrl ?? null;
  },
};
