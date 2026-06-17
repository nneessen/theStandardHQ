/**
 * US-centric E.164 phone normalizer — the Vite/browser twin of
 * `supabase/functions/_shared/phone.ts` (Deno) and the SQL
 * `public.normalize_phone_e164()` that backs the `clients.phone_e164`
 * generated column used for the inbound-call Agent-of-Record lookup.
 *
 * ALL THREE implementations must stay in lockstep. Parity is gated by:
 *   - src/lib/__tests__/phone.test.ts  (this TS twin vs the fixed vector set)
 *   - scripts/test-phone-parity.mjs     (the SQL function vs the same vectors)
 *
 * Returns `null` when the input cannot be coerced to a plausible E.164 number.
 */
export function normalizePhoneNumber(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;

  const cleaned = phone.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    if (cleaned.length >= 11 && cleaned.length <= 15) return cleaned;
    return null;
  }

  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`;

  return null;
}
