// supabase/functions/stripe-webhook/index.ts
// Stripe Webhook Handler - Processes subscription and payment events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createStandardChatBotVoiceClient } from "../_shared/standard-chat-bot-voice.ts";
import {
  PREMIUM_VOICE_ADDON_NAME,
  buildVoiceCancellationPayload,
  buildVoiceEntitlementPayload,
  getVoiceTierConfig,
  syncVoiceEntitlementWithRetry,
  type VoiceEntitlementStatus,
  type VoiceEntitlementSnapshot,
} from "../../../src/services/subscription/voice-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Map Stripe subscription status to our internal status
function mapSubscriptionStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    paused: "paused",
    past_due: "past_due",
    canceled: "cancelled",
    incomplete: "incomplete",
    incomplete_expired: "cancelled",
    unpaid: "past_due",
  };
  return statusMap[stripeStatus] || "active";
}

// Extract subscription ID from invoice, handling API version 2026-01-28.clover
// where invoice.subscription is null and moved to parent.subscription_details.subscription
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;
  if (typeof inv.subscription === "string") return inv.subscription;
  if (inv.subscription?.id) return inv.subscription.id;
  if (inv.parent?.subscription_details?.subscription) {
    return inv.parent.subscription_details.subscription;
  }
  return null;
}

// Extract subscription metadata from invoice, handling API version changes
function getInvoiceSubscriptionMetadata(
  invoice: Stripe.Invoice,
): Record<string, string> | undefined {
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;
  return (
    inv.subscription_details?.metadata ||
    inv.parent?.subscription_details?.metadata ||
    inv.metadata ||
    undefined
  );
}

// Determine billing interval from Stripe price interval
function getBillingInterval(interval?: string): string {
  if (interval === "year") return "annual";
  return "monthly";
}

// Map Stripe invoice billing reason to our internal reason
function mapBillingReason(reason?: string | null): string {
  const reasonMap: Record<string, string> = {
    subscription_create: "initial",
    subscription_cycle: "renewal",
    subscription_update: "upgrade",
    manual: "renewal",
  };
  return reasonMap[reason || ""] || "renewal";
}

// Send billing email via Mailgun
async function sendBillingEmail(
  supabase: ReturnType<typeof createClient>,
  templateName: string,
  userEmail: string,
  userName: string,
  variables: Record<string, string>,
): Promise<void> {
  try {
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("subject, body_html, body_text")
      .eq("name", templateName)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error(`Email template not found: ${templateName}`, templateError);
      return;
    }

    let subject = template.subject;
    let bodyHtml = template.body_html;
    let bodyText = template.body_text || "";

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      bodyHtml = bodyHtml.replace(regex, value);
      bodyText = bodyText.replace(regex, value);
    }

    const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
    const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      console.error("Mailgun credentials not configured");
      return;
    }

    const form = new FormData();
    form.append("from", `The Standard HQ <noreply@${MAILGUN_DOMAIN}>`);
    form.append("to", `${userName} <${userEmail}>`);
    form.append("subject", subject);
    form.append("html", bodyHtml);
    if (bodyText) {
      form.append("text", bodyText);
    }

    const credentials = `api:${MAILGUN_API_KEY}`;
    const encoder = new TextEncoder();
    const credentialsBytes = encoder.encode(credentials);
    const base64Credentials = btoa(String.fromCharCode(...credentialsBytes));

    const response = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${base64Credentials}`,
        },
        body: form,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send billing email: ${errorText}`);
    } else {
      console.log(`Billing email sent: ${templateName} to ${userEmail}`);
    }
  } catch (error) {
    console.error("Error sending billing email:", error);
  }
}

