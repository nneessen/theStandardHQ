// supabase/functions/create-auth-user/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { z } from "npm:zod@3.23.8";
import {
  createOrRefreshSetupToken,
  sendSetupEmail,
} from "../_shared/account-setup.ts";

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
  isSuperAdmin: boolean;
  imoId: string | null;
  agencyId: string | null;
  canManageUsers: boolean;
  canCreateRecruits: boolean;
};

type ProfileData = z.infer<typeof profileDataSchema>;
type CreateAuthUserRequest = z.infer<typeof createAuthUserRequestSchema>;
// The edge function intentionally uses the service-role client against several
// tables without generated Deno DB types.
// deno-lint-ignore no-explicit-any
type SupabaseAdminClient = any;

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

// buildWelcomeEmail + the Mailgun sender now live in ../_shared/account-setup.ts
// (shared with resend-account-setup) so onboarding copy + delivery stay in one place.

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
  supabaseAdmin: SupabaseAdminClient,
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
  supabaseAdmin: SupabaseAdminClient,
  caller: CallerContext,
  requestedUplineId: string | null | undefined,
): Promise<string | null> {
  if (!requestedUplineId) {
    return caller.userId;
  }

  // Callers who are allowed to create recruits should always be able to
  // assign the recruit to themselves, even if their role is not in the
  // stricter manager/upline allowlist.
  if (requestedUplineId === caller.userId) {
    return caller.userId;
  }

  if (caller.isSuperAdmin) {
    return requestedUplineId ?? null;
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

  const isSameTenant = uplineProfile.imo_id === caller.imoId;
  if (caller.canManageUsers) {
    return isSameTenant ? uplineProfile.id : null;
  }

  const isAssignable =
    isSameTenant &&
    (uplineProfile.is_admin === true ||
      uplineRoles.some((role: string) => UPLINE_ROLE_ALLOWLIST.has(role)));

  return isAssignable ? uplineProfile.id : null;
}

async function resolveAssignablePipelineTemplate(
  supabaseAdmin: SupabaseAdminClient,
  caller: CallerContext,
  pipelineTemplateId: string | null | undefined,
): Promise<string | null> {
  if (!pipelineTemplateId) {
    return pipelineTemplateId ?? null;
  }

  if (caller.isSuperAdmin) {
    return pipelineTemplateId;
  }

  const { data: template, error } = await supabaseAdmin
    .from("pipeline_templates")
    .select("id, imo_id, is_active")
    .eq("id", pipelineTemplateId)
    .maybeSingle();

  if (error || !template) {
    return null;
  }

  return template.is_active === true &&
    (template.imo_id === caller.imoId || template.imo_id === null)
    ? template.id
    : null;
}

async function validateExistingProfileId(
  supabaseAdmin: SupabaseAdminClient,
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
  supabaseAdmin: SupabaseAdminClient,
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
    .select("roles, is_admin, is_super_admin, imo_id, agency_id")
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
    callerProfile?.is_super_admin === true ||
    callerProfile?.is_admin === true ||
    callerRoles.some((role: string) => INTERNAL_ROLE_ALLOWLIST.has(role));

  const canManageUsers =
    callerProfile?.is_super_admin === true ||
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
      isSuperAdmin: callerProfile?.is_super_admin === true,
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

    // "Add Agent": placing someone who is ALREADY a licensed agent directly onto
    // a team, skipping all onboarding pipelines. The request SHAPE — exactly
    // roles=['agent'], skipPipeline=true, isAdmin not requested — is recognized
    // regardless of caller so every caller class produces the same active-agent
    // envelope below (super admin / manager / ordinary agent). Add Agent never
    // targets an existing profile, so existingProfileId is rejected outright
    // (closes a promote-an-existing-recruit vector).
    const isAddAgentShape =
      isAdmin !== true &&
      skipPipeline === true &&
      requestedRoles.length === 1 &&
      requestedRoles[0] === "agent";

    if (isAddAgentShape && existingProfileId) {
      return jsonResponse(400, {
        error: "Add Agent cannot target an existing profile.",
      });
    }

    // The narrow relaxation: ONLY this lets a non-manager mint a non-recruit
    // role (it bypasses the recruit-only 403 below). Comp is stripped and
    // is_admin forced false in the envelope, so it cannot self-escalate.
    const isAddAgentPath =
      !callerResult.caller.canManageUsers &&
      callerResult.caller.canCreateRecruits &&
      isAddAgentShape;

    if (
      !callerResult.caller.canManageUsers &&
      !isAddAgentPath &&
      (isAdmin === true ||
        skipPipeline === true ||
        requestedRoles.some((role) => role !== "recruit"))
    ) {
      return jsonResponse(403, {
        error:
          "Recruit creation is limited to pipeline recruits for this account.",
      });
    }

    if (isAddAgentShape) {
      console.log("[create-auth-user] add-agent shape", {
        caller: callerResult.caller.userId,
        viaRelaxedPath: isAddAgentPath,
        email: maskEmail(normalizedEmail),
      });
    }

    // Managers may pass an arbitrary role/skip shape; the Add Agent path is
    // allowed its single fixed shape. Everyone else is coerced to a recruit.
    const allowRequestedShape =
      callerResult.caller.canManageUsers || isAddAgentPath;
    const effectiveRoles =
      allowRequestedShape && requestedRoles.length > 0
        ? requestedRoles
        : ["recruit"];
    // is_admin can ONLY be granted by a manager — never via the Add Agent path.
    const effectiveIsAdmin =
      callerResult.caller.canManageUsers && isAdmin === true;
    const effectiveSkipPipeline = allowRequestedShape && skipPipeline === true;

    let sanitizedProfileData: ProfileData | undefined = profileData
      ? { ...profileData }
      : undefined;

    if (sanitizedProfileData) {
      if (!callerResult.caller.isSuperAdmin && !callerResult.caller.imoId) {
        return jsonResponse(403, {
          error: "Current user is not assigned to an IMO.",
        });
      }

      // Agent-driven creation is either a pipeline recruit (prospect) or an
      // Add-Agent (active agent, handled by the isAddAgentShape branch below).
      // Either way, ignore any client-supplied pipeline assignment here so stale
      // bundles cannot implicitly enroll during the create step.
      if (!callerResult.caller.canManageUsers) {
        sanitizedProfileData.pipeline_template_id = undefined;
      }

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
      };

      if (sanitizedProfileData.pipeline_template_id !== undefined) {
        sanitizedProfileData.pipeline_template_id = resolvedTemplateId;
      }

      if (callerResult.caller.isSuperAdmin) {
        sanitizedProfileData = {
          ...sanitizedProfileData,
          recruiter_id:
            sanitizedProfileData.recruiter_id ?? callerResult.caller.userId,
        };
      } else if (isAddAgentShape) {
        // Already-licensed agent joining a team directly (ordinary agent OR a
        // non-super-admin manager via the same button): immediately active, no
        // pipeline enrollment, upline forced to the caller, and compensation
        // deliberately NOT settable by the adder (contract_level stripped;
        // owner/admin sets it later). Forcing approved here is what keeps a
        // manager-created agent from landing in a locked-out pending state.
        sanitizedProfileData = {
          ...sanitizedProfileData,
          recruiter_id: callerResult.caller.userId,
          imo_id: callerResult.caller.imoId,
          agency_id: callerResult.caller.agencyId,
          upline_id: callerResult.caller.userId,
          approval_status: "approved",
          agent_status: "licensed",
          contract_level: null,
          onboarding_status: "completed",
          current_onboarding_phase: "completed",
          onboarding_started_at: null,
          pipeline_template_id: undefined,
        };
      } else {
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
    //
    // imo_id / agency_id / recruiter_id / upline_id ride along in
    // user_metadata so handle_new_user can populate user_profiles.imo_id on the
    // initial INSERT. Without these, enforce_user_profile_imo_consistency would
    // fall back to Founders for service-role-context signups — wrong for
    // admin-created recruits whose IMO is known up front.
    //
    // IMPORTANT: when sanitizedProfileData is present (recruit-create flow), we
    // pass its values verbatim — including explicit undefined for agency_id when
    // a super-admin is acting as a foreign IMO. Falling back to caller.agencyId
    // there would mismatch the imo_id and trip the agency-imo consistency
    // trigger.
    const hasProfileData = sanitizedProfileData !== undefined;
    const userMetadataImoId = hasProfileData
      ? sanitizedProfileData?.imo_id
      : (callerResult.caller.imoId ?? undefined);
    const userMetadataAgencyId = hasProfileData
      ? sanitizedProfileData?.agency_id
      : (callerResult.caller.agencyId ?? undefined);
    const userMetadataRecruiterId = hasProfileData
      ? sanitizedProfileData?.recruiter_id
      : undefined;
    const userMetadataUplineId = hasProfileData
      ? sanitizedProfileData?.upline_id
      : undefined;

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
        ...(userMetadataImoId ? { imo_id: userMetadataImoId } : {}),
        ...(userMetadataAgencyId ? { agency_id: userMetadataAgencyId } : {}),
        ...(userMetadataRecruiterId
          ? { recruiter_id: userMetadataRecruiterId }
          : {}),
        ...(userMetadataUplineId ? { upline_id: userMetadataUplineId } : {}),
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
    let profileUpdateError: string | null = null;
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
        profileUpdateError =
          profileError.message || "Profile update failed after auth creation";
        console.error(
          "[create-auth-user] Profile update failed:",
          JSON.stringify(profileError),
        );
        console.error(
          "[create-auth-user] Profile update keys:",
          Object.keys(sanitizedProfileData),
        );
        if (!existingProfileId) {
          const { error: profileDeleteError } = await supabaseAdmin
            .from("user_profiles")
            .delete()
            .eq("id", authUser.user.id);

          if (profileDeleteError) {
            console.error(
              "[create-auth-user] Failed to rollback profile after update failure:",
              profileDeleteError.message,
            );
          }
        }

        const { error: deleteError } =
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        if (deleteError) {
          console.error(
            "[create-auth-user] Failed to rollback auth user after profile update failure:",
            deleteError.message,
          );
        }
        return jsonResponse(500, {
          error: "Failed to create user profile",
          details: profileUpdateError,
        });
      } else {
        profile = updatedProfile;
        console.log("[create-auth-user] Profile updated successfully:", {
          userId: authUser.user.id,
          upline_id: profile?.upline_id,
          imo_id: profile?.imo_id,
        });
      }
    }

    // Send the "Set Your Password" welcome email via an app-owned setup token.
    // This replaces the old Supabase recovery link (whose real lifetime was the
    // project OTP/email-link expiry, not the 72h we asked for, and which scanners
    // could burn on pre-click). createOrRefreshSetupToken stores a real 7-day token
    // and returns the /set-password link; sendSetupEmail does Gmail→Mailgun.
    let emailSent = false;
    let emailVia: "gmail" | "mailgun" | null = null;
    if (authUser.user) {
      try {
        const setup = await createOrRefreshSetupToken(supabaseAdmin, {
          userId: authUser.user.id,
          email: normalizedEmail,
          createdBy: callerResult.caller.userId,
          enforceCap: false,
        });

        if (setup.link) {
          const sendResult = await sendSetupEmail(supabaseAdmin, {
            senderUserId: callerResult.caller.userId,
            toEmail: normalizedEmail,
            imoId: profile?.imo_id ?? callerResult.caller.imoId,
            setupLink: setup.link,
          });
          emailSent = sendResult.sent;
          emailVia = sendResult.via;
          console.log("[create-auth-user] Setup email result:", {
            sent: emailSent,
            via: emailVia,
          });
        }
      } catch (setupError) {
        console.error(
          "[create-auth-user] Failed to create/send account setup link:",
          setupError,
        );
      }
    }

    // Send SMS notification if phone provided
    let smsSent = false;
    if (phone && emailSent) {
      const smsResult = await sendSmsNotification(
        phone,
        "Welcome to The Standard HQ! Check your email to set your password. The link expires in 7 days.",
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
      emailVia,
      smsSent,
      callerUserId: callerResult.caller.userId,
    });

    const message = emailSent
      ? `User created successfully. Password setup email sent via ${
          emailVia === "gmail" ? "connected Gmail" : "Mailgun"
        }.`
      : "User created but email could not be sent. Check edge function logs.";

    return jsonResponse(200, {
      user: authUser.user,
      profile, // Include the updated profile (or null if profileData wasn't provided)
      profileUpdateError,
      message,
      emailSent,
      emailVia,
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
