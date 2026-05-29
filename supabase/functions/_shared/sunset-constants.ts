// ============================================================================
// Platform-sunset shared constants (edge functions).
// ============================================================================
// Deno edge functions can't use the `@/` alias, so the few stable ids the
// sunset flow needs live here, next to the owned-tables registry.
// ============================================================================

/**
 * FFG / Self Made — the original single-tenant IMO. This is the ONLY id the
 * activation edge function will revoke (a fail-closed allowlist). The gate
 * itself targets by data (`imos.access_revoked_at`), but the human-triggered
 * RED BUTTON refuses any other IMO so a live tenant (e.g. Epic Life) can never
 * be revoked by a fat-fingered id. Adding a second revocable IMO is a
 * deliberate code change — exactly what you want on a kill switch.
 *
 * Stable across LOCAL and REMOTE (unlike Epic Life, whose id differs per env).
 */
export const FFG_SENTINEL_IMO_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

/**
 * The deny sentinel `get_effective_imo_id()` returns for a revoked user. Never
 * NULL (NULL would re-enable the super-admin see-all hatch). Matches no real
 * row, so every IMO-scoped RLS predicate fails closed. Defined here for parity
 * checks / documentation only — the chokepoint owns the live value.
 */
export const REVOKED_DENY_SENTINEL = "00000000-0000-0000-0000-000000000000";

/**
 * Private, per-user storage buckets a wipe must purge ({user_id}/...). Shared
 * buckets and service-role/super-admin policies are untouched.
 */
export const PRIVATE_USER_BUCKETS = [
  "user-documents",
  "contract-documents",
  "presentation-recordings",
] as const;

/**
 * Recovery-archive bucket (Migration F). `snapshots/{user_id}/...` holds the
 * frozen export kept for the wipe; `recovery/{user_id}/...` is the 30-day
 * post-wipe archive. Service-role only.
 */
export const RECOVERY_BUCKET = "account-recovery-archives";
export const SNAPSHOT_PREFIX = "snapshots";
export const RECOVERY_PREFIX = "recovery";

/** Days a revoked straggler is auto-purged after; recovery archive TTL. */
export const AUTO_PURGE_AFTER_DAYS = 7;
export const RECOVERY_TTL_DAYS = 30;
