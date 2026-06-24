// src/services/social-studio/instagramPublishService.ts
// Thin client for the instagram-publish-post edge function — publishes rendered Social
// Studio graphic(s) (at public Storage URLs) + caption to the agency's connected
// Instagram account. One or more images route server-side to a single feed post, a
// carousel (2–10), or a Story; an optional integrationId pins which connected account.
// The edge fn resolves the integration + token; here we just invoke + surface a result.

import { supabase } from "../base/supabase";

export interface PublishResult {
  mediaId: string;
  username?: string;
}

/** FEED → single image or carousel; STORIES → a single Story frame (no caption). */
export type PublishMediaType = "FEED" | "STORIES";

export interface PublishOptions {
  mediaType?: PublishMediaType;
  /** Which connected account to post to; omit to use the agency's most-recent. */
  integrationId?: string;
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
  imageUrls: string[],
  caption: string,
  opts?: PublishOptions,
): Promise<PublishResponse> {
  const { data, error } = await supabase.functions.invoke<PublishResponse>(
    "instagram-publish-post",
    {
      body: {
        imageUrls,
        caption,
        mediaType: opts?.mediaType ?? "FEED",
        integrationId: opts?.integrationId,
      },
    },
  );
  if (error)
    throw new Error(error.message || "Couldn't reach the Instagram publisher.");
  return data ?? {};
}

/**
 * Publish image(s) + caption to the connected Instagram account. One URL → single feed
 * post (or a Story when mediaType is STORIES); 2–10 URLs → a carousel. Retries ONCE if
 * the edge fn proactively refreshed an expiring token (code TOKEN_REFRESHED), matching
 * the instagram-send-message contract.
 */
export async function publishToInstagram(
  imageUrls: string[],
  caption: string,
  opts?: PublishOptions,
): Promise<PublishResult> {
  let res = await invokePublish(imageUrls, caption, opts);
  if (!res.ok && (res.code === "TOKEN_REFRESHED" || res.retry)) {
    res = await invokePublish(imageUrls, caption, opts);
  }
  if (!res.ok || !res.mediaId) {
    throw new Error(res.error || "Instagram couldn't publish this post.");
  }
  return { mediaId: res.mediaId, username: res.username };
}
