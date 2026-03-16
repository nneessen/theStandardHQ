// src/services/base/index.ts
export { supabase } from "./supabase";
export {
  supabaseUrl,
  supabaseAnonKey,
  supabaseFunctionsUrl,
  isLocalSupabase,
} from "./supabase-config";
export {
  BaseRepository,
  type BaseEntity,
  type QueryOptions,
  type FilterOptions,
} from "./BaseRepository";
export {
  BaseService,
  type ServiceResponse,
  type ListResponse,
  type ValidationRule,
} from "./BaseService";
export {
  getCurrentTenantContext,
  getTenantContextSafe,
  getTenantFields,
  type TenantContext,
} from "./TenantContext";
