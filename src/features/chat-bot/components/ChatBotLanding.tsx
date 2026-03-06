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
import { ConversationDemo } from "./ConversationDemo";

// ─── Close CRM Logo ──────────────────────────────────────────────

function CloseLogo({ className }: { className?: string }) {
  return (
    <svg fill="none" viewBox="0 0 234 64" className={className}>
      <mask
        id="close_logo_a"
        width="234"
        height="63"
        x="0"
        y="0"
        maskUnits="userSpaceOnUse"
        style={{ maskType: "luminance" }}
      >
        <path fill="#fff" d="M233.143 0H0v62.449h233.143V0z" />
      </mask>
      <g mask="url(#close_logo_a)">
        <path
          fill="currentColor"
          d="M117.935 43.475a.39.39 0 00-.271-.125c-.104-.02-.208.031-.281.094-3.736 3.361-8.524 5.204-13.478 5.204-10.804 0-19.588-8.535-19.588-19.026 0-10.492 8.784-18.902 19.588-18.902 4.964 0 9.877 1.915 13.468 5.267a.427.427 0 00.302.104.395.395 0 00.281-.146l1.561-1.998a.388.388 0 00-.052-.53 23.422 23.422 0 00-15.623-5.975c-12.646 0-22.929 9.981-22.929 22.242 0 12.26 10.283 22.305 22.929 22.305 5.725 0 11.449-2.248 15.685-6.162a.392.392 0 00.021-.551l-1.624-1.812.011.01zm12.573-38.656h-2.612a.396.396 0 00-.396.396V51.54c0 .219.177.396.396.396h2.612a.395.395 0 00.395-.396V5.215a.395.395 0 00-.395-.396zm23.98 13.739c-9.523 0-16.434 7.015-16.434 16.684 0 9.67 6.911 16.747 16.434 16.747 9.524 0 16.435-7.047 16.435-16.747s-6.911-16.684-16.435-16.684zm0 30.225c-7.712 0-13.093-5.537-13.093-13.468s5.381-13.468 13.093-13.468c7.713 0 13.094 5.537 13.094 13.468 0 7.93-5.381 13.468-13.094 13.468zm32.432-15.581c-4.423-1.332-8.243-2.477-8.243-6.266 0-3.278 2.893-5.225 7.723-5.225 2.914 0 5.766.802 8.035 2.249a.414.414 0 00.312.052.396.396 0 00.25-.198l1.124-2.123a.4.4 0 00-.146-.52c-2.852-1.739-6.047-2.613-9.502-2.613-5.35 0-11.064 2.248-11.064 8.566 0 6.317 5.599 7.879 10.533 9.419 4.402 1.374 8.566 2.665 8.451 6.734-.239 5.163-6.401 5.558-8.295 5.558-3.997 0-7.869-1.468-10.596-4.017a.362.362 0 00-.322-.104.404.404 0 00-.281.187l-1.187 1.998a.394.394 0 00.063.479c3.049 2.925 7.504 4.6 12.198 4.6 5.391 0 11.688-2.394 11.688-9.138 0-6.745-5.703-8.14-10.741-9.659v.021zm41.196-10.387c-2.738-2.79-6.516-4.257-10.929-4.257-9.419 0-16.247 7.046-16.247 16.746s6.838 16.685 16.247 16.685c5.163 0 9.742-1.884 12.906-5.308a.383.383 0 000-.52l-1.498-1.687a.428.428 0 00-.292-.135c-.094.031-.218.041-.291.125-2.571 2.82-6.37 4.371-10.7 4.371-7.306 0-12.49-4.985-13.01-12.459H232.3a.4.4 0 00.395-.385c.104-5.391-1.53-10.075-4.579-13.187v.01zm-23.731 10.47c.77-6.942 5.87-11.584 12.813-11.584 6.942 0 11.667 4.528 12.312 11.584h-25.125z"
        />
        <path
          fill="#4EC375"
          d="M33.306 48.929C14.634 48.929 0 41.154 0 31.235c0-9.92 14.634-17.694 33.306-17.694 18.672 0 33.306 7.775 33.306 17.694 0 9.919-14.634 17.694-33.306 17.694zm0-30.184c-13.291 0-28.102 5.131-28.102 12.49 0 7.358 14.81 12.49 28.102 12.49 13.291 0 28.102-5.132 28.102-12.49 0-7.359-14.81-12.49-28.102-12.49z"
        />
        <path
          fill="#1463FF"
          d="M44.578 61.46c-8.347 0-19.026-8.254-26.603-21.378-4.299-7.442-6.911-15.3-7.37-22.138-.499-7.494 1.645-13.01 6.038-15.55C21.035-.146 26.895.76 33.129 4.934c5.693 3.82 11.189 10.012 15.488 17.454 9.336 16.174 9.919 32.734 1.332 37.688-1.624.937-3.435 1.384-5.381 1.384h.01zM22.118 6.193c-1.083 0-2.051.229-2.863.708-2.55 1.467-3.81 5.37-3.455 10.7.405 6.057 2.779 13.124 6.682 19.89C29.122 49 40.977 59.263 47.347 55.58c6.37-3.685 3.414-19.068-3.237-30.58-3.903-6.765-8.837-12.354-13.874-15.726-3.019-2.02-5.829-3.06-8.13-3.06l.011-.021z"
        />
        <path
          fill="#FFBC00"
          d="M22.107 61.491c-1.988 0-3.82-.468-5.454-1.415-4.392-2.54-6.547-8.056-6.037-15.55.458-6.838 3.07-14.696 7.37-22.138C27.32 6.214 41.372-2.571 49.958 2.383c8.587 4.965 8.004 21.514-1.332 37.688-4.299 7.442-9.794 13.635-15.487 17.455-3.914 2.623-7.682 3.955-11.033 3.955v.01zM44.36 6.131c-6.62 0-16.164 8.96-21.878 18.849-3.903 6.765-6.276 13.822-6.682 19.89-.354 5.329.905 9.221 3.455 10.7 2.55 1.467 6.547.613 10.991-2.364 5.048-3.382 9.971-8.971 13.874-15.726 6.64-11.512 9.607-26.905 3.237-30.58-.895-.52-1.904-.76-2.997-.76v-.01z"
        />
        <path
          fill="#4EC375"
          d="M33.306 43.725c-13.291 0-28.102-5.132-28.102-12.49H0c0 9.919 14.634 17.694 33.306 17.694v-5.204z"
        />
        <path
          fill="#1463FF"
          d="M34.503 12.656a35.65 35.65 0 00-4.257-3.403c-1.415-.947-2.79-1.686-4.08-2.196l1.728-4.913c1.707.656 3.466 1.582 5.256 2.79a41.285 41.285 0 015.568 4.537l-4.205 3.185h-.01zm4.174 41.976c-2.248-1.207-4.59-3.008-6.86-5.183l-3.986 3.466c2.332 2.259 4.726 4.111 7.099 5.506l3.757-3.789h-.01z"
        />
        <path
          fill="#4EC375"
          d="M57.286 24.865c-5.328-3.788-14.998-6.13-23.98-6.13V13.53c10.46 0 19.65 2.435 25.719 6.328l-1.739 5.006z"
        />
      </g>
    </svg>
  );
}

