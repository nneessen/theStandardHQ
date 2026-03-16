// supabase/functions/create-auth-user/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const INTERNAL_ROLE_ALLOWLIST = new Set([
  "admin",
  "agent",
  "active_agent",
  "trainer",
  "contracting_manager",
  "recruiter",
  "upline_manager",
  "office_staff",
]);

const UPLINE_ROLE_ALLOWLIST = new Set([
  "admin",
  "agent",
  "active_agent",
  "trainer",
  "contracting_manager",
  "upline_manager",
]);

const RECRUITING_PERMISSION_CODES = ["nav.recruiting_pipeline"];
const USER_MANAGEMENT_PERMISSION_CODES = [
  "nav.user_management",
  "users.manage",
];

const profileDataSchema = z
  .object({
    first_name: z.string().max(200).optional(),
    last_name: z.string().max(200).optional(),
    phone: z.string().max(50).nullable().optional(),
    date_of_birth: z.string().max(50).nullable().optional(),
    street_address: z.string().max(255).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    state: z.string().max(50).nullable().optional(),
    resident_state: z.string().max(50).nullable().optional(),
    zip: z.string().max(20).nullable().optional(),
    agent_status: z
      .enum(["unlicensed", "licensed", "not_applicable"])
      .optional(),
    licensing_info: z.record(z.unknown()).optional(),
    pipeline_template_id: z.string().uuid().nullable().optional(),
    onboarding_status: z.string().max(100).nullable().optional(),
    current_onboarding_phase: z.string().max(100).nullable().optional(),
    onboarding_started_at: z.string().max(100).nullable().optional(),
    hierarchy_path: z.string().max(1000).optional(),
    hierarchy_depth: z.number().int().min(0).optional(),
    contract_level: z.number().finite().nullable().optional(),
    approval_status: z.string().max(50).optional(),
    recruiter_id: z.string().uuid().nullable().optional(),
    upline_id: z.string().uuid().nullable().optional(),
    referral_source: z.string().max(255).nullable().optional(),
    imo_id: z.string().uuid().nullable().optional(),
    agency_id: z.string().uuid().nullable().optional(),
    roles: z.array(z.string().min(1)).max(10).optional(),
    is_admin: z.boolean().optional(),
    license_number: z.string().max(100).nullable().optional(),
    npn: z.string().max(100).nullable().optional(),
  })
  .strict();

const createAuthUserRequestSchema = z
  .object({
    email: z.string().email(),
    fullName: z.string().max(255).optional().default(""),
    roles: z.array(z.string().min(1)).max(10).optional().default(["recruit"]),
    isAdmin: z.boolean().optional().default(false),
    skipPipeline: z.boolean().optional().default(false),
    phone: z.string().max(50).nullable().optional(),
    profileData: profileDataSchema.optional(),
    existingProfileId: z.string().uuid().optional(),
    password: z.string().optional(),
  })
  .strict();

type CallerContext = {
  userId: string;
  roles: string[];
  isAdmin: boolean;
  imoId: string | null;
  agencyId: string | null;
  canManageUsers: boolean;
  canCreateRecruits: boolean;
};

