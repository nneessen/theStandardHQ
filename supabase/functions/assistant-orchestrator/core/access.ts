// Access gate for the command center (Jarvis). The assistant is free for the
// owner's personal team and SOLD to everyone else via the single `ai_assistant`
// ("AI Suite") add-on. A caller may use it if ANY of: super-admin, their IMO
// grants all features for free (Epic Life `free_all_features`), their email
// carries the legacy Epic-Life marker, or they hold the AI add-on. Pure +
// dependency-free so it stays offline-testable via `deno test`; the booleans are
// resolved by the caller (see _shared/resolve-ai-access.ts).
//
// Mirrored on the frontend by useAiAccess (src/hooks/subscription/useAiAccess.ts)
// + the sidebar/route gating. Keep the predicate in sync across both layers.

const EPIC_LIFE_EMAIL_MARKER = "epiclife";

/** Case-insensitive: does this email mark the user as an Epic Life user? */
export function isEpicLifeEmail(email: string | null | undefined): boolean {
  return (
    typeof email === "string" &&
    email.toLowerCase().includes(EPIC_LIFE_EMAIL_MARKER)
  );
}

/**
 * Whether a caller may use the command center. This is the server-side boundary —
 * the deployed edge functions are HTTP-callable, so UI gating alone is not
 * sufficient. The `imoGrantsAllFeatures` arm also fixes the latent bug where an
 * Epic Life agent without "epiclife" in their email was 403'd server-side.
 */
export function canAccessAssistant(args: {
  email: string | null | undefined;
  isSuperAdmin: boolean;
  imoGrantsAllFeatures?: boolean;
  hasAiAddon?: boolean;
}): boolean {
  return (
    args.isSuperAdmin === true ||
    args.imoGrantsAllFeatures === true ||
    args.hasAiAddon === true ||
    isEpicLifeEmail(args.email)
  );
}
