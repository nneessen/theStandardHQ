// Shared helpers for sending transactional auth emails (welcome / password reset)
// FROM a connected Gmail in `gmail_integrations`, by reusing the deployed
// `gmail-send-email` edge function via a trusted service-role call.
//
// Every resolver here degrades safely: on ANY failure it returns the fallback
// ("The Standard HQ" brand, or a null sender / success:false), so the caller can
// fall back to Mailgun and onboarding/reset email never silently dies.
// deno-lint-ignore-file no-explicit-any

const PLATFORM_BRAND = "The Standard HQ";

type SupabaseLike = {
  from: (table: string) => any;
};

// Resolve the display/brand name for an IMO (e.g. "Epic Life"), falling back to
// the platform name when the IMO is unknown or the lookup fails.
export async function getImoBrandName(
  supabaseAdmin: SupabaseLike,
  imoId: string | null | undefined,
): Promise<string> {
  if (!imoId) return PLATFORM_BRAND;
  try {
    const { data, error } = await supabaseAdmin
      .from("imos")
      .select("name")
      .eq("id", imoId)
      .single();
    if (error || !data?.name) return PLATFORM_BRAND;
    return data.name as string;
  } catch {
    return PLATFORM_BRAND;
  }
}

// Resolve which connected Gmail should send on behalf of an IMO: a super-admin of
// that IMO who has an active, connected Gmail integration. Returns the sender's
// user_id, or null if none exists (caller should fall back to Mailgun).
export async function resolveImoSenderUserId(
  supabaseAdmin: SupabaseLike,
  imoId: string | null | undefined,
): Promise<string | null> {
  if (!imoId) return null;
  try {
    const { data: admins, error: adminError } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("imo_id", imoId)
      .eq("is_super_admin", true);
    if (adminError || !admins?.length) return null;

    const adminIds = admins.map((a: { id: string }) => a.id);
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from("gmail_integrations")
      .select("user_id")
      .in("user_id", adminIds)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (integrationError || !integration?.user_id) return null;
    return integration.user_id as string;
  } catch {
    return null;
  }
}

// Send an email FROM a user's connected Gmail by invoking the shared
// `gmail-send-email` edge function with a trusted service-role call.
// Returns success:false (never throws) on any failure so callers fall back to Mailgun.
export async function sendViaConnectedGmail(
  senderUserId: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ success: boolean; error?: string; code?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, error: "Missing SUPABASE_URL / service role key" };
  }
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/gmail-send-email`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: senderUserId,
          to: [to],
          subject,
          html,
          text,
        }),
      },
    );
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      code?: string;
    };
    if (response.ok && data.success) {
      return { success: true };
    }
    return {
      success: false,
      error: data.error || `gmail-send-email HTTP ${response.status}`,
      code: data.code,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
