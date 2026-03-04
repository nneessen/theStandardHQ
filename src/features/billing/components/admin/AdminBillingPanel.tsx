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
  Sparkles,
} from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";
import { PlansOverview } from "./PlansOverview";
import { FeatureAssignmentMatrix } from "./FeatureAssignmentMatrix";
import { AddonsManagementPanel } from "./AddonsManagementPanel";
import { TemporaryAccessSettings } from "./TemporaryAccessSettings";
import { SpotlightManager } from "./SpotlightManager";
import {
  useAdminSubscriptionPlans,
  useAdminSubscriptionAddons,
} from "@/hooks/admin";

type AdminTab = "plans" | "features" | "addons" | "access" | "spotlights";

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
    { id: "spotlights", label: "Spotlights", icon: Sparkles },
  ];

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-amber-200 dark:border-amber-800/50">
        {/* Trigger */}
        <Collapsible.Trigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors rounded-lg">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                Admin: Plan Management
              </span>
            </div>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-zinc-400 transition-transform duration-200",
                isOpen && "rotate-90",
              )}
            />
          </button>
        </Collapsible.Trigger>

        {/* Content */}
        <Collapsible.Content>
          <div className="border-t border-amber-200 dark:border-amber-800/50">
            {/* Sub-tabs */}
            <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5 mx-3 mt-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
                      activeTab === tab.id
                        ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
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

              {activeTab === "spotlights" && <SpotlightManager />}
            </div>
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}
