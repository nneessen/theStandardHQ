// Shared phone normalization. Suppressions/consents are keyed by E.164
// (sms-inbound-webhook stores Twilio's E.164 "From"; send-sms normalizes before
// is_suppressed), so any path that checks suppression or sends SMS MUST normalize
// first or the opt-out check silently never matches.
//
// Mirrors the original normalizePhoneNumber in send-sms (US-centric, +1 default).
// Returns null when the input can't be coerced to a plausible E.164 number.
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
