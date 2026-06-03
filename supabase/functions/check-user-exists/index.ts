// supabase/functions/check-user-exists/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // =========================================================================
    // AUTHORIZATION — super-admin only.
    // This is a diagnostic endpoint that enumerates users across ALL IMOs, so
    // it must never be reachable by anonymous or ordinary authenticated users.
    // It has no production callers (only a debug tool), so gating it behind a
    // verified super-admin JWT is safe.
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!bearer) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authErr } =
      await supabaseAdmin.auth.getUser(bearer);

    if (authErr || !authData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!callerProfile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: super-admin required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => null);
    const email = body?.email;
    if (typeof email !== "string" || email.trim() === "") {
      return new Response(
        JSON.stringify({ error: "A non-empty 'email' string is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const normalizedEmail = email.toLowerCase().trim();

    console.log("[check-user-exists] Checking email:", normalizedEmail);

    // Method 1: List all users and search
    const { data: listData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    const foundInList = listData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    );

    // Method 2: Check user_profiles table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    // Method 3: Check auth.identities table directly via SQL
    const { data: identityData, error: identityError } =
      await supabaseAdmin.rpc("check_auth_identity", {
        check_email: normalizedEmail,
      });

    // NOTE: This is a read-only existence check. The previous implementation
    // also (a) called auth.admin.createUser on every invocation and (b) deleted
    // "orphan" identities via a `delete_orphan` action. Both were removed: a
    // "check" must never mutate auth state — those side effects were the core
    // security defect, not just the missing auth gate.

    const result = {
      email: normalizedEmail,
      foundInAuthList: !!foundInList,
      authListUser: foundInList
        ? {
            id: foundInList.id,
            email: foundInList.email,
            created_at: foundInList.created_at,
          }
        : null,
      foundInProfiles: !!profileData,
      profileUser: profileData,
      identityCheck: identityData,
      identityError: identityError?.message,
      listError: listError?.message,
      profileError: profileError?.message,
      totalUsersInAuth: listData?.users?.length || 0,
    };

    console.log("[check-user-exists] Result:", JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[check-user-exists] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
