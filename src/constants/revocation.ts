// src/constants/revocation.ts
// Frontend mirror of the platform-sunset lifecycle windows. The authoritative
// copy lives in `supabase/functions/_shared/sunset-constants.ts` (Deno, can't be
// imported here). Keep the two in sync — they describe the same policy.

/** Days after revocation a straggler account is auto-purged by the daily cron. */
export const AUTO_PURGE_AFTER_DAYS = 7;

/** Days a post-wipe recovery archive is retained before the cron GCs it. */
export const RECOVERY_TTL_DAYS = 30;
