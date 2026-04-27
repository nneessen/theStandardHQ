// src/features/billing/components/admin/PlanEditorDialog.tsx
// Dialog for editing subscription plan details

import { useState, useEffect } from "react";
import { Loader2, Save, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useUpdatePlanPricing,
  useUpdatePlanLimits,
  useUpdatePlanMetadata,
  usePlanChangeHistory,
  type SubscriptionPlan,
} from "@/hooks/admin";

interface PlanEditorDialogProps {
  plan: SubscriptionPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanEditorDialog({
  plan,
  open,
  onOpenChange,
}: PlanEditorDialogProps) {
  // Form state
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceAnnual, setPriceAnnual] = useState(0);
  const [emailLimit, setEmailLimit] = useState(0);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [teamSizeLimit, setTeamSizeLimit] = useState<number | null>(null);
  const [stripePriceMonthly, setStripePriceMonthly] = useState("");
  const [stripePriceAnnual, setStripePriceAnnual] = useState("");

  // Mutations
  const updatePricing = useUpdatePlanPricing();
  const updateLimits = useUpdatePlanLimits();
  const updateMetadata = useUpdatePlanMetadata();

  // History
  const { data: history, isLoading: historyLoading } = usePlanChangeHistory(
    plan?.id || "",
  );

  // Initialize form when plan changes
  useEffect(() => {
    if (plan) {
      setDisplayName(plan.display_name);
      setDescription(plan.description || "");
      setPriceMonthly(plan.price_monthly);
      setPriceAnnual(plan.price_annual);
      setEmailLimit(plan.email_limit);
      setSmsEnabled(plan.sms_enabled);
      setTeamSizeLimit(plan.team_size_limit);
      setStripePriceMonthly(plan.stripe_price_id_monthly || "");
      setStripePriceAnnual(plan.stripe_price_id_annual || "");
    }
  }, [plan]);

  if (!plan) return null;

  const handleSaveMetadata = async () => {
    await updateMetadata.mutateAsync({
      planId: plan.id,
      displayName,
      description: description || undefined,
      stripePriceIdMonthly: stripePriceMonthly || null,
      stripePriceIdAnnual: stripePriceAnnual || null,
    });
    onOpenChange(false);
  };

  const handleSavePricing = async () => {
    await updatePricing.mutateAsync({
      planId: plan.id,
      priceMonthly,
      priceAnnual,
    });
    onOpenChange(false);
  };

  const handleSaveLimits = async () => {
    await updateLimits.mutateAsync({
      planId: plan.id,
      emailLimit,
      smsEnabled,
      teamSizeLimit,
    });
    onOpenChange(false);
  };

  const formatChangeDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isSaving =
    updatePricing.isPending ||
    updateLimits.isPending ||
    updateMetadata.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Plan: {plan.display_name}
            <Badge variant="outline" className="text-[10px] uppercase">
              {plan.name}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="info" className="text-xs">
              Info & Integration
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs">
              Pricing
            </TabsTrigger>
            <TabsTrigger value="limits" className="text-xs">
              Limits
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs">
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-sm resize-none"
                rows={3}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-xs font-medium text-v2-ink-muted mb-3">
                Stripe Integration
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stripePriceMonthly" className="text-xs">
                    Stripe Monthly Price ID
                  </Label>
                  <Input
                    id="stripePriceMonthly"
                    value={stripePriceMonthly}
                    onChange={(e) => setStripePriceMonthly(e.target.value)}
                    className="h-8 text-sm font-mono"
                    placeholder="e.g., price_1Abc..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripePriceAnnual" className="text-xs">
                    Stripe Annual Price ID
                  </Label>
                  <Input
                    id="stripePriceAnnual"
                    value={stripePriceAnnual}
                    onChange={(e) => setStripePriceAnnual(e.target.value)}
                    className="h-8 text-sm font-mono"
                    placeholder="e.g., price_1Def..."
                  />
                </div>
              </div>
              <p className="text-[10px] text-v2-ink-muted mt-2">
                These IDs link this plan to Stripe prices for checkout.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveMetadata}
                disabled={isSaving}
                size="sm"
                className="text-xs"
              >
                {updateMetadata.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save Info
              </Button>
            </div>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceMonthly" className="text-xs">
                  Monthly Price (cents)
                </Label>
                <Input
                  id="priceMonthly"
                  type="number"
                  value={priceMonthly}
                  onChange={(e) =>
                    setPriceMonthly(parseInt(e.target.value) || 0)
                  }
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-v2-ink-muted">
                  ${(priceMonthly / 100).toFixed(2)} / month
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceAnnual" className="text-xs">
                  Annual Price (cents)
                </Label>
                <Input
                  id="priceAnnual"
                  type="number"
                  value={priceAnnual}
                  onChange={(e) =>
                    setPriceAnnual(parseInt(e.target.value) || 0)
                  }
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-v2-ink-muted">
                  ${(priceAnnual / 100).toFixed(2)} / year
                </p>
              </div>
            </div>

            {priceMonthly > 0 && priceAnnual > 0 && (
              <div className="p-3 bg-v2-ring rounded-md">
                <p className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle">
                  Annual savings:{" "}
                  <span className="font-semibold text-emerald-600">
                    {Math.round((1 - priceAnnual / (priceMonthly * 12)) * 100)}%
                  </span>{" "}
                  (${((priceMonthly * 12 - priceAnnual) / 100).toFixed(2)}/year)
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSavePricing}
                disabled={isSaving}
                size="sm"
                className="text-xs"
              >
                {updatePricing.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save Pricing
              </Button>
            </div>
          </TabsContent>

          {/* Limits Tab */}
          <TabsContent value="limits" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="emailLimit" className="text-xs">
                Monthly Email Limit
              </Label>
              <Input
                id="emailLimit"
                type="number"
                value={emailLimit}
                onChange={(e) => setEmailLimit(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-v2-ink-muted">
                0 = no email access, -1 = unlimited
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="smsEnabled" className="text-xs">
                  SMS Enabled
                </Label>
                <p className="text-[10px] text-v2-ink-muted">
                  Allow SMS messaging for this plan
                </p>
              </div>
              <Switch
                id="smsEnabled"
                checked={smsEnabled}
                onCheckedChange={setSmsEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamSizeLimit" className="text-xs">
                Team Size Limit
              </Label>
              <Input
                id="teamSizeLimit"
                type="number"
                value={teamSizeLimit ?? ""}
                onChange={(e) =>
                  setTeamSizeLimit(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }
                className="h-8 text-sm"
                placeholder="No limit"
              />
              <p className="text-[10px] text-v2-ink-muted">
                Leave empty for no limit
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveLimits}
                disabled={isSaving}
                size="sm"
                className="text-xs"
              >
                {updateLimits.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save Limits
              </Button>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            {historyLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
              </div>
            ) : history && history.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {history.map((change) => (
                    <div
                      key={change.id}
                      className="p-2 border border-v2-ring rounded-md"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          {change.change_type}
                        </Badge>
                        <span className="text-[10px] text-v2-ink-muted">
                          {formatChangeDate(change.created_at || "")}
                        </span>
                      </div>
                      <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                        Changed by:{" "}
                        {change.changer
                          ? `${change.changer.first_name} ${change.changer.last_name}`
                          : "Unknown"}
                      </p>
                      {change.notes && (
                        <p className="text-[10px] text-v2-ink-muted mt-1">
                          {change.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-v2-ink-muted text-sm">
                No change history yet
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
