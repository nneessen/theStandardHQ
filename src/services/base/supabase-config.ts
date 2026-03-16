const DEFAULT_LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const DEFAULT_LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const useLocalSupabase = import.meta.env.VITE_USE_LOCAL === "true";
const allowRemoteSupabaseDev =
  import.meta.env.VITE_ALLOW_REMOTE_SUPABASE_DEV === "true";
const isTestRuntime =
  import.meta.env.MODE === "test" || import.meta.env.VITEST === true;

const resolvedSupabaseUrl = useLocalSupabase
  ? import.meta.env.VITE_LOCAL_SUPABASE_URL || DEFAULT_LOCAL_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL;

const resolvedSupabaseAnonKey = useLocalSupabase
  ? import.meta.env.VITE_LOCAL_SUPABASE_ANON_KEY ||
    DEFAULT_LOCAL_SUPABASE_ANON_KEY
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!resolvedSupabaseUrl || !resolvedSupabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check local or remote Supabase env config.",
  );
}

if (
  import.meta.env.DEV &&
  !isTestRuntime &&
  !useLocalSupabase &&
  !allowRemoteSupabaseDev
) {
  throw new Error(
    "Remote Supabase is disabled in development. Set VITE_USE_LOCAL=true for Dockerized local Supabase or VITE_ALLOW_REMOTE_SUPABASE_DEV=true to opt into a remote project intentionally.",
  );
}

export const supabaseUrl = resolvedSupabaseUrl;
export const supabaseAnonKey = resolvedSupabaseAnonKey;
export const supabaseFunctionsUrl =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`;
export const isLocalSupabase = useLocalSupabase;
