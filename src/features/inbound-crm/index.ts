// src/features/inbound-crm/index.ts — public API for the inbound-CRM feature.
// Import the feature from this barrel (deep imports into the feature are lint-forbidden).
export type { InboundCallRow } from "./types";
export { InboundCallPop } from "./components/InboundCallPop";
export {
  useInboundCallClient,
  useInboundCallPolicyCount,
} from "./hooks/useInboundCallClient";
export {
  useInboundCallTypes,
  useInboundCarriers,
  useInboundCallDisposition,
} from "./hooks/useInboundCallDisposition";
