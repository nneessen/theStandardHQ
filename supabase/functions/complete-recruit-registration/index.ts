import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const registrationFormSchema = z
  .object({
    first_name: z.string().min(1).max(200),
    last_name: z.string().min(1).max(200),
    phone: z.string().max(50).optional(),
    date_of_birth: z.string().max(50).optional(),
    street_address: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zip: z.string().max(20).optional(),
    instagram_username: z.string().max(100).optional(),
    facebook_handle: z.string().max(100).optional(),
    personal_website: z.string().max(255).optional(),
    referral_source: z.string().max(255).optional(),
  })
  .strict();

const completeRecruitRegistrationRequestSchema = z
  .object({
    token: z.string().uuid(),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    formData: registrationFormSchema,
  })
  .strict();

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendSmsNotification(
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber =
    Deno.env.get("MY_TWILIO_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    console.log(
      "[complete-recruit-registration] SMS skipped - Twilio not configured",
    );
    return { success: false, error: "Twilio not configured" };
  }

  const cleanPhone = phoneNumber.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    return { success: false, error: "Invalid phone number" };
  }

  const formattedPhone =
    cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const body = new URLSearchParams({
      To: formattedPhone,
      From: fromNumber,
      Body: message,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[complete-recruit-registration] Twilio error:", errorText);
      return { success: false, error: `Twilio API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("[complete-recruit-registration] SMS send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function rollbackCreatedUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { error: deleteAuthError } =
    await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    console.error(
      "[complete-recruit-registration] Failed to delete auth user during rollback:",
      {
        userId,
        error: deleteAuthError,
      },
    );
  }

  const { error: deleteProfileError } = await supabaseAdmin
    .from("user_profiles")
    .delete()
    .eq("id", userId);

  if (deleteProfileError) {
    console.error(
      "[complete-recruit-registration] Failed to delete profile during rollback:",
      {
        userId,
        error: deleteProfileError,
      },
    );
  }
}

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

    const rawBody = await req.json();
    const parsedRequest =
      completeRecruitRegistrationRequestSchema.safeParse(rawBody);

    if (!parsedRequest.success) {
      return jsonResponse(200, {
        success: false,
        error: "validation_error",
        message: "Invalid registration payload.",
      });
    }

    const { token, email, password, formData } = parsedRequest.data;

    const normalizedEmail = email.toLowerCase().trim();

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("recruit_invitations")
      .select("id, email, status, expires_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (invitationError) {
      console.error(
        "[complete-recruit-registration] Failed to validate invitation:",
        invitationError,
      );
      return jsonResponse(500, {
        success: false,
        error: "invitation_validation_failed",
        message: "Failed to validate invitation.",
      });
    }

    if (!invitation) {
      return jsonResponse(200, {
        success: false,
        error: "invitation_not_found",
        message: "This invitation link is invalid or has been removed.",
      });
    }

    if (invitation.status === "completed") {
      return jsonResponse(200, {
        success: false,
        error: "already_completed",
        message: "This registration has already been completed.",
      });
    }

    if (invitation.status === "cancelled") {
      return jsonResponse(200, {
        success: false,
        error: "invitation_cancelled",
        message: "This invitation has been cancelled.",
      });
    }

    if (
      invitation.expires_at &&
      new Date(invitation.expires_at).getTime() < Date.now()
    ) {
      await supabaseAdmin
        .from("recruit_invitations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      return jsonResponse(200, {
        success: false,
        error: "invitation_expired",
        message: "This invitation has expired.",
      });
    }

    if (invitation.email?.toLowerCase().trim() !== normalizedEmail) {
      return jsonResponse(200, {
        success: false,
        error: "email_mismatch",
        message:
          "This invitation is only valid for the email address it was sent to.",
      });
    }

    const firstName =
      typeof formData.first_name === "string" ? formData.first_name.trim() : "";
    const lastName =
      typeof formData.last_name === "string" ? formData.last_name.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          roles: ["recruit"],
          is_admin: false,
          skip_pipeline: false,
        },
      });

    if (authError) {
      const errorMessage = authError.message?.toLowerCase() || "";
      if (
        errorMessage.includes("already registered") ||
        errorMessage.includes("already exists") ||
        errorMessage.includes("duplicate")
      ) {
        return jsonResponse(200, {
          success: false,
          error: "email_exists",
          message: "An account with this email already exists.",
        });
      }

      throw authError;
    }

    const authUserId = authData.user?.id;
    if (!authUserId) {
      throw new Error("Auth user was created but no ID was returned");
    }

    const { data: registrationData, error: registrationError } =
      await supabaseAdmin.rpc("submit_recruit_registration", {
        p_token: token,
        p_data: formData,
        p_auth_user_id: authUserId,
      });

    if (registrationError) {
      await rollbackCreatedUser(supabaseAdmin, authUserId);
      throw registrationError;
    }

    const registrationResult =
      registrationData && typeof registrationData === "object"
        ? (registrationData as Record<string, unknown>)
        : null;

    if (!registrationResult) {
      await rollbackCreatedUser(supabaseAdmin, authUserId);
      return jsonResponse(200, {
        success: false,
        error: "submission_failed",
        message: "Registration failed. Please try again.",
      });
    }

    if (registrationResult.success !== true) {
      await rollbackCreatedUser(supabaseAdmin, authUserId);
      return jsonResponse(200, registrationResult);
    }

    let smsSent = false;
    const phone =
      typeof formData.phone === "string" ? formData.phone.trim() : "";

    if (phone) {
      const smsResult = await sendSmsNotification(
        phone,
        "Welcome to The Standard HQ! Your account has been created. You can now log in.",
      );
      smsSent = smsResult.success;
    }

    return jsonResponse(200, {
      ...registrationResult,
      authUserId,
      smsSent,
    });
  } catch (error) {
    console.error("[complete-recruit-registration] Error:", error);
    return jsonResponse(500, {
      success: false,
      error: "registration_failed",
      message:
        error instanceof Error
          ? error.message
          : "Failed to complete registration.",
    });
  }
});
