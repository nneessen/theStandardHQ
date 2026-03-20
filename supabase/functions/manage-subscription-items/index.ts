// supabase/functions/manage-subscription-items/index.ts
// Manages subscription line items (addons, seat packs) on an existing Stripe subscription

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import {
  PREMIUM_VOICE_ADDON_NAME,
  PREMIUM_VOICE_COMING_SOON_MESSAGE,
  PREMIUM_VOICE_SELF_SERVE_ENABLED,
} from "../../../src/lib/subscription/voice-addon.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hardcoded seat pack price — never trust the client for pricing
const SEAT_PACK_PRICE_ID = "price_1T1tU4RYi2kelWQkYkNFnthp";

// Tier config shape stored in subscription_addons.tier_config JSON
interface AddonTier {
  id: string;
  name: string;
  runs_per_month: number;
  price_monthly: number;
  price_annual: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_annual?: string;
}

interface AddonTierConfig {
  tiers: AddonTier[];
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    // For calling other edge functions (e.g. chat-bot-provision), prefer remote URL
    // so provisioning always hits the production function even during local dev.
    const FUNCTIONS_BASE_URL =
      Deno.env.get("REMOTE_SUPABASE_URL") || SUPABASE_URL;

    // Stripe is initialized lazily — only when a paid tier path needs it.
    // This lets the free tier path work without STRIPE_SECRET_KEY.
    let _stripe: InstanceType<typeof Stripe> | null = null;
    function getStripe(): InstanceType<typeof Stripe> {
      if (!_stripe) {
        if (!STRIPE_SECRET_KEY) {
          throw new Error("Stripe not configured");
        }
        _stripe = new Stripe(STRIPE_SECRET_KEY, {
          apiVersion: "2024-12-18.acacia",
        });
      }
      return _stripe;
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.slice(7));
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { action } = body;

