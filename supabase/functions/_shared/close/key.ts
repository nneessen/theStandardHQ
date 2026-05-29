// Resolve a user's decrypted Close API key for SERVER-SIDE write use.
//
// get_close_api_key is service_role-only and returns the ENCRYPTED key; this helper
// fetches it for the VERIFIED userId only (the caller passes the JWT-verified id —
// never a model/payload-supplied value) and decrypts it. It is used by the trusted
// assistant-action-execute backend, which already handles raw secrets; the key is
// never returned to the model-facing tool layer.
//
// NOTE (consolidation, deferred): the orchestrator's close/provider.ts and
// close-lead-drop's getCallerApiKey predate this and keep their own copies of the
// same fetch+decrypt. New write callers should use this; folding the others in is a
// separate cleanup (same note as _shared/close/client.ts).

import { createSupabaseAdminClient } from "../supabase-client.ts";
import { decrypt } from "../encryption.ts";

/**
 * Returns the decrypted Close API key for `userId`, or null when the user has no
 * active close_config row (caller should surface "not connected"). Mirrors the
 * local-dev gate used elsewhere: a shared CLOSE_API_KEY env is honored ONLY when
 * ENVIRONMENT=local, so a stray prod env value can never act for users in prod.
 */
export async function getUserCloseKey(userId: string): Promise<string | null> {
  if (Deno.env.get("ENVIRONMENT") === "local") {
    const envKey = Deno.env.get("CLOSE_API_KEY");
    if (envKey) return envKey;
  }
  const svc = createSupabaseAdminClient();
  const { data: encrypted, error } = await svc.rpc("get_close_api_key", {
    p_user_id: userId,
  });
  if (error || !encrypted || typeof encrypted !== "string") return null;
  try {
    return await decrypt(encrypted);
  } catch (e) {
    // Never log the key/ciphertext — message only.
    console.error(
      "getUserCloseKey: failed to decrypt Close key",
      e instanceof Error ? e.message : "unknown",
    );
    return null;
  }
}
