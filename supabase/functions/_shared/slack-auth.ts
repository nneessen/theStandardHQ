import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.38.0";

export const EPIC_LIFE_IMO_ID = "89514211-f2bd-4440-9527-90a472c5e622";

type SlackAdminClient = SupabaseClient;

interface SlackProfileRow {
  imo_id: string | null;
}

interface SlackIntegrationRow {
  id: string;
  imo_id: string | null;
  bot_token_encrypted: string;
  is_active?: boolean | null;
  connection_status?: string | null;
  [key: string]: unknown;
}

export interface SlackRequestContext {
  supabaseAdmin: SlackAdminClient;
  isServiceRoleCall: boolean;
  userId: string | null;
  authHeader: string;
}

function jsonResponse(
  corsHeaders: Record<string, string>,
  status: number,
  payload: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function epicSlackDisabledResponse(
  corsHeaders: Record<string, string>,
): Response {
  return jsonResponse(corsHeaders, 200, {
    ok: true,
    skipped: true,
    reason: "Epic Life is Slack-disabled",
  });
}

export async function requireSlackRequestContext(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<SlackRequestContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(corsHeaders, 401, { ok: false, error: "Unauthorized" });
  }

  const bearerToken = authHeader.slice(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(corsHeaders, 500, {
      ok: false,
      error: "Server configuration error",
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const isServiceRoleCall = bearerToken === serviceRoleKey;
  if (isServiceRoleCall) {
    return {
      supabaseAdmin,
      isServiceRoleCall: true,
      userId: null,
      authHeader,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(bearerToken);

  if (authError || !user) {
    return jsonResponse(corsHeaders, 401, { ok: false, error: "Unauthorized" });
  }

  return {
    supabaseAdmin,
    isServiceRoleCall: false,
    userId: user.id,
    authHeader,
  };
}

async function loadUserProfileImoId(
  supabaseAdmin: SlackAdminClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("imo_id")
    .eq("id", userId)
    .maybeSingle();
  const profile = data as SlackProfileRow | null;

  if (error || !profile?.imo_id) {
    return null;
  }

  return profile.imo_id;
}

export async function authorizeSlackImoAccess(
  context: SlackRequestContext,
  corsHeaders: Record<string, string>,
  imoId: string,
): Promise<Response | null> {
  if (imoId === EPIC_LIFE_IMO_ID) {
    return epicSlackDisabledResponse(corsHeaders);
  }

  if (context.isServiceRoleCall) {
    return null;
  }

  const userImoId = await loadUserProfileImoId(
    context.supabaseAdmin,
    context.userId!,
  );

  if (!userImoId || userImoId !== imoId) {
    return jsonResponse(corsHeaders, 403, { ok: false, error: "Forbidden" });
  }

  return null;
}

export async function resolveAuthorizedSlackIntegration(
  context: SlackRequestContext,
  corsHeaders: Record<string, string>,
  options: {
    imoId?: string;
    integrationId?: string;
    requireActive?: boolean;
    requireConnected?: boolean;
  },
): Promise<{ integration: SlackIntegrationRow } | Response> {
  const {
    imoId,
    integrationId,
    requireActive = true,
    requireConnected = true,
  } = options;

  if (!imoId && !integrationId) {
    return jsonResponse(corsHeaders, 400, {
      ok: false,
      error: "Missing imoId or integrationId",
    });
  }

  if (imoId) {
    const imoAccessResponse = await authorizeSlackImoAccess(
      context,
      corsHeaders,
      imoId,
    );
    if (imoAccessResponse) {
      return imoAccessResponse;
    }
  }

  let query = context.supabaseAdmin.from("slack_integrations").select("*");

  if (requireActive) {
    query = query.eq("is_active", true);
  }
  if (requireConnected) {
    query = query.eq("connection_status", "connected");
  }

  if (integrationId) {
    query = query.eq("id", integrationId);
  } else {
    query = query.eq("imo_id", imoId as string);
  }

  const { data, error } = await query.maybeSingle();
  const integration = data as SlackIntegrationRow | null;

  if (error || !integration) {
    return jsonResponse(corsHeaders, 404, {
      ok: false,
      error: "No active Slack integration found",
    });
  }

  if (!integration.imo_id) {
    return jsonResponse(corsHeaders, 403, { ok: false, error: "Forbidden" });
  }

  if (imoId && integration.imo_id !== imoId) {
    return jsonResponse(corsHeaders, 403, { ok: false, error: "Forbidden" });
  }

  if (integration.imo_id === EPIC_LIFE_IMO_ID) {
    return epicSlackDisabledResponse(corsHeaders);
  }

  if (!context.isServiceRoleCall) {
    const userImoId = await loadUserProfileImoId(
      context.supabaseAdmin,
      context.userId!,
    );

    if (!userImoId || userImoId !== integration.imo_id) {
      return jsonResponse(corsHeaders, 403, { ok: false, error: "Forbidden" });
    }
  }

  return { integration };
}