    // Get user's active subscription (may be null for free-tier-only users)
    const { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("stripe_subscription_id, billing_interval, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    const stripeSubId = userSub?.stripe_subscription_id || null;
    const billingInterval = userSub?.billing_interval || "monthly";

    switch (action) {
      // ──────────────────────────────────────────────
      // ADD ADDON
      // ──────────────────────────────────────────────
      case "add_addon": {
        const { addonId, tierId } = body;

        if (!addonId) {
          return jsonResponse({ error: "addonId is required" }, 400);
        }

        // Validate addon exists and is active — server-side lookup
        const { data: addon, error: addonLookupError } = await supabase
          .from("subscription_addons")
          .select(
            "id, name, is_active, stripe_price_id_monthly, stripe_price_id_annual, tier_config",
          )
          .eq("id", addonId)
          .maybeSingle();

        if (addonLookupError || !addon) {
          return jsonResponse({ error: "Addon not found" }, 404);
        }

        if (!addon.is_active) {
          return jsonResponse(
            { error: "This addon is no longer available" },
            400,
          );
        }

        if (
          addon.name === PREMIUM_VOICE_ADDON_NAME &&
          !PREMIUM_VOICE_SELF_SERVE_ENABLED
        ) {
          return jsonResponse(
            {
              error: PREMIUM_VOICE_COMING_SOON_MESSAGE,
              comingSoon: true,
            },
            403,
          );
        }

        // Resolve the correct price ID server-side
        let priceId: string | null = null;
        let resolvedTierId: string | null = null;

        const tierConfig = addon.tier_config as AddonTierConfig | null;

        if (tierConfig?.tiers && tierConfig.tiers.length > 0) {
          // Tiered addon — tierId is required
          if (!tierId) {
            return jsonResponse(
              { error: "tierId is required for this addon" },
              400,
            );
          }

          const tier = tierConfig.tiers.find((t) => t.id === tierId);
          if (!tier) {
            return jsonResponse(
              {
                error: `Invalid tier: ${tierId}. Valid tiers: ${tierConfig.tiers.map((t) => t.id).join(", ")}`,
              },
              400,
            );
          }

          priceId =
            billingInterval === "annual"
              ? tier.stripe_price_id_annual || null
              : tier.stripe_price_id_monthly || null;
          resolvedTierId = tier.id;
        } else {
          // Non-tiered addon — use addon-level price IDs
          priceId =
            billingInterval === "annual"
              ? addon.stripe_price_id_annual
              : addon.stripe_price_id_monthly;
        }

        // Check for existing active addon (before any Stripe or DB writes)
        const { data: existingAddon } = await supabase
          .from("user_subscription_addons")
          .select("id, status, tier_id, stripe_subscription_item_id")
          .eq("user_id", user.id)
          .eq("addon_id", addonId)
          .in("status", ["active", "manual_grant"])
          .maybeSingle();

        if (existingAddon) {
          // Same tier — check if agent provisioning needs a retry
          if (existingAddon.tier_id === resolvedTierId) {
            // Check if the chat bot agent needs (re-)provisioning
            if (addon.name === "ai_chat_bot") {
              const { data: agentRow } = await supabase
                .from("chat_bot_agents")
                .select("provisioning_status")
                .eq("user_id", user.id)
                .maybeSingle();

              if (!agentRow || agentRow.provisioning_status !== "active") {
                // Agent missing or failed — re-trigger provisioning
                console.log(
                  `[manage-subscription-items] Re-provisioning chat bot agent (status=${agentRow?.provisioning_status ?? "missing"}) for user=${user.id}`,
                );
                try {
                  const provisionRes = await fetch(
                    `${FUNCTIONS_BASE_URL}/functions/v1/chat-bot-provision`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      },
                      body: JSON.stringify({
                        action: "provision",
                        userId: user.id,
                        tierId: resolvedTierId,
                      }),
                    },
                  );
                  const provisionData = await provisionRes
                    .json()
                    .catch(() => ({}));
                  console.log(
                    `[manage-subscription-items] Re-provision result:`,
                    provisionData,
                  );

                  if (provisionData.error) {
                    return jsonResponse(
                      {
                        error:
                          provisionData.error ||
                          "Failed to provision chat bot agent",
                        provisioningFailed: true,
                      },
                      500,
                    );
                  }

                  return jsonResponse({
                    success: true,
                    tier: resolvedTierId,
                    reprovisioned: true,
                  });
                } catch (provisionErr) {
                  console.error(
                    `[manage-subscription-items] Re-provision failed:`,
                    provisionErr,
                  );
                  return jsonResponse(
                    {
                      error: "Failed to provision chat bot agent",
                      provisioningFailed: true,
                    },
                    500,
                  );
                }
              }
            }

            return jsonResponse({
              success: true,
              alreadyActive: true,
              tier: resolvedTierId,
            });
          }

          // Different tier — handle tier change (upgrade/downgrade)
          console.log(
            `[manage-subscription-items] Tier change: ${existingAddon.tier_id} → ${resolvedTierId}, user=${user.id}`,
          );

          // Remove the old Stripe line item if the previous tier was paid
          if (existingAddon.stripe_subscription_item_id && stripeSubId) {
            try {
              await getStripe().subscriptions.update(stripeSubId, {
                items: [
                  {
                    id: existingAddon.stripe_subscription_item_id,
                    deleted: true,
                  },
                ],
                proration_behavior: "create_prorations",
              });
              console.log(
                `[manage-subscription-items] Removed old Stripe item ${existingAddon.stripe_subscription_item_id}`,
              );
            } catch (removeErr) {
              console.error(
                "[manage-subscription-items] Failed to remove old Stripe item:",
                removeErr,
              );
              // Continue — the old item may already be gone
            }
          }

          // Cancel the existing DB record so the new tier can be added below
          await supabase
            .from("user_subscription_addons")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingAddon.id);
        }

        // Resolve the tier's price (0 for free tiers)
        const resolvedPriceMonthly = tierConfig?.tiers
          ? (tierConfig.tiers.find((t) => t.id === resolvedTierId)
              ?.price_monthly ?? null)
          : null;

        // Free tier — skip Stripe, just insert DB record directly
        if (resolvedPriceMonthly === 0 || !priceId) {
          const now = new Date();
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          const { error: freeAddonError } = await supabase
            .from("user_subscription_addons")
            .upsert(
              {
                user_id: user.id,
                addon_id: addonId,
                tier_id: resolvedTierId,
                status: "active",
                billing_interval: billingInterval,
                stripe_subscription_id: stripeSubId,
                stripe_subscription_item_id: null,
                stripe_checkout_session_id: null,
                cancelled_at: null,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                updated_at: now.toISOString(),
              },
              { onConflict: "user_id,addon_id" },
            );

          if (freeAddonError) {
            console.error(
              "[manage-subscription-items] DB write failed for free tier addon:",
              freeAddonError,
            );
            return jsonResponse({ error: "Failed to save addon record" }, 500);
          }

          console.log(
            `[manage-subscription-items] Free addon added: addon=${addonId}, tier=${resolvedTierId}, user=${user.id}`,
          );

          // Trigger agent provisioning or tier update
          // Check if agent exists and is active — if not, provision instead of update_tier
          let provisionAction = "provision";
          if (existingAddon && addon.name === "ai_chat_bot") {
            const { data: agentCheck } = await supabase
              .from("chat_bot_agents")
              .select("provisioning_status")
              .eq("user_id", user.id)
              .maybeSingle();
            if (agentCheck?.provisioning_status === "active") {
              provisionAction = "update_tier";
            }
          } else if (existingAddon) {
            provisionAction = "update_tier";
          }
          try {
            const provisionRes = await fetch(
              `${FUNCTIONS_BASE_URL}/functions/v1/chat-bot-provision`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  action: provisionAction,
                  userId: user.id,
                  tierId: resolvedTierId,
                }),
              },
            );
            const provisionData = await provisionRes.json().catch(() => ({}));
            console.log(
              `[manage-subscription-items] ${provisionAction} result for free tier:`,
              provisionData,
            );
          } catch (provisionErr) {
            // Non-fatal — user can retry from the setup wizard
            console.error(
              `[manage-subscription-items] Failed to trigger ${provisionAction} for free tier:`,
              provisionErr,
            );
          }

          return jsonResponse({ success: true, tier: resolvedTierId });
        }

        // Paid tier — no Stripe subscription? Create a checkout session for standalone addon
        if (!stripeSubId) {
          console.log(
            `[manage-subscription-items] No Stripe subscription found, creating checkout for addon: addon=${addonId}, tier=${resolvedTierId}, user=${user.id}`,
          );

          // Find or create Stripe customer
          const { data: existingSub } = await supabase
            .from("user_subscriptions")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .maybeSingle();

          const SITE_URL =
            Deno.env.get("SITE_URL") || "https://app.commissiontracker.io";
          const successUrl = `${SITE_URL}/tools/chat-bot?checkout=success&addon_id=${addonId}&tier_id=${resolvedTierId}`;
          const cancelUrl = `${SITE_URL}/tools/chat-bot?checkout=cancelled`;

          // deno-lint-ignore no-explicit-any
          const sessionParams: any = {
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
              user_id: user.id,
              addon_id: addonId,
              tier_id: resolvedTierId,
            },
            subscription_data: {
              metadata: {
                user_id: user.id,
                addon_id: addonId,
                tier_id: resolvedTierId,
              },
            },
          };

          if (existingSub?.stripe_customer_id) {
            sessionParams.customer = existingSub.stripe_customer_id;
          } else {
            sessionParams.customer_email = user.email;
          }

          const session =
            await getStripe().checkout.sessions.create(sessionParams);

          console.log(
            `[manage-subscription-items] Created checkout session: ${session.id}, url=${session.url}`,
          );

          return jsonResponse({
            success: true,
            requiresCheckout: true,
            checkoutUrl: session.url,
          });
        }

        // Add line item to existing Stripe subscription
        const updatedSub = await getStripe().subscriptions.update(stripeSubId, {
          items: [{ price: priceId }],
          proration_behavior: "create_prorations",
        });

        // Find the newly added item by matching price ID
        const newItem = updatedSub.items.data.find(
          (item) => item.price.id === priceId,
        );

        if (!newItem) {
          console.error(
            "[manage-subscription-items] Could not find new item after adding addon",
          );
          return jsonResponse(
            { error: "Failed to identify the new subscription item" },
            500,
          );
        }

        // Upsert addon record in DB
        const { error: addonError } = await supabase
          .from("user_subscription_addons")
          .upsert(
            {
              user_id: user.id,
              addon_id: addonId,
              tier_id: resolvedTierId,
              status: "active",
              stripe_subscription_id: stripeSubId,
              stripe_subscription_item_id: newItem.id,
              stripe_checkout_session_id: null,
              billing_interval: billingInterval,
              cancelled_at: null,
              current_period_start: new Date(
                updatedSub.current_period_start * 1000,
              ).toISOString(),
              current_period_end: new Date(
                updatedSub.current_period_end * 1000,
              ).toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,addon_id" },
          );

        if (addonError) {
          // Rollback: remove the Stripe line item since DB write failed
          console.error(
            "[manage-subscription-items] DB write failed, rolling back Stripe item:",
            addonError,
          );
          try {
            await getStripe().subscriptions.update(stripeSubId, {
              items: [{ id: newItem.id, deleted: true }],
              proration_behavior: "none",
            });
            console.log(
              `[manage-subscription-items] Rolled back Stripe item ${newItem.id}`,
            );
          } catch (rollbackErr) {
            console.error(
              "[manage-subscription-items] CRITICAL: Stripe rollback also failed:",
              rollbackErr,
            );
          }
          return jsonResponse({ error: "Failed to save addon record" }, 500);
        }

        console.log(
          `[manage-subscription-items] Addon added: addon=${addonId}, tier=${resolvedTierId}, item=${newItem.id}, user=${user.id}`,
        );

        // If this was a tier change, update the lead limit on the external agent
        if (existingAddon) {
          try {
            const updateRes = await fetch(
              `${FUNCTIONS_BASE_URL}/functions/v1/chat-bot-provision`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  action: "update_tier",
                  userId: user.id,
                  tierId: resolvedTierId,
                }),
              },
            );
            const updateData = await updateRes.json().catch(() => ({}));
            console.log(
              `[manage-subscription-items] update_tier result for paid tier change:`,
              updateData,
            );
          } catch (updateErr) {
            console.error(
              "[manage-subscription-items] Failed to trigger update_tier for paid tier change:",
              updateErr,
            );
          }
        }

        return jsonResponse({ success: true });
      }

      // ──────────────────────────────────────────────
      // REMOVE ADDON
      // ──────────────────────────────────────────────
      case "remove_addon": {
        const { addonId: removeAddonId } = body;

        if (!removeAddonId) {
          return jsonResponse({ error: "addonId is required" }, 400);
        }

        // Look up the addon record
        const { data: addonRecord, error: lookupError } = await supabase
          .from("user_subscription_addons")
          .select("id, stripe_subscription_item_id")
          .eq("user_id", user.id)
          .eq("addon_id", removeAddonId)
          .eq("status", "active")
          .maybeSingle();

        if (lookupError || !addonRecord) {
          return jsonResponse({ error: "Active addon not found" }, 404);
        }

        // Remove Stripe line item (skip if free tier — no Stripe item)
        if (addonRecord.stripe_subscription_item_id && stripeSubId) {
          await getStripe().subscriptions.update(stripeSubId, {
            items: [
              { id: addonRecord.stripe_subscription_item_id, deleted: true },
            ],
            proration_behavior: "create_prorations",
          });
        }

        // Update DB record
        await supabase
          .from("user_subscription_addons")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", addonRecord.id);

        console.log(
          `[manage-subscription-items] Addon removed: addon=${removeAddonId}, user=${user.id}`,
        );

        return jsonResponse({ success: true });
      }

      // ──────────────────────────────────────────────
      // ADD SEAT PACK
      // ──────────────────────────────────────────────
      case "add_seat_pack": {
        if (!stripeSubId) {
          return jsonResponse({ error: "No active subscription found." }, 400);
        }
        // Capture item count BEFORE adding, to detect if Stripe creates
        // a new item vs incrementing quantity on an existing one.
        const currentSub =
          await getStripe().subscriptions.retrieve(stripeSubId);
        const itemCountBefore = currentSub.items.data.length;
        const existingSeatItem = currentSub.items.data.find(
          (item) => item.price.id === SEAT_PACK_PRICE_ID,
        );

        // Add seat pack line item to subscription (price hardcoded server-side)
        const updatedSub = await getStripe().subscriptions.update(stripeSubId, {
          items: [{ price: SEAT_PACK_PRICE_ID }],
          proration_behavior: "create_prorations",
        });

        const newSeatItem = updatedSub.items.data.find(
          (item) => item.price.id === SEAT_PACK_PRICE_ID,
        );

        if (!newSeatItem) {
          console.error(
            "[manage-subscription-items] Could not find seat pack item after update",
          );
          return jsonResponse(
            { error: "Failed to identify the seat pack subscription item" },
            500,
          );
        }

        // Detect if Stripe aggregated quantity instead of creating a new item.
        // If item count didn't increase and the item existed before, Stripe
        // incremented quantity on the existing item.
        const isQuantityIncrement =
          existingSeatItem && updatedSub.items.data.length <= itemCountBefore;

        // Record the quantity on the Stripe item for audit
        const stripeQuantity = newSeatItem.quantity || 1;

        // Create seat pack record
        const { error: seatPackError } = await supabase
          .from("team_seat_packs")
          .insert({
            owner_id: user.id,
            quantity: 1,
            stripe_subscription_id: stripeSubId,
            stripe_subscription_item_id: newSeatItem.id,
            status: "active",
          });

        if (seatPackError) {
          // Rollback: remove the Stripe line item since DB write failed
          console.error(
            "[manage-subscription-items] DB write failed, rolling back Stripe seat pack:",
            seatPackError,
          );
          try {
            if (isQuantityIncrement && existingSeatItem) {
              // Decrement quantity back instead of deleting
              await getStripe().subscriptions.update(stripeSubId, {
                items: [
                  {
                    id: newSeatItem.id,
                    quantity: stripeQuantity - 1,
                  },
                ],
                proration_behavior: "none",
              });
            } else {
              await getStripe().subscriptions.update(stripeSubId, {
                items: [{ id: newSeatItem.id, deleted: true }],
                proration_behavior: "none",
              });
            }
            console.log(
              `[manage-subscription-items] Rolled back Stripe seat pack item ${newSeatItem.id}`,
            );
          } catch (rollbackErr) {
            console.error(
              "[manage-subscription-items] CRITICAL: Stripe rollback also failed:",
              rollbackErr,
            );
          }
          return jsonResponse(
            { error: "Failed to save seat pack record" },
            500,
          );
        }

        if (isQuantityIncrement) {
          console.log(
            `[manage-subscription-items] Seat pack added via quantity increment: item=${newSeatItem.id}, qty=${stripeQuantity}, user=${user.id}`,
          );
        } else {
          console.log(
            `[manage-subscription-items] Seat pack added as new item: item=${newSeatItem.id}, user=${user.id}`,
          );
        }

        return jsonResponse({ success: true });
      }

      // ──────────────────────────────────────────────
      // REMOVE SEAT PACK
      // ──────────────────────────────────────────────
      case "remove_seat_pack": {
        if (!stripeSubId) {
          return jsonResponse({ error: "No active subscription found." }, 400);
        }
        const { seatPackId } = body;

        if (!seatPackId) {
          return jsonResponse({ error: "seatPackId is required" }, 400);
        }

        // Look up the seat pack's stripe_subscription_item_id
        const { data: seatPackRecord, error: seatLookupError } = await supabase
          .from("team_seat_packs")
          .select("id, stripe_subscription_item_id")
          .eq("id", seatPackId)
          .eq("owner_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (seatLookupError || !seatPackRecord?.stripe_subscription_item_id) {
          return jsonResponse(
            { error: "Active seat pack not found or missing item ID" },
            404,
          );
        }

        // Check how many active DB records share this Stripe item ID
        // (multiple seat packs may share a single Stripe item via quantity)
        const { count: sharedCount } = await supabase
          .from("team_seat_packs")
          .select("id", { count: "exact", head: true })
          .eq(
            "stripe_subscription_item_id",
            seatPackRecord.stripe_subscription_item_id,
          )
          .eq("status", "active");

        const otherActivePacksOnSameItem = (sharedCount || 0) - 1;

        if (otherActivePacksOnSameItem > 0) {
          // Other packs share this Stripe item — decrement quantity instead of deleting
          const currentSub =
            await getStripe().subscriptions.retrieve(stripeSubId);
          const seatItem = currentSub.items.data.find(
            (item) => item.id === seatPackRecord.stripe_subscription_item_id,
          );
          const currentQty = seatItem?.quantity || 1;

          if (currentQty > 1) {
            await getStripe().subscriptions.update(stripeSubId, {
              items: [
                {
                  id: seatPackRecord.stripe_subscription_item_id,
                  quantity: currentQty - 1,
                },
              ],
              proration_behavior: "create_prorations",
            });
          } else {
            // Quantity is already 1 but we have other DB records — just remove the item
            await getStripe().subscriptions.update(stripeSubId, {
              items: [
                {
                  id: seatPackRecord.stripe_subscription_item_id,
                  deleted: true,
                },
              ],
              proration_behavior: "create_prorations",
            });
          }
        } else {
          // Only this pack uses the Stripe item — delete the item entirely
          await getStripe().subscriptions.update(stripeSubId, {
            items: [
              {
                id: seatPackRecord.stripe_subscription_item_id,
                deleted: true,
              },
            ],
            proration_behavior: "create_prorations",
          });
        }

        // Update DB record
        await supabase
          .from("team_seat_packs")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", seatPackRecord.id);

        console.log(
          `[manage-subscription-items] Seat pack removed: id=${seatPackId}, user=${user.id}`,
        );

        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse(
          {
            error: `Unknown action: ${action}. Valid actions: add_addon, remove_addon, add_seat_pack, remove_seat_pack`,
          },
          400,
        );
    }
  } catch (err) {
    console.error("[manage-subscription-items] Unhandled error:", err);
    return jsonResponse({ error: "Subscription update failed" }, 500);
  }
});
