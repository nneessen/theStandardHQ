// src/features/expenses/ExpensesPage.tsx

import { useState } from "react";
import { PillNav, SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { ExpenseDashboardCompact } from "./ExpenseDashboardCompact";
import { LeadPurchaseDashboard } from "./leads";

type TabValue = "expenses" | "leads";

export function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("expenses");

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Departure-board header — eyebrow + title + tab nav */}
          <header className="flex items-end justify-between gap-3 flex-wrap">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>SPEND TRACKING</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
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
          </header>

          {/* Active dashboard */}
          <div className="min-w-0">
            {activeTab === "expenses" && <ExpenseDashboardCompact />}
            {activeTab === "leads" && <LeadPurchaseDashboard />}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
