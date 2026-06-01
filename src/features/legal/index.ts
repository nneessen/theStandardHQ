// src/features/legal/index.ts
export { CookieConsentBanner } from "./components/CookieConsentBanner";
export { LegalPageLayout } from "./components/LegalPageLayout";
export { TermsPage } from "./pages/TermsPage";
export { PrivacyPage } from "./pages/PrivacyPage";
export { AccessibilityPage } from "./pages/AccessibilityPage";
export { useCookieConsent } from "./hooks/useCookieConsent";
export {
  TERMS_VERSION,
  TCPA_LEAD_CONSENT_VERSION,
  TCPA_LEAD_CONSENT_TEXT,
} from "./constants";
