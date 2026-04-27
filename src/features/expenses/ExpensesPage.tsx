// src/features/expenses/ExpensesPage.tsx

import { useState } from "react";
import { Receipt, Target } from "lucide-react";
import { PillNav } from "@/components/v2";
import { ExpenseDashboardCompact } from "./ExpenseDashboardCompact";
import { LeadPurchaseDashboard } from "./leads";

type TabValue = "expenses" | "leads";

export function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("expenses");

  return (
    <div className="flex flex-col gap-3">
      {/* Tab nav — pill-shaped, matches Leaderboard / Dashboard hero */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {activeTab === "expenses" ? (
            <Receipt className="h-4 w-4 text-v2-ink" />
          ) : (
            <Target className="h-4 w-4 text-v2-ink" />
          )}
          <h1 className="text-base font-semibold tracking-tight text-v2-ink">
            {activeTab === "expenses" ? "Expenses" : "Lead Purchases"}
          </h1>
        </div>
        <PillNav
          size="sm"
          activeValue={activeTab}
          onChange={(v) => setActiveTab(v as TabValue)}
          items={[
            { label: "General Expenses", value: "expenses" },
            { label: "Lead Purchases", value: "leads" },
          ]}
        />
      </div>

      {/* Active dashboard */}
      <div className="min-w-0">
        {activeTab === "expenses" && <ExpenseDashboardCompact />}
        {activeTab === "leads" && <LeadPurchaseDashboard />}
      </div>
    </div>
  );
}