// ─── Calendly Logo ───────────────────────────────────────────────

function CalendlyLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M27.4166 25.9298C26.1216 27.0554 24.5105 28.4566 21.5764 28.4566H19.8247C17.7043 28.4566 15.7759 27.702 14.3955 26.3307C13.0478 24.9914 12.3043 23.1595 12.3043 21.1702V18.8179C12.3043 16.8286 13.0466 14.9955 14.3955 13.6574C15.7759 12.286 17.7043 11.5314 19.8247 11.5314H21.5764C24.5105 11.5314 26.1216 12.9326 27.4166 14.0582C28.7596 15.2263 29.9199 16.2348 33.0098 16.2348C33.4898 16.2348 33.9605 16.1969 34.4183 16.1245C34.4148 16.1153 34.4113 16.1073 34.4078 16.0981C34.224 15.6513 34.0073 15.2125 33.758 14.7887L31.6914 11.2776C29.7958 8.05585 26.2914 6.07227 22.5002 6.07227H18.367C14.5758 6.07227 11.0714 8.05699 9.17577 11.2776L7.10922 14.7887C5.21359 18.0105 5.21359 21.9787 7.10922 25.1993L9.17577 28.7105C11.0714 31.9322 14.5758 33.9158 18.367 33.9158H22.5002C26.2914 33.9158 29.7958 31.9311 31.6914 28.7105L33.758 25.1993C34.0073 24.7744 34.224 24.3367 34.4078 23.89C34.4113 23.8808 34.4148 23.8727 34.4183 23.8635C33.9605 23.7912 33.491 23.7533 33.0098 23.7533C29.9199 23.7533 28.7596 24.7617 27.4166 25.9298Z"
        fill="#006BFF"
      />
      <path
        d="M21.5767 13.6621H19.825C16.5982 13.6621 14.4766 15.9236 14.4766 18.818V21.1703C14.4766 24.0647 16.597 26.3262 19.825 26.3262H21.5767C26.2788 26.3262 25.91 21.6228 33.0101 21.6228C33.6904 21.6228 34.3624 21.6837 35.0169 21.8031C35.2324 20.6075 35.2324 19.3831 35.0169 18.1863C34.3624 18.3058 33.6904 18.3666 33.0101 18.3666C25.91 18.3655 26.2788 13.6621 21.5767 13.6621Z"
        fill="#006BFF"
      />
      <path
        d="M39.095 23.5203C37.882 22.6428 36.491 22.0708 35.0157 21.8009C35.0134 21.8124 35.0122 21.8239 35.0099 21.8354C34.8834 22.5245 34.6867 23.2033 34.4174 23.8614C35.662 24.059 36.8095 24.5184 37.7895 25.2225C37.786 25.2328 37.7836 25.2432 37.7801 25.2547C37.2146 27.0556 36.3622 28.7532 35.2476 30.298C34.1458 31.8233 32.8145 33.166 31.2889 34.2881C28.1217 36.6186 24.3492 37.8498 20.3776 37.8498C17.9188 37.8498 15.535 37.3778 13.2916 36.4474C11.1243 35.5481 9.17718 34.2605 7.50402 32.6192C5.83086 30.9779 4.51835 29.0679 3.60156 26.9419C2.65317 24.7412 2.17194 22.4028 2.17194 19.9908C2.17194 17.5788 2.65317 15.2403 3.60156 13.0397C4.51835 10.9137 5.83086 9.0036 7.50402 7.3623C9.17718 5.721 11.1243 4.43346 13.2916 3.53414C15.535 2.6038 17.9188 2.13174 20.3776 2.13174C24.3492 2.13174 28.1217 3.36301 31.2889 5.69345C32.8145 6.81559 34.1458 8.15827 35.2476 9.68356C36.3622 11.2284 37.2146 12.926 37.7801 14.7269C37.7836 14.7384 37.7871 14.7487 37.7895 14.7591C36.8095 15.4631 35.662 15.9237 34.4174 16.1201C34.6867 16.7794 34.8846 17.4593 35.0099 18.1485C35.0122 18.16 35.0134 18.1703 35.0157 18.1818C36.491 17.9119 37.8808 17.3399 39.095 16.4624C40.2576 15.6182 40.0328 14.6649 39.856 14.0998C37.293 5.93464 29.542 0 20.3776 0C9.12334 0 0 8.94962 0 19.9896C0 31.0296 9.12334 39.9793 20.3776 39.9793C29.542 39.9793 37.293 34.0446 39.856 25.8795C40.0328 25.3178 40.2588 24.3645 39.095 23.5203Z"
        fill="#006BFF"
      />
      <path
        d="M34.4187 16.1224C33.9609 16.1948 33.4914 16.2327 33.0102 16.2327C29.9203 16.2327 28.76 15.2242 27.417 14.0561C26.122 12.9305 24.5109 11.5293 21.5767 11.5293H19.8251C17.7047 11.5293 15.7763 12.2839 14.3959 13.6553C13.0482 14.9945 12.3047 16.8265 12.3047 18.8158V21.1681C12.3047 23.1574 13.047 24.9905 14.3959 26.3286C15.7763 27.6999 17.7047 28.4546 19.8251 28.4546H21.5767C24.5109 28.4546 26.122 27.0533 27.417 25.9277C28.76 24.7596 29.9203 23.7512 33.0102 23.7512C33.4902 23.7512 33.9609 23.7891 34.4187 23.8614C34.688 23.2033 34.8847 22.5234 35.0112 21.8354C35.0135 21.8239 35.0147 21.8124 35.017 21.8009C34.3625 21.6815 33.6904 21.6206 33.0102 21.6206C25.9101 21.6206 26.2789 26.324 21.5767 26.324H19.8251C16.5983 26.324 14.4766 24.0624 14.4766 21.1681V18.8158C14.4766 15.9214 16.5971 13.6599 19.8251 13.6599H21.5767C26.2789 13.6599 25.9101 18.3633 33.0102 18.3633C33.6904 18.3633 34.3625 18.3024 35.017 18.1829C35.0147 18.1715 35.0135 18.1611 35.0112 18.1496C34.8859 17.4616 34.688 16.7817 34.4187 16.1224Z"
        fill="#0AE8F0"
      />
      <path
        d="M34.4187 16.1224C33.9609 16.1948 33.4914 16.2327 33.0102 16.2327C29.9203 16.2327 28.76 15.2242 27.417 14.0561C26.122 12.9305 24.5109 11.5293 21.5767 11.5293H19.8251C17.7047 11.5293 15.7763 12.2839 14.3959 13.6553C13.0482 14.9945 12.3047 16.8265 12.3047 18.8158V21.1681C12.3047 23.1574 13.047 24.9905 14.3959 26.3286C15.7763 27.6999 17.7047 28.4546 19.8251 28.4546H21.5767C24.5109 28.4546 26.122 27.0533 27.417 25.9277C28.76 24.7596 29.9203 23.7512 33.0102 23.7512C33.4902 23.7512 33.9609 23.7891 34.4187 23.8614C34.688 23.2033 34.8847 22.5234 35.0112 21.8354C35.0135 21.8239 35.0147 21.8124 35.017 21.8009C34.3625 21.6815 33.6904 21.6206 33.0102 21.6206C25.9101 21.6206 26.2789 26.324 21.5767 26.324H19.8251C16.5983 26.324 14.4766 24.0624 14.4766 21.1681V18.8158C14.4766 15.9214 16.5971 13.6599 19.8251 13.6599H21.5767C26.2789 13.6599 25.9101 18.3633 33.0102 18.3633C33.6904 18.3633 34.3625 18.3024 35.017 18.1829C35.0147 18.1715 35.0135 18.1611 35.0112 18.1496C34.8859 17.4616 34.688 16.7817 34.4187 16.1224Z"
        fill="#0AE8F0"
      />
    </svg>
  );
}

