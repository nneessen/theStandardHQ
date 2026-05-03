// src/features/billing/components/admin/AdminBillingPanel.tsx
// Super-admin collapsible panel for plan/feature/addon management

import { useState } from "react";
import {
  Shield,
  ChevronRight,
  Settings,
  Check,
  Package,
  Clock,
} from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";
import { PlansOverview } from "./PlansOverview";
import { FeatureAssignmentMatrix } from "./FeatureAssignmentMatrix";
import { AddonsManagementPanel } from "./AddonsManagementPanel";
import { TemporaryAccessSettings } from "./TemporaryAccessSettings";
import {
  useAdminSubscriptionPlans,
  useAdminSubscriptionAddons,
} from "@/hooks/admin";

type AdminTab = "plans" | "features" | "addons" | "access";

export function AdminBillingPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("plans");

  const { data: plans } = useAdminSubscriptionPlans();
  const { data: addons } = useAdminSubscriptionAddons();

  const activePlans = plans?.filter((p) => p.is_active) || [];

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "plans", label: "Plans", icon: Settings },
    { id: "features", label: "Features", icon: Check },
    { id: "addons", label: "Add-ons", icon: Package },
    { id: "access", label: "Temp Access", icon: Clock },
  ];

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-v2-card rounded-lg border border-warning/30/50">
        {/* Trigger */}
        <Collapsible.Trigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2 hover:bg-warning/10/50 dark:hover:bg-warning/10 transition-colors rounded-lg">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-warning" />
              <span className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                Admin: Plan Management
              </span>
            </div>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-v2-ink-subtle transition-transform duration-200",
                isOpen && "rotate-90",
              )}
            />
          </button>
        </Collapsible.Trigger>

        {/* Content */}
        <Collapsible.Content>
          <div className="border-t border-warning/30/50">
            {/* Sub-tabs */}
            <div className="flex items-center gap-0.5 bg-v2-canvas rounded-md p-0.5 mx-3 mt-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
                      activeTab === tab.id
                        ? "bg-v2-card shadow-sm text-v2-ink"
                        : "text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-3">
              {activeTab === "plans" && <PlansOverview plans={plans || []} />}

              {activeTab === "features" && activePlans.length > 0 && (
                <FeatureAssignmentMatrix plans={activePlans} />
              )}

              {activeTab === "addons" && (
                <AddonsManagementPanel addons={addons || []} />
              )}

              {activeTab === "access" && <TemporaryAccessSettings />}
            </div>
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}
