// supabase/functions/crm-oauth-token/index.ts
// OAuth2 client-credentials token endpoint for the external inbound-call platform.
//
// Thin entrypoint only: the request logic (credential verification, the bcrypt RPC, the
// fail-closed DoS rate-limit gates, and token minting) lives in ./handler.ts so it is
// unit-testable without binding a port. See handler.ts for the full flow + threat model.
//
// Auth model: this endpoint has its OWN auth (client_id/secret), so config.toml sets
// verify_jwt=false. Machine-to-machine — no browser origin, so no _shared/cors.ts.
//
// Required secrets (Deno.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-set by the
// runtime), CRM_CALL_PLATFORM_SIGNING_KEY (bearer signing key), CRM_INSTANCE_URL (the base
// URL the platform targets for /api/v1/leads — confirmed at onboarding).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleOAuthTokenRequest } from "./handler.ts";

serve((req: Request): Promise<Response> => handleOAuthTokenRequest(req));
