// Access gate for the command center. While the feature is limited to Epic Life,
// only super-admins (always) or users whose email marks them as Epic Life may use
// it. Pure + dependency-free so it stays offline-testable via `deno test`.
//
// The same rule is mirrored on the frontend (RouteGuard `requireEmailIncludes` +
// the sidebar resolver). Keep the "epiclife" marker in sync across both layers.

const EPIC_LIFE_EMAIL_MARKER = "epiclife";

/** Case-insensitive: does this email mark the user as an Epic Life user? */
export function isEpicLifeEmail(email: string | null | undefined): boolean {
  return (
    typeof email === "string" &&
    email.toLowerCase().includes(EPIC_LIFE_EMAIL_MARKER)
  );
}

/**
 * Whether a caller may use the command center during the Epic-Life-only rollout:
 * super-admins always, otherwise only Epic Life users (by email marker). This is
 * the server-side boundary — the deployed edge functions are HTTP-callable, so UI
 * gating alone is not sufficient.
 */
export function canAccessAssistant(args: {
  email: string | null | undefined;
  isSuperAdmin: boolean;
}): boolean {
  return args.isSuperAdmin === true || isEpicLifeEmail(args.email);
}
