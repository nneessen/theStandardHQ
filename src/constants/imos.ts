// src/constants/imos.ts
// Centralized IMO id constants — SINGLE SOURCE OF TRUTH.

/**
 * FFG / Self Made — the original single-tenant IMO. This is the all-Fs sentinel
 * id (`ffffffff-…`), stable across LOCAL and REMOTE (unlike Epic Life, whose id
 * differs per environment).
 *
 * It is the ONLY IMO the platform-sunset RED BUTTON will revoke (the
 * `activate-imo-revocation` edge function enforces a fail-closed allowlist on
 * exactly this id). Used by:
 * - CommissionRatesManagement (FFG-specific comp-rate management)
 * - PlatformRevocationControl (the RED BUTTON targets this IMO)
 */
export const FFG_IMO_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
