// src/services/base/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "./supabase-config";

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
);

// Re-export TABLES from dedicated module
export { TABLES } from "./tables";