// ─── Google Calendar Logo ────────────────────────────────────────

function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M152.637 47.363H47.363v105.274h105.274V47.363z" fill="#fff" />
      <path d="M152.637 200L200 152.637h-47.363V200z" fill="#EA4335" />
      <path d="M200 47.363h-47.363v105.274H200V47.363z" fill="#FBBC04" />
      <path
        d="M152.637 152.637H47.363V200l52.637-26.318L152.637 200v-47.363z"
        fill="#34A853"
      />
      <path d="M0 152.637V200h47.363v-47.363H0z" fill="#188038" />
      <path d="M47.363 47.363V0L0 47.363h47.363z" fill="#1967D2" />
      <path d="M47.363 0v47.363h105.274L100 21.181 47.363 0z" fill="#4285F4" />
      <path d="M0 47.363v105.274h47.363V47.363H0z" fill="#4285F4" />
      <path
        d="M78.438 132.227c-4.675-3.152-7.903-7.754-9.672-13.792l10.834-4.463c1.04 3.96 2.807 7.033 5.301 9.22 2.494 2.186 5.507 3.265 9.013 3.265 3.59 0 6.679-1.147 9.268-3.44 2.59-2.294 3.884-5.178 3.884-8.652 0-3.558-1.352-6.49-4.057-8.8-2.704-2.31-6.084-3.464-10.138-3.464h-6.283v-10.72h5.65c3.59 0 6.603-1.03 9.04-3.09 2.437-2.06 3.655-4.83 3.655-8.31 0-3.134-1.11-5.656-3.33-7.57-2.22-1.912-5.022-2.868-8.406-2.868-3.3 0-5.93.918-7.896 2.752-1.965 1.835-3.384 4.076-4.21 6.627L70.364 74.91c1.36-4.326 3.963-8.116 7.965-11.228 3.894-3.037 8.915-4.622 14.674-4.622 4.39 0 8.368.878 11.894 2.636 3.527 1.758 6.297 4.21 8.31 7.36 2.013 3.148 3.02 6.674 3.02 10.578 0 3.988-.95 7.37-2.848 10.147-1.898 2.777-4.23 4.87-6.997 6.277v.693c3.558 1.495 6.413 3.808 8.637 6.99 2.224 3.182 3.323 6.92 3.323 11.17 0 4.25-1.098 8.076-3.295 11.477-2.196 3.4-5.252 6.075-9.168 8.023-3.916 1.95-8.348 2.923-13.296 2.923-5.684 0-10.827-1.576-15.502-4.728l-.643-.355z"
        fill="#4285F4"
      />
      <path
        d="M141.426 72.082l-11.903 8.598-5.997-9.1 20.964-15.12h8.252v78.27h-11.316V72.082z"
        fill="#4285F4"
      />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────

interface ChatBotLandingProps {
  /** The user's current active tier ID (e.g. "free", "starter"), if any */
  currentTierId?: string | null;
  /** Called after a plan is successfully activated — used to switch to configuration tab */
  onPlanActivated?: () => void;
}

export function ChatBotLanding({
  currentTierId,
  onPlanActivated,
}: ChatBotLandingProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

      {/* ═══════════ CHOOSE YOUR PLAN ═══════════ */}
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
                              {isFree ? "$0" : formatPrice(tier.price_monthly)}
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
                              {tier.runs_per_month.toLocaleString()} leads/month
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
                        Each plan is a monthly lead limit — unique new leads the
                        bot will engage with.
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
