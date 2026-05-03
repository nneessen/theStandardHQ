// src/features/billing/components/admin/PlansOverview.tsx
// Plans table with stats, refactored from SubscriptionPlansTab

import { useState } from "react";
import { Plus, Edit2, Users, Mail, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminSubscriptionAddons,
  type SubscriptionPlan,
} from "@/hooks/admin";
import { PlanEditorDialog } from "./PlanEditorDialog";
import { CreatePlanDialog } from "./CreatePlanDialog";
import { cn } from "@/lib/utils";

interface PlansOverviewProps {
  plans: SubscriptionPlan[];
}

export function PlansOverview({ plans }: PlansOverviewProps) {
  const { data: addons } = useAdminSubscriptionAddons();

  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(0)}`;
  };

  // Sort plans: active first, then by sort_order
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.sort_order - b.sort_order;
  });

  const activePlans = sortedPlans.filter((p) => p.is_active);
  const inactivePlans = sortedPlans.filter((p) => !p.is_active);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {activePlans.length} active
          </Badge>
          {inactivePlans.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {inactivePlans.length} inactive
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Plan
        </Button>
      </div>

      {/* Plans Table */}
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-v2-canvas">
              <TableHead className="text-[11px] font-semibold w-8">#</TableHead>
              <TableHead className="text-[11px] font-semibold">Plan</TableHead>
              <TableHead className="text-[11px] font-semibold text-center">
                Status
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-right">
                Monthly
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-right">
                Annual
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-center">
                <Mail className="h-3 w-3 inline mr-1" />
                Emails
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-center">
                <Users className="h-3 w-3 inline mr-1" />
                Team Limit
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-center">
                <BarChart3 className="h-3 w-3 inline mr-1" />
                Features
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPlans.map((plan) => {
              const featureCount = Object.values(plan.features || {}).filter(
                Boolean,
              ).length;
              const analyticsCount = plan.analytics_sections?.length || 0;

              return (
                <TableRow
                  key={plan.id}
                  className={cn(
                    "group",
                    !plan.is_active &&
                      "opacity-50 bg-v2-canvas dark:bg-v2-card-dark",
                  )}
                >
                  <TableCell className="text-[11px] text-v2-ink-subtle font-mono">
                    {plan.sort_order}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-sm font-semibold text-v2-ink">
                          {plan.display_name}
                        </div>
                        <div className="text-[10px] text-v2-ink-muted font-mono">
                          {plan.name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {plan.is_active ? (
                      <Badge className="bg-success/20 text-success dark:bg-success/30 dark:text-success text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-semibold">
                      {formatPrice(plan.price_monthly)}
                    </span>
                    {plan.price_monthly > 0 && (
                      <span className="text-[10px] text-v2-ink-muted">/mo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm">
                      {formatPrice(plan.price_annual)}
                    </span>
                    {plan.price_annual > 0 && plan.price_monthly > 0 && (
                      <span className="text-[10px] text-success ml-1">
                        (
                        {Math.round(
                          (1 - plan.price_annual / (plan.price_monthly * 12)) *
                            100,
                        )}
                        % off)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs">
                      {plan.email_limit === 0
                        ? "—"
                        : plan.email_limit === -1
                          ? "∞"
                          : plan.email_limit.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs">
                      {plan.team_size_limit === null
                        ? "∞"
                        : plan.team_size_limit === 0
                          ? "—"
                          : plan.team_size_limit}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs font-medium">
                        {featureCount}
                      </span>
                      <span className="text-[10px] text-v2-ink-subtle">/</span>
                      <span className="text-xs text-v2-ink-muted">
                        {analyticsCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setEditingPlan(plan);
                        setIsEditorOpen(true);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="text-[10px] text-v2-ink-muted uppercase tracking-wide mb-1">
            Active Plans
          </div>
          <div className="text-2xl font-bold text-v2-ink">
            {activePlans.length}
          </div>
        </div>
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="text-[10px] text-v2-ink-muted uppercase tracking-wide mb-1">
            Total Features
          </div>
          <div className="text-2xl font-bold text-v2-ink">
            {Object.keys(activePlans[0]?.features || {}).length}
          </div>
        </div>
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <div className="text-[10px] text-v2-ink-muted uppercase tracking-wide mb-1">
            Add-ons Available
          </div>
          <div className="text-2xl font-bold text-v2-ink">
            {addons?.filter((a) => a.is_active).length || 0}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <PlanEditorDialog
        plan={editingPlan}
        open={isEditorOpen}
        onOpenChange={(open) => {
          setIsEditorOpen(open);
          if (!open) setEditingPlan(null);
        }}
      />

      <CreatePlanDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        existingPlans={plans}
      />
    </div>
  );
}
