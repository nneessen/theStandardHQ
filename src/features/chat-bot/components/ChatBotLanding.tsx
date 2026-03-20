// src/features/chat-bot/components/ChatBotLanding.tsx
// Feature showcase + inline tier purchase for non-subscribers

import { useState } from "react";
import {
  Bot,
  MessageSquare,
  Calendar,
  Clock,
  Globe,
  ShieldCheck,
  Zap,
  Check,
  Loader2,
  AlertTriangle,
  KeyRound,
  ListChecks,
  Tag,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useAdminSubscriptionAddons,
  type SubscriptionAddon,
  type AddonTierConfig,
} from "@/hooks/admin";
import {
  useSubscription,
  subscriptionKeys,
  userAddonKeys,
} from "@/hooks/subscription";
// eslint-disable-next-line no-restricted-imports
import { subscriptionService } from "@/services/subscription";
import { useProvisionTeamBot } from "../hooks/useChatBot";
import { ConversationDemo } from "./ConversationDemo";
import {
  CloseLogo,
  CalendlyLogo,
  GoogleCalendarLogo,
} from "./IntegrationLogos";

// ─── Component ──────────────────────────────────────────────────

interface ChatBotLandingProps {
  /** The user's current active tier ID (e.g. "free", "starter"), if any */
  currentTierId?: string | null;
  /** Called after a plan is successfully activated — used to switch to configuration tab */
  onPlanActivated?: () => void;
  /** Whether the current user is a team member (IMO owner/admin, super admin) */
  isTeamMember?: boolean;
  /** Whether the user's agent already has billing exemption */
  isBillingExempt?: boolean;
}

