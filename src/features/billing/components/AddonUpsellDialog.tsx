// src/features/billing/components/AddonUpsellDialog.tsx
// Dialog shown when user selects a paid plan — currently bypasses addon upsell
// since UW Wizard Stripe integration is not ready yet.

import { useState, useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
// eslint-disable-next-line no-restricted-imports
import { subscriptionService } from "@/services/subscription";
// eslint-disable-next-line no-restricted-imports
import type { SubscriptionPlan } from "@/services/subscription";

interface AddonUpsellDialogProps {
  plan: SubscriptionPlan | null;
  billingInterval: "monthly" | "annual";
  discountCode?: string;
  onClose: () => void;
}

export function AddonUpsellDialog({
  plan,
  billingInterval,
  discountCode,
  onClose,
}: AddonUpsellDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const open = !!plan;

  // UW Wizard addon upsell hidden until Stripe integration is ready.
  // Auto-proceed to checkout when dialog opens.
  useEffect(() => {
    if (!open || !plan || !user?.id || isLoading) return;

    const proceedToCheckout = async () => {
      setIsLoading(true);
      try {
        const checkoutUrl = await subscriptionService.createCheckoutSession(
          plan,
          billingInterval,
          discountCode,
        );
        if (checkoutUrl) {
          window.open(checkoutUrl, "_blank");
        } else {
          toast.error("Failed to create checkout session. Please try again.");
        }
      } catch {
        toast.error("Failed to create checkout session. Please try again.");
      } finally {
        setIsLoading(false);
        onClose();
      }
    };

    proceedToCheckout();
  }, [open, plan, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show a brief loading dialog while checkout session is created
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Setting Up Checkout</DialogTitle>
          <DialogDescription className="text-[11px]">
            Redirecting you to Stripe...
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-6">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle" />
          ) : (
            <Button size="sm" className="text-[11px]" onClick={onClose}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
