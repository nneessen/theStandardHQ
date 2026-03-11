// Core infrastructure
export { supabase, TABLES } from "./base/supabase";

// Base classes and types
export * from "./base";

// Feature-organized services
export * from "./policies";
export * from "./commissions";
export * from "./expenses";
export * from "./settings";
export * from "./analytics";
export * from "./users";
export * from "./imo";
export * from "./agency";
export * from "./agency-request";
export * from "./join-request";
export * from "./notifications";
export * from "./audit";
export * from "./hierarchy";
export * from "./email";
export * from "./subscription";
export * from "./recruiting";
export * from "./underwriting";
export * from "./documents";
export * from "./document-extraction";
export * from "./leads";
export * from "./clients";
// Individual service exports for backward compatibility
export { carrierService } from "./settings/carriers";
export { constantsService } from "./settings/constantsService";
export { userService, userApprovalService } from "./users/userService";
export { compGuideService } from "./settings/comp-guide";
export { agentSettingsService } from "./settings/agentSettingsService";
export { chargebackService } from "./commissions/chargebackService";
export { commissionRateService } from "./commissions/commissionRateService";
export { breakevenService } from "./analytics/breakevenService";

// Legacy service exports for backward compatibility
export { policyService } from "./policies/policyService";
export { commissionService } from "./commissions/commissionService";
export { expenseService } from "./expenses";
export { clientService } from "./clients";

// Gmail integration
export * from "./gmail";

// Type exports
export type { CreatePolicyData, UpdatePolicyData } from "../types/policy.types";
export type {
  CreateCommissionData,
  UpdateCommissionData,
} from "../types/commission.types";
export type {
  CreateExpenseData,
  UpdateExpenseData,
} from "../types/expense.types";
export type {
  ProductFormData as CreateProductData,
  NewCommissionRateForm as CreateCommissionRateData,
} from "../types/product.types";