export function ChatBotLanding({
  currentTierId,
  onPlanActivated,
  isTeamMember,
  isBillingExempt,
}: ChatBotLandingProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const provisionTeamBot = useProvisionTeamBot();
  const [selectedTierId, setSelectedTierId] = useState<string>(
    currentTierId || "free",
  );
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const { data: allAddons, isLoading: addonsLoading } =
    useAdminSubscriptionAddons();
  useSubscription();

  // Find the ai_chat_bot addon
  const chatBotAddon = allAddons?.find(
    (a) => a.name === "ai_chat_bot" && a.is_active,
  );

  const getTierConfig = (addon: SubscriptionAddon): AddonTierConfig | null => {
    const raw = (addon as { tier_config?: AddonTierConfig | null }).tier_config;
    if (!raw || !raw.tiers || raw.tiers.length === 0) return null;
    return raw;
  };

  const tierConfig = chatBotAddon ? getTierConfig(chatBotAddon) : null;
  const tiers = tierConfig?.tiers || [];

  const selectedTier = tiers.find((t) => t.id === selectedTierId) || tiers[0];

  const isFreeSelected = selectedTier?.price_monthly === 0;
  const hasPriceConfigured =
    isFreeSelected ||
    !!selectedTier?.stripe_price_id_monthly ||
    !!selectedTier?.stripe_price_id_annual;

  const isCurrentTier = !!currentTierId && selectedTierId === currentTierId;
  const canPurchase = !isCurrentTier;

  const handlePurchase = async () => {
    if (!user?.id || !chatBotAddon || !selectedTier || purchaseLoading) return;

    // Paid tiers without a Stripe subscription will redirect to Stripe Checkout

    setPurchaseLoading(true);
    try {
      const result = await subscriptionService.addSubscriptionAddon(
        chatBotAddon.id,
        selectedTier.id,
      );

      if (result.success) {
        // If checkout is required (no existing Stripe subscription), redirect
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }

        toast.success("AI Chat Bot activated! Let's configure your bot.");
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
        if (user?.id) {
          queryClient.invalidateQueries({
            queryKey: userAddonKeys.activeAddons(user.id),
          });
        }
        // Re-fetch agent status
        queryClient.invalidateQueries({ queryKey: ["chat-bot"] });
        // Switch to configuration tab
        onPlanActivated?.();
      } else {
        toast.error(result.error || "Failed to activate addon.");
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="space-y-6">
      {/* ═══════════ HERO BANNER ═══════════ */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="relative px-6 py-5">
          <div className="grid grid-cols-[1fr_auto] items-center gap-8">
            {/* Left column — text content */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  AI-Powered SMS Appointment Setter
                </h1>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed max-w-lg">
                  Responds to inbound leads instantly, has real conversations,
                  and books appointments on your calendar. Runs within compliant
                  hours so you never miss a lead.
                </p>
              </div>
            </div>

            {/* Right column — integration logos */}
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shadow-md shadow-black/20">
                  <CloseLogo className="h-5 w-auto text-white" />
                </div>
                <span className="text-[9px] text-zinc-400 font-medium">
                  Close CRM
                </span>
              </div>
              <span className="text-xs text-zinc-600 font-medium">+</span>
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shadow-md shadow-black/20">
                  <CalendlyLogo className="h-8 w-8" />
                </div>
                <span className="text-[9px] text-zinc-400 font-medium">
                  Calendly
                </span>
              </div>
              <span className="text-xs text-zinc-600 font-medium">/</span>
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shadow-md shadow-black/20">
                  <GoogleCalendarLogo className="h-8 w-8" />
                </div>
                <span className="text-[9px] text-zinc-400 font-medium">
                  Google Cal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ TEAM ACCESS (team members only) ═══════════ */}
      {isTeamMember && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Team Access
            </h2>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 overflow-hidden bg-white dark:bg-zinc-900">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Team Access — Free
                    </h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Unlimited leads, no billing. If you already have a bot,
                      this reconnects it instead of creating a duplicate.
                    </p>
                  </div>
                </div>
                {isBillingExempt ? (
                  <Badge className="text-[9px] h-6 px-3 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                    <Check className="h-2.5 w-2.5 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 text-[10px] px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={provisionTeamBot.isPending}
                    onClick={() =>
                      provisionTeamBot.mutate(undefined, {
                        onSuccess: () => onPlanActivated?.(),
                      })
                    }
                  >
                    {provisionTeamBot.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    {provisionTeamBot.isPending ? "Loading..." : "Load Bot"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ CHOOSE YOUR PLAN (non-team members) ═══════════ */}
      {!isTeamMember && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Choose Your Plan
            </h2>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
            <div className="p-4">
              {addonsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : tiers.length > 0 ? (
                <>
                  <div
                    className={cn(
                      "grid gap-3",
                      tiers.length > 3
                        ? "grid-cols-2 sm:grid-cols-4"
                        : "grid-cols-1 sm:grid-cols-3",
                    )}
                  >
                    {tiers.map((tier) => {
                      const isSelected = selectedTierId === tier.id;
                      const isFree = tier.price_monthly === 0;
                      const isPopular = tier.id === "growth";
                      const isCurrent = currentTierId === tier.id;
                      return (
                        <button
                          key={tier.id}
                          onClick={() => setSelectedTierId(tier.id)}
                          className={cn(
                            "relative flex flex-col rounded-lg border p-3 text-left transition-all",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30"
                              : isPopular
                                ? "border-zinc-900 dark:border-zinc-100"
                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
                          )}
                        >
                          {/* Current plan badge — takes priority */}
                          {isCurrent && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                              <span className="inline-flex items-center gap-0.5 bg-blue-600 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
                                <Check className="h-2.5 w-2.5" />
                                Current
                              </span>
                            </div>
                          )}

                          {/* Popular badge */}
                          {isPopular && !isSelected && !isCurrent && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                              <span className="inline-flex items-center gap-0.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                                <Zap className="h-2.5 w-2.5" />
                                Popular
                              </span>
                            </div>
                          )}

                          {/* Selected badge */}
                          {isSelected && !isCurrent && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                              <span className="inline-flex items-center gap-0.5 bg-emerald-500 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
                                <Check className="h-2.5 w-2.5" />
                                Selected
                              </span>
                            </div>
                          )}

                          {/* Free test badge */}
                          {isFree && !isSelected && !isCurrent && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                              <span className="inline-flex items-center gap-0.5 bg-amber-500 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
                                Test
                              </span>
                            </div>
                          )}

                          {/* Plan header */}
                          <div className="mt-1 mb-3">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                              {tier.name}
                            </h3>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                                {isFree
                                  ? "$0"
                                  : formatPrice(tier.price_monthly)}
                              </span>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                /mo
                              </span>
                            </div>
                            {isFree && (
                              <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                Free forever
                              </p>
                            )}
                          </div>

                          {/* Features */}
                          <div className="flex-1 space-y-1.5 mb-3">
                            <div className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                {tier.runs_per_month.toLocaleString()}{" "}
                                leads/month
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                ~{(tier.runs_per_month * 8).toLocaleString()}{" "}
                                SMS/month
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                AI responses (compliant hours)
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                Auto appointment booking
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                Proactive new-lead outreach
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                Objection handling &amp; rebuttals
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                Scheduled follow-ups
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Subscribe button — below cards */}
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-zinc-400">
                          {isFreeSelected
                            ? "Free — no credit card required"
                            : "Billed monthly with your subscription"}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Each plan is a monthly lead limit — unique new leads
                          the bot will engage with.
                        </p>
                      </div>
                      {isCurrentTier ? (
                        <Badge className="text-[9px] h-7 px-4 flex-shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          <Check className="h-3 w-3 mr-1" />
                          Current Plan
                        </Badge>
                      ) : hasPriceConfigured ? (
                        <Button
                          size="sm"
                          className={cn(
                            "h-7 text-[10px] px-4 flex-shrink-0",
                            "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white",
                          )}
                          disabled={purchaseLoading || !canPurchase}
                          onClick={handlePurchase}
                        >
                          {purchaseLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          {currentTierId
                            ? isFreeSelected
                              ? "Downgrade to Free"
                              : `Upgrade to ${selectedTier?.name || ""}`
                            : isFreeSelected
                              ? "Start Free"
                              : `Activate ${selectedTier?.name || ""} Plan`}
                        </Button>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[9px] flex-shrink-0"
                        >
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Fallback static tiers if addon not configured in DB yet */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    {[
                      {
                        name: "Starter",
                        price: "$49",
                        leads: "50",
                        popular: false,
                      },
                      {
                        name: "Growth",
                        price: "$99",
                        leads: "150",
                        popular: true,
                      },
                      {
                        name: "Scale",
                        price: "$199",
                        leads: "500",
                        popular: false,
                      },
                    ].map((tier) => (
                      <div
                        key={tier.name}
                        className={cn(
                          "relative flex flex-col rounded-lg border p-3",
                          tier.popular
                            ? "border-zinc-900 dark:border-zinc-100"
                            : "border-zinc-200 dark:border-zinc-700",
                        )}
                      >
                        {tier.popular && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-0.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                              <Zap className="h-2.5 w-2.5" />
                              Popular
                            </span>
                          </div>
                        )}
                        <div className="mt-1 mb-3">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {tier.name}
                          </h3>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                              {tier.price}
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              /mo
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                              {tier.leads} leads/month
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                              ~{parseInt(tier.leads) * 8} SMS/month
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                              AI responses (compliant hours)
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                              Auto appointment booking
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                              Proactive new-lead outreach
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                              Objection handling &amp; rebuttals
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                              Scheduled follow-ups
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <Badge variant="outline" className="text-[9px]">
                      Coming Soon
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ SEE IT IN ACTION ═══════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            See It In Action
          </h2>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">
          Watch real conversation scenarios — from first contact to booked
          appointment.
        </p>
        <ConversationDemo />
      </section>

      {/* ═══════════ HOW IT WORKS + WHAT YOU GET (SIDE BY SIDE) ═══════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            How It Works
          </h2>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* 3-step flow */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              step: 1,
              icon: MessageSquare,
              color: "blue",
              title: "Lead Texts In",
              desc: "A new lead sends an SMS to your Close CRM phone number",
              bg: "bg-blue-50 dark:bg-blue-950/30",
            },
            {
              step: 2,
              icon: Bot,
              color: "purple",
              title: "AI Responds Instantly",
              desc: "The bot replies within seconds, has a natural back-and-forth conversation, and offers appointment times",
              bg: "bg-purple-50 dark:bg-purple-950/30",
            },
            {
              step: 3,
              icon: Calendar,
              color: "emerald",
              title: "Appointment Booked",
              desc: "An event is created on your calendar and both you and the lead are notified",
              bg: "bg-emerald-50 dark:bg-emerald-950/30",
            },
          ].map((item) => (
            <div
              key={item.step}
              className={cn(
                "p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50",
                item.bg,
              )}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-zinc-800 text-[9px] font-bold text-zinc-500 dark:text-zinc-400 shadow-sm">
                  {item.step}
                </span>
                <item.icon
                  className={cn(
                    "h-3.5 w-3.5",
                    item.color === "blue" && "text-blue-500",
                    item.color === "purple" && "text-purple-500",
                    item.color === "emerald" && "text-emerald-500",
                  )}
                />
              </div>
              <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                {item.title}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ WHAT YOU GET ═══════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            What You Get
          </h2>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: Clock,
              title: "Instant Response",
              desc: "Leads get a reply within seconds during business hours. Off-hours messages queue for the next compliant window — no lead falls through the cracks",
            },
            {
              icon: Calendar,
              title: "Smart Scheduling",
              desc: "Bot checks your real calendar availability and offers times that work for both of you",
            },
            {
              icon: Globe,
              title: "Timezone Aware",
              desc: "Automatically adjusts appointment offers based on the lead's timezone",
            },
            {
              icon: ShieldCheck,
              title: "Compliant Conversations",
              desc: "Never quotes prices or policy details over text — redirects all financial questions to the appointment",
            },
            {
              icon: Zap,
              title: "Proactive Outreach",
              desc: "Automatically contacts new leads the moment they hit your CRM — no waiting for them to text first",
            },
            {
              icon: MessageSquare,
              title: "Objection Handling",
              desc: "Handles pricing questions, hesitation, and common pushback with natural rebuttals that steer toward booking",
            },
            {
              icon: RefreshCw,
              title: "Follow-Up Re-engagement",
              desc: "Re-engages cold leads with personalized follow-ups. Adapts messaging for mortgage protection, veteran, and other lead types",
            },
            {
              icon: Bot,
              title: "Natural Conversations",
              desc: "Not a basic auto-responder — carries on real multi-message conversations that feel human",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <f.icon className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                </div>
                <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                  {f.title}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ REQUIREMENTS ═══════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Before You Get Started
          </h2>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10 p-4">
          <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mb-3">
            This bot currently works exclusively with{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Close CRM
            </span>{" "}
            and{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Calendly or Google Calendar
            </span>
            . Make sure you have the following ready:
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2.5 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/50 dark:border-zinc-800/50">
              <KeyRound className="h-3.5 w-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                  Close CRM Account
                </p>
                <ul className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 space-y-0.5">
                  <li>
                    Must have a custom field called "Lead Source" on leads
                  </li>
                  <li>Lead statuses configured (New, Contacted, etc.)</li>
                  <li>API key ready (Settings &gt; API Keys in Close)</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/50 dark:border-zinc-800/50">
              <Calendar className="h-3.5 w-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                  Calendar Account
                </p>
                <ul className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 space-y-0.5">
                  <li>Calendly (Standard+) or Google Calendar</li>
                  <li>At least one event type configured</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/50 dark:border-zinc-800/50">
              <Tag className="h-3.5 w-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                  Lead Source Names
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Know which lead sources your leads come from (e.g. "Sitka
                  Life", "GOAT Realtime Mortgage"). You'll configure these after
                  subscribing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ INTEGRATIONS ═══════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Required Integrations
          </h2>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">
            This bot currently works{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              exclusively with Close CRM and either Calendly or Google Calendar
            </span>
            . Close CRM plus one calendar provider are required.
          </p>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg flex-1 border border-zinc-100 dark:border-zinc-700/50">
              <CloseLogo className="h-4 w-auto text-zinc-900 dark:text-zinc-100" />
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
                    Close CRM
                  </p>
                  <Badge className="text-[7px] h-3 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    Required
                  </Badge>
                </div>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-400">
                  Receives SMS leads, sends replies
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg flex-1 border border-zinc-100 dark:border-zinc-700/50">
              <CalendlyLogo className="h-5 w-5 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
                    Calendly
                  </p>
                  <Badge className="text-[7px] h-3 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    Option A
                  </Badge>
                </div>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-400">
                  Checks availability, books appointments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg flex-1 border border-zinc-100 dark:border-zinc-700/50">
              <GoogleCalendarLogo className="h-5 w-5 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
                    Google Calendar
                  </p>
                  <Badge className="text-[7px] h-3 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    Option B
                  </Badge>
                </div>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-400">
                  Checks availability, books appointments
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-2.5">
            <ListChecks className="h-3 w-3 flex-shrink-0" />
            <span>
              Connect either Calendly or Google Calendar — one required
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
