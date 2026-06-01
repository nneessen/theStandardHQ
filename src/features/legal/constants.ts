// src/features/legal/constants.ts
//
// Current version of the platform Terms of Service / Privacy Policy. This is the
// "Last Updated" date rendered on /terms and /privacy. The first-login
// acceptance gate records this string against the user, so bumping it here when
// the Terms materially change will re-prompt every user to re-accept.
export const TERMS_VERSION = "2026-05-11";

// TCPA "prior express written consent" disclosure shown on public lead-capture
// forms that collect a phone number, and recorded verbatim against the lead in
// the communication_consent ledger. This is hard-coded into the shared lead form
// so a recruiter's custom branding/disclaimer can never remove it. Bump the
// version whenever the wording changes so each recorded consent ties to the exact
// language the person saw. NOTE: exact wording should be reviewed by counsel.
export const TCPA_LEAD_CONSENT_VERSION = "2026-06-01";
export const TCPA_LEAD_CONSENT_TEXT =
  "By checking this box and submitting this form, I agree to the Terms of Service and Privacy Policy, and I give my prior express written consent to be contacted at the phone number and email address I provided — including by phone call, text message (SMS), email, and automated dialing, prerecorded/artificial voice, and AI-generated voice — regarding insurance career and business opportunities. I understand this consent is not a condition of any purchase or employment. Message frequency may vary; message and data rates may apply. Reply STOP to opt out of texts at any time, or HELP for help.";
