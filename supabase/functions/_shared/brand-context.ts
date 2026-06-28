// Shared: fetch the caller's per-IMO AI brand context (positioning + hard messaging rules)
// so every AI template generator (carousel compose, caption, marketing copy, …) speaks in
// the agency's voice WITHOUT the user re-typing it each time. Stored in public.ai_brand_context,
// editable from the app. Read with the service-role admin client (RLS-exempt).
//
// deno-lint-ignore-file no-explicit-any

export async function getBrandContext(
  admin: any,
  userId: string,
): Promise<string> {
  try {
    const { data: prof } = await admin
      .from("user_profiles")
      .select("imo_id")
      .eq("id", userId)
      .maybeSingle();
    const imoId = prof?.imo_id;
    if (!imoId) return "";
    const { data } = await admin
      .from("ai_brand_context")
      .select("context")
      .eq("imo_id", imoId)
      .maybeSingle();
    return (data?.context ?? "").trim();
  } catch {
    return ""; // brand context is best-effort — never block generation on it
  }
}

/** Wrap the brand context as an authoritative leading block for any system prompt. */
export function brandBlock(brand: string): string {
  if (!brand) return "";
  return `AGENCY BRAND CONTEXT — AUTHORITATIVE. Everything you write MUST fit this, and you MUST obey its hard rules over any generic instinct:\n${brand}\n\n`;
}
