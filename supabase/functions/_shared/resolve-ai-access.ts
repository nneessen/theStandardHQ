// supabase/functions/_shared/resolve-ai-access.ts
// Server-side mirror of the client useAiAccess hook (src/hooks/subscription/
// useAiAccess.ts). The deployed edge functions are HTTP-callable independent of
// the UI, so AI gating MUST be enforced here too — UI gating alone is not enough.
//
// "AI access" = super-admin OR the caller's IMO grants all features for free
// (Epic Life `free_all_features` — the owner's personal team) OR the caller holds
// the single `ai_assistant` ("AI Suite") add-on (active or manual_grant).
//
// Reads run on an ADMIN (service_role) client and FAIL CLOSED on any error.

// deno-lint-ignore-file no-explicit-any

/** Name of the single AI add-on (matches subscription_addons.name). */
export const AI_ASSISTANT_ADDON_NAME = "ai_assistant";

export interface AiAccessFacts {
  /** user_profiles.is_super_admin */
  isSuperAdmin: boolean;
  /** imos.free_all_features for the caller's IMO (the personal-team free path) */
  imoGrantsAllFeatures: boolean;
  /** Holds the ai_assistant add-on (status active or manual_grant) */
  hasAiAddon: boolean;
}

/**
 * Whether the user holds the `ai_assistant` add-on (active or manual_grant).
 * Two-step (resolve addon id, then membership) to avoid PostgREST embedded-filter
 * subtleties. Fails closed.
 */
export async function callerHoldsAiAddon(
  adminClient: any,
  userId: string,
): Promise<boolean> {
  try {
    const { data: addonRow, error: addonErr } = await adminClient
      .from("subscription_addons")
      .select("id")
      .eq("name", AI_ASSISTANT_ADDON_NAME)
      .maybeSingle();
    if (addonErr || !addonRow?.id) return false;

    const { data, error } = await adminClient
      .from("user_subscription_addons")
      .select("id")
      .eq("user_id", userId)
      .eq("addon_id", addonRow.id)
      .in("status", ["active", "manual_grant"])
      .limit(1);
    if (error) {
      console.error(
        "resolve-ai-access: addon membership read failed (fail-closed)",
        error?.code ?? error?.message ?? "",
      );
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.error(
      "resolve-ai-access: callerHoldsAiAddon threw (fail-closed)",
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

/**
 * Resolve the three AI-access facts for a caller in a single pass. Works for both
 * the assistant gate (combined with the email marker via canAccessAssistant) and
 * the embedded-AI gates (combined with the recording's IMO epic check).
 */
export async function resolveAiAccessFacts(
  adminClient: any,
  userId: string,
): Promise<AiAccessFacts> {
  let isSuperAdmin = false;
  let imoGrantsAllFeatures = false;

  try {
    const { data: prof } = await adminClient
      .from("user_profiles")
      .select("is_super_admin, imo_id")
      .eq("id", userId)
      .maybeSingle();
    isSuperAdmin = prof?.is_super_admin === true;

    if (prof?.imo_id) {
      const { data: imo } = await adminClient
        .from("imos")
        .select("free_all_features")
        .eq("id", prof.imo_id)
        .maybeSingle();
      imoGrantsAllFeatures = imo?.free_all_features === true;
    }
  } catch (e) {
    // fail closed — leave both false. Log so a transient DB error that 403s an
    // entitled caller (incl. a super-admin) is diagnosable rather than silent.
    console.error(
      "resolve-ai-access: resolveAiAccessFacts profile/imo read threw (fail-closed)",
      e instanceof Error ? e.message : String(e),
    );
  }

  const hasAiAddon = await callerHoldsAiAddon(adminClient, userId);
  return { isSuperAdmin, imoGrantsAllFeatures, hasAiAddon };
}
