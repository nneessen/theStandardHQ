// src/services/social-studio/spotlightAssetService.ts
// Storage access for the Spotlight (Social Studio) agent photo. Lives in the
// service layer so the feature/UI never touches the Supabase client directly
// (eslint: UI/features must not import infrastructure).

import { supabase } from "../base/supabase";

const BUCKET = "spotlight-assets";
const PHOTO_KEY = "aotw-photo";
const POST_KEY = "social-post";

/**
 * Read a File as a data: URL — the card's render source. A data URL is what makes
 * the in-app preview AND the PNG export capture the image with zero
 * cross-origin dependency (a remote URL silently drops from the export on a CORS
 * miss). Pure; shared by the photo upload and the (storage-free) background upload.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export interface UploadedAgentPhoto {
  /** data: URL the card renders (CORS-proof in the PNG export). */
  dataUrl: string;
  /** Cache-busted public Storage URL, kept for later Instagram posting. */
  storageUrl: string;
}

/**
 * Upload the AOTW agent photo to the public spotlight-assets bucket under a stable
 * per-owner key (upsert → re-uploads never orphan a prior face). Returns the render
 * data URL and the public URL atomically (both only on full success).
 */
export async function uploadAgentPhoto(
  file: File,
): Promise<UploadedAgentPhoto> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  const path = `${uid}/${PHOTO_KEY}`;
  const [dataUrl] = await Promise.all([
    readFileAsDataUrl(file),
    supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true })
      .then(({ error }) => {
        if (error) throw error;
      }),
  ]);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust the stable URL so a later consumer (P2/P3 IG posting) fetches the
  // newest upload, not a CDN-cached prior image at the same key.
  return { dataUrl, storageUrl: `${pub.publicUrl}?v=${Date.now()}` };
}

/**
 * Upload a RENDERED post image (a PNG data: URL from the in-app screenshot) to the
 * public bucket so Instagram can fetch it (the Graph API requires a public https URL).
 * Stable per-owner key + cache-busted URL → no orphan accumulation, and IG always
 * fetches the newest render. Returns the public URL. (Used by "Post to Instagram".)
 */
export async function uploadGeneratedPost(dataUrl: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not authenticated");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${uid}/${POST_KEY}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

/**
 * Delete the owner's AOTW photo object — "Remove" must not leave a face
 * world-readable in the public bucket. Best-effort; the caller clears the UI even
 * if the delete fails.
 */
export async function removeAgentPhoto(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (uid) {
    await supabase.storage.from(BUCKET).remove([`${uid}/${PHOTO_KEY}`]);
  }
}
