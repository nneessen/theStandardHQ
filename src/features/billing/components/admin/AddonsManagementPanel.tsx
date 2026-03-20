// src/features/billing/components/admin/AddonsManagementPanel.tsx
// Panel for managing subscription add-ons (e.g., UW Wizard)

import { useState, useEffect } from "react";
import { Package, Settings, Users, Loader2, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useUpdateAddon,
  useAddonUsers,
  type SubscriptionAddon,
} from "@/hooks/admin";
import { PREMIUM_VOICE_ADDON_NAME } from "@/lib/subscription/voice-addon";
// eslint-disable-next-line no-restricted-imports
import { adminSubscriptionService } from "@/services/subscription";
import { AddonTierEditor, type TierConfig } from "./AddonTierEditor";
import { toast } from "sonner";

interface AddonsManagementPanelProps {
  addons: SubscriptionAddon[];
}

export function AddonsManagementPanel({ addons }: AddonsManagementPanelProps) {
  const [editingAddon, setEditingAddon] = useState<SubscriptionAddon | null>(
    null,
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Add-on Cards */}
      <div className="grid grid-cols-2 gap-4">
        {addons.map((addon) => (
          <AddonCard
            key={addon.id}
            addon={addon}
            onEdit={() => {
              setEditingAddon(addon);
              setIsEditorOpen(true);
            }}
          />
        ))}

        {addons.length === 0 && (
          <div className="col-span-2 text-center py-12 text-zinc-500">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No add-ons configured</p>
          </div>
        )}
      </div>

      {/* Add-on Editor Dialog */}
      <AddonEditorDialog
        addon={editingAddon}
        open={isEditorOpen}
        onOpenChange={(open) => {
          setIsEditorOpen(open);
          if (!open) setEditingAddon(null);
        }}
      />
    </div>
  );
}

// ============================================
// Add-on Card Component
// ============================================

interface AddonCardProps {
  addon: SubscriptionAddon;
  onEdit: () => void;
}

interface VoiceSnapshotSummary {
  status?: string;
  includedMinutes?: number;
  usage?: {
    usedMinutes?: number;
    remainingMinutes?: number;
  };
}

function parseVoiceSnapshot(value: unknown): VoiceSnapshotSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as VoiceSnapshotSummary;
}

