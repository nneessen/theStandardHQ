// src/features/underwriting/components/UWLimitReachedDialog.tsx
// Dialog shown when user has reached their monthly UW Wizard usage limit

import { AlertTriangle, Zap, ArrowUpRight, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import {
  getDaysRemaining,
  type UWWizardUsage,
} from "../../hooks/wizard/useUWWizardUsage";

interface UWLimitReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usage: UWWizardUsage | null;
}

// Tier comparison for upgrade prompts
const TIER_INFO = [
  { id: "starter", name: "Starter", runs: 100, price: "$9.99" },
  { id: "professional", name: "Professional", runs: 500, price: "$24.99" },
];

export function UWLimitReachedDialog({
  open,
  onOpenChange,
  usage,
}: UWLimitReachedDialogProps) {
  const navigate = useNavigate();
  const daysRemaining = getDaysRemaining(usage);

  const currentTier = usage
    ? {
        id: usage.tier_id,
        name: usage.tier_name,
        runs: usage.runs_limit,
        price: "",
      }
    : TIER_INFO[0];
  const currentTierIndex = TIER_INFO.findIndex((t) => t.id === usage?.tier_id);
  const upgradeTiers =
    currentTierIndex >= 0 ? TIER_INFO.slice(currentTierIndex + 1) : [];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate({ to: "/billing" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-lg">Monthly Limit Reached</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            You've used all {usage?.runs_limit || 0} runs included in your{" "}
            <span className="font-medium">{currentTier.name}</span> plan this
            month.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Usage */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Usage This Month</span>
            </div>
            <Badge variant="destructive" className="text-xs">
              {usage?.runs_used || 0} / {usage?.runs_limit || 0}
            </Badge>
          </div>

          {/* Days Until Reset */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-v2-ink-muted" />
              <span className="text-sm font-medium">Resets In</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Upgrade Options */}
          {upgradeTiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Upgrade for more runs
              </p>
              <div className="space-y-2">
                {upgradeTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                  >
                    <div>
                      <p className="text-sm font-medium">{tier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tier.runs} runs/month
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{tier.price}</p>
                      <p className="text-[10px] text-muted-foreground">
                        /month
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Close
          </Button>
          {upgradeTiers.length > 0 && (
            <Button
              onClick={handleUpgrade}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              Upgrade Plan
              <ArrowUpRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
