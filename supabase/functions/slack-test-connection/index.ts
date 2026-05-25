// supabase/functions/slack-test-connection/index.ts
// Tests Slack connection by calling auth.test API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  resolveAuthorizedSlackIntegration,
  requireSlackRequestContext,
} from "../_shared/slack-auth.ts";

interface SlackAuthTestResponse {
  ok: boolean;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    console.log("[slack-test-connection] Function invoked");
    const authContext = await requireSlackRequestContext(req, corsHeaders);
    if (authContext instanceof Response) {
      return authContext;
    }

    const body = await req.json();
    const { imoId, integrationId, testEmail } = body;

    if (!imoId && !integrationId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing imoId or integrationId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const integrationResult = await resolveAuthorizedSlackIntegration(
      authContext,
      corsHeaders,
      {
        imoId,
        integrationId,
        requireActive: false,
        requireConnected: false,
      },
    );
    if (integrationResult instanceof Response) {
      return integrationResult;
    }
    const { integration } = integrationResult;

    // Decrypt bot token
    const botToken = await decrypt(integration.bot_token_encrypted);

    // Call Slack auth.test to verify connection
    const response = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
    });

    const data: SlackAuthTestResponse = await response.json();

    // Update integration status based on result
    if (data.ok) {
      await authContext.supabaseAdmin
        .from("slack_integrations")
        .update({
          connection_status: "connected",
          last_error: null,
          last_connected_at: new Date().toISOString(),
        })
        .eq("id", integration.id);

      console.log(
        `[slack-test-connection] Connection verified for IMO ${imoId}`,
      );

      // If testEmail provided, also test email lookup and search users
      let emailLookup = null;
      let userSearch = null;
      if (testEmail) {
        try {
          const lookupResponse = await fetch(
            `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(testEmail)}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${botToken}`,
              },
            },
          );
          const lookupData = await lookupResponse.json();
          if (lookupData.ok && lookupData.user) {
            emailLookup = {
              found: true,
              id: lookupData.user.id,
              displayName:
                lookupData.user.profile?.display_name ||
                lookupData.user.profile?.real_name ||
                lookupData.user.real_name,
              email: lookupData.user.profile?.email,
              avatarUrl:
                lookupData.user.profile?.image_72 ||
                lookupData.user.profile?.image_48,
            };
          } else {
            emailLookup = {
              found: false,
              error: lookupData.error,
            };
          }
        } catch (lookupErr) {
          emailLookup = {
            found: false,
            error:
              lookupErr instanceof Error ? lookupErr.message : "Lookup failed",
          };
        }

        // If email lookup failed, search all users for matching name
        if (!emailLookup.found) {
          try {
            const searchName = testEmail.split("@")[0].toLowerCase();
            const listResponse = await fetch(
              "https://slack.com/api/users.list?limit=200",
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${botToken}`,
                },
              },
            );
            const listData = await listResponse.json();
            if (listData.ok && listData.members) {
              const matches = listData.members
                .filter(
                  (m: {
                    deleted?: boolean;
                    is_bot?: boolean;
                    name?: string;
                    real_name?: string;
                    profile?: { display_name?: string; email?: string };
                  }) =>
                    !m.deleted &&
                    !m.is_bot &&
                    (m.name?.toLowerCase().includes(searchName) ||
                      m.real_name?.toLowerCase().includes("nick") ||
                      m.profile?.display_name?.toLowerCase().includes("nick")),
                )
                .map(
                  (m: {
                    id: string;
                    name: string;
                    real_name?: string;
                    profile?: {
                      display_name?: string;
                      email?: string;
                      image_72?: string;
                    };
                  }) => ({
                    id: m.id,
                    name: m.name,
                    realName: m.real_name,
                    displayName: m.profile?.display_name,
                    email: m.profile?.email,
                    avatar: m.profile?.image_72,
                  }),
                );
              userSearch = { totalUsers: listData.members.length, matches };
            }
          } catch (searchErr) {
            userSearch = {
              error:
                searchErr instanceof Error
                  ? searchErr.message
                  : "Search failed",
            };
          }
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          team: data.team,
          user: data.user,
          emailLookup,
          userSearch,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      // Token is invalid or revoked
      await authContext.supabaseAdmin
        .from("slack_integrations")
        .update({
          connection_status: "error",
          last_error: data.error || "auth_test_failed",
        })
        .eq("id", integration.id);

      console.error(`[slack-test-connection] Auth test failed: ${data.error}`);

      return new Response(
        JSON.stringify({
          ok: false,
          error: data.error || "Connection test failed",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (err) {
    console.error("[slack-test-connection] Unexpected error:", err);
    const corsHeaders = getCorsHeaders(req.headers.get("origin"));
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
