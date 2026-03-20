/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_FUNCTIONS_URL?: string;
  readonly VITE_USE_LOCAL?: string;
  readonly VITE_ALLOW_REMOTE_SUPABASE_DEV?: string;
  readonly VITE_LOCAL_SUPABASE_URL?: string;
  readonly VITE_LOCAL_SUPABASE_ANON_KEY?: string;
  readonly VITE_INSTAGRAM_APP_ID?: string;
  readonly VITEST?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