// Send plain-text admin notification email via Mailgun
// Non-fatal: errors are caught silently so webhook processing is never interrupted
async function sendAdminNotification(
  subject: string,
  body: string,
): Promise<void> {
  try {
    const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
    const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) return;

    const form = new FormData();
    form.append("from", `CommissionTracker Alerts <alerts@${MAILGUN_DOMAIN}>`);
    form.append("to", "nickneessen@thestandardhq.com");
    form.append("subject", subject);
    form.append("text", body);

    const credentials = `api:${MAILGUN_API_KEY}`;
    const encoder = new TextEncoder();
    const credentialsBytes = encoder.encode(credentials);
    const base64Credentials = btoa(String.fromCharCode(...credentialsBytes));

    await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${base64Credentials}` },
      body: form,
    });
  } catch {
    // Silently ignore — admin notifications must never break webhook processing
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function timestampToISO(ts: number | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

// ──────────────────────────────────────────────
// CHAT BOT ADDON HELPERS
// ──────────────────────────────────────────────

// Helper to call standard-chat-bot external API
async function callChatBotApi(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const CHAT_BOT_API_URL =
    Deno.env.get("STANDARD_CHAT_BOT_API_URL") ||
    Deno.env.get("CHAT_BOT_API_URL");
  const CHAT_BOT_API_KEY =
    Deno.env.get("STANDARD_CHAT_BOT_EXTERNAL_API_KEY") ||
    Deno.env.get("CHAT_BOT_API_KEY");

  if (!CHAT_BOT_API_URL || !CHAT_BOT_API_KEY) {
    console.warn(
      "[stripe-webhook] CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured — skipping chat bot sync",
    );
    return { ok: false, status: 0, data: { error: "not configured" } };
  }

  const url = `${CHAT_BOT_API_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": CHAT_BOT_API_KEY,
    },
  };
  if (method !== "GET" && method !== "DELETE") {
    options.body = JSON.stringify(body || {});
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function extractExternalAgentId(data: Record<string, unknown>): string | null {
  const nested = data.data;
  if (nested && typeof nested === "object") {
    const nestedId = (nested as Record<string, unknown>).agentId;
    if (typeof nestedId === "string" && nestedId.trim()) {
      return nestedId.trim();
    }
  }

  const directId = data.agentId;
  if (typeof directId === "string" && directId.trim()) {
    return directId.trim();
  }

  return null;
}

async function ensureManagedAgentMapping(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: existingAgent } = await supabase
    .from("chat_bot_agents")
    .select("external_agent_id, provisioning_status, billing_exempt, tier_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    existingAgent?.provisioning_status === "active" &&
    typeof existingAgent.external_agent_id === "string" &&
    existingAgent.external_agent_id.trim()
  ) {
    return existingAgent.external_agent_id.trim();
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  const agentName =
    `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
    "The Standard HQ Workspace";
  const provisionRes = await callChatBotApi("POST", "/api/external/agents", {
    externalRef: userId,
    name: agentName,
    billingExempt: existingAgent?.billing_exempt === true,
  });

  if (!provisionRes.ok) {
    console.error(
      `[stripe-webhook] Failed to auto-provision managed agent for voice user ${userId}:`,
      provisionRes.data,
    );
    return null;
  }

  const agentId = extractExternalAgentId(provisionRes.data);
  if (!agentId) {
    console.error(
      `[stripe-webhook] Provisioned managed agent for voice user ${userId} without agentId payload`,
      provisionRes.data,
    );
    return null;
  }

  await supabase.from("chat_bot_agents").upsert(
    {
      user_id: userId,
      external_agent_id: agentId,
      provisioning_status: "active",
      billing_exempt: existingAgent?.billing_exempt === true,
      tier_id: existingAgent?.tier_id ?? null,
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return agentId;
}

// Sync chat bot addon after subscription update: provision, deprovision, or tier change
async function syncChatBotAddon(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  _subscription: Stripe.Subscription,
): Promise<void> {
  try {
    // Look up the ai_chat_bot addon
    const { data: chatBotAddon } = await supabase
      .from("subscription_addons")
      .select("id, tier_config")
      .eq("name", "ai_chat_bot")
      .maybeSingle();

    if (!chatBotAddon) return; // addon not configured yet

    // Check user's current addon subscription status
    const { data: userAddon } = await supabase
      .from("user_subscription_addons")
      .select("id, status, tier_id")
      .eq("user_id", userId)
      .eq("addon_id", chatBotAddon.id)
      .maybeSingle();

    // Check existing chat_bot_agents row
    const { data: existingAgent } = await supabase
      .from("chat_bot_agents")
      .select("id, external_agent_id, provisioning_status, tier_id")
      .eq("user_id", userId)
      .maybeSingle();

    const addonIsActive =
      userAddon?.status === "active" || userAddon?.status === "manual_grant";
    const agentIsActive = existingAgent?.provisioning_status === "active";

    // PROVISION: addon active but no active agent
    if (addonIsActive && !agentIsActive) {
      // Get user name
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      const agentName = profile
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
          "Chat Bot Agent"
        : "Chat Bot Agent";

      // Resolve lead limit from tier
      const tierId = userAddon?.tier_id || "starter";
      let leadLimit = 50;
      if (chatBotAddon.tier_config) {
        const tierConfig = chatBotAddon.tier_config as {
          tiers: Array<{ id: string; runs_per_month: number }>;
        };
        const tier = tierConfig.tiers?.find(
          (t: { id: string }) => t.id === tierId,
        );
        if (tier) leadLimit = tier.runs_per_month;
      }

      const result = await callChatBotApi("POST", "/api/external/agents", {
        externalRef: userId,
        name: agentName,
        leadLimit,
      });

      if (result.ok) {
        const externalAgentId =
          (result.data.data as Record<string, unknown>)?.agentId ||
          result.data.agentId;

        await supabase.from("chat_bot_agents").upsert(
          {
            user_id: userId,
            external_agent_id: String(externalAgentId),
            provisioning_status: "active",
            tier_id: tierId,
            error_message: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

        console.log(
          `[stripe-webhook] Chat bot provisioned for user ${userId}, agent ${externalAgentId}`,
        );
      } else {
        console.error(
          `[stripe-webhook] Failed to provision chat bot for user ${userId}:`,
          result.data,
        );

        await supabase.from("chat_bot_agents").upsert(
          {
            user_id: userId,
            external_agent_id: "",
            provisioning_status: "failed",
            tier_id: tierId,
            error_message: JSON.stringify(result.data),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
      return;
    }

    // DEPROVISION: addon cancelled/expired but agent still active
    if (!addonIsActive && agentIsActive && existingAgent?.external_agent_id) {
      const result = await callChatBotApi(
        "POST",
        `/api/external/agents/${existingAgent.external_agent_id}/deprovision`,
      );

      if (result.ok || result.status === 404) {
        await supabase
          .from("chat_bot_agents")
          .update({
            provisioning_status: "deprovisioned",
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAgent.id);

        console.log(
          `[stripe-webhook] Chat bot deprovisioned for user ${userId}`,
        );
      } else {
        console.error(
          `[stripe-webhook] Failed to deprovision chat bot for user ${userId}:`,
          result.data,
        );
      }
      return;
    }

    // TIER UPDATE: both active but tier changed
    if (
      addonIsActive &&
      agentIsActive &&
      userAddon?.tier_id &&
      userAddon.tier_id !== existingAgent?.tier_id
    ) {
      let leadLimit = 50;
      if (chatBotAddon.tier_config) {
        const tierConfig = chatBotAddon.tier_config as {
          tiers: Array<{ id: string; runs_per_month: number }>;
        };
        const tier = tierConfig.tiers?.find(
          (t: { id: string }) => t.id === userAddon.tier_id,
        );
        if (tier) leadLimit = tier.runs_per_month;
      }

      const result = await callChatBotApi(
        "PATCH",
        `/api/external/agents/${existingAgent!.external_agent_id}`,
        { leadLimit },
      );

      if (result.ok) {
        await supabase
          .from("chat_bot_agents")
          .update({
            tier_id: userAddon.tier_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAgent!.id);

        console.log(
          `[stripe-webhook] Chat bot tier updated to ${userAddon.tier_id} for user ${userId}`,
        );
      } else {
        console.error(
          `[stripe-webhook] Failed to update chat bot tier for user ${userId}:`,
          result.data,
        );
      }
    }
  } catch (err) {
    // Non-fatal — don't let chat bot sync errors break subscription processing
    console.error(
      `[stripe-webhook] Chat bot sync error for user ${userId}:`,
      err,
    );
  }
}

// Deprovision chat bot agent when subscription is fully deleted
async function deprovisionChatBotAgent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  try {
    const { data: agent } = await supabase
      .from("chat_bot_agents")
      .select("id, external_agent_id, provisioning_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!agent || agent.provisioning_status === "deprovisioned") return;

    if (agent.external_agent_id) {
      const result = await callChatBotApi(
        "POST",
        `/api/external/agents/${agent.external_agent_id}/deprovision`,
      );

      if (!result.ok && result.status !== 404) {
        console.error(
          `[stripe-webhook] Failed to deprovision chat bot on subscription delete for user ${userId}:`,
          result.data,
        );
      }
    }

    await supabase
      .from("chat_bot_agents")
      .update({
        provisioning_status: "deprovisioned",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    console.log(
      `[stripe-webhook] Chat bot deprovisioned (subscription deleted) for user ${userId}`,
    );
  } catch (err) {
    console.error(
      `[stripe-webhook] Chat bot deprovision error for user ${userId}:`,
      err,
    );
  }
}

function isActiveAddonStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "manual_grant";
}

function parseReferenceDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

async function markVoiceSyncAttempt(
  supabase: ReturnType<typeof createClient>,
  userAddonId: string,
  eventId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_subscription_addons")
    .update({
      voice_sync_status: "pending",
      voice_last_sync_attempt_at: now,
      voice_last_sync_event_id: eventId,
      voice_last_sync_error: null,
      voice_last_sync_http_status: null,
      updated_at: now,
    })
    .eq("id", userAddonId);

  if (error) {
    console.error("[stripe-webhook] Failed to mark voice sync attempt:", error);
  }
}

async function markVoiceSyncSuccess(
  supabase: ReturnType<typeof createClient>,
  userAddonId: string,
  eventId: string,
  statusCode: number,
  snapshot: VoiceEntitlementSnapshot | null,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_subscription_addons")
    .update({
      voice_sync_status: "synced",
      voice_last_sync_attempt_at: now,
      voice_last_synced_at: now,
      voice_last_sync_event_id: eventId,
      voice_last_sync_error: null,
      voice_last_sync_http_status: statusCode,
      voice_entitlement_snapshot: snapshot,
      updated_at: now,
    })
    .eq("id", userAddonId);

  if (error) {
    console.error("[stripe-webhook] Failed to mark voice sync success:", error);
  }
}

async function markVoiceSyncFailure(
  supabase: ReturnType<typeof createClient>,
  userAddonId: string,
  eventId: string,
  errorMessage: string,
  statusCode?: number | null,
  snapshot?: VoiceEntitlementSnapshot | null,
): Promise<void> {
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    voice_sync_status: "degraded",
    voice_last_sync_attempt_at: now,
    voice_last_sync_event_id: eventId,
    voice_last_sync_error: errorMessage,
    voice_last_sync_http_status: statusCode ?? null,
    updated_at: now,
  };
  if (snapshot !== undefined) {
    updateData.voice_entitlement_snapshot = snapshot;
  }

  const { error } = await supabase
    .from("user_subscription_addons")
    .update(updateData)
    .eq("id", userAddonId);

  if (error) {
    console.error("[stripe-webhook] Failed to mark voice sync failure:", error);
  }
}

async function syncPremiumVoiceAddon(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string;
    eventId: string;
    stripeStatus?: string | null;
    overrideStatus?: VoiceEntitlementStatus;
    cancelAtPeriodEnd?: boolean;
    immediateCancel?: boolean;
    cancelReason?: string;
    externalCustomerId?: string | null;
    externalSubscriptionId?: string | null;
    externalSubscriptionItemId?: string | null;
    referenceDate?: Date;
  },
): Promise<void> {
  try {
    const [voiceAddonLookup, userSubscriptionLookup] = await Promise.all([
      supabase
        .from("subscription_addons")
        .select("id, name, tier_config")
        .eq("name", PREMIUM_VOICE_ADDON_NAME)
        .maybeSingle(),
      supabase
        .from("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", params.userId)
        .maybeSingle(),
    ]);

    if (!voiceAddonLookup.data?.id) {
      return;
    }

    const { data: userAddon, error: userAddonError } = await supabase
      .from("user_subscription_addons")
      .select("*")
      .eq("user_id", params.userId)
      .eq("addon_id", voiceAddonLookup.data.id)
      .maybeSingle();

    if (userAddonError) {
      console.error(
        `[stripe-webhook] Failed to load premium voice addon for user ${params.userId}:`,
        userAddonError,
      );
      return;
    }

    if (!userAddon) {
      return;
    }

    await markVoiceSyncAttempt(supabase, userAddon.id, params.eventId);

    const agentId = await ensureManagedAgentMapping(supabase, params.userId);
    if (!agentId) {
      await markVoiceSyncFailure(
        supabase,
        userAddon.id,
        params.eventId,
        "Missing managed workspace mapping",
      );
      return;
    }

    const client = createStandardChatBotVoiceClient();
    const externalCustomerId =
      params.externalCustomerId ??
      userSubscriptionLookup.data?.stripe_customer_id;
    const externalSubscriptionId =
      params.externalSubscriptionId ?? userAddon.stripe_subscription_id;
    const externalSubscriptionItemId =
      params.externalSubscriptionItemId ??
      userAddon.stripe_subscription_item_id;

    if (params.immediateCancel || !isActiveAddonStatus(userAddon.status)) {
      const cancelResult = await syncVoiceEntitlementWithRetry({
        client,
        agentId,
        idempotencyKey: params.eventId,
        action: {
          operation: "cancel",
          payload: buildVoiceCancellationPayload({
            externalSubscriptionId,
            reason: params.cancelReason ?? "addon_inactive",
          }),
        },
      });

      if (!cancelResult.ok) {
        await markVoiceSyncFailure(
          supabase,
          userAddon.id,
          params.eventId,
          cancelResult.error ?? "Failed to cancel premium voice entitlement",
          cancelResult.status,
          cancelResult.snapshot,
        );
        return;
      }

      await markVoiceSyncSuccess(
        supabase,
        userAddon.id,
        params.eventId,
        cancelResult.status,
        cancelResult.snapshot,
      );
      return;
    }

    const tier = getVoiceTierConfig(
      voiceAddonLookup.data.tier_config,
      userAddon.tier_id,
    );
    if (!tier) {
      await markVoiceSyncFailure(
        supabase,
        userAddon.id,
        params.eventId,
        `Missing premium voice tier config for tier '${userAddon.tier_id ?? "default"}'`,
      );
      return;
    }

    const referenceDate =
      params.referenceDate ??
      parseReferenceDate(userAddon.current_period_start);
    const upsertPayload = buildVoiceEntitlementPayload({
      eventId: params.eventId,
      tier,
      referenceDate,
      stripeStatus: params.stripeStatus ?? null,
      overrideStatus: params.overrideStatus,
      externalCustomerId,
      externalSubscriptionId,
      externalSubscriptionItemId,
      effectiveAt: referenceDate,
      metadata: {
        subscriptionAddonId: userAddon.id,
        userId: params.userId,
      },
    });

    const upsertResult = await syncVoiceEntitlementWithRetry({
      client,
      agentId,
      idempotencyKey: params.eventId,
      action: {
        operation: "upsert",
        payload: upsertPayload,
      },
    });

    if (!upsertResult.ok) {
      await markVoiceSyncFailure(
        supabase,
        userAddon.id,
        params.eventId,
        upsertResult.error ?? "Failed to sync premium voice entitlement",
        upsertResult.status,
        upsertResult.snapshot,
      );
      return;
    }

    if (params.cancelAtPeriodEnd) {
      const cancelResult = await syncVoiceEntitlementWithRetry({
        client,
        agentId,
        idempotencyKey: params.eventId,
        action: {
          operation: "cancel",
          payload: buildVoiceCancellationPayload({
            externalSubscriptionId,
            cancelAt: new Date(upsertPayload.cycleEndAt),
            reason: params.cancelReason ?? "cancel_at_period_end",
          }),
        },
      });

      if (!cancelResult.ok) {
        await markVoiceSyncFailure(
          supabase,
          userAddon.id,
          params.eventId,
          cancelResult.error ?? "Failed to schedule premium voice cancellation",
          cancelResult.status,
          upsertResult.snapshot,
        );
        return;
      }

      await markVoiceSyncSuccess(
        supabase,
        userAddon.id,
        params.eventId,
        cancelResult.status,
        cancelResult.snapshot,
      );
      return;
    }

    await markVoiceSyncSuccess(
      supabase,
      userAddon.id,
      params.eventId,
      upsertResult.status,
      upsertResult.snapshot,
    );
  } catch (err) {
    console.error(
      `[stripe-webhook] Premium voice sync error for user ${params.userId}:`,
      err,
    );

    const { data: voiceAddonLookup } = await supabase
      .from("subscription_addons")
      .select("id")
      .eq("name", PREMIUM_VOICE_ADDON_NAME)
      .maybeSingle();

    if (!voiceAddonLookup?.id) return;

    const { data: userAddon } = await supabase
      .from("user_subscription_addons")
      .select("id")
      .eq("user_id", params.userId)
      .eq("addon_id", voiceAddonLookup.id)
      .maybeSingle();

    if (!userAddon?.id) return;

    await markVoiceSyncFailure(
      supabase,
      userAddon.id,
      params.eventId,
      err instanceof Error ? err.message : "Premium voice sync failed",
    );
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      console.error("Stripe keys not configured");
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature (must use async variant in Deno/Edge Functions)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Invalid webhook signature:", errMsg);
      return new Response(
        JSON.stringify({ error: "Invalid signature", detail: errMsg }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[stripe-webhook] Received event: ${event.type}`, {
      eventId: event.id,
    });

    // Helper: resolve user_id from Stripe metadata or customer lookup
    async function resolveUserId(
      metadata?: Stripe.Metadata | null,
      customerIdStr?: string | null,
    ): Promise<string | null> {
      // Check metadata first
      if (metadata?.user_id) {
        return metadata.user_id;
      }

      // Look up by stripe_customer_id
      if (customerIdStr) {
        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerIdStr)
          .maybeSingle();

        if (sub?.user_id) return sub.user_id;

        // Try looking up customer email in Stripe, then match to user
        try {
          const customer = await stripe.customers.retrieve(customerIdStr);
          if (customer && !customer.deleted && customer.email) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("id")
              .eq("email", customer.email)
              .maybeSingle();
            if (profile?.id) return profile.id;
          }
        } catch {
          // Customer lookup failed, continue
        }
      }

      return null;
    }

    // Helper: get user details for emails
    async function getUserDetails(userId: string) {
      const { data } = await supabase
        .from("user_profiles")
        .select("first_name, last_name, email")
        .eq("id", userId)
        .single();
      return data;
    }

    // Handle events
    switch (event.type) {
      // ──────────────────────────────────────────────
      // CHECKOUT SESSION COMPLETED
      // ──────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (!userId) {
          console.error("checkout.session.completed: No user_id in metadata");
          break;
        }

        // Store customer ID on user's subscription for future portal lookups
        if (customerId) {
          await supabase
            .from("user_subscriptions")
            .update({
              stripe_customer_id: customerId,
              stripe_checkout_session_id: session.id,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }

        // Handle addon checkout (standalone subscription for addon)
        const addonId = session.metadata?.addon_id;
        const tierId = session.metadata?.tier_id;
        const stripeSubId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id || null;

        if (addonId && tierId && stripeSubId) {
          console.log(
            `[stripe-webhook] Addon checkout completed: addon=${addonId}, tier=${tierId}, sub=${stripeSubId}`,
          );

          const { data: addonDefinition } = await supabase
            .from("subscription_addons")
            .select("name, display_name")
            .eq("id", addonId)
            .maybeSingle();

          // Retrieve the subscription to get item details
          const addonSub = await stripe.subscriptions.retrieve(stripeSubId);
          const addonItem = addonSub.items?.data?.[0];

          const { error: addonUpsertError } = await supabase
            .from("user_subscription_addons")
            .upsert(
              {
                user_id: userId,
                addon_id: addonId,
                tier_id: tierId,
                status: "active",
                stripe_subscription_id: stripeSubId,
                stripe_subscription_item_id: addonItem?.id || null,
                stripe_checkout_session_id: session.id,
                billing_interval:
                  addonItem?.price?.recurring?.interval === "year"
                    ? "annual"
                    : "monthly",
                cancelled_at: null,
                current_period_start: new Date(
                  addonSub.current_period_start * 1000,
                ).toISOString(),
                current_period_end: new Date(
                  addonSub.current_period_end * 1000,
                ).toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,addon_id" },
            );

          if (addonUpsertError) {
            console.error(
              "[stripe-webhook] Failed to upsert addon record from checkout:",
              addonUpsertError,
            );
          } else {
            console.log(
              `[stripe-webhook] Addon record created from checkout: user=${userId}, addon=${addonId}, tier=${tierId}`,
            );

            if (addonDefinition?.name === "ai_chat_bot") {
              try {
                const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
                const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
                  "SUPABASE_SERVICE_ROLE_KEY",
                )!;
                await fetch(`${SUPABASE_URL}/functions/v1/chat-bot-provision`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify({
                    action: "provision",
                    userId,
                    tierId,
                  }),
                });
                console.log(
                  `[stripe-webhook] Triggered chat-bot-provision for user ${userId}`,
                );
              } catch (provisionErr) {
                console.error(
                  "[stripe-webhook] Failed to trigger chat-bot-provision:",
                  provisionErr,
                );
              }
            }

            if (addonDefinition?.name === PREMIUM_VOICE_ADDON_NAME) {
              try {
                await syncPremiumVoiceAddon(supabase, {
                  userId,
                  eventId: event.id,
                  stripeStatus: "active",
                  externalCustomerId: customerId || null,
                  externalSubscriptionId: stripeSubId,
                });
                console.log(
                  `[stripe-webhook] Voice entitlement synced from checkout for user ${userId}`,
                );
              } catch (voiceSyncErr) {
                console.error(
                  "[stripe-webhook] Failed to sync voice entitlement from checkout:",
                  voiceSyncErr,
                );
              }
            }
          }

          // Admin notification for addon purchase
          try {
            const addonUserDetails = await getUserDetails(userId);
            const addonUserName =
              `${addonUserDetails?.first_name || ""} ${addonUserDetails?.last_name || ""}`.trim() ||
              "Customer";
            const addonUserEmail = addonUserDetails?.email || "unknown";
            await sendAdminNotification(
              `New Addon Purchase: ${addonUserName} (${tierId})`,
              `User: ${addonUserName}\nEmail: ${addonUserEmail}\nAddon: ${addonDefinition?.display_name || addonDefinition?.name || addonId}\nTier: ${tierId}`,
            );
          } catch {
            // Non-fatal
          }
        }

        console.log(`[stripe-webhook] Checkout completed for user: ${userId}`);
        break;
      }

      // ──────────────────────────────────────────────
      // SUBSCRIPTION CREATED / UPDATED / RESUMED
      // ──────────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.resumed": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        const userId = await resolveUserId(subscription.metadata, customerId);

        if (!userId) {
          console.error(`${event.type}: Could not determine user_id`, {
            customerId,
            metadata: subscription.metadata,
          });

          await supabase.from("subscription_events").insert({
            event_type: "subscription",
            event_name: event.type,
            stripe_event_id: event.id,
            event_data: event,
            error_message: "Could not determine user_id",
          });
          break;
        }

        // Find the plan item among subscription line items.
        // With multi-item subscriptions (plan + addons + seat packs),
        // items.data[0] is NOT guaranteed to be the plan.
        // Match against known plan prices in subscription_plans.
        let planItem = subscription.items?.data?.[0] || null;

        if (subscription.items?.data && subscription.items.data.length > 1) {
          const itemPriceIds = subscription.items.data.map(
            (item) => item.price.id,
          );
          const { data: matchedPlan } = await supabase
            .from("subscription_plans")
            .select("stripe_price_id_monthly, stripe_price_id_annual")
            .or(
              itemPriceIds
                .map(
                  (pid) =>
                    `stripe_price_id_monthly.eq.${pid},stripe_price_id_annual.eq.${pid}`,
                )
                .join(","),
            )
            .limit(1)
            .maybeSingle();

          if (matchedPlan) {
            const found = subscription.items.data.find(
              (item) =>
                item.price.id === matchedPlan.stripe_price_id_monthly ||
                item.price.id === matchedPlan.stripe_price_id_annual,
            );
            if (found) planItem = found;
          }
        }

        const priceId = planItem?.price?.id || null;
        const priceInterval = planItem?.price?.recurring?.interval;

        // Guard: skip if this subscription was already deleted (out-of-order event)
        // A delayed created/updated event for an already-cancelled subscription must not
        // overwrite the free plan that the deleted handler set.
        // We check two conditions:
        // 1. The user's current subscription has stripe_subscription_id = NULL (cleared by deleted handler)
        // 2. A customer.subscription.deleted event exists for this user in the audit log
        const { data: currentSub } = await supabase
          .from("user_subscriptions")
          .select("stripe_subscription_id, cancelled_at")
          .eq("user_id", userId)
          .maybeSingle();

        const subAlreadyCleared =
          currentSub &&
          currentSub.stripe_subscription_id === null &&
          currentSub.cancelled_at !== null;

        let hasDeletedEvent = false;
        if (subAlreadyCleared) {
          // Only query the audit log if the subscription looks cleared.
          // IMPORTANT: Match by the SAME stripe subscription ID to avoid
          // blocking legitimate re-subscribe flows with a new subscription.
          const { data: deletedEvt } = await supabase
            .from("subscription_events")
            .select("id")
            .eq("user_id", userId)
            .eq("event_name", "customer.subscription.deleted")
            .contains("event_data", {
              data: { object: { id: subscription.id } },
            })
            .limit(1)
            .maybeSingle();
          hasDeletedEvent = !!deletedEvt;
        }

        if (subAlreadyCleared && hasDeletedEvent) {
          console.log(
            `[stripe-webhook] Skipping stale ${event.type} for already-deleted subscription ${subscription.id}`,
          );

          // Still log the event for audit, but mark it as skipped
          await supabase.from("subscription_events").insert({
            user_id: userId,
            event_type: "subscription",
            event_name: event.type,
            stripe_event_id: event.id,
            event_data: event,
            processed_at: new Date().toISOString(),
            error_message: `Skipped: subscription ${subscription.id} was already deleted`,
          });
          break;
        }

        const { data: eventId, error: eventError } = await supabase.rpc(
          "process_stripe_subscription_event",
          {
            p_event_type: "subscription",
            p_event_name: event.type,
            p_stripe_event_id: event.id,
            p_stripe_subscription_id: subscription.id,
            p_stripe_customer_id: customerId || null,
            p_stripe_checkout_session_id: null,
            p_stripe_price_id: priceId,
            p_user_id: userId,
            p_status: mapSubscriptionStatus(subscription.status),
            p_billing_interval: getBillingInterval(priceInterval),
            p_current_period_start: timestampToISO(
              subscription.current_period_start,
            ),
            p_current_period_end: timestampToISO(
              subscription.current_period_end,
            ),
            p_trial_ends_at: timestampToISO(subscription.trial_end),
            p_cancelled_at: timestampToISO(subscription.canceled_at),
            p_event_data: event,
          },
        );

        if (eventError) {
          console.error("Error processing subscription event:", eventError);
          throw eventError;
        }

        // Send welcome email for new subscriptions
        if (event.type === "customer.subscription.created") {
          const userDetails = await getUserDetails(userId);
          const userEmail = userDetails?.email || "";
          const userName =
            `${userDetails?.first_name || ""} ${userDetails?.last_name || ""}`.trim() ||
            "Customer";

          if (userEmail) {
            const planProductId = planItem?.price?.product;
            let productName = "Premium";
            if (typeof planProductId === "string") {
              try {
                const product = await stripe.products.retrieve(planProductId);
                productName = product.name;
              } catch {
                // Use default
              }
            }

            await sendBillingEmail(
              supabase,
              "subscription_welcome",
              userEmail,
              userName,
              {
                first_name: userDetails?.first_name || "there",
                plan_name: productName,
                amount: formatCents(planItem?.price?.unit_amount || 0),
                billing_interval: priceInterval === "year" ? "year" : "month",
                next_billing_date: formatDate(
                  timestampToISO(subscription.current_period_end),
                ),
              },
            );

            // Admin notification
            try {
              await sendAdminNotification(
                `New Subscription: ${userName} (${productName})`,
                `User: ${userName}\nEmail: ${userEmail}\nPlan: ${productName}\nAmount: ${formatCents(planItem?.price?.unit_amount || 0)}/${priceInterval === "year" ? "year" : "month"}`,
              );
            } catch {
              // Non-fatal
            }
          }
        }

        // Sync period dates to any addon subscriptions tied to this Stripe subscription
        if (subscription.id) {
          const addonPeriodUpdate: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (subscription.current_period_start) {
            addonPeriodUpdate.current_period_start = timestampToISO(
              subscription.current_period_start,
            );
          }
          if (subscription.current_period_end) {
            addonPeriodUpdate.current_period_end = timestampToISO(
              subscription.current_period_end,
            );
          }
          if (priceInterval) {
            addonPeriodUpdate.billing_interval =
              getBillingInterval(priceInterval);
          }
          // Map subscription status to addon status
          const addonStatus = mapSubscriptionStatus(subscription.status);
          if (addonStatus === "cancelled") {
            addonPeriodUpdate.status = "cancelled";
            addonPeriodUpdate.cancelled_at = new Date().toISOString();
          } else if (addonStatus === "active") {
            addonPeriodUpdate.status = "active";
          }

          await supabase
            .from("user_subscription_addons")
            .update(addonPeriodUpdate)
            .eq("stripe_subscription_id", subscription.id);
        }

        // Detect removed line items — mark addons/seat packs as cancelled
        // when their stripe_subscription_item_id no longer exists in the subscription
        if (subscription.id && subscription.items?.data) {
          const currentItemIds = new Set(
            subscription.items.data.map((item) => item.id),
          );

          // Check addons with tracked item IDs
          const { data: trackedAddons } = await supabase
            .from("user_subscription_addons")
            .select("id, stripe_subscription_item_id")
            .eq("stripe_subscription_id", subscription.id)
            .not("stripe_subscription_item_id", "is", null)
            .in("status", ["active", "manual_grant"]);

          if (trackedAddons && trackedAddons.length > 0) {
            const removedAddonIds = trackedAddons
              .filter(
                (a) =>
                  a.stripe_subscription_item_id &&
                  !currentItemIds.has(a.stripe_subscription_item_id),
              )
              .map((a) => a.id);

            if (removedAddonIds.length > 0) {
              await supabase
                .from("user_subscription_addons")
                .update({
                  status: "cancelled",
                  cancelled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .in("id", removedAddonIds);

              console.log(
                `[stripe-webhook] Marked ${removedAddonIds.length} addon(s) as cancelled (item removed from subscription)`,
              );
            }
          }

          // Check seat packs with tracked item IDs
          const { data: trackedSeatPacks } = await supabase
            .from("team_seat_packs")
            .select("id, stripe_subscription_item_id")
            .eq("stripe_subscription_id", subscription.id)
            .not("stripe_subscription_item_id", "is", null)
            .eq("status", "active");

          if (trackedSeatPacks && trackedSeatPacks.length > 0) {
            const removedSeatPackIds = trackedSeatPacks
              .filter(
                (sp) =>
                  sp.stripe_subscription_item_id &&
                  !currentItemIds.has(sp.stripe_subscription_item_id),
              )
              .map((sp) => sp.id);

            if (removedSeatPackIds.length > 0) {
              await supabase
                .from("team_seat_packs")
                .update({
                  status: "cancelled",
                  updated_at: new Date().toISOString(),
                })
                .in("id", removedSeatPackIds);

              console.log(
                `[stripe-webhook] Marked ${removedSeatPackIds.length} seat pack(s) as cancelled (item removed from subscription)`,
              );
            }
          }
        }

        // ──────────────────────────────────────────────
        // CHAT BOT ADDON LIFECYCLE (provision/deprovision/tier update)
        // ──────────────────────────────────────────────
        await syncChatBotAddon(supabase, userId, subscription);
        await syncPremiumVoiceAddon(supabase, {
          userId,
          eventId: event.id,
          stripeStatus: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
          cancelReason: subscription.cancel_at_period_end
            ? "cancel_at_period_end"
            : undefined,
          externalCustomerId: customerId || null,
          externalSubscriptionId: subscription.id,
          referenceDate: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : undefined,
        });

        console.log(`[stripe-webhook] Processed ${event.type}:`, {
          eventId,
          userId,
        });
        break;
      }

      // ──────────────────────────────────────────────
      // SUBSCRIPTION DELETED (cancelled)
      // ──────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        const userId = await resolveUserId(subscription.metadata, customerId);

        if (!userId) {
          console.error("subscription.deleted: Could not determine user_id");
          break;
        }

        // Idempotency gate — skip entire handler if already processed
        const { data: existingDeletedEvent } = await supabase
          .from("subscription_events")
          .select("id")
          .eq("stripe_event_id", event.id)
          .maybeSingle();

        if (existingDeletedEvent) {
          console.log(`[stripe-webhook] Duplicate event skipped: ${event.id}`);
          break;
        }

        // Look up the free plan to downgrade to
        const { data: freePlan } = await supabase
          .from("subscription_plans")
          .select("id")
          .eq("name", "free")
          .maybeSingle();

        // Abort retryably if free plan is not configured — we cannot safely downgrade
        if (!freePlan?.id) {
          console.error(
            "[stripe-webhook] subscription.deleted: free plan not found — aborting for retry",
          );
          return new Response("Free plan not found", { status: 500 });
        }

        const cancelUpdate = {
          plan_id: freePlan.id, // guaranteed non-null
          status: "active", // free plans are always active — not "cancelled"
          stripe_subscription_id: null, // clear the paid subscription ID
          cancelled_at: new Date().toISOString(),
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        };

        // Primary: update by stripe_subscription_id
        const { data: updatedBySub, error: primaryErr } = await supabase
          .from("user_subscriptions")
          .update(cancelUpdate)
          .eq("stripe_subscription_id", subscription.id)
          .select("id");

        if (primaryErr) {
          console.error(
            "[stripe-webhook] subscription.deleted primary update failed:",
            primaryErr,
          );
          return new Response("DB update failed", { status: 500 });
        }

        // Fallback: ONLY if the row had no stripe_subscription_id set (repair case)
        if (!updatedBySub?.length) {
          const { data: fallbackRows, error: fallbackErr } = await supabase
            .from("user_subscriptions")
            .update(cancelUpdate)
            .eq("user_id", userId)
            .is("stripe_subscription_id", null) // narrow: only truly null rows
            .select("id");

          if (fallbackErr) {
            console.error(
              "[stripe-webhook] subscription.deleted fallback update failed:",
              fallbackErr,
            );
            return new Response("DB fallback update failed", { status: 500 });
          }

          // If neither path matched a row, abort retryably — do NOT insert the audit event
          if (!fallbackRows?.length) {
            console.error(
              "[stripe-webhook] subscription.deleted: no subscription row matched for user:",
              userId,
              "stripe_subscription_id:",
              subscription.id,
            );
            return new Response("No subscription row updated", { status: 500 });
          }

          console.log(
            `[stripe-webhook] subscription.deleted: matched by user_id fallback (stripe_subscription_id was null)`,
          );
        }

        // Also cancel any addon subscriptions tied to this Stripe subscription
        await supabase
          .from("user_subscription_addons")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        // Cancel any seat packs tied to this Stripe subscription
        // (do NOT auto-remove seated agents — owner can re-purchase)
        await supabase
          .from("team_seat_packs")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        // Deprovision chat bot agent if one exists
        await deprovisionChatBotAgent(supabase, userId);
        await syncPremiumVoiceAddon(supabase, {
          userId,
          eventId: event.id,
          immediateCancel: true,
          cancelReason: "subscription_deleted",
          externalCustomerId: customerId || null,
          externalSubscriptionId: subscription.id,
        });

        const { error: eventInsertError } = await supabase
          .from("subscription_events")
          .insert({
            user_id: userId,
            event_type: "subscription",
            event_name: event.type,
            stripe_event_id: event.id,
            event_data: event,
            processed_at: new Date().toISOString(),
          });

        if (eventInsertError) {
          console.warn(
            `[stripe-webhook] Duplicate event insert (race): ${event.id}`,
            eventInsertError.message,
          );
          break;
        }

        // Send cancellation email
        const userDetails = await getUserDetails(userId);
        const userEmail = userDetails?.email || "";
        const userName =
          `${userDetails?.first_name || ""} ${userDetails?.last_name || ""}`.trim() ||
          "Customer";

        if (userEmail) {
          await sendBillingEmail(
            supabase,
            "subscription_cancelled",
            userEmail,
            userName,
            {
              first_name: userDetails?.first_name || "there",
              plan_name: "Premium",
              access_until_date: formatDate(
                timestampToISO(subscription.current_period_end),
              ),
            },
          );

          // Admin notification
          try {
            await sendAdminNotification(
              `Subscription Cancelled: ${userName}`,
              `User: ${userName}\nEmail: ${userEmail}\nCancelled: ${formatDate(new Date().toISOString())}\nAccess Until: ${formatDate(timestampToISO(subscription.current_period_end))}`,
            );
          } catch {
            // Non-fatal
          }
        }

        console.log(
          `[stripe-webhook] Subscription deleted for user: ${userId}`,
        );
        break;
      }

      // ──────────────────────────────────────────────
      // SUBSCRIPTION PAUSED
      // ──────────────────────────────────────────────
      case "customer.subscription.paused": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        const userId = await resolveUserId(subscription.metadata, customerId);

        if (!userId) break;

        // Idempotency gate — skip entire handler if already processed
        const { data: existingPausedEvent } = await supabase
          .from("subscription_events")
          .select("id")
          .eq("stripe_event_id", event.id)
          .maybeSingle();

        if (existingPausedEvent) {
          console.log(`[stripe-webhook] Duplicate event skipped: ${event.id}`);
          break;
        }

        await supabase
          .from("user_subscriptions")
          .update({
            status: "paused",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        const { error: eventInsertError } = await supabase
          .from("subscription_events")
          .insert({
            user_id: userId,
            event_type: "subscription",
            event_name: event.type,
            stripe_event_id: event.id,
            event_data: event,
            processed_at: new Date().toISOString(),
          });

        if (eventInsertError) {
          console.warn(
            `[stripe-webhook] Duplicate event insert (race): ${event.id}`,
            eventInsertError.message,
          );
          break;
        }

        console.log(`[stripe-webhook] Subscription paused for user: ${userId}`);
        await syncPremiumVoiceAddon(supabase, {
          userId,
          eventId: event.id,
          overrideStatus: "suspended",
          externalCustomerId: customerId || null,
          externalSubscriptionId: subscription.id,
          referenceDate: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : undefined,
        });
        break;
      }

      // ──────────────────────────────────────────────
      // INVOICE PAID
      // ──────────────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        const subscriptionId = getInvoiceSubscriptionId(invoice);

        const userId = await resolveUserId(
          getInvoiceSubscriptionMetadata(invoice),
          customerId,
        );

        if (!userId) {
          console.error("invoice.paid: Could not determine user_id");
          break;
        }

        // Idempotency gate — skip entire handler if already processed
        const { data: existingPaidEvent } = await supabase
          .from("subscription_events")
          .select("id")
          .eq("stripe_event_id", event.id)
          .maybeSingle();

        if (existingPaidEvent) {
          console.log(`[stripe-webhook] Duplicate event skipped: ${event.id}`);
          break;
        }

        const { error: paymentError } = await supabase.rpc(
          "record_stripe_payment",
          {
            p_user_id: userId,
            p_stripe_invoice_id: invoice.id,
            p_stripe_payment_intent_id:
              typeof invoice.payment_intent === "string"
                ? invoice.payment_intent
                : invoice.payment_intent?.id || null,
            p_stripe_subscription_id: subscriptionId || null,
            p_amount: invoice.amount_paid || 0,
            p_tax_amount: invoice.tax || 0,
            p_discount_amount:
              invoice.total_discount_amounts?.reduce(
                (sum, d) => sum + d.amount,
                0,
              ) || 0,
            p_currency: (invoice.currency || "usd").toUpperCase(),
            p_status: "paid",
            p_billing_reason: mapBillingReason(invoice.billing_reason),
            p_receipt_url: invoice.hosted_invoice_url || null,
            p_invoice_url: invoice.invoice_pdf || null,
            p_card_brand: invoice.charge ? null : null,
            p_card_last_four: null,
            p_paid_at: new Date().toISOString(),
          },
        );

        if (paymentError) {
          console.error("Error recording payment:", paymentError);
        }

        // Update subscription to active if it was past_due
        if (subscriptionId) {
          await supabase
            .from("user_subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId)
            .eq("status", "past_due");
        }

        const { error: eventInsertError } = await supabase
          .from("subscription_events")
          .insert({
            user_id: userId,
            event_type: "payment",
            event_name: event.type,
            stripe_event_id: event.id,
            event_data: event,
            processed_at: new Date().toISOString(),
          });

        if (eventInsertError) {
          console.warn(
            `[stripe-webhook] Duplicate event insert (race): ${event.id}`,
            eventInsertError.message,
          );
          break;
        }

        // Send receipt email
        const userDetails = await getUserDetails(userId);
        const userEmail = userDetails?.email || "";
        const userName =
          `${userDetails?.first_name || ""} ${userDetails?.last_name || ""}`.trim() ||
          "Customer";

        if (userEmail && invoice.billing_reason !== "subscription_create") {
          await sendBillingEmail(
            supabase,
            "payment_receipt",
            userEmail,
            userName,
            {
              first_name: userDetails?.first_name || "there",
              amount: formatCents(invoice.amount_paid || 0),
              plan_name: "Premium",
              payment_date: formatDate(new Date().toISOString()),
              card_brand: "Card",
              card_last_four: "****",
              invoice_id: invoice.id,
              receipt_url: invoice.hosted_invoice_url || "",
            },
          );
        }

        console.log(`[stripe-webhook] Payment recorded for user: ${userId}`);
        await syncPremiumVoiceAddon(supabase, {
          userId,
          eventId: event.id,
          overrideStatus: "active",
          externalCustomerId: customerId || null,
          externalSubscriptionId: subscriptionId || null,
        });
        break;
      }

      // ──────────────────────────────────────────────
      // INVOICE PAYMENT FAILED
      // ──────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        const subscriptionId = getInvoiceSubscriptionId(invoice);

        const userId = await resolveUserId(
          getInvoiceSubscriptionMetadata(invoice),
          customerId,
        );

        if (!userId) {
          console.error("invoice.payment_failed: Could not determine user_id");
          break;
        }

        // Idempotency gate — skip entire handler if already processed
        const { data: existingFailedEvent } = await supabase
          .from("subscription_events")
          .select("id")
          .eq("stripe_event_id", event.id)
          .maybeSingle();

        if (existingFailedEvent) {
          console.log(`[stripe-webhook] Duplicate event skipped: ${event.id}`);
          break;
        }

        // Update subscription status to past_due
        if (subscriptionId) {
          await supabase
            .from("user_subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);
        }

        // Record the failed payment
        await supabase.rpc("record_stripe_payment", {
          p_user_id: userId,
          p_stripe_invoice_id: invoice.id,
          p_stripe_payment_intent_id:
            typeof invoice.payment_intent === "string"
              ? invoice.payment_intent
              : invoice.payment_intent?.id || null,
          p_stripe_subscription_id: subscriptionId || null,
          p_amount: invoice.amount_due || 0,
          p_tax_amount: invoice.tax || 0,
          p_discount_amount: 0,
          p_currency: (invoice.currency || "usd").toUpperCase(),
          p_status: "failed",
          p_billing_reason: mapBillingReason(invoice.billing_reason),
          p_receipt_url: null,
          p_invoice_url: invoice.invoice_pdf || null,
          p_card_brand: null,
          p_card_last_four: null,
          p_paid_at: null,
        });

        const { error: eventInsertError } = await supabase
          .from("subscription_events")
          .insert({
            user_id: userId,
            event_type: "payment",
            event_name: event.type,
            stripe_event_id: event.id,
            event_data: event,
            processed_at: new Date().toISOString(),
          });

        if (eventInsertError) {
          console.warn(
            `[stripe-webhook] Duplicate event insert (race): ${event.id}`,
            eventInsertError.message,
          );
          break;
        }

        // Send payment failed email
        const userDetails = await getUserDetails(userId);
        const userEmail = userDetails?.email || "";
        const userName =
          `${userDetails?.first_name || ""} ${userDetails?.last_name || ""}`.trim() ||
          "Customer";

        if (userEmail) {
          await sendBillingEmail(
            supabase,
            "payment_failed",
            userEmail,
            userName,
            {
              first_name: userDetails?.first_name || "there",
              amount: formatCents(invoice.amount_due || 0),
              plan_name: "Premium",
              update_payment_url: "",
            },
          );

          // Admin notification
          try {
            await sendAdminNotification(
              `Payment Failed: ${userName} - ${formatCents(invoice.amount_due || 0)}`,
              `User: ${userName}\nEmail: ${userEmail}\nAmount: ${formatCents(invoice.amount_due || 0)}\nInvoice: ${invoice.id}`,
            );
          } catch {
            // Non-fatal
          }
        }

        console.log(`[stripe-webhook] Payment failed for user: ${userId}`);
        await syncPremiumVoiceAddon(supabase, {
          userId,
          eventId: event.id,
          overrideStatus: "past_due",
          externalCustomerId: customerId || null,
          externalSubscriptionId: subscriptionId || null,
        });
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ success: true, event: event.type }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