function formatSyncTime(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

function AddonCard({ addon, onEdit }: AddonCardProps) {
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const { data: users, isLoading: usersLoading } = useAddonUsers(addon.id);
  const isPremiumVoice = addon.name === PREMIUM_VOICE_ADDON_NAME;

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <Card
      className={`${
        !addon.is_active
          ? "opacity-60 border-zinc-300 dark:border-zinc-700"
          : "border-purple-200 dark:border-purple-800"
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-purple-500" />
            {addon.display_name}
          </CardTitle>
          {!addon.is_active && (
            <Badge variant="destructive" className="text-[9px]">
              Inactive
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-zinc-500">
          {addon.description || "No description"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pricing */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold">
            {formatPrice(addon.price_monthly)}
          </span>
          {addon.price_monthly > 0 && (
            <span className="text-xs text-zinc-500">/month</span>
          )}
        </div>
        {addon.price_annual > 0 && (
          <p className="text-[10px] text-zinc-500">
            {formatPrice(addon.price_annual)}/year (
            {Math.round(
              (1 - addon.price_annual / (addon.price_monthly * 12)) * 100,
            )}
            % off)
          </p>
        )}

        {/* Users with add-on */}
        <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs justify-between"
            >
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {usersLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  `${users?.length || 0} users`
                )}
              </span>
              <span className="text-[10px] text-zinc-400">
                {isUsersOpen ? "Hide" : "Show"}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {users && users.length > 0 ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {users.map((user) => (
                  <div
                    key={user.userId}
                    className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[10px] dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                          {user.fullName}
                        </div>
                        <div className="truncate text-[9px] text-zinc-500 dark:text-zinc-400">
                          {user.email || user.userId}
                        </div>
                        {isPremiumVoice && (
                          <>
                            <div className="truncate pt-1 font-mono text-[9px] text-zinc-500 dark:text-zinc-400">
                              Agent: {user.standardChatBotAgentId || "Unmapped"}
                            </div>
                            {(user.voiceLastSyncedAt ||
                              user.voiceLastSyncAttemptAt) && (
                              <div className="pt-0.5 text-[9px] text-zinc-500 dark:text-zinc-400">
                                {user.voiceLastSyncedAt
                                  ? `Last synced ${formatSyncTime(user.voiceLastSyncedAt)}`
                                  : `Last attempt ${formatSyncTime(user.voiceLastSyncAttemptAt)}`}
                              </div>
                            )}
                            {(() => {
                              const snapshot = parseVoiceSnapshot(
                                user.voiceEntitlementSnapshot,
                              );
                              if (!snapshot) return null;
                              return (
                                <div className="pt-0.5 text-[9px] text-zinc-500 dark:text-zinc-400">
                                  Entitlement: {snapshot.status || "unknown"}
                                  {typeof snapshot.includedMinutes === "number"
                                    ? ` • ${snapshot.includedMinutes} min`
                                    : ""}
                                  {typeof snapshot.usage?.usedMinutes ===
                                  "number"
                                    ? ` • ${snapshot.usage.usedMinutes} used`
                                    : ""}
                                  {typeof snapshot.usage?.remainingMinutes ===
                                  "number"
                                    ? ` • ${snapshot.usage.remainingMinutes} left`
                                    : ""}
                                </div>
                              );
                            })()}
                            {user.voiceLastSyncError && (
                              <div className="pt-1 text-[9px] text-red-600 dark:text-red-400">
                                {user.voiceLastSyncError}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant={
                            user.status === "manual_grant"
                              ? "secondary"
                              : "default"
                          }
                          className="text-[9px]"
                        >
                          {user.status === "manual_grant" ? "Manual" : "Paid"}
                        </Badge>
                        {isPremiumVoice && (
                          <Badge
                            variant="outline"
                            className="text-[9px] capitalize"
                          >
                            {user.voiceSyncStatus || "pending"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-500 text-center py-2">
                No users with this add-on
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Edit button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-7"
          onClick={onEdit}
        >
          <Settings className="h-3 w-3 mr-1" />
          Configure
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// Add-on Editor Dialog
// ============================================

interface AddonEditorDialogProps {
  addon: SubscriptionAddon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddonEditorDialog({
  addon,
  open,
  onOpenChange,
}: AddonEditorDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceAnnual, setPriceAnnual] = useState(0);
  const [stripePriceMonthly, setStripePriceMonthly] = useState("");
  const [stripePriceAnnual, setStripePriceAnnual] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [tierConfig, setTierConfig] = useState<TierConfig | null>(null);
  const [isSettingUpStripe, setIsSettingUpStripe] = useState(false);

  const updateAddon = useUpdateAddon();

  // Re-initialize form state when addon prop changes or dialog opens
  useEffect(() => {
    if (addon && open) {
      setDisplayName(addon.display_name);
      setDescription(addon.description || "");
      setPriceMonthly(addon.price_monthly);
      setPriceAnnual(addon.price_annual);
      setStripePriceMonthly(addon.stripe_price_id_monthly || "");
      setStripePriceAnnual(addon.stripe_price_id_annual || "");
      setIsActive(addon.is_active ?? true);
      const rawTierConfig = (addon as { tier_config?: TierConfig | null })
        .tier_config;
      setTierConfig(rawTierConfig || null);
    }
  }, [addon, open]);

  if (!addon) return null;

  // Check if this addon has tiers configured
  const supportsTiers = !!tierConfig?.tiers && tierConfig.tiers.length > 0;

  const handleSetupStripeProducts = async () => {
    setIsSettingUpStripe(true);
    try {
      const data = await adminSubscriptionService.setupAddonStripeProducts(
        addon.name,
      );

      toast.success("Stripe products and prices created successfully");

      if (data?.results) {
        const updatedTiers = tierConfig?.tiers.map((tier) => {
          const result = data.results.find((r) => r.tierId === tier.id);
          if (result) {
            return {
              ...tier,
              stripe_price_id_monthly:
                result.monthlyPriceId || tier.stripe_price_id_monthly,
              stripe_price_id_annual:
                result.annualPriceId || tier.stripe_price_id_annual,
            };
          }
          return tier;
        });
        if (updatedTiers) {
          setTierConfig({ tiers: updatedTiers });
        }
      }
    } catch (err) {
      toast.error(
        `Stripe setup failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsSettingUpStripe(false);
    }
  };

  // Check if any paid tiers are missing Stripe price IDs
  const hasMissingPriceIds =
    supportsTiers &&
    tierConfig?.tiers.some(
      (t) =>
        (t.price_monthly > 0 || t.price_annual > 0) &&
        (!t.stripe_price_id_monthly || !t.stripe_price_id_annual),
    );

  const handleSave = async () => {
    await updateAddon.mutateAsync({
      addonId: addon.id,
      params: {
        displayName,
        description: description || undefined,
        priceMonthly,
        priceAnnual,
        stripePriceIdMonthly: stripePriceMonthly || null,
        stripePriceIdAnnual: stripePriceAnnual || null,
        isActive,
        tierConfig: supportsTiers ? tierConfig : (tierConfig ?? undefined),
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-purple-500" />
            Configure: {addon.display_name}
            <Badge variant="outline" className="text-[10px] font-mono">
              {addon.name}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* Top section: 2-column layout for basic fields */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {/* Left column */}
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="addonDisplayName" className="text-[11px]">
                  Display Name
                </Label>
                <Input
                  id="addonDisplayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="addonDescription" className="text-[11px]">
                  Description
                </Label>
                <Textarea
                  id="addonDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs resize-none h-[52px]"
                  rows={2}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="addonPriceMonthly" className="text-[11px]">
                    Monthly (cents)
                  </Label>
                  <Input
                    id="addonPriceMonthly"
                    type="number"
                    value={priceMonthly}
                    onChange={(e) =>
                      setPriceMonthly(parseInt(e.target.value) || 0)
                    }
                    className="h-7 text-xs"
                  />
                  <p className="text-[9px] text-zinc-500">
                    ${(priceMonthly / 100).toFixed(2)}/mo
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="addonPriceAnnual" className="text-[11px]">
                    Annual (cents)
                  </Label>
                  <Input
                    id="addonPriceAnnual"
                    type="number"
                    value={priceAnnual}
                    onChange={(e) =>
                      setPriceAnnual(parseInt(e.target.value) || 0)
                    }
                    className="h-7 text-xs"
                  />
                  <p className="text-[9px] text-zinc-500">
                    ${(priceAnnual / 100).toFixed(2)}/yr
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="addonStripeMonthly" className="text-[11px]">
                    Stripe Monthly ID
                  </Label>
                  <Input
                    id="addonStripeMonthly"
                    value={stripePriceMonthly}
                    onChange={(e) => setStripePriceMonthly(e.target.value)}
                    className="h-7 text-[10px] font-mono"
                    placeholder="price_..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="addonStripeAnnual" className="text-[11px]">
                    Stripe Annual ID
                  </Label>
                  <Input
                    id="addonStripeAnnual"
                    value={stripePriceAnnual}
                    onChange={(e) => setStripePriceAnnual(e.target.value)}
                    className="h-7 text-[10px] font-mono"
                    placeholder="price_..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tier Configuration — full width */}
          {supportsTiers && (
            <div className="border-t pt-3">
              <AddonTierEditor
                addonName={addon.name}
                tierConfig={tierConfig}
                onChange={setTierConfig}
              />

              {hasMissingPriceIds && (
                <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 flex-1">
                    Paid tiers missing Stripe price IDs.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                    onClick={handleSetupStripeProducts}
                    disabled={isSettingUpStripe}
                  >
                    {isSettingUpStripe ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    {isSettingUpStripe
                      ? "Creating..."
                      : "Setup Stripe Products"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Footer: Active toggle + Save */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-3">
              <Switch
                id="addonActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="addonActive" className="text-xs cursor-pointer">
                {isActive ? "Active" : "Inactive"}
              </Label>
            </div>
            <Button
              onClick={handleSave}
              disabled={updateAddon.isPending}
              size="sm"
              className="text-xs"
            >
              {updateAddon.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
