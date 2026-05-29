// Close key provider for the orchestrator.
//
// The orchestrator runs on the USER's JWT, but `get_close_api_key` is service_role
// only and returns the ENCRYPTED key. This module is the one place that crosses that
// boundary: it uses a service-role client SOLELY to fetch + decrypt the key for the
// VERIFIED caller (ctx.userId from the JWT), then hands the tool layer a read-only
// client already bound to that key.
//
// SAFETY: createCloseProvider() captures `userId` in its closure and exposes only
// getClient() — there is NO user-id parameter the model or a tool could supply. This
// makes the per-user key boundary structural. The raw key never leaves this file.
//
// This file (unlike the pure tools/ + core/ layers) intentionally imports supabase-js
// and the encryption module; it is wired up by index.ts, which already does esm I/O.

import { createSupabaseAdminClient } from "../../_shared/supabase-client.ts";
import { decrypt } from "../../_shared/encryption.ts";
import { bindCloseReadClient } from "../../_shared/close/client.ts";
import type { CloseProvider, CloseReadClient } from "../tools/types.ts";

export function createCloseProvider(userId: string): CloseProvider {
  let resolved: Promise<CloseReadClient | null> | null = null;

  async function resolve(): Promise<CloseReadClient | null> {
    // Local-dev shortcut: a shared CLOSE_API_KEY in env, honored ONLY when
    // ENVIRONMENT=local so a stray env value can never act for users in prod.
    if (Deno.env.get("ENVIRONMENT") === "local") {
      const envKey = Deno.env.get("CLOSE_API_KEY");
      if (envKey) return bindCloseReadClient(envKey);
    }

    // Fetch the ENCRYPTED key for the verified caller only. Returns null (→ the
    // tool reports "not connected") when the user has no active close_config row.
    const svc = createSupabaseAdminClient();
    const { data: encrypted, error } = await svc.rpc("get_close_api_key", {
      p_user_id: userId,
    });
    if (error || !encrypted || typeof encrypted !== "string") return null;

    let apiKey: string;
    try {
      apiKey = await decrypt(encrypted);
    } catch (e) {
      // Never log the key or ciphertext — message only.
      console.error(
        "createCloseProvider: failed to decrypt Close key",
        e instanceof Error ? e.message : "unknown",
      );
      return null;
    }
    if (!apiKey) return null;
    return bindCloseReadClient(apiKey);
  }

  return {
    getClient() {
      if (!resolved) resolved = resolve();
      return resolved;
    },
  };
}
