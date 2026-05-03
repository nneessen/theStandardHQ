// src/features/billing/components/admin/CreatePlanDialog.tsx
// Dialog for creating a new subscription plan

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePlan, type SubscriptionPlan } from "@/hooks/admin";

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPlans: SubscriptionPlan[];
}

export function CreatePlanDialog({
  open,
  onOpenChange,
  existingPlans,
}: CreatePlanDialogProps) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [priceAnnual, setPriceAnnual] = useState(0);

  const createPlan = useCreatePlan();

  const handleCreate = async () => {
    if (!name || !displayName) return;

    // Calculate sort order (add to end)
    const maxSortOrder = Math.max(...existingPlans.map((p) => p.sort_order), 0);

    await createPlan.mutateAsync({
      name: name.toLowerCase().replace(/\s+/g, "_"),
      displayName,
      description: description || undefined,
      priceMonthly,
      priceAnnual,
      sortOrder: maxSortOrder + 1,
    });

    // Reset form and close
    setName("");
    setDisplayName("");
    setDescription("");
    setPriceMonthly(0);
    setPriceAnnual(0);
    onOpenChange(false);
  };

  const nameExists = existingPlans.some(
    (p) => p.name.toLowerCase() === name.toLowerCase().replace(/\s+/g, "_"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Plan</DialogTitle>
          <DialogDescription className="text-xs">
            Add a new subscription tier. Features can be configured after
            creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs">
                Plan ID (internal)
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm font-mono"
                placeholder="e.g., enterprise"
              />
              {nameExists && (
                <p className="text-[10px] text-destructive">
                  A plan with this name already exists
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs">
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g., Enterprise"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs">
              Description (optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm resize-none"
              rows={2}
              placeholder="Brief description of this plan..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceMonthly" className="text-xs">
                Monthly Price (cents)
              </Label>
              <Input
                id="priceMonthly"
                type="number"
                value={priceMonthly}
                onChange={(e) => setPriceMonthly(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
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
                onChange={(e) => setPriceAnnual(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                ${(priceAnnual / 100).toFixed(2)} / year
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !name || !displayName || nameExists || createPlan.isPending
              }
              size="sm"
              className="text-xs"
            >
              {createPlan.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Create Plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
