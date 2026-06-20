// src/features/inbound-crm/index.ts — public API for the inbound-CRM feature.
// Import the feature from this barrel (deep imports into the feature are lint-forbidden).
export type { InboundCallRow } from "./types";
export { InboundCallModal } from "./components/InboundCallModal";
export {
  useInboundCallClient,
  useInboundCallPolicyCount,
} from "./hooks/useInboundCallClient";
export { useInboundCallDisposition } from "./hooks/useInboundCallDisposition";
export {
  useInboundClientRecord,
  useInboundCallHistory,
  useSaveInboundIntake,
  useSaveClientRecord,
} from "./hooks/useInboundCallIntake";
export type { InboundCallHistoryRow } from "./hooks/useInboundCallIntake";

// Shared client-record form (the inbound modal and the Clients detail page both render these,
// so the live-call intake and the saved client record stay in exact parity).
export { ClientFormTabs } from "./components/clientForm/ClientFormTabs";
export {
  ClientRecordRail,
  type PolicyRow,
} from "./components/clientForm/ClientRecordRail";
export { useClientIntakeForm } from "./components/clientForm/useClientIntakeForm";
export type {
  ClientIntake,
  ClientFormState,
} from "./components/clientForm/types";
