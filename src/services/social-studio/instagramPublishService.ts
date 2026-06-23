// src/services/social-studio/instagramPublishService.ts
// Thin client for the instagram-publish-post edge function — publishes a rendered
// Social Studio graphic (at a public Storage URL) + caption to the agency's connected
// Instagram feed. The edge fn resolves the agency's integration + token server-side;
// here we just invoke it and surface a clean result/error. Mirrors socialCaptionService.

import { supabase } from "../base/supabase";

export interface PublishResult {
  mediaId: string;
  username?: string;
}

interface PublishResponse {
  ok?: boolean;
  mediaId?: string;
  username?: string;
  error?: string;
  code?: string;
  retry?: boolean;
}

async function invokePublish(
  imageUrl: string,
  caption: string,
): Promise<PublishResponse> {
  const { data, error } = await supabase.functions.invoke<PublishResponse>(
    "instagram-publish-post",
    { body: { imageUrl, caption } },
  );
  if (error)
    throw new Error(error.message || "Couldn't reach the Instagram publisher.");
  return data ?? {};
}

/**
 * Publish an image + caption to the connected Instagram feed. Retries ONCE if the
 * edge fn proactively refreshed an expiring token (code TOKEN_REFRESHED), matching
 * the instagram-send-message contract.
 */
export async function publishToInstagram(
  imageUrl: string,
  caption: string,
): Promise<PublishResult> {
  let res = await invokePublish(imageUrl, caption);
  if (!res.ok && (res.code === "TOKEN_REFRESHED" || res.retry)) {
    res = await invokePublish(imageUrl, caption);
  }
  if (!res.ok || !res.mediaId) {
    throw new Error(res.error || "Instagram couldn't publish this post.");
  }
  return { mediaId: res.mediaId, username: res.username };
}