type ProfileData = z.infer<typeof profileDataSchema>;
type CreateAuthUserRequest = z.infer<typeof createAuthUserRequestSchema>;

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskEmail(email: string) {
  const [localPart, domain = ""] = email.split("@");
  if (!localPart) return "***";
  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function maskPhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function normalizeRoles(roles: string[]) {
  return [
    ...new Set(roles.map((role) => role.trim().toLowerCase()).filter(Boolean)),
  ];
}

// Helper function to send password reset email via Mailgun
async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  mailgunApiKey: string,
  mailgunDomain: string,
): Promise<{ success: boolean; error?: string }> {
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome - Set Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Welcome to The Standard HQ!</h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Your account has been created. Click the button below to set your password and get started.
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #dc2626; font-weight: 500;">
                ⚠️ This link expires in 72 hours. Please set your password soon.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #18181b; text-decoration: none; border-radius: 6px;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; line-height: 1.5; color: #a1a1aa; word-break: break-all;">
                ${resetLink}
              </p>
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                © ${new Date().getFullYear()} The Standard HQ. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const plainText = `
Welcome to The Standard HQ!

Your account has been created. Click this link to set your password:
${resetLink}

IMPORTANT: This link expires in 72 hours. Please set your password soon.

If you didn't expect this email, you can safely ignore it.

© ${new Date().getFullYear()} The Standard HQ
  `.trim();

  try {
    const form = new FormData();
    form.append("from", `The Standard HQ <noreply@${mailgunDomain}>`);
    form.append("to", email);
    form.append("subject", "Welcome - Set Your Password | The Standard HQ");
    form.append("html", emailHtml);
    form.append("text", plainText);
    form.append("o:tracking", "no");

    const mailgunUrl = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;
    const credentials = `api:${mailgunApiKey}`;
    const encoder = new TextEncoder();
    const credentialsBytes = encoder.encode(credentials);
    const base64Credentials = btoa(String.fromCharCode(...credentialsBytes));

    const response = await fetch(mailgunUrl, {
      method: "POST",
      headers: { Authorization: `Basic ${base64Credentials}` },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[create-auth-user] Mailgun error:", errorText);
      return { success: false, error: `Mailgun API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[create-auth-user] Email send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Helper function to send SMS notification via Twilio
// Uses same env vars as send-sms edge function
async function sendSmsNotification(
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  // Match the existing send-sms edge function pattern
  const fromNumber =
    Deno.env.get("MY_TWILIO_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    console.log("[create-auth-user] SMS skipped - Twilio not configured");
    return { success: false, error: "Twilio not configured" };
  }

  // Validate phone number format (basic check)
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    console.log(
      "[create-auth-user] SMS skipped - Invalid phone number:",
      maskPhone(phoneNumber),
    );
    return { success: false, error: "Invalid phone number" };
  }

  // Format phone number with country code if needed
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
      console.error("[create-auth-user] Twilio error:", errorText);
      return { success: false, error: `Twilio API error: ${response.status}` };
    }

    console.log(
      "[create-auth-user] SMS sent successfully to:",
      maskPhone(formattedPhone),
    );
    return { success: true };
  } catch (err) {
    console.error("[create-auth-user] SMS send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function hasAnyPermission(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  permissionCodes: string[],
) {
  for (const permissionCode of permissionCodes) {
    const { data, error } = await supabaseAdmin.rpc("has_permission", {
      target_user_id: userId,
      permission_code: permissionCode,
    });

    if (error) {
      console.warn("[create-auth-user] Permission check failed:", {
        userId,
        permissionCode,
        error: error.message,
      });
      continue;
    }

    if (data === true) {
      return true;
    }
  }

  return false;
}

async function resolveAssignableUpline(
  supabaseAdmin: ReturnType<typeof createClient>,
  caller: CallerContext,
  requestedUplineId: string | null | undefined,
) {
  if (!requestedUplineId) {
    return caller.userId;
  }

  if (caller.canManageUsers) {
    return requestedUplineId;
  }

  const { data: uplineProfile, error } = await supabaseAdmin
    .from("user_profiles")
    .select("id, roles, is_admin, imo_id")
    .eq("id", requestedUplineId)
    .maybeSingle();

  if (error || !uplineProfile) {
    return null;
  }

  const uplineRoles = Array.isArray(uplineProfile.roles)
    ? uplineProfile.roles
    : [];

  const isAssignable =
    uplineProfile.imo_id === caller.imoId &&
    (uplineProfile.is_admin === true ||
      uplineRoles.some((role) => UPLINE_ROLE_ALLOWLIST.has(role)));

  return isAssignable ? uplineProfile.id : null;
}

async function resolveAssignablePipelineTemplate(
  supabaseAdmin: ReturnType<typeof createClient>,
  caller: CallerContext,
  pipelineTemplateId: string | null | undefined,
) {
  if (!pipelineTemplateId || caller.canManageUsers) {
    return pipelineTemplateId ?? null;
  }

  const { data: template, error } = await supabaseAdmin
    .from("pipeline_templates")
    .select("id, imo_id, is_active")
    .eq("id", pipelineTemplateId)
    .maybeSingle();

  if (error || !template) {
    return null;
  }

  return template.is_active === true && template.imo_id === caller.imoId
    ? template.id
    : null;
}

async function validateExistingProfileId(
  supabaseAdmin: ReturnType<typeof createClient>,
  caller: CallerContext,
  existingProfileId: string,
  normalizedEmail: string,
) {
  const { data: existingProfile, error } = await supabaseAdmin
    .from("user_profiles")
    .select("id, email, recruiter_id, upline_id, imo_id, roles")
    .eq("id", existingProfileId)
    .maybeSingle();

  if (error || !existingProfile) {
    return false;
  }

  const existingEmail = existingProfile.email?.toLowerCase().trim();
  if (existingEmail !== normalizedEmail) {
    return false;
  }

  if (caller.canManageUsers) {
    return true;
  }

  const existingRoles = Array.isArray(existingProfile.roles)
    ? existingProfile.roles
    : [];

  return (
    existingProfile.imo_id === caller.imoId &&
    existingRoles.includes("recruit") &&
    (existingProfile.recruiter_id === caller.userId ||
      existingProfile.upline_id === caller.userId)
  );
}

async function authorizeInternalCaller(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<
  | {
      ok: true;
      caller: CallerContext;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: jsonResponse(401, { error: "Unauthorized" }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(authHeader.slice(7));

  if (authError || !user) {
    return {
      ok: false,
      response: jsonResponse(401, { error: "Unauthorized" }),
    };
  }

  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("roles, is_admin, imo_id, agency_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[create-auth-user] Failed to load caller profile:", {
      userId: user.id,
      error: profileError,
    });
    return {
      ok: false,
      response: jsonResponse(500, { error: "Failed to validate caller" }),
    };
  }

  const callerRoles = Array.isArray(callerProfile?.roles)
    ? callerProfile.roles
    : [];

  const hasAllowedRole =
    callerProfile?.is_admin === true ||
    callerRoles.some((role) => INTERNAL_ROLE_ALLOWLIST.has(role));

  const canManageUsers =
    callerProfile?.is_admin === true ||
    callerRoles.includes("admin") ||
    (await hasAnyPermission(
      supabaseAdmin,
      user.id,
      USER_MANAGEMENT_PERMISSION_CODES,
    ));

  const canCreateRecruits =
    canManageUsers ||
    hasAllowedRole ||
    (await hasAnyPermission(
      supabaseAdmin,
      user.id,
      RECRUITING_PERMISSION_CODES,
    ));

  if (!canCreateRecruits) {
    return {
      ok: false,
      response: jsonResponse(403, { error: "Forbidden" }),
    };
  }

  return {
    ok: true,
    caller: {
      userId: user.id,
      roles: callerRoles,
      isAdmin: callerProfile?.is_admin === true,
      imoId: callerProfile?.imo_id ?? null,
      agencyId: callerProfile?.agency_id ?? null,
      canManageUsers,
      canCreateRecruits,
    },
  };
}

serve(async (req) => {
  // Handle CORS
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

    const callerResult = await authorizeInternalCaller(req, supabaseAdmin);
    if (!callerResult.ok) {
      return callerResult.response;
    }

    const rawBody = await req.json();
    const parsedRequest = createAuthUserRequestSchema.safeParse(rawBody);

    if (!parsedRequest.success) {
      return jsonResponse(400, {
        error: "Invalid request payload",
        details: parsedRequest.error.flatten(),
      });
    }

    const {
      email,
      fullName,
      roles,
      isAdmin,
      skipPipeline,
      phone,
      profileData,
      existingProfileId,
      password: providedPassword,
    }: CreateAuthUserRequest = parsedRequest.data;

    if (providedPassword) {
      return jsonResponse(400, {
        error:
          "Direct password creation is not allowed on create-auth-user. Use complete-recruit-registration instead.",
      });
    }

    // Normalize email to lowercase for consistent checking
    const normalizedEmail = email.toLowerCase().trim();
    const requestedRoles = normalizeRoles(roles);

    if (
      !callerResult.caller.canManageUsers &&
      (isAdmin === true ||
        skipPipeline === true ||
        requestedRoles.some((role) => role !== "recruit"))
    ) {
      return jsonResponse(403, {
        error:
          "Recruit creation is limited to pipeline recruits for this account.",
      });
    }

    const effectiveRoles =
      callerResult.caller.canManageUsers && requestedRoles.length > 0
        ? requestedRoles
        : ["recruit"];
    const effectiveIsAdmin =
      callerResult.caller.canManageUsers && isAdmin === true;
    const effectiveSkipPipeline =
      callerResult.caller.canManageUsers && skipPipeline === true;

    let sanitizedProfileData: ProfileData | undefined = profileData
      ? { ...profileData }
      : undefined;

    if (sanitizedProfileData) {
      const resolvedUplineId = await resolveAssignableUpline(
        supabaseAdmin,
        callerResult.caller,
        sanitizedProfileData.upline_id,
      );

      if (
        sanitizedProfileData.upline_id !== undefined &&
        resolvedUplineId === null
      ) {
        return jsonResponse(403, {
          error: "The requested upline assignment is not allowed.",
        });
      }

      const resolvedTemplateId = await resolveAssignablePipelineTemplate(
        supabaseAdmin,
        callerResult.caller,
        sanitizedProfileData.pipeline_template_id,
      );

      if (
        sanitizedProfileData.pipeline_template_id !== undefined &&
        resolvedTemplateId === null
      ) {
        return jsonResponse(403, {
          error: "The requested pipeline template is not allowed.",
        });
      }

      sanitizedProfileData = {
        ...sanitizedProfileData,
        roles: effectiveRoles,
        is_admin: effectiveIsAdmin,
        upline_id:
          resolvedUplineId ??
          sanitizedProfileData.upline_id ??
          callerResult.caller.userId,
        pipeline_template_id: resolvedTemplateId,
      };

      if (!callerResult.caller.canManageUsers) {
        sanitizedProfileData = {
          ...sanitizedProfileData,
          recruiter_id: callerResult.caller.userId,
          imo_id: callerResult.caller.imoId,
          agency_id: callerResult.caller.agencyId,
          approval_status: "pending",
          onboarding_status:
            sanitizedProfileData.onboarding_status ?? "prospect",
          current_onboarding_phase:
            sanitizedProfileData.current_onboarding_phase ?? "prospect",
          onboarding_started_at:
            sanitizedProfileData.onboarding_started_at ?? null,
        };
      }
    }

    if (existingProfileId) {
      const isExistingProfileAllowed = await validateExistingProfileId(
        supabaseAdmin,
        callerResult.caller,
        existingProfileId,
        normalizedEmail,
      );

      if (!isExistingProfileAllowed) {
        return jsonResponse(403, {
          error: "The existing profile ID is not allowed for this request.",
        });
      }
    }

    const userPassword = crypto.randomUUID() + crypto.randomUUID();

    // Create user with email_confirm=true and a generated temporary password.
    // Internal flows always direct the user to the password-reset link.
    const createUserParams: Parameters<
      typeof supabaseAdmin.auth.admin.createUser
    >[0] = {
      email: normalizedEmail,
      password: userPassword,
      email_confirm: true, // Pre-confirm email - user can log in immediately
      user_metadata: {
        full_name: fullName,
        roles: effectiveRoles,
        is_admin: effectiveIsAdmin,
        skip_pipeline: effectiveSkipPipeline,
      },
    };

    // If we have an existing profile ID, use it for the auth user
    // This ensures auth.users.id matches user_profiles.id
    if (existingProfileId) {
      createUserParams.id = existingProfileId;
      console.log(
        "[create-auth-user] Using existing profile ID for auth user:",
        existingProfileId,
      );
    }

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser(createUserParams);

    if (authError) {
      // Provide clearer error message for common cases
      const errorMsg = authError.message?.toLowerCase() || "";
      if (
        errorMsg.includes("already registered") ||
        errorMsg.includes("already exists") ||
        errorMsg.includes("duplicate")
      ) {
        console.log("[create-auth-user] Duplicate detected during create:", {
          email: maskEmail(normalizedEmail),
          callerUserId: callerResult.caller.userId,
        });
        return jsonResponse(200, {
          user: null,
          message: "User already exists",
          emailSent: false,
          alreadyExists: true,
        });
      }
      throw authError;
    }

    // Note: user_profiles.id IS auth.users.id (same UUID)
    // The handle_new_user trigger creates the profile automatically
    // No need to manually link - the profile id = auth user id

    // Update the profile with additional data if provided (using service role to bypass RLS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let profile: any = null;
    if (authUser.user && sanitizedProfileData) {
      // Small delay to ensure trigger has completed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Debug: Log what we're about to update
      console.log("[create-auth-user] Updating profile with data:", {
        userId: authUser.user.id,
        upline_id: sanitizedProfileData.upline_id,
        imo_id: sanitizedProfileData.imo_id,
        keys: Object.keys(sanitizedProfileData),
      });

      const { data: updatedProfile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .update(sanitizedProfileData)
        .eq("id", authUser.user.id)
        .select()
        .single();

      if (profileError) {
        console.error(
          "[create-auth-user] Profile update failed:",
          JSON.stringify(profileError),
        );
        console.error(
          "[create-auth-user] Profile update keys:",
          Object.keys(sanitizedProfileData),
        );
        // Don't throw - auth user was created, profile will have minimal data
      } else {
        profile = updatedProfile;
        console.log("[create-auth-user] Profile updated successfully:", {
          userId: authUser.user.id,
          upline_id: profile?.upline_id,
          imo_id: profile?.imo_id,
        });
      }
    }

    // Send password reset email via Mailgun ONLY if temp password was generated
    let emailSent = false;
    if (authUser.user) {
      const siteUrl =
        Deno.env.get("SITE_URL") || "https://www.thestandardhq.com";
      const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
      const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");

      // Log env var presence for diagnostics (not values)
      console.log("[create-auth-user] Env check:", {
        hasMailgunKey: !!MAILGUN_API_KEY,
        hasMailgunDomain: !!MAILGUN_DOMAIN,
        hasSiteUrl: !!Deno.env.get("SITE_URL"),
        hasServiceRoleKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      });

      if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
        console.error(
          "[create-auth-user] Missing Mailgun credentials for email",
        );
      } else {
        // Generate a password reset link using Supabase Admin SDK
        // Use /auth/callback which is whitelisted and handles recovery type
        const { data: linkData, error: linkError } =
          await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: normalizedEmail,
            options: {
              redirectTo: `${siteUrl}/auth/callback`,
              expiresIn: 259200, // 72 hours in seconds
            },
          });

        // Log link generation result for diagnostics
        console.log("[create-auth-user] Link generation:", {
          success: !linkError,
          hasLink: !!linkData?.properties?.action_link,
          error: linkError?.message || null,
        });

        if (linkError) {
          console.error(
            "[create-auth-user] Failed to generate reset link:",
            linkError,
          );
        } else if (linkData?.properties?.action_link) {
          const result = await sendPasswordResetEmail(
            normalizedEmail,
            linkData.properties.action_link,
            MAILGUN_API_KEY,
            MAILGUN_DOMAIN,
          );
          emailSent = result.success;

          // Log email send result for diagnostics
          console.log("[create-auth-user] Email send result:", {
            success: result.success,
            error: result.error || null,
          });

          if (!result.success) {
            console.error(
              "[create-auth-user] Email send failed:",
              result.error,
            );
          }
        }
      }
    }

    // Send SMS notification if phone provided
    let smsSent = false;
    if (phone && emailSent) {
      const smsResult = await sendSmsNotification(
        phone,
        "Welcome to The Standard HQ! Check your email to set your password. The link expires in 72 hours.",
      );
      smsSent = smsResult.success;
      console.log("[create-auth-user] SMS result:", {
        success: smsSent,
        error: smsResult.error || null,
      });
    } else if (phone && !emailSent) {
      console.log("[create-auth-user] SMS skipped - email was not sent");
    }

    // Log final status
    console.log("[create-auth-user] Complete:", {
      userId: authUser.user?.id,
      email: maskEmail(normalizedEmail),
      emailSent,
      smsSent,
      callerUserId: callerResult.caller.userId,
    });

    const message = emailSent
      ? "User created successfully. Password reset email sent."
      : "User created but email could not be sent. Check edge function logs.";

    return jsonResponse(200, {
      user: authUser.user,
      profile, // Include the updated profile (or null if profileData wasn't provided)
      profileUpdateError: profile
        ? null
        : "Profile update may have failed - check logs",
      message,
      emailSent,
      smsSent,
    });
  } catch (error) {
    console.error("Error in create-auth-user function:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create user";
    const errorDetails =
      error instanceof Error ? error.toString() : String(error);
    return jsonResponse(400, {
      error: errorMessage,
      details: errorDetails,
    });
  }
});
