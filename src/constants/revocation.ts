// src/constants/revocation.ts
// Frontend access point for the platform-sunset lifecycle windows.
//
// There is exactly ONE definition of these values, and it lives in the Deno
// edge tree (`supabase/functions/_shared/sunset-constants.ts`) because the
// auto-purge cron — the component that actually enforces the policy — is an
// edge function and can't import from the Vite `@/` world. This module simply
// re-exports those scalars so the React app reads the same numbers the cron
// acts on. Do NOT redeclare the values here; change them at the source.
export {
  /** Days after revocation a straggler account is auto-purged by the daily cron. */
  AUTO_PURGE_AFTER_DAYS,
  /** Days a post-wipe recovery archive is retained before the cron GCs it. */
  RECOVERY_TTL_DAYS,
} from "../../supabase/functions/_shared/sunset-constants";
